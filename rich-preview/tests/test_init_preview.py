import hashlib
import json
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

            output = tmp_path / "out"
            manifest = create_preview(source, output, template, "plan")
            expected_manifest = {
                "slug": "plan",
                "source_filename": source.name,
                "source_path": str(source.resolve()),
                "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            }

            self.assertEqual(
                (output / "src/content/source.md").read_bytes(),
                source.read_bytes(),
            )
            self.assertEqual(manifest, expected_manifest)
            manifest_path = output / "src/content/preview-manifest.json"
            self.assertTrue(manifest_path.is_file())
            self.assertEqual(
                json.loads(manifest_path.read_text()),
                expected_manifest,
            )

    def test_create_preview_uses_existing_empty_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            template = tmp_path / "template"
            template.mkdir()
            (template / "index.html").write_text("template")
            output = tmp_path / "out"
            output.mkdir()

            try:
                create_preview(source, output, template, "plan")
            except FileExistsError as error:
                self.fail(f"Existing empty directory was not reused: {error}")

            self.assertEqual((output / "index.html").read_text(), "template")

    def test_create_preview_force_uses_existing_empty_directory(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            tmp_path = Path(temp_dir)
            source = tmp_path / "plan.md"
            source.write_text("# Plan\n")
            template = tmp_path / "template"
            template.mkdir()
            (template / "index.html").write_text("template")
            output = tmp_path / "out"
            output.mkdir()

            try:
                create_preview(source, output, template, "plan", force=True)
            except FileExistsError as error:
                self.fail(f"Existing empty directory was not reused: {error}")

            self.assertEqual((output / "index.html").read_text(), "template")

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
