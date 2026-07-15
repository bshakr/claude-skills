import argparse
import hashlib
import json
import re
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


REQUIRED_FILES = (
    "package.json",
    "scripts/validate-content.ts",
    "src/content/preview-manifest.json",
    "src/content/report-data.json",
    "src/content/source.md",
    "src/lib/provenance.ts",
    "src/lib/source.ts",
    "src/main.tsx",
    "src/report.mdx",
)
REQUIRED_MANIFEST_FIELDS = (
    "slug",
    "source_filename",
    "source_path",
    "source_sha256",
)
EXPECTED_PACKAGE_VERSIONS = {
    "dependencies": {
        "@mdx-js/react": "3.1.1",
        "react": "19.2.7",
        "react-dom": "19.2.7",
        "react-markdown": "10.1.0",
        "rehype-raw": "7.0.0",
        "rehype-sanitize": "6.0.0",
        "remark-gfm": "4.0.1",
        "remark-parse": "11.0.0",
        "unified": "11.0.5",
        "unist-util-visit": "5.1.0",
    },
    "devDependencies": {
        "@mdx-js/rollup": "3.1.1",
        "@types/node": "26.1.1",
        "@types/react": "19.2.17",
        "@types/react-dom": "19.2.3",
        "@vitejs/plugin-react": "6.0.3",
        "typescript": "7.0.2",
        "tsx": "4.23.1",
        "vite": "8.1.4",
        "vitest": "4.1.1",
    },
}
PLACEHOLDER_PATTERNS = (
    re.compile(r"\{\{[^{}]+\}\}"),
    re.compile(r"\[\[[^\[\]]+\]\]"),
    re.compile(r"\b(?:TODO|TBD)\b"),
    re.compile(r"__[A-Z][A-Z0-9_]*__"),
)


@dataclass(frozen=True)
class ValidationReport:
    source_sha256: str
    source_nodes: int
    coverage_percent: int
    visuals: int
    tests_passed: bool
    build_passed: bool


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text())
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError(f"Invalid JSON file: {path}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return value


def _validate_required_files(preview: Path) -> None:
    for relative_path in REQUIRED_FILES:
        if not (preview / relative_path).is_file():
            raise ValueError(f"Missing required file: {relative_path}")


def _validate_manifest(preview: Path) -> tuple[dict[str, Any], str]:
    manifest = _read_json(preview / "src/content/preview-manifest.json")
    for field in REQUIRED_MANIFEST_FIELDS:
        if not isinstance(manifest.get(field), str) or not manifest[field].strip():
            raise ValueError(f"Missing manifest field: {field}")

    expected_digest = manifest["source_sha256"]
    if not re.fullmatch(r"[0-9a-f]{64}", expected_digest):
        raise ValueError("Invalid manifest field: source_sha256")
    actual_digest = hashlib.sha256(
        (preview / "src/content/source.md").read_bytes()
    ).hexdigest()
    if actual_digest != expected_digest:
        raise ValueError(
            f"Source digest mismatch: expected {expected_digest}, got {actual_digest}"
        )
    return manifest, actual_digest


def _validate_authored_content(preview: Path) -> None:
    report = (preview / "src/report.mdx").read_text()
    if "<CompleteDocument" not in report:
        raise ValueError("CompleteDocument is required in src/report.mdx")

    main = (preview / "src/main.tsx").read_text()
    if "source.md?raw" not in main:
        raise ValueError("Canonical source must use a raw source.md?raw import")
    if not re.search(r"\bsource\s*=\s*\{\s*source\s*\}", main):
        raise ValueError("Raw canonical source must be passed to the report")

    for relative_path in ("src/report.mdx", "src/content/report-data.json"):
        text = (preview / relative_path).read_text()
        for pattern in PLACEHOLDER_PATTERNS:
            placeholder = pattern.search(text)
            if placeholder:
                raise ValueError(
                    f"Unresolved placeholder in {relative_path}: {placeholder.group(0)}"
                )


def _validate_package_versions(preview: Path) -> None:
    package = _read_json(preview / "package.json")
    for section, expected_packages in EXPECTED_PACKAGE_VERSIONS.items():
        actual_packages = package.get(section)
        if not isinstance(actual_packages, dict):
            raise ValueError(f"Missing package section: {section}")
        for name, expected_version in expected_packages.items():
            if actual_packages.get(name) != expected_version:
                raise ValueError(
                    f"Package {name} must use exact version {expected_version}"
                )


def _parse_content_validation(stdout: str) -> dict[str, Any]:
    json_values: list[Any] = []
    for line in stdout.splitlines():
        try:
            json_values.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    if len(json_values) != 1:
        raise ValueError("Content validation must print exactly one JSON line")
    result = json_values[0]
    if not isinstance(result, dict):
        raise ValueError("Content validation result must be a JSON object")

    integer_fields = ("sourceNodes", "sourceUrls", "coveragePercent", "visuals")
    for field in integer_fields:
        if type(result.get(field)) is not int or result[field] < 0:
            raise ValueError(f"Invalid content validation field: {field}")
    if type(result.get("provenanceValid")) is not bool:
        raise ValueError("Invalid content validation field: provenanceValid")
    if result["coveragePercent"] != 100:
        raise ValueError("Preview must have 100% source coverage")
    if not result["provenanceValid"]:
        raise ValueError("Preview contains invalid provenance")
    return result


def validate_preview(preview: Path) -> ValidationReport:
    preview = Path(preview)
    for relative_path in (
        "src/content/preview-manifest.json",
        "src/content/source.md",
    ):
        if not (preview / relative_path).is_file():
            raise ValueError(f"Missing required file: {relative_path}")
    _, source_digest = _validate_manifest(preview)
    _validate_required_files(preview)
    _validate_authored_content(preview)
    _validate_package_versions(preview)

    content_process = subprocess.run(
        ["npm", "run", "validate:content"],
        cwd=preview,
        check=True,
        capture_output=True,
        text=True,
    )
    content = _parse_content_validation(content_process.stdout)

    subprocess.run(
        ["npm", "test", "--", "--run", "src/report.test.tsx"],
        cwd=preview,
        check=True,
    )
    subprocess.run(["npm", "run", "build"], cwd=preview, check=True)

    return ValidationReport(
        source_sha256=source_digest,
        source_nodes=content["sourceNodes"],
        coverage_percent=content["coveragePercent"],
        visuals=content["visuals"],
        tests_passed=True,
        build_passed=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("preview", type=Path)
    args = parser.parse_args()
    print(json.dumps(asdict(validate_preview(args.preview)), sort_keys=True))
