import argparse
import subprocess
from pathlib import Path

from package_manager import package_manager


def validate_preview(preview: Path) -> None:
    subprocess.run([package_manager(), "run", "build"], cwd=Path(preview), check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("preview", type=Path)
    args = parser.parse_args()
    validate_preview(args.preview)
