import argparse
import shutil
import subprocess
from pathlib import Path


def ensure_template_modules(template: Path) -> Path:
    modules = template / "node_modules"
    if not modules.is_dir():
        print(f"Installing template dependencies in {template} (one-time)")
        subprocess.run(["npm", "ci"], cwd=template, check=True)
    return modules


def create_preview(
    source: Path,
    output: Path,
    template: Path,
    force: bool = False,
) -> Path:
    source_bytes = source.read_bytes()
    if output.exists():
        if any(output.iterdir()) and not force:
            raise FileExistsError(f"Preview already exists: {output}")
        shutil.rmtree(output)

    modules = ensure_template_modules(template)
    shutil.copytree(template, output, ignore=shutil.ignore_patterns("node_modules"))
    (output / "node_modules").symlink_to(modules, target_is_directory=True)

    canonical = output / "src" / "content" / "source.md"
    canonical.parent.mkdir(parents=True, exist_ok=True)
    canonical.write_bytes(source_bytes)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    preview = create_preview(
        source=args.source,
        output=args.output,
        template=Path(__file__).parents[1] / "assets" / "template",
        force=args.force,
    )
    print(f"Preview initialized at {preview}")
