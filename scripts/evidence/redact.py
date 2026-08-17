from __future__ import annotations

import re
from typing import Any

_KEY_RE = re.compile(r"(?i)(api[_-]?key|token|secret|password|authorization|cookie)")
_VALUE_PATTERNS = [
    re.compile(r"(?i)(bearer\s+)[A-Za-z0-9._~+\-/=]+"),
    re.compile(r"(?i)((?:api[_-]?key|token|secret|password)\s*[=:]\s*)[^\s,;]+"),
    re.compile(r"\b(?:sk|sess|ghp|github_pat)-?[A-Za-z0-9_\-]{12,}\b"),
]


def redact_text(value: str) -> str:
    result = value
    for pattern in _VALUE_PATTERNS:
        if pattern.groups:
            result = pattern.sub(r"\1[REDACTED]", result)
        else:
            result = pattern.sub("[REDACTED]", result)
    return result


def redact(value: Any, key: str = "") -> Any:
    if _KEY_RE.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(k): redact(v, str(k)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, tuple):
        return [redact(item) for item in value]
    if isinstance(value, str):
        return redact_text(value)
    return value
