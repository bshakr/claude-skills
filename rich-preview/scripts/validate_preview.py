import argparse
import subprocess
from pathlib import Path


def validate_preview(preview: Path) -> None:
    subprocess.run(["npm", "run", "build"], cwd=Path(preview), check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("preview", type=Path)
    args = parser.parse_args()
    validate_preview(args.preview)
