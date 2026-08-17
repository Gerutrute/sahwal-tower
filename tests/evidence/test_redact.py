import unittest
from scripts.evidence.redact import redact, redact_text


class RedactTests(unittest.TestCase):
    def test_sensitive_keys_and_values_are_redacted(self):
        data = redact({"api_key": "abc", "nested": {"name": "ok", "token": "xyz"}})
        self.assertEqual(data["api_key"], "[REDACTED]")
        self.assertEqual(data["nested"]["token"], "[REDACTED]")
        self.assertEqual(data["nested"]["name"], "ok")

    def test_bearer_and_inline_secret_are_redacted(self):
        value = redact_text("Authorization: Bearer abc.def password=hunter2")
        self.assertNotIn("abc.def", value)
        self.assertNotIn("hunter2", value)
        self.assertIn("[REDACTED]", value)


if __name__ == "__main__": unittest.main()
