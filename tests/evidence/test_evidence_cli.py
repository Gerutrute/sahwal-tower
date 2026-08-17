import argparse
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

from scripts.evidence import evidence


class RepoCase(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)
        subprocess.run(["git", "init", "-b", "main"], cwd=self.repo, check=True, capture_output=True)
        (self.repo / "request.md").write_text("점프 기능을 추가해줘", encoding="utf-8")

    def tearDown(self): self.temp.cleanup()

    def start(self):
        with mock.patch("pathlib.Path.cwd", return_value=self.repo):
            args = argparse.Namespace(request_file=str(self.repo / "request.md"), slug="점프 기능")
            with mock.patch("builtins.print") as output:
                self.assertEqual(evidence.start(args), 0)
                return Path(output.call_args.args[0])


class EvidenceCliTests(RepoCase):
    def test_start_supports_unborn_head_and_korean_path_content(self):
        directory = self.start()
        manifest = evidence.load_manifest(directory)
        self.assertTrue(manifest["git_unborn_head"])
        self.assertIsNone(manifest["git_head_before"])
        self.assertEqual(len(manifest["baseline_tree"]), 40)
        self.assertIn("점프", (directory / "00-user-request.md").read_text(encoding="utf-8"))

    def test_plan_gate_is_fail_closed_then_freezes_hashes(self):
        directory = self.start()
        args = argparse.Namespace(dir=str(directory), name="plan-frozen")
        self.assertEqual(evidence.gate(args), 2)
        decisions = directory / "01-human-design-decisions.md"
        decisions.write_text("# decisions\n\n| HDD-1 | 결정됨 | Core | 점프 | Human | 구현 |\n", encoding="utf-8")
        for filename in evidence.PLAN_FILES:
            (directory / filename).write_text("# artifact\n", encoding="utf-8")
        self.assertEqual(evidence.gate(args), 0)
        manifest = evidence.load_manifest(directory)
        self.assertEqual(manifest["status"], "PLAN_FROZEN")
        (directory / evidence.PLAN_FILES[0]).write_text("changed", encoding="utf-8")
        self.assertEqual(evidence.gate(argparse.Namespace(dir=str(directory), name="pre-implement")), 2)

    def test_snapshot_does_not_touch_user_index(self):
        (self.repo / "tracked.txt").write_text("v1", encoding="utf-8")
        subprocess.run(["git", "add", "tracked.txt"], cwd=self.repo, check=True)
        before = subprocess.run(["git", "status", "--porcelain"], cwd=self.repo, text=True, encoding="utf-8", capture_output=True, check=True).stdout
        tree = evidence.snapshot_tree(self.repo)
        after = subprocess.run(["git", "status", "--porcelain"], cwd=self.repo, text=True, encoding="utf-8", capture_output=True, check=True).stdout
        self.assertEqual(before, after)
        self.assertEqual(len(tree), 40)

    def test_checksum_round_trip_and_tamper_detection(self):
        directory = self.start()
        evidence.write_checksums(directory)
        self.assertEqual(evidence.verify_checksums(directory), [])
        (directory / "00-user-request.md").write_text("tampered", encoding="utf-8")
        self.assertIn("00-user-request.md", evidence.verify_checksums(directory))

    def test_final_validation_requires_independent_verifier_command(self):
        directory = self.start()
        (self.repo / "evidence.config.json").write_text(
            json.dumps({"required": ["full_tests"]}), encoding="utf-8"
        )
        decisions = directory / "01-human-design-decisions.md"
        decisions.write_text("# decisions\n\n| HDD-1 | 결정됨 | Core | 점프 | Human | 구현 |\n", encoding="utf-8")
        for filename in evidence.PLAN_FILES:
            (directory / filename).write_text("# artifact\n", encoding="utf-8")
        self.assertEqual(evidence.gate(argparse.Namespace(dir=str(directory), name="plan-frozen")), 0)
        for filename in (evidence.ROLE_FILES["codex-log"], evidence.ROLE_FILES["codex-result"], evidence.ROLE_FILES["claude-verification"], evidence.ROLE_FILES["final-summary"]):
            (directory / filename).write_text("# artifact\n", encoding="utf-8")
        manifest = evidence.load_manifest(directory)
        manifest["verifier_tree_unchanged"] = True
        manifest["verification"] = {"self-test": {"executed_by": "implementer", "status": "passed"}}
        evidence.save_manifest(directory, manifest)
        failures = evidence.validate(directory, final=True)
        self.assertIn("independent verifier commands", failures)
        self.assertIn("required verifier command: full_tests", failures)

    def test_final_validation_rejects_required_command_alias(self):
        directory = self.start()
        expected = ["npm.cmd", "run", "benchmark:ai"]
        (self.repo / "evidence.config.json").write_text(
            json.dumps({
                "commands": {"benchmark_ai": expected},
                "required": ["benchmark_ai"],
            }),
            encoding="utf-8",
        )
        decisions = directory / "01-human-design-decisions.md"
        decisions.write_text("# decisions\n\n| HDD-1 | 결정됨 | Core | 점프 | Human | 구현 |\n", encoding="utf-8")
        for filename in evidence.PLAN_FILES:
            (directory / filename).write_text("# artifact\n", encoding="utf-8")
        self.assertEqual(evidence.gate(argparse.Namespace(dir=str(directory), name="plan-frozen")), 0)
        for filename in (
            evidence.ROLE_FILES["codex-log"],
            evidence.ROLE_FILES["codex-result"],
            evidence.ROLE_FILES["claude-verification"],
            evidence.ROLE_FILES["final-summary"],
        ):
            (directory / filename).write_text("# artifact\n", encoding="utf-8")
        manifest = evidence.load_manifest(directory)
        manifest["verifier_tree_unchanged"] = True
        manifest["verification"] = {
            "benchmark_ai": {
                "executed_by": "verifier",
                "status": "passed",
                "argv": ["python", "-c", "print('not the benchmark')"],
            }
        }
        evidence.save_manifest(directory, manifest)

        failures = evidence.validate(directory, final=True)

        self.assertIn("required verifier argv: benchmark_ai", failures)

        manifest["verification"]["benchmark_ai"]["argv"] = expected
        evidence.save_manifest(directory, manifest)
        self.assertNotIn("required verifier argv: benchmark_ai", evidence.validate(directory, final=True))


if __name__ == "__main__": unittest.main()
