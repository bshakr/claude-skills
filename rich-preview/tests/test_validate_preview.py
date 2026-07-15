import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import call, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from validate_preview import ValidationReport, validate_preview


PACKAGE_JSON = {
    "name": "rich-preview-report",
    "private": True,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
        "dev": "vite",
        "test": "vitest",
        "validate:content": "tsx scripts/validate-content.ts",
        "build": "tsc -b && vite build",
    },
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


def build_fixture_preview(root: Path) -> Path:
    preview = root / "preview"
    content = preview / "src" / "content"
    content.mkdir(parents=True)
    source = b"# Canonical\n"
    (content / "source.md").write_bytes(source)
    (content / "preview-manifest.json").write_text(
        json.dumps(
            {
                "slug": "canonical",
                "source_filename": "source.md",
                "source_path": "/tmp/source.md",
                "source_sha256": hashlib.sha256(source).hexdigest(),
            }
        )
    )
    (content / "report-data.json").write_text(
        json.dumps(
            {
                "title": "Canonical",
                "eyebrow": "Plan",
                "lede": "A complete source.",
                "status": "Ready",
                "highlights": [],
                "comparisons": [],
                "timeline": [],
                "risks": [],
                "actions": [],
            }
        )
    )
    (preview / "src" / "lib").mkdir()
    (preview / "src" / "lib" / "source.ts").write_text(
        "export const extractSourceNodes = () => [];\n"
    )
    (preview / "src" / "lib" / "provenance.ts").write_text(
        "export const validateEditorialData = () => ({ valid: true });\n"
    )
    (preview / "scripts").mkdir()
    (preview / "scripts" / "validate-content.ts").write_text(
        "process.stdout.write('{}\\n');\n"
    )
    (preview / "src" / "main.tsx").write_text(
        'import source from "./content/source.md?raw";\n'
        '<Report manifest={manifest} source={source} />;\n'
    )
    (preview / "src" / "report.mdx").write_text(
        'import { CompleteDocument } from "./components/editorial"\n\n'
        "<CompleteDocument {...documentProps} />\n"
    )
    (preview / "package.json").write_text(json.dumps(PACKAGE_JSON))
    return preview


