import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import serve_hub
from serve_hub import serve_hub as serve_detached
from serve_hub import serve_foreground, status, stop

MARKER_BODY = "<meta content='rich-report-hub'>"
FOREIGN_BODY = "<html>some other app</html>"


@contextlib.contextmanager
def temp_hub():
    with tempfile.TemporaryDirectory() as temp_dir:
        yield Path(temp_dir)


class ServeForegroundTest(unittest.TestCase):
    def test_reports_already_running_hub_without_starting_a_server(self) -> None:
        output = io.StringIO()
        with (
            patch("serve_hub.fetch", return_value=MARKER_BODY),
            patch("serve_hub.subprocess.run") as run,
            contextlib.redirect_stdout(output),
        ):
            result = serve_foreground(Path("/hub"), 4400)

        self.assertEqual(result, 0)
        self.assertEqual(output.getvalue(), "http://127.0.0.1:4400/\n")
        run.assert_not_called()

    def test_refuses_a_port_held_by_a_foreign_process(self) -> None:
        errors = io.StringIO()
        with (
            patch("serve_hub.fetch", return_value=FOREIGN_BODY),
            patch("serve_hub.subprocess.run") as run,
            contextlib.redirect_stderr(errors),
        ):
            result = serve_foreground(Path("/hub"), 4400)

        self.assertEqual(result, 1)
        self.assertIn("not the rich-report hub", errors.getvalue())
        run.assert_not_called()

    def test_runs_dev_server_in_the_foreground_when_the_port_is_free(self) -> None:
        with temp_hub() as hub:
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
                result = serve_foreground(hub, 4400)

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


