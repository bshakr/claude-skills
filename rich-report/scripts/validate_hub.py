import argparse
import subprocess
from pathlib import Path

from package_manager import package_manager

DEFAULT_HUB = Path.home() / ".rich-report"


def validate_hub(hub: Path = DEFAULT_HUB) -> None:
    subprocess.run([package_manager(), "run", "build"], cwd=Path(hub), check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hub", type=Path, default=DEFAULT_HUB)
    args = parser.parse_args()
    validate_hub(args.hub)
