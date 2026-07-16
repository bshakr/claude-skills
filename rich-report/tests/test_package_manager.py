import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
from package_manager import install_command, package_manager


class PackageManagerTest(unittest.TestCase):
    def test_prefers_working_pnpm(self) -> None:
        with (
            patch("package_manager.shutil.which", return_value="/usr/local/bin/pnpm"),
            patch(
                "package_manager.subprocess.run",
                return_value=subprocess.CompletedProcess([], 0),
            ),
        ):
            self.assertEqual(package_manager(), "pnpm")

    def test_falls_back_to_npm_when_pnpm_is_missing(self) -> None:
        with patch("package_manager.shutil.which", return_value=None):
            self.assertEqual(package_manager(), "npm")

    def test_falls_back_to_npm_when_pnpm_is_a_broken_shim(self) -> None:
        with (
            patch("package_manager.shutil.which", return_value="/shims/pnpm"),
            patch(
                "package_manager.subprocess.run",
                return_value=subprocess.CompletedProcess([], 126),
            ),
        ):
            self.assertEqual(package_manager(), "npm")

    def test_npm_installs_from_the_lockfile(self) -> None:
        self.assertEqual(install_command("npm"), ["npm", "ci"])

    def test_pnpm_installs_without_the_npm_lockfile(self) -> None:
        self.assertEqual(install_command("pnpm"), ["pnpm", "install"])


if __name__ == "__main__":
    unittest.main()
