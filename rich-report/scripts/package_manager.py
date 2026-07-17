import shutil
import subprocess


def package_manager() -> str:
    pnpm = shutil.which("pnpm")
    if pnpm:
        probe = subprocess.run([pnpm, "--version"], capture_output=True)
        if probe.returncode == 0:
            return "pnpm"
    return "npm"


def install_command(manager: str) -> list[str]:
    return ["npm", "ci"] if manager == "npm" else [manager, "install"]
