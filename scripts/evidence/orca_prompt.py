from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
from typing import Any


def call_orca(args: list[str], cwd: Path) -> dict[str, Any]:
    proc = subprocess.run(["orca", *args, "--json"], cwd=cwd, text=True, encoding="utf-8", errors="replace", capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr or proc.stdout)
    data = json.loads(proc.stdout)
    if not data.get("ok"):
        raise RuntimeError(json.dumps(data, ensure_ascii=False))
    return data


def save(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    p = argparse.ArgumentParser(); p.add_argument("action", choices=["plan", "verify"]); p.add_argument("--dir", required=True); p.add_argument("--spec", required=True); p.add_argument("--round", type=int, default=1)
    a = p.parse_args(); evidence = Path(a.dir).resolve(); repo = evidence.parents[2]; prompt_id = evidence.name
    role = "planner" if a.action == "plan" else "verifier"
    task = call_orca(["orchestration", "task-create", "--spec", f"{role.upper()} READ-ONLY. prompt_id={prompt_id}; evidence_dir={evidence}; {a.spec}"], repo)
    task_id = task["result"]["task"]["id"]
    filename = "task-plan.json" if a.action == "plan" else f"task-verify-r{a.round}.json"
    save(evidence / "orca" / filename, task)
    pointer = {"evidence_dir": str(evidence), "prompt_id": prompt_id, "role": role}
    (repo / ".evidence-active.json").write_text(json.dumps(pointer, ensure_ascii=False), encoding="utf-8")
    worker = call_orca(["orchestration", "worker-start", "--task", task_id, "--worktree", "current", "--agent", "claude"], repo)
    filename = "dispatch-plan.json" if a.action == "plan" else f"dispatch-verify-r{a.round}.json"
    save(evidence / "orca" / filename, worker)
    print(json.dumps({"task_id": task_id, "dispatch_id": worker["result"]["dispatchId"]}))
    return 0


if __name__ == "__main__": raise SystemExit(main())
