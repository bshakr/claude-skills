import re
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_DESCRIPTION = (
    "Use when a completed plan, investigation, summary, or decision memo needs a "
    "polished, lossless local MDX webpage with editorial highlights, source-grounded "
    "diagrams or charts, print styling, or a shareable localhost preview."
)


class SkillContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.skill = (SKILL_ROOT / "SKILL.md").read_text()

    def test_frontmatter_has_only_the_portable_skill_identity(self) -> None:
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

    def test_workflow_preserves_authors_validates_serves_and_hands_off(self) -> None:
        required_phrases = (
            "Preserve the source",
            "scripts/init_preview.py",
            "Read `references/authoring-contract.md` completely",
            "report-data.json",
            "report.mdx",
            "Reject unsupported visuals",
            "scripts/validate_preview.py",
            "scripts/serve_preview.py",
            "HTTP 200",
            "exact localhost URL",
        )

        for phrase in required_phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, self.skill)

    def test_authoring_contract_defines_the_editorial_and_visual_schema(self) -> None:
        contract_path = SKILL_ROOT / "references/authoring-contract.md"

        self.assertTrue(contract_path.is_file())
        contract = contract_path.read_text()
        required_phrases = (
            "Positive editorial recipe",
            "Source-node lookup",
            "Exact-span provenance",
            '"nodeId": "paragraph:',
            '"evidence":',
            "EditorialData",
            "ProcessSpec",
            "ChartSpec",
            "ProcessFlow",
            "BranchFlow",
            "SequenceFlow",
            "DependencyMap",
            "BarChart",
            "LineChart",
            "StackedBar",
            "ComparisonChart",
            "Sparse documents",
            "Fallback",
            "Accessibility",
            "Print",
            "raw URLs",
            "No omissions",
        )

        for phrase in required_phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, contract)

    def test_openai_interface_is_exact_and_invokes_the_skill(self) -> None:
        metadata = (SKILL_ROOT / "agents/openai.yaml").read_text()

        self.assertEqual(
            metadata,
            "interface:\n"
            "  display_name: Rich Preview\n"
            "  short_description: Turn plans and summaries into polished webpages\n"
            "  default_prompt: Use $rich-preview to turn this completed plan into a "
            "polished, lossless local MDX webpage.\n",
        )


if __name__ == "__main__":
    unittest.main()
