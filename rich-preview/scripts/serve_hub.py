import argparse
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

from package_manager import package_manager

DEFAULT_HUB = Path.home() / ".rich-preview"
LOOPBACK_HOST = "127.0.0.1"
HUB_MARKER = "rich-preview-hub"


def fetch(url: str) -> str | None:
    try:
        with urllib.request.urlopen(url, timeout=2) as response:
            return response.read().decode("utf-8", "replace")
    except urllib.error.URLError as error:
        if isinstance(error.reason, ConnectionRefusedError):
            return None
        raise


def serve_hub(hub: Path, port: int = 4400) -> int:
    url = f"http://{LOOPBACK_HOST}:{port}/"
    body = fetch(url)
    if body is not None:
        if HUB_MARKER in body:
            print(url, flush=True)
            return 0
        print(
            f"Port {port} is serving something that is not the rich-preview hub; "
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
        cwd=Path(hub),
        check=True,
    )
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hub", type=Path, default=DEFAULT_HUB)
    parser.add_argument("--port", type=int, default=4400)
    args = parser.parse_args()
    raise SystemExit(serve_hub(args.hub, args.port))
