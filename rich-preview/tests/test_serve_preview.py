import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, call, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from serve_preview import find_available_port, serve_preview


class ServePreviewTest(unittest.TestCase):
    def test_find_available_port_advances_from_occupied_preferred_port(self) -> None:
        probe = Mock()
        probe.__enter__ = Mock(return_value=probe)
        probe.__exit__ = Mock(return_value=False)
        probe.bind.side_effect = [OSError("occupied"), None]

        with patch("serve_preview.socket.socket", return_value=probe):
            port = find_available_port("127.0.0.1", 4173)

        self.assertEqual(port, 4174)
        self.assertEqual(
            probe.bind.call_args_list,
            [call(("127.0.0.1", 4173)), call(("127.0.0.1", 4174))],
        )

    def test_find_available_port_rejects_non_loopback_host(self) -> None:
        with self.assertRaisesRegex(ValueError, "127.0.0.1"):
            find_available_port("0.0.0.0", 4173)

    def test_find_available_port_asks_the_os_when_no_port_is_preferred(self) -> None:
        port = find_available_port("127.0.0.1", None)

        self.assertGreater(port, 0)

    def test_serve_preview_prints_url_before_waiting_on_vite(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            preview = Path(temp_dir)
            output = io.StringIO()

            def assert_url_was_printed(*args, **kwargs):
                self.assertEqual(output.getvalue(), "http://127.0.0.1:4174/\n")

            with (
                patch("serve_preview.find_available_port", return_value=4174),
                patch("serve_preview.package_manager", return_value="npm"),
                patch(
                    "serve_preview.subprocess.run",
                    side_effect=assert_url_was_printed,
                ) as run,
                contextlib.redirect_stdout(output),
            ):
                result = serve_preview(preview, 4173)

            self.assertEqual(result, 4174)
            run.assert_called_once_with(
                [
                    "npm",
                    "run",
                    "dev",
                    "--",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "4174",
                    "--strictPort",
                ],
                cwd=preview,
                check=True,
            )


if __name__ == "__main__":
    unittest.main()
