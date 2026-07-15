import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from init_preview import create_preview


class InitPreviewTest(unittest.TestCase):
    def test_create_preview_preserves_source_and_digest(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_bytes(b"# Plan\n\nKeep every byte.\n")
            template = tmp_path / "template"
            (template / "src" / "content").mkdir(parents=True)
            (template / "index.html").write_text("<div id='root'></div>")

            manifest = create_preview(source, tmp_path / "out", template, "plan")

            self.assertEqual(
                (tmp_path / "out/src/content/source.md").read_bytes(),
                source.read_bytes(),
            )
            self.assertEqual(
                manifest["source_sha256"],
                hashlib.sha256(source.read_bytes()).hexdigest(),
            )

    def test_create_preview_rejects_existing_customized_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            template = tmp_path / "template"
            template.mkdir()
            output = tmp_path / "out"
            output.mkdir()
            (output / "custom.txt").write_text("keep me")

            with self.assertRaisesRegex(
                FileExistsError, f"Preview already exists: {output}"
            ):
                create_preview(source, output, template, "plan")

    def test_create_preview_force_replaces_existing_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            template = tmp_path / "template"
            template.mkdir()
            (template / "index.html").write_text("template")
            output = tmp_path / "out"
            output.mkdir()
            (output / "custom.txt").write_text("replace me")

            create_preview(source, output, template, "plan", force=True)

            self.assertFalse((output / "custom.txt").exists())
            self.assertEqual((output / "index.html").read_text(), "template")


if __name__ == "__main__":
    unittest.main()
