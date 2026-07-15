import argparse
import hashlib
import json
import shutil
from pathlib import Path


def create_preview(
    source: Path,
    output: Path,
    template: Path,
    slug: str,
    force: bool = False,
) -> dict[str, object]:
    source_bytes = source.read_bytes()
    if output.exists() and any(output.iterdir()):
        if not force:
            raise FileExistsError(f"Preview already exists: {output}")
        shutil.rmtree(output)
    shutil.copytree(template, output)
    canonical = output / "src" / "content" / "source.md"
    canonical.parent.mkdir(parents=True, exist_ok=True)
    canonical.write_bytes(source_bytes)
    manifest = {
        "slug": slug,
        "source_filename": source.name,
        "source_path": str(source.resolve()),
        "source_sha256": hashlib.sha256(source_bytes).hexdigest(),
    }
    (canonical.parent / "preview-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    create_preview(
        source=args.source,
        output=args.output,
        template=Path(__file__).parents[1] / "assets" / "template",
        slug=args.slug,
        force=args.force,
    )
