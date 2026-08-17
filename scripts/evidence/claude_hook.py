from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
from typing import Any

try:
    from .evidence import append_jsonl, now
    from .redact import redact
except ImportError:
    from evidence import append_jsonl, now
    from redact import redact

WRITE_TOOLS = {"Edit", "Write", "NotebookEdit"}
DESTRUCTIVE_RE = re.compile(
    r"(?i)(?:\bgit\b(?:(?![;&|\r\n]).){0,500}\b(?:commit|push|reset|clean|stash)\b|\brm\s+-|\bremove-item\b)"
)


def context() -> tuple[Path | None, str, str]:
    evidence = os.environ.get("EVIDENCE_DIR")
    role = os.environ.get("EVIDENCE_ROLE", "unknown")
    prompt_id = os.environ.get("PROMPT_ID", "unknown")
    if not evidence:
        roots = []
        project_root = os.environ.get("CLAUDE_PROJECT_DIR")
        if project_root:
            roots.append(Path(project_root))
        roots.extend([Path.cwd(), *Path.cwd().parents])
        for root in roots:
            pointer = root / ".evidence-active.json"
            if pointer.is_file():
                try:
                    data = json.loads(pointer.read_text(encoding="utf-8"))
                except (OSError, json.JSONDecodeError, UnicodeError):
                    continue
                evidence, role, prompt_id = data.get("evidence_dir"), data.get("role", role), data.get("prompt_id", prompt_id)
                break
    return (Path(evidence).resolve() if evidence else None, role, prompt_id)


def deny(reason: str, event: str) -> dict[str, Any]:
    return {"hookSpecificOutput": {"hookEventName": event, "permissionDecision": "deny", "permissionDecisionReason": reason}}


def allowed_evidence_write(tool_input: dict[str, Any], evidence: Path) -> bool:
    raw = tool_input.get("file_path") or tool_input.get("path") or ""
    if not raw:
        return False
    try:
        Path(raw).resolve().relative_to(evidence)
        return True
    except (ValueError, OSError):
        return False


def main() -> int:
    if hasattr(sys.stdin, "reconfigure"):
        sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    event = sys.argv[1] if len(sys.argv) > 1 else "unknown"
    if event == "self-test":
        print(json.dumps({"ok": True, "events": ["user-prompt-submit", "pre-tool-use", "post-tool-use", "stop"]}))
        return 0
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {"invalid_json": True}
    evidence, role, prompt_id = context()
    if evidence is None:
        if os.environ.get("EVIDENCE_REQUIRED") == "1":
            print(json.dumps(deny("EVIDENCE_DIR is required", event)))
            return 2
        return 0
    session = "plan-session" if role == "planner" else os.environ.get("EVIDENCE_SESSION", "verify-session-r1")
    log = evidence / "claude" / session / ("tool-events.jsonl" if "tool" in event else "prompt-events.jsonl")
    tool_name = str(payload.get("tool_name", ""))
    tool_input = payload.get("tool_input") if isinstance(payload.get("tool_input"), dict) else {}
    decision = None
    if event == "pre-tool-use" and role in {"planner", "verifier"}:
        if tool_name in WRITE_TOOLS and not allowed_evidence_write(tool_input, evidence):
            decision = deny(f"Claude {role} may only write evidence artifacts", "PreToolUse")
        if tool_name == "Bash":
            command = str(tool_input.get("command", "")).lower()
            if DESTRUCTIVE_RE.search(command):
                decision = deny(f"destructive command blocked for Claude {role}", "PreToolUse")
    log_error = None
    try:
        append_jsonl(log, {"at": now(), "event": event, "role": role, "prompt_id": prompt_id, "tool_name": tool_name, "payload": redact(payload), "denied": decision is not None})
    except (OSError, TimeoutError, UnicodeError) as exc:
        log_error = str(exc)
    if event == "stop":
        (evidence / "claude" / session).mkdir(parents=True, exist_ok=True)
        (evidence / "claude" / session / "stop-event.json").write_text(json.dumps(redact(payload), ensure_ascii=False, indent=2), encoding="utf-8")
    if decision:
        print(json.dumps(decision, ensure_ascii=False))
        return 0
    if log_error and os.environ.get("EVIDENCE_REQUIRED") == "1":
        print(json.dumps(deny(f"evidence audit logging failed: {log_error}", event), ensure_ascii=False))
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
