import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from scripts.evidence import claude_hook


SCRIPT = Path(__file__).parents[2] / "scripts/evidence/claude_hook.py"


class ClaudeHookTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.evidence = Path(self.temp.name) / "evidence"
        self.evidence.mkdir()
        self.env = os.environ.copy()
        self.env.update({"EVIDENCE_DIR": str(self.evidence), "EVIDENCE_ROLE": "verifier", "PROMPT_ID": "prompt-test", "EVIDENCE_REQUIRED": "1"})

    def tearDown(self): self.temp.cleanup()

    def invoke(self, event, payload, env=None):
        return subprocess.run([sys.executable, str(SCRIPT), event], input=json.dumps(payload), text=True, encoding="utf-8", capture_output=True, env=env or self.env)

    def test_verifier_source_write_is_denied_and_logged(self):
        result = self.invoke("pre-tool-use", {"tool_name": "Write", "tool_input": {"file_path": str(self.evidence.parent / "game.py")}})
        self.assertEqual(result.returncode, 0)
        decision = json.loads(result.stdout)
        self.assertEqual(decision["hookSpecificOutput"]["permissionDecision"], "deny")
        log = self.evidence / "claude/verify-session-r1/tool-events.jsonl"
        self.assertTrue(json.loads(log.read_text(encoding="utf-8").splitlines()[0])["denied"])

    def test_evidence_artifact_write_is_allowed(self):
        result = self.invoke("pre-tool-use", {"tool_name": "Write", "tool_input": {"file_path": str(self.evidence / "08-claude-verification-report.md")}})
        self.assertEqual(result.stdout.strip(), "")

    def test_missing_evidence_fails_closed(self):
        env = os.environ.copy(); env["EVIDENCE_REQUIRED"] = "1"; env.pop("EVIDENCE_DIR", None); env.pop("EVIDENCE_ROLE", None)
        result = self.invoke("pre-tool-use", {"tool_name": "Read"}, env)
        self.assertEqual(result.returncode, 2)

    def test_self_test(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "self-test"], text=True, capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertTrue(json.loads(result.stdout)["ok"])

    def test_project_pointer_is_found_from_nested_cwd(self):
        project = Path(self.temp.name) / "project"
        nested = project / "logs" / "date" / "prompt"
        nested.mkdir(parents=True)
        pointer = {"evidence_dir": str(self.evidence), "role": "verifier", "prompt_id": "prompt-test"}
        (project / ".evidence-active.json").write_text(json.dumps(pointer), encoding="utf-8")
        env = os.environ.copy()
        env.update({"CLAUDE_PROJECT_DIR": str(project), "EVIDENCE_REQUIRED": "1"})
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "pre-tool-use"],
            input=json.dumps({"tool_name": "Write", "tool_input": {"file_path": str(project / "game.py")}}),
            text=True, encoding="utf-8", capture_output=True, env=env, cwd=nested,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_utf8_korean_payload_overrides_cp949_stdio(self):
        env = self.env.copy()
        env["PYTHONIOENCODING"] = "cp949"
        payload = json.dumps(
            {"tool_name": "Write", "tool_input": {"file_path": r"D:\개인 pjt\게임\source.py"}},
            ensure_ascii=False,
        ).encode("utf-8")
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "pre-tool-use"], input=payload, capture_output=True, env=env
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout.decode("utf-8"))["hookSpecificOutput"]["permissionDecision"], "deny")
        logged = (self.evidence / "claude/verify-session-r1/tool-events.jsonl").read_text(encoding="utf-8")
        self.assertIn("개인", logged)

    def test_git_dash_c_commit_is_denied(self):
        commands = [
            "git -C . commit -m nope",
            'git -C "D:/개인 pjt/codex 게임 해커톤" commit -m nope',
            "git -C D:/x -c a=b commit -m nope",
        ]
        for command in commands:
            with self.subTest(command=command):
                result = self.invoke("pre-tool-use", {"tool_name": "Bash", "tool_input": {"command": command}})
                self.assertEqual(json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_corrupt_pointer_fails_closed_when_evidence_is_required(self):
        project = Path(self.temp.name) / "project"
        nested = project / "nested"
        nested.mkdir(parents=True)
        (project / ".evidence-active.json").write_text("{corrupt", encoding="utf-8")
        env = os.environ.copy()
        env.pop("EVIDENCE_DIR", None)
        env.pop("EVIDENCE_ROLE", None)
        env.pop("PROMPT_ID", None)
        env.update({"CLAUDE_PROJECT_DIR": str(project), "EVIDENCE_REQUIRED": "1"})
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "pre-tool-use"],
            input=json.dumps({"tool_name": "Write", "tool_input": {"file_path": str(project / "game.py")}}),
            text=True, encoding="utf-8", capture_output=True, env=env, cwd=nested,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(json.loads(result.stdout)["hookSpecificOutput"]["permissionDecision"], "deny")

    def test_deny_survives_audit_log_failure(self):
        payload = {"tool_name": "Write", "tool_input": {"file_path": str(self.evidence.parent / "game.py")}}
        with mock.patch.dict(os.environ, self.env, clear=True), mock.patch.object(sys, "stdin", io.StringIO(json.dumps(payload))), mock.patch.object(sys, "stdout", new_callable=io.StringIO) as output, mock.patch.object(claude_hook, "append_jsonl", side_effect=OSError("disk full")), mock.patch.object(sys, "argv", [str(SCRIPT), "pre-tool-use"]):
            self.assertEqual(claude_hook.main(), 0)
            self.assertEqual(json.loads(output.getvalue())["hookSpecificOutput"]["permissionDecision"], "deny")


if __name__ == "__main__": unittest.main()