class ServeDetachedTest(unittest.TestCase):
    def test_reports_already_running_hub_without_spawning(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            with (
                patch("serve_hub.fetch", return_value=MARKER_BODY),
                patch("serve_hub.subprocess.Popen") as popen,
                contextlib.redirect_stdout(output),
            ):
                result = serve_detached(hub, 4400)

        self.assertEqual(result, 0)
        self.assertEqual(output.getvalue(), "http://127.0.0.1:4400/\n")
        popen.assert_not_called()

    def test_refuses_a_port_held_by_a_foreign_process(self) -> None:
        errors = io.StringIO()
        with temp_hub() as hub:
            with (
                patch("serve_hub.fetch", return_value=FOREIGN_BODY),
                patch("serve_hub.subprocess.Popen") as popen,
                contextlib.redirect_stderr(errors),
            ):
                result = serve_detached(hub, 4400)

        self.assertEqual(result, 1)
        self.assertIn("not the rich-report hub", errors.getvalue())
        popen.assert_not_called()

    def test_writes_pidfile_only_after_the_health_check_passes(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            pid_path, _, _ = serve_hub.hub_files(hub)
            child = MagicMock(pid=54321)
            child.poll.return_value = None
            # port free at the pre-spawn probe, then two misses, then healthy.
            fetch_bodies = [None, None, None, MARKER_BODY]

            def fake_fetch(url):
                self.assertFalse(
                    pid_path.exists(),
                    "pidfile must not exist until the server is healthy",
                )
                return fetch_bodies.pop(0)

            with (
                patch("serve_hub.fetch", side_effect=fake_fetch),
                patch("serve_hub.package_manager", return_value="npm"),
                patch("serve_hub.subprocess.Popen", return_value=child),
                patch("serve_hub.time.sleep"),
                contextlib.redirect_stdout(output),
            ):
                result = serve_detached(hub, 4400)

            self.assertEqual(result, 0)
            self.assertEqual(output.getvalue(), "http://127.0.0.1:4400/\n")
            self.assertEqual(read_pidfile(pid_path), 54321)

    def test_loser_of_a_port_race_converges_on_the_winner_url(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            pid_path, _, _ = serve_hub.hub_files(hub)
            child = MagicMock(pid=999)
            # child dies immediately (lost --strictPort race); winner serves marker.
            child.poll.return_value = 1
            fetch_bodies = [None, None, MARKER_BODY]

            with (
                patch("serve_hub.fetch", side_effect=fetch_bodies),
                patch("serve_hub.package_manager", return_value="npm"),
                patch("serve_hub.subprocess.Popen", return_value=child),
                patch("serve_hub.time.sleep"),
                contextlib.redirect_stdout(output),
            ):
                result = serve_detached(hub, 4400)

            self.assertEqual(result, 0)
            self.assertEqual(output.getvalue(), "http://127.0.0.1:4400/\n")
            self.assertFalse(
                pid_path.exists(),
                "the loser must not claim the pidfile it does not own",
            )

    def test_reports_failure_when_the_child_dies_without_a_winner(self) -> None:
        errors = io.StringIO()
        with temp_hub() as hub:
            _, log_path, _ = serve_hub.hub_files(hub)
            log_path.write_text("vite: EADDRINUSE crash\n")
            child = MagicMock(pid=999)
            child.poll.return_value = 1

            with (
                patch("serve_hub.fetch", return_value=None),
                patch("serve_hub.package_manager", return_value="npm"),
                patch("serve_hub.subprocess.Popen", return_value=child),
                patch("serve_hub.time.sleep"),
                contextlib.redirect_stderr(errors),
            ):
                result = serve_detached(hub, 4400)

            self.assertEqual(result, 1)
            self.assertIn("exited before serving", errors.getvalue())
            self.assertIn("EADDRINUSE", errors.getvalue())


class StopTest(unittest.TestCase):
    def test_stops_a_live_server_and_removes_the_pidfile(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            pid_path, _, _ = serve_hub.hub_files(hub)
            serve_hub.write_pid(pid_path, 4242)

            with (
                patch("serve_hub.read_pid", return_value=4242),
                patch("serve_hub.pid_alive", side_effect=[True, False, False]),
                patch("serve_hub.terminate") as terminate_mock,
                patch("serve_hub.serves_marker", return_value=False),
                contextlib.redirect_stdout(output),
            ):
                result = stop(hub, 4400)

            self.assertEqual(result, 0)
            terminate_mock.assert_called_once_with(4242)
            self.assertFalse(pid_path.exists())
            self.assertIn("stopped pid 4242", output.getvalue())

    def test_cleans_up_a_stale_pidfile(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            pid_path, _, _ = serve_hub.hub_files(hub)
            serve_hub.write_pid(pid_path, 111)

            with (
                patch("serve_hub.pid_alive", return_value=False),
                patch("serve_hub.terminate") as terminate_mock,
                contextlib.redirect_stdout(output),
            ):
                result = stop(hub, 4400)

            self.assertEqual(result, 0)
            self.assertEqual(output.getvalue().strip(), "not running")
            self.assertFalse(pid_path.exists())
            terminate_mock.assert_not_called()

    def test_reports_not_running_without_a_pidfile(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            with contextlib.redirect_stdout(output):
                result = stop(hub, 4400)

        self.assertEqual(result, 0)
        self.assertEqual(output.getvalue().strip(), "not running")


class StatusTest(unittest.TestCase):
    def test_reports_running_with_pid_for_a_live_matching_server(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            pid_path, _, _ = serve_hub.hub_files(hub)
            serve_hub.write_pid(pid_path, 7777)

            with (
                patch("serve_hub.serves_marker", return_value=True),
                patch("serve_hub.pid_alive", return_value=True),
                contextlib.redirect_stdout(output),
            ):
                result = status(hub, 4400)

            self.assertEqual(result, 0)
            self.assertIn("running", output.getvalue())
            self.assertIn("pid 7777", output.getvalue())

    def test_reports_running_without_pidfile_when_a_foreign_owner_serves_the_hub(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            with (
                patch("serve_hub.serves_marker", return_value=True),
                contextlib.redirect_stdout(output),
            ):
                result = status(hub, 4400)

            self.assertEqual(result, 0)
            self.assertIn("no matching pidfile", output.getvalue())

    def test_cleans_up_a_stale_pidfile_when_nothing_serves(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            pid_path, _, _ = serve_hub.hub_files(hub)
            serve_hub.write_pid(pid_path, 5555)

            with (
                patch("serve_hub.serves_marker", return_value=False),
                contextlib.redirect_stdout(output),
            ):
                result = status(hub, 4400)

            self.assertEqual(result, 0)
            self.assertIn("stale pidfile", output.getvalue())
            self.assertFalse(pid_path.exists())

    def test_reports_not_running_when_idle(self) -> None:
        output = io.StringIO()
        with temp_hub() as hub:
            with (
                patch("serve_hub.serves_marker", return_value=False),
                contextlib.redirect_stdout(output),
            ):
                result = status(hub, 4400)

            self.assertEqual(result, 0)
            self.assertEqual(output.getvalue().strip(), "not running")


def read_pidfile(pid_path: Path) -> int:
    return int(pid_path.read_text().strip())


if __name__ == "__main__":
    unittest.main()
