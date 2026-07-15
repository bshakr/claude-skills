import argparse
import socket
import subprocess
from pathlib import Path


LOOPBACK_HOST = "127.0.0.1"


def find_available_port(host: str, preferred: int | None) -> int:
    if host != LOOPBACK_HOST:
        raise ValueError(f"Preview host must be {LOOPBACK_HOST}")
    if preferred is None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind((host, 0))
            return probe.getsockname()[1]
    if not 1 <= preferred <= 65535:
        raise ValueError("Preferred port must be between 1 and 65535")

    for port in range(preferred, 65536):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            try:
                probe.bind((host, port))
            except OSError:
                continue
        return port
    raise RuntimeError(f"No available port at or above {preferred}")


def serve_preview(preview: Path, preferred: int | None = None) -> int:
    preview = Path(preview)
    port = find_available_port(LOOPBACK_HOST, preferred)
    print(f"http://{LOOPBACK_HOST}:{port}/", flush=True)
    subprocess.run(
        [
            "npm",
            "run",
            "dev",
            "--",
            "--host",
            LOOPBACK_HOST,
            "--port",
            str(port),
            "--strictPort",
        ],
        cwd=preview,
        check=True,
    )
    return port


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("preview", type=Path)
    parser.add_argument("--port", type=int)
    args = parser.parse_args()
    serve_preview(args.preview, args.port)
