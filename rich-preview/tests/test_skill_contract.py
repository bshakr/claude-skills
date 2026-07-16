import re
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_DESCRIPTION = (
    "Use when a completed plan, investigation, summary, or decision memo needs a "
    "polished local webpage — an editorial layer of highlights, timelines, risks, "
    "and mermaid diagrams over the full source — added to a local report hub served "
    "on localhost."
)


class SkillContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.skill = (SKILL_ROOT / "SKILL.md").read_text()

    def test_frontmatter_is_the_portable_skill_identity(self) -> None:
        frontmatter_match = re.match(r"\A---\n(.*?)\n---\n", self.skill, re.DOTALL)

        self.assertIsNotNone(frontmatter_match)
        lines = frontmatter_match.group(1).splitlines()
        self.assertEqual(
            lines,
            [
                "name: rich-preview",
                f"description: {EXPECTED_DESCRIPTION}",
            ],
        )
        self.assertTrue(EXPECTED_DESCRIPTION.startswith("Use when"))

    def test_workflow_covers_add_author_serve(self) -> None:
        required_phrases = (
            "Preserve the source",
            "scripts/add_report.py",
            "references/components.md",
            "<CompleteDocument source={source} />",
            "scripts/serve_hub.py",
            "scripts/validate_hub.py",
            "content directory",
            "index",
        )

        for phrase in required_phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.skill)

    def test_referenced_files_exist(self) -> None:
        for relative_path in (
            "references/components.md",
            "scripts/add_report.py",
            "scripts/serve_hub.py",
            "scripts/validate_hub.py",
            "scripts/package_manager.py",
            "agents/openai.yaml",
            "assets/report-starter.mdx",
        ):
            with self.subTest(path=relative_path):
                self.assertTrue((SKILL_ROOT / relative_path).is_file())

    def test_components_reference_documents_the_vocabulary(self) -> None:
        contract = (SKILL_ROOT / "references/components.md").read_text()
        required_phrases = (
            "@components/editorial",
            "@styles",
            "additive",
            "Hero",
            "HighlightGrid",
            "ComparisonGrid",
            "beforeDetail",
            "afterDetail",
            "Timeline",
            "RiskList",
            "ActionList",
            "CompleteDocument",
            "Mermaid",
            "flowchart",
            "sequenceDiagram",
        )

        for phrase in required_phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, contract)

    def test_openai_interface_invokes_the_skill(self) -> None:
        metadata = (SKILL_ROOT / "agents/openai.yaml").read_text()

        self.assertEqual(
            metadata,
            "interface:\n"
            "  display_name: Rich Preview\n"
            "  short_description: Turn plans and summaries into polished local webpages\n"
            "  default_prompt: Use $rich-preview to turn this completed document into a "
            "polished local webpage that keeps the full source.\n",
        )


if __name__ == "__main__":
    unittest.main()
