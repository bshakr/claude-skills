import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from serve_hub import serve_hub


class ServeHubTest(unittest.TestCase):
    def test_reports_already_running_hub_without_starting_a_server(self) -> None:
        output = io.StringIO()
        with (
            patch("serve_hub.fetch", return_value="<meta content='rich-report-hub'>"),
            patch("serve_hub.subprocess.run") as run,
            contextlib.redirect_stdout(output),
        ):
            result = serve_hub(Path("/hub"), 4400)

        self.assertEqual(result, 0)
        self.assertEqual(output.getvalue(), "http://127.0.0.1:4400/\n")
        run.assert_not_called()

    def test_refuses_a_port_held_by_a_foreign_process(self) -> None:
        errors = io.StringIO()
        with (
            patch("serve_hub.fetch", return_value="<html>some other app</html>"),
            patch("serve_hub.subprocess.run") as run,
            contextlib.redirect_stderr(errors),
        ):
            result = serve_hub(Path("/hub"), 4400)

        self.assertEqual(result, 1)
        self.assertIn("not the rich-report hub", errors.getvalue())
        run.assert_not_called()

    def test_starts_dev_server_when_the_port_is_free(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            hub = Path(temp_dir)
            output = io.StringIO()

            def assert_url_printed_first(*args, **kwargs):
                self.assertEqual(output.getvalue(), "http://127.0.0.1:4400/\n")

            with (
                patch("serve_hub.fetch", return_value=None),
                patch("serve_hub.package_manager", return_value="npm"),
                patch(
                    "serve_hub.subprocess.run",
                    side_effect=assert_url_printed_first,
                ) as run,
                contextlib.redirect_stdout(output),
            ):
                result = serve_hub(hub, 4400)

            self.assertEqual(result, 0)
            run.assert_called_once_with(
                [
                    "npm",
                    "run",
                    "dev",
                    "--",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "4400",
                    "--strictPort",
                ],
                cwd=hub,
                check=True,
            )


if __name__ == "__main__":
    unittest.main()
