import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock
from scripts.evidence.orca_prompt import call_orca


class OrcaTests(unittest.TestCase):
    @mock.patch("subprocess.run")
    def test_only_json_success_receipt_is_accepted(self, run):
        run.return_value.returncode = 0
        run.return_value.stdout = json.dumps({"ok": True, "result": {"task": {"id": "task_1"}}})
        run.return_value.stderr = ""
        data = call_orca(["orchestration", "task-list"], Path.cwd())
        self.assertTrue(data["ok"])
        self.assertEqual(run.call_args.args[0][-1], "--json")

    @mock.patch("subprocess.run")
    def test_orca_error_is_rejected(self, run):
        run.return_value.returncode = 0
        run.return_value.stdout = json.dumps({"ok": False, "error": {"code": "x"}})
        run.return_value.stderr = ""
        with self.assertRaises(RuntimeError): call_orca(["orchestration", "task-list"], Path.cwd())


if __name__ == "__main__": unittest.main()
