import argparse
import json
import re
import shutil
import subprocess
from datetime import date
from pathlib import Path

from package_manager import install_command, package_manager

DEFAULT_HUB = Path.home() / ".rich-report"
HUB_PORT = 4400
SKILL_ROOT = Path(__file__).parents[1]
TEMPLATE = SKILL_ROOT / "assets" / "template"
STARTER = SKILL_ROOT / "assets" / "report-starter.mdx"
KEEP_STATE = {"content", "node_modules"}


def sync_app(template: Path, hub: Path) -> None:
    hub.mkdir(parents=True, exist_ok=True)
    for item in template.iterdir():
        if item.name in KEEP_STATE:
            continue
        target = hub / item.name
        if item.is_dir():
            shutil.copytree(item, target, dirs_exist_ok=True)
        else:
            shutil.copy2(item, target)


def ensure_dependencies(hub: Path, package_changed: bool) -> None:
    if package_changed or not (hub / "node_modules").is_dir():
        manager = package_manager()
        print(f"Installing hub dependencies with {manager}")
        subprocess.run(install_command(manager), cwd=hub, check=True)


def infer_project(source: Path, override: str | None) -> str:
    if override:
        return override
    try:
        top = subprocess.run(
            ["git", "-C", str(source.parent), "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
        if top:
            return Path(top).name
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass
    return source.parent.name


def infer_slug(source: Path, override: str | None) -> str:
    return override or source.stem


def title_from_source(text: str, fallback: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return fallback


def add_report(
    source: Path,
    hub: Path = DEFAULT_HUB,
    template: Path = TEMPLATE,
    project: str | None = None,
    slug: str | None = None,
    force: bool = False,
    install: bool = True,
) -> Path:
    source_bytes = source.read_bytes()
    source_text = source_bytes.decode("utf-8", "replace")

    hub_package = hub / "package.json"
    template_package = template / "package.json"
    package_changed = (
        not hub_package.exists()
        or hub_package.read_bytes() != template_package.read_bytes()
    )
    sync_app(template, hub)
    if install:
        ensure_dependencies(hub, package_changed)

    project = infer_project(source, project)
    slug = infer_slug(source, slug)
    content_dir = hub / "content" / project / slug
    if content_dir.exists() and any(content_dir.iterdir()) and not force:
        raise FileExistsError(f"Report already exists: {content_dir}")
    if content_dir.exists():
        shutil.rmtree(content_dir)
    content_dir.mkdir(parents=True)

    (content_dir / "source.md").write_bytes(source_bytes)
    meta = {
        "title": title_from_source(source_text, source.stem),
        "project": project,
        "slug": slug,
        "date": date.today().isoformat(),
        "source_path": str(source.resolve()),
    }
    (content_dir / "meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    (content_dir / "report.mdx").write_text(STARTER.read_text())
    return content_dir


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--project")
    parser.add_argument("--slug")
    parser.add_argument("--hub", type=Path, default=DEFAULT_HUB)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    content_dir = add_report(
        source=args.source,
        hub=args.hub,
        project=args.project,
        slug=args.slug,
        force=args.force,
    )
    meta = json.loads((content_dir / "meta.json").read_text())
    print(f"Report content: {content_dir}")
    print(f"Report URL: http://127.0.0.1:{HUB_PORT}/{meta['project']}/{meta['slug']}")
