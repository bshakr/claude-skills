import json
import subprocess
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from add_report import add_report, sync_app


def build_template(root: Path) -> Path:
    template = root / "template"
    (template / "src").mkdir(parents=True, exist_ok=True)
    (template / "package.json").write_text('{"name": "hub"}\n')
    (template / "src" / "main.tsx").write_text("export const x = 1;\n")
    (template / "content").mkdir(exist_ok=True)
    (template / "content" / ".gitkeep").write_text("")
    (template / "node_modules").mkdir(exist_ok=True)
    (template / "node_modules" / "dep.js").write_text("shipped")
    return template


def add(root: Path, source: Path, **kwargs) -> Path:
    return add_report(
        source=source,
        hub=root / "hub",
        template=build_template(root),
        install=False,
        **kwargs,
    )


class AddReportTest(unittest.TestCase):
    def test_writes_source_verbatim(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "plan.md"
            source.write_bytes(b"# Plan\n\nKeep every byte.\n")

            content = add(root, source)

            self.assertEqual(
                (content / "source.md").read_bytes(), source.read_bytes()
            )

    def test_meta_title_from_first_heading(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "plan.md"
            source.write_text("## Section first\n\n# Real Title\n\nBody\n")

            meta = json.loads((add(root, source) / "meta.json").read_text())

            self.assertEqual(meta["title"], "Real Title")

    def test_meta_title_falls_back_to_stem(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "no-heading.md"
            source.write_text("Just prose, no heading.\n")

            meta = json.loads((add(root, source) / "meta.json").read_text())

            self.assertEqual(meta["title"], "no-heading")

    def test_meta_records_slug_date_and_source_path(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "plan.md"
            source.write_text("# Plan\n")

            meta = json.loads((add(root, source, project="acme") / "meta.json").read_text())

            self.assertEqual(meta["project"], "acme")
            self.assertEqual(meta["slug"], "plan")
            self.assertEqual(meta["date"], date.today().isoformat())
            self.assertEqual(meta["source_path"], str(source.resolve()))

    def test_project_inferred_from_git_repo(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            repo = root / "my-repo"
            (repo / "docs").mkdir(parents=True)
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            source = repo / "docs" / "plan.md"
            source.write_text("# Plan\n")

            meta = json.loads((add(root, source) / "meta.json").read_text())

            self.assertEqual(meta["project"], "my-repo")

    def test_project_falls_back_to_parent_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            parent = root / "loose-docs"
            parent.mkdir()
            source = parent / "plan.md"
            source.write_text("# Plan\n")

            meta = json.loads((add(root, source) / "meta.json").read_text())

            self.assertEqual(meta["project"], "loose-docs")

    def test_slug_override(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "plan.md"
            source.write_text("# Plan\n")

            content = add(root, source, project="acme", slug="custom-slug")

            self.assertEqual(content.name, "custom-slug")

    def test_refuses_existing_report_without_force(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "plan.md"
            source.write_text("# Plan\n")
            add(root, source, project="acme")

            with self.assertRaisesRegex(FileExistsError, "Report already exists"):
                add(root, source, project="acme")

    def test_force_replaces_existing_report(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "plan.md"
            source.write_text("# Plan\n")
            content = add(root, source, project="acme")
            (content / "stale.txt").write_text("old")

            add(root, source, project="acme", force=True)

            self.assertFalse((content / "stale.txt").exists())

    def test_sync_app_copies_app_but_never_touches_content_or_modules(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            template = build_template(root)
            hub = root / "hub"
            (hub / "content" / "nory" / "kept").mkdir(parents=True)
            (hub / "content" / "nory" / "kept" / "meta.json").write_text("{}")
            (hub / "node_modules").mkdir()
            (hub / "node_modules" / "installed.js").write_text("keep")

            sync_app(template, hub)

            self.assertEqual((hub / "package.json").read_text(), '{"name": "hub"}\n')
            self.assertTrue((hub / "src" / "main.tsx").is_file())
            self.assertTrue((hub / "content" / "nory" / "kept" / "meta.json").is_file())
            self.assertFalse((hub / "content" / ".gitkeep").exists())
            self.assertEqual(
                (hub / "node_modules" / "installed.js").read_text(), "keep"
            )
            self.assertFalse((hub / "node_modules" / "dep.js").exists())


if __name__ == "__main__":
    unittest.main()
