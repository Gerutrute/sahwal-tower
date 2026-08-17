from pathlib import Path
import unittest


class ProjectRuleTests(unittest.TestCase):
    def test_role_contract_and_lifecycle_are_present(self):
        text = (Path(__file__).parents[2] / "docs/evidence-workflow.md").read_text(encoding="utf-8")
        for required in ("Claude Code", "Hermes(Codex)", "PLAN_FROZEN", "verifier", "commit/push"):
            self.assertIn(required, text)

    def test_claude_hook_settings_exist(self):
        text = (Path(__file__).parents[2] / ".claude/settings.json").read_text(encoding="utf-8")
        for event in ("UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"):
            self.assertIn(event, text)
        self.assertIn("$CLAUDE_PROJECT_DIR/scripts/evidence/claude_hook.py", text)
        self.assertNotIn('"command": "python scripts/', text)


if __name__ == "__main__": unittest.main()