def content_result(
    *,
    coverage_percent: int = 100,
    provenance_valid: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess(
        ["npm", "run", "validate:content"],
        0,
        stdout=json.dumps(
            {
                "sourceNodes": 1,
                "sourceUrls": 0,
                "coveragePercent": coverage_percent,
                "visuals": 0,
                "provenanceValid": provenance_valid,
            }
        )
        + "\n",
        stderr="",
    )


class ValidatePreviewTest(unittest.TestCase):
    def test_validate_preview_rejects_changed_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = Path(temp_dir) / "preview"
            content = preview / "src/content"
            content.mkdir(parents=True)
            source = b"# Canonical\n"
            (content / "source.md").write_bytes(source)
            (content / "preview-manifest.json").write_text(
                json.dumps(
                    {
                        "slug": "canonical",
                        "source_filename": "source.md",
                        "source_path": "/tmp/source.md",
                        "source_sha256": hashlib.sha256(source).hexdigest(),
                    }
                )
            )
            (preview / "src/content/source.md").write_text("changed")

            with self.assertRaisesRegex(ValueError, "Source digest mismatch"):
                validate_preview(preview)

    def test_validate_preview_runs_content_tests_before_build(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            digest = json.loads(
                (preview / "src/content/preview-manifest.json").read_text()
            )["source_sha256"]

            with patch(
                "validate_preview.subprocess.run",
                side_effect=[content_result(), None, None],
            ) as run:
                report = validate_preview(preview)

            self.assertEqual(
                report,
                ValidationReport(
                    source_sha256=digest,
                    source_nodes=1,
                    coverage_percent=100,
                    visuals=0,
                    tests_passed=True,
                    build_passed=True,
                ),
            )
            self.assertEqual(
                run.call_args_list,
                [
                    call(
                        ["npm", "run", "validate:content"],
                        cwd=preview,
                        check=True,
                        capture_output=True,
                        text=True,
                    ),
                    call(
                        ["npm", "test", "--", "--run", "src/report.test.tsx"],
                        cwd=preview,
                        check=True,
                    ),
                    call(
                        ["npm", "run", "build"],
                        cwd=preview,
                        check=True,
                    ),
                ],
            )

    def test_validate_preview_rejects_missing_required_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            (preview / "src/content/report-data.json").unlink()

            with self.assertRaisesRegex(ValueError, "Missing required file"):
                validate_preview(preview)

    def test_validate_preview_rejects_missing_manifest_field(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            manifest_path = preview / "src/content/preview-manifest.json"
            manifest = json.loads(manifest_path.read_text())
            del manifest["source_path"]
            manifest_path.write_text(json.dumps(manifest))

            with self.assertRaisesRegex(ValueError, "source_path"):
                validate_preview(preview)

    def test_validate_preview_rejects_unresolved_placeholder(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            (preview / "src/report.mdx").write_text(
                "<CompleteDocument {...documentProps} />\n<h1>{{TITLE}}</h1>\n"
            )

            with self.assertRaisesRegex(ValueError, "Unresolved placeholder"):
                validate_preview(preview)

    def test_validate_preview_requires_complete_document(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            (preview / "src/report.mdx").write_text("<Report />\n")

            with self.assertRaisesRegex(ValueError, "CompleteDocument"):
                validate_preview(preview)

    def test_validate_preview_requires_raw_source_import(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            (preview / "src/main.tsx").write_text(
                'import source from "./content/source.md";\n'
                '<Report manifest={manifest} source={source} />;\n'
            )

            with self.assertRaisesRegex(ValueError, "raw"):
                validate_preview(preview)

    def test_validate_preview_requires_raw_import_binding_as_report_source(
        self,
    ) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            (preview / "src/main.tsx").write_text(
                'import canonicalSource from "./content/source.md?raw";\n'
                'const source = "fabricated";\n'
                '<Report manifest={manifest} source={source} />;\n'
            )

            with patch(
                "validate_preview.subprocess.run",
                side_effect=[content_result(), None, None],
            ):
                with self.assertRaisesRegex(ValueError, "Raw.*binding"):
                    validate_preview(preview)

    def test_validate_preview_requires_report_to_forward_document_props(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            (preview / "src/report.mdx").write_text(
                'import { CompleteDocument } from "./components/editorial"\n\n'
                "<CompleteDocument />\n"
            )

            with patch(
                "validate_preview.subprocess.run",
                side_effect=[content_result(), None, None],
            ):
                with self.assertRaisesRegex(ValueError, "CompleteDocument.*props"):
                    validate_preview(preview)

    def test_validate_preview_requires_exact_package_versions(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            package_path = preview / "package.json"
            package = json.loads(package_path.read_text())
            package["dependencies"]["react"] = "^19.2.7"
            package_path.write_text(json.dumps(package))

            with self.assertRaisesRegex(ValueError, "react.*19.2.7"):
                validate_preview(preview)

    def test_validate_preview_requires_exactly_one_content_result(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            multiple = content_result()
            multiple.stdout += multiple.stdout

            with patch("validate_preview.subprocess.run", return_value=multiple):
                with self.assertRaisesRegex(ValueError, "exactly one JSON line"):
                    validate_preview(preview)

    def test_validate_preview_ignores_npm_wrapper_output(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))
            wrapped = content_result()
            wrapped.stdout = (
                "\n> rich-preview-report@1.0.0 validate:content\n"
                "> tsx scripts/validate-content.ts\n\n"
                f"{wrapped.stdout}"
            )

            with patch(
                "validate_preview.subprocess.run",
                side_effect=[wrapped, None, None],
            ):
                report = validate_preview(preview)

            self.assertEqual(report.coverage_percent, 100)

    def test_validate_preview_requires_complete_coverage(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))

            with patch(
                "validate_preview.subprocess.run",
                return_value=content_result(coverage_percent=99),
            ):
                with self.assertRaisesRegex(ValueError, "100% source coverage"):
                    validate_preview(preview)

    def test_validate_preview_requires_valid_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = build_fixture_preview(Path(temp_dir))

            with patch(
                "validate_preview.subprocess.run",
                return_value=content_result(provenance_valid=False),
            ):
                with self.assertRaisesRegex(ValueError, "provenance"):
                    validate_preview(preview)


if __name__ == "__main__":
    unittest.main()
