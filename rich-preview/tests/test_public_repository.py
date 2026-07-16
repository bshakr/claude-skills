import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_PATHS = (
    REPOSITORY_ROOT / "README.md",
    REPOSITORY_ROOT / "docs",
    REPOSITORY_ROOT / "rich-preview",
)
FORBIDDEN_MARKERS = (
    "/" + "Users/",
    "." + "supacode",
    "nory" + "Stage",
    "LAMBDAS" + "_DB_",
    "wfm" + "-prod",
)
IGNORED_PARTS = {"node_modules", "dist", "__pycache__"}


class PublicRepositoryTests(unittest.TestCase):
    def test_generated_preview_and_build_outputs_are_ignored(self) -> None:
        patterns = set((REPOSITORY_ROOT / ".gitignore").read_text().splitlines())

        self.assertTrue(
            {
                ".rich-preview/",
                ".superpowers/",
                "node_modules/",
                "dist/",
                "*.tsbuildinfo",
                "__pycache__/",
            }.issubset(patterns)
        )

    def test_public_files_do_not_contain_private_paths_or_credentials(self) -> None:
        files = []
        for path in PUBLIC_PATHS:
            files.extend(path.rglob("*") if path.is_dir() else (path,))

        violations = []
        for path in files:
            if (
                not path.is_file()
                or any(part.startswith(".") for part in path.parts)
                or any(part in IGNORED_PARTS for part in path.parts)
            ):
                continue
            try:
                content = path.read_text()
            except UnicodeDecodeError:
                continue
            for marker in FORBIDDEN_MARKERS:
                if marker in content:
                    violations.append(f"{path.relative_to(REPOSITORY_ROOT)}: {marker}")

        self.assertEqual(violations, [])


if __name__ == "__main__":
    unittest.main()
