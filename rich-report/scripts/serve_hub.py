import argparse
import contextlib
import fcntl
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from package_manager import package_manager

DEFAULT_HUB = Path.home() / ".rich-report"
LOOPBACK_HOST = "127.0.0.1"
HUB_MARKER = "rich-report-hub"
HEALTH_TIMEOUT = 20.0
HEALTH_INTERVAL = 0.25
STOP_TIMEOUT = 5.0


def fetch(url: str) -> str | None:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.read().decode("utf-8", "replace")
    except urllib.error.URLError as error:
        if isinstance(error.reason, ConnectionRefusedError):
            return None
        raise


def hub_url(port: int) -> str:
    return f"http://{LOOPBACK_HOST}:{port}/"


def serves_marker(port: int) -> bool:
    body = fetch(hub_url(port))
    return body is not None and HUB_MARKER in body


def hub_files(hub: Path) -> tuple[Path, Path, Path]:
    return hub / "server.pid", hub / "server.log", hub / "server.lock"


def read_pid(pid_path: Path) -> int | None:
    try:
        return int(pid_path.read_text().strip())
    except (FileNotFoundError, ValueError):
        return None


def write_pid(pid_path: Path, pid: int) -> None:
    tmp = pid_path.parent / f"{pid_path.name}.tmp"
    tmp.write_text(f"{pid}\n")
    tmp.replace(pid_path)


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def terminate(pid: int, sig: int = signal.SIGTERM) -> None:
    try:
        os.killpg(os.getpgid(pid), sig)
    except (ProcessLookupError, PermissionError):
        pass


def print_log_tail(log_path: Path, lines: int = 20) -> None:
    try:
        tail = log_path.read_text("utf-8", "replace").splitlines()[-lines:]
    except FileNotFoundError:
        return
    for line in tail:
        print(line, file=sys.stderr)


@contextlib.contextmanager
def hub_lock(hub: Path):
    hub.mkdir(parents=True, exist_ok=True)
    fd = os.open(hub / "server.lock", os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def start_detached(hub: Path, port: int, pid_path: Path, log_path: Path) -> int:
    url = hub_url(port)
    with open(log_path, "a") as log:
        child = subprocess.Popen(
            [
                package_manager(),
                "run",
                "dev",
                "--",
                "--host",
                LOOPBACK_HOST,
                "--port",
                str(port),
                "--strictPort",
            ],
            cwd=hub,
            stdout=log,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    deadline = time.monotonic() + HEALTH_TIMEOUT
    while True:
        body = fetch(url)
        if body is not None and HUB_MARKER in body:
            if child.poll() is None:
                write_pid(pid_path, child.pid)
            print(url, flush=True)
            return 0
        if child.poll() is not None:
            if serves_marker(port):
                print(url, flush=True)
                return 0
            print(
                f"Hub server exited before serving the hub on port {port}.",
                file=sys.stderr,
            )
            print_log_tail(log_path)
            return 1
        if time.monotonic() >= deadline:
            terminate(child.pid)
            print(
                f"Hub server did not become healthy within {int(HEALTH_TIMEOUT)}s "
                f"on port {port}.",
                file=sys.stderr,
            )
            print_log_tail(log_path)
            return 1
        time.sleep(HEALTH_INTERVAL)


def serve_hub(hub: Path, port: int = 4400) -> int:
    hub = Path(hub)
    pid_path, log_path, _ = hub_files(hub)
    url = hub_url(port)
    with hub_lock(hub):
        body = fetch(url)
        if body is not None:
            if HUB_MARKER in body:
                print(url, flush=True)
                return 0
            print(
                f"Port {port} is serving something that is not the rich-report hub; "
                f"stop it or pass --port.",
                file=sys.stderr,
            )
            return 1
        return start_detached(hub, port, pid_path, log_path)


def serve_foreground(hub: Path, port: int = 4400) -> int:
    hub = Path(hub)
    url = hub_url(port)
    body = fetch(url)
    if body is not None:
        if HUB_MARKER in body:
            print(url, flush=True)
            return 0
        print(
            f"Port {port} is serving something that is not the rich-report hub; "
            f"stop it or pass --port.",
            file=sys.stderr,
        )
        return 1

    print(url, flush=True)
    subprocess.run(
        [
            package_manager(),
            "run",
            "dev",
            "--",
            "--host",
            LOOPBACK_HOST,
            "--port",
            str(port),
            "--strictPort",
        ],
        cwd=hub,
        check=True,
    )
    return 0


def status(hub: Path, port: int = 4400) -> int:
    hub = Path(hub)
    pid_path, _, _ = hub_files(hub)
    url = hub_url(port)
    serving = serves_marker(port)
    pid = read_pid(pid_path)
    if serving:
        if pid is not None and pid_alive(pid):
            print(f"running {url} (pid {pid})")
        else:
            print(f"running {url} (no matching pidfile)")
        return 0
    if pid is not None:
        pid_path.unlink(missing_ok=True)
        print(f"not running (removed stale pidfile for pid {pid})")
        return 0
    print("not running")
    return 0


def stop(hub: Path, port: int = 4400) -> int:
    hub = Path(hub)
    pid_path, _, _ = hub_files(hub)
    pid = read_pid(pid_path)
    if pid is None or not pid_alive(pid):
        if pid is not None:
            pid_path.unlink(missing_ok=True)
        print("not running")
        return 0

    terminate(pid)
    deadline = time.monotonic() + STOP_TIMEOUT
    while pid_alive(pid) and time.monotonic() < deadline:
        time.sleep(0.1)
    if pid_alive(pid):
        terminate(pid, signal.SIGKILL)
    pid_path.unlink(missing_ok=True)

    if serves_marker(port):
        print(f"stopped pid {pid} but port {port} is still serving the hub", file=sys.stderr)
        return 1
    print(f"stopped pid {pid}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hub", type=Path, default=DEFAULT_HUB)
    parser.add_argument("--port", type=int, default=4400)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--status", action="store_true")
    mode.add_argument("--stop", action="store_true")
    mode.add_argument("--foreground", action="store_true")
    args = parser.parse_args()

    if args.status:
        raise SystemExit(status(args.hub, args.port))
    if args.stop:
        raise SystemExit(stop(args.hub, args.port))
    if args.foreground:
        raise SystemExit(serve_foreground(args.hub, args.port))
    raise SystemExit(serve_hub(args.hub, args.port))
