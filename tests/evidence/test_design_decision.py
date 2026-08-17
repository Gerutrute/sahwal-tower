from pathlib import Path
import tempfile
import unittest
from scripts.evidence.design_decision import append


class DesignDecisionTests(unittest.TestCase):
    def test_ai_cannot_claim_human_decision(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                append(Path(tmp) / "d.md", "HDD-1", "결정됨", "Core", "점프", "Claude", "blocking")

    def test_human_decision_is_appended(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "d.md"
            append(path, "HDD-1", "결정됨", "Core", "점프", "Human", "implement")
            self.assertIn("HDD-1", path.read_text(encoding="utf-8"))


if __name__ == "__main__": unittest.main()
