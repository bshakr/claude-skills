import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from init_preview import create_preview


def build_template(root: Path) -> Path:
    template = root / "template"
    (template / "src" / "content").mkdir(parents=True)
    (template / "index.html").write_text("<div id='root'></div>")
    (template / "node_modules").mkdir()
    (template / "node_modules" / "marker.txt").write_text("shared")
    return template


class InitPreviewTest(unittest.TestCase):
    def test_writes_source_verbatim(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_bytes(b"# Plan\n\nKeep every byte.\n")
            output = tmp_path / "out"

            create_preview(source, output, build_template(tmp_path))

            self.assertEqual(
                (output / "src/content/source.md").read_bytes(),
                source.read_bytes(),
            )

    def test_symlinks_shared_node_modules_and_excludes_the_copy(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            template = build_template(tmp_path)
            output = tmp_path / "out"

            create_preview(source, output, template)

            modules = output / "node_modules"
            self.assertTrue(modules.is_symlink())
            self.assertEqual(modules.resolve(), (template / "node_modules").resolve())
            self.assertEqual((modules / "marker.txt").read_text(), "shared")

    def test_reuses_existing_empty_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            output = tmp_path / "out"
            output.mkdir()

            create_preview(source, output, build_template(tmp_path))

            self.assertEqual((output / "index.html").read_text(), "<div id='root'></div>")

    def test_rejects_existing_customized_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            output = tmp_path / "out"
            output.mkdir()
            (output / "custom.txt").write_text("keep me")

            with self.assertRaisesRegex(
                FileExistsError, f"Preview already exists: {output}"
            ):
                create_preview(source, output, build_template(tmp_path))

    def test_force_replaces_existing_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            output = tmp_path / "out"
            output.mkdir()
            (output / "custom.txt").write_text("replace me")

            create_preview(source, output, build_template(tmp_path), force=True)

            self.assertFalse((output / "custom.txt").exists())
            self.assertEqual((output / "index.html").read_text(), "<div id='root'></div>")


if __name__ == "__main__":
    unittest.main()
