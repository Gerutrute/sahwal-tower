from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
import uuid
from typing import Any, Iterable

try:
    from .redact import redact, redact_text
except ImportError:
    from redact import redact, redact_text

SCHEMA_VERSION = "2.0"
ROLE_FILES = {
    "claude-requirements": "02-claude-requirements-analysis.md",
    "claude-plan": "03-claude-implementation-plan.md",
    "claude-acceptance": "04-claude-acceptance-criteria.md",
    "codex-brief": "05-codex-implementation-brief.md",
    "codex-log": "06-codex-implementation-log.md",
    "codex-result": "07-codex-result.md",
    "claude-verification": "08-claude-verification-report.md",
    "claude-defects": "09-claude-defect-report.md",
    "codex-fix": "10-codex-fix-log.md",
    "final-summary": "11-final-summary.md",
    "human-decisions": "01-human-design-decisions.md",
}
PLAN_FILES = [ROLE_FILES[k] for k in ("claude-requirements", "claude-plan", "claude-acceptance", "codex-brief")]
SOURCE_EXCLUDES = ("logs", ".git", "__pycache__", ".pytest_cache")


def now() -> str:
    return dt.datetime.now().astimezone().isoformat(timespec="seconds")


def run(argv: list[str], cwd: Path, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, cwd=cwd, env=env, text=True, encoding="utf-8", errors="replace", capture_output=True, check=check)


def git(repo: Path, *args: str, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["git", "-c", "core.quotepath=false", *args], repo, env=env, check=check)


def repo_root(path: Path) -> Path:
    result = git(path, "rev-parse", "--show-toplevel")
    return Path(result.stdout.strip()).resolve()


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def load_manifest(directory: Path) -> dict[str, Any]:
    return json.loads((directory / "manifest.json").read_text(encoding="utf-8"))


def save_manifest(directory: Path, manifest: dict[str, Any]) -> None:
    atomic_json(directory / "manifest.json", manifest)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_slug(value: str) -> str:
    slug = re.sub(r"[^0-9A-Za-z가-힣_-]+", "-", value.strip()).strip("-").lower()
    return (slug or "prompt")[:40]


def has_head(repo: Path) -> bool:
    return git(repo, "rev-parse", "--verify", "HEAD", check=False).returncode == 0


def snapshot_tree(repo: Path) -> str:
    fd, index_name = tempfile.mkstemp(prefix="evidence-index-")
    os.close(fd)
    os.unlink(index_name)
    env = os.environ.copy()
    env["GIT_INDEX_FILE"] = index_name
    try:
        base = git(repo, "rev-parse", "--verify", "HEAD", check=False)
        if base.returncode == 0:
            git(repo, "read-tree", base.stdout.strip(), env=env)
        git(repo, "add", "-A", "--", ".", env=env)
        git(repo, "rm", "-r", "--cached", "--ignore-unmatch", "logs", env=env, check=False)
        for ignored in ("__pycache__", ".pytest_cache"):
            git(repo, "rm", "-r", "--cached", "--ignore-unmatch", ignored, env=env, check=False)
        return git(repo, "write-tree", env=env).stdout.strip()
    finally:
        try:
            os.unlink(index_name)
        except FileNotFoundError:
            pass


def tree_patch(repo: Path, before: str, after: str) -> str:
    result = git(repo, "diff", "--no-color", "--binary", before, after, check=False)
    if result.returncode not in (0, 1):
        raise RuntimeError(result.stderr.strip())
    return result.stdout


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = path.with_suffix(path.suffix + ".lock")
    deadline = time.monotonic() + 10
    fd = None
    while fd is None:
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise TimeoutError(f"lock timeout: {lock}")
            time.sleep(0.02)
    try:
        with path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(redact(value), ensure_ascii=False) + "\n")
    finally:
        os.close(fd)
        lock.unlink(missing_ok=True)


def start(args: argparse.Namespace) -> int:
    repo = repo_root(Path.cwd())
    request = Path(args.request_file).resolve()
    request_text = request.read_text(encoding="utf-8")
    baseline = snapshot_tree(repo)
    stamp = dt.datetime.now().astimezone()
    prompt_id = f"prompt-{stamp:%Y%m%d-%H%M%S}-{uuid.uuid4().hex[:8]}-{safe_slug(args.slug)}"
    directory = repo / "logs" / f"{stamp:%Y-%m-%d}" / prompt_id
    for sub in ("orca", "claude/plan-session", "codex/self-check", "diff", "verification"):
        (directory / sub).mkdir(parents=True, exist_ok=True)
    (directory / "00-user-request.md").write_text(request_text, encoding="utf-8", newline="\n")
    (directory / "01-human-design-decisions.md").write_text("# Human Design Decisions\n\n| ID | 상태 | 영역 | 결정/질문 | 결정 주체 | 구현 영향 |\n|---|---|---|---|---|---|\n| HDD-000 | 미결정 | General | 사용자 결정 기록 필요 | Human | BLOCKING |\n", encoding="utf-8")
    status = git(repo, "status", "--short", "--branch").stdout
    (directory / "diff/00-baseline-status.txt").write_text(status, encoding="utf-8")
    head = git(repo, "rev-parse", "HEAD", check=False)
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "prompt_id": prompt_id,
        "created_at": now(),
        "completed_at": None,
        "status": "STARTED",
        "user_request_sha256": hashlib.sha256(request_text.encode()).hexdigest(),
        "repo_root": str(repo),
        "git_branch": git(repo, "branch", "--show-current").stdout.strip(),
        "git_unborn_head": head.returncode != 0,
        "git_head_before": head.stdout.strip() if head.returncode == 0 else None,
        "baseline_tree": baseline,
        "snapshots": {"baseline": baseline},
        "human_decision_status": "pending",
        "plan_hashes": {},
        "orca_tasks": {"prompt": None, "plan": None, "implement": None, "verify": []},
        "orca_dispatches": {"plan": None, "verify": []},
        "verification": {},
        "verifier_tree_unchanged": None,
        "open_defects": [],
        "final_outcome": None,
    }
    atomic_json(directory / "diff/01-baseline-metadata.json", {"tree": baseline, "unborn": manifest["git_unborn_head"], "head": manifest["git_head_before"]})
    save_manifest(directory, manifest)
    print(directory)
    return 0


def record(args: argparse.Namespace) -> int:
    directory = Path(args.dir).resolve()
    filename = ROLE_FILES.get(args.kind)
    if not filename:
        raise ValueError(f"unknown kind: {args.kind}")
    source = Path(args.source).resolve()
    text = source.read_text(encoding="utf-8")
    (directory / filename).write_text(redact_text(text), encoding="utf-8", newline="\n")
    return 0


def snapshot(args: argparse.Namespace) -> int:
    directory = Path(args.dir).resolve()
    manifest = load_manifest(directory)
    repo = Path(manifest["repo_root"])
    tree = snapshot_tree(repo)
    stage = args.stage
    manifest.setdefault("snapshots", {})[stage] = tree
    baseline = manifest["baseline_tree"]
    names = {
        "implementation": "10-codex-implementation.patch",
        "reviewed": "20-codex-reviewed.patch",
        "after-fix": "30-after-fix.patch",
    }
    if stage in names:
        (directory / "diff" / names[stage]).write_text(tree_patch(repo, baseline, tree), encoding="utf-8", newline="\n")
    if stage == "after-fix" and "implementation" in manifest["snapshots"]:
        (directory / "diff/40-fix-only.patch").write_text(tree_patch(repo, manifest["snapshots"]["implementation"], tree), encoding="utf-8", newline="\n")
    if stage == "implementation":
        manifest["status"] = "IMPLEMENTATION_CAPTURED"
    save_manifest(directory, manifest)
    print(tree)
    return 0


def gate(args: argparse.Namespace) -> int:
    directory = Path(args.dir).resolve()
    manifest = load_manifest(directory)
    name = args.name
    if name == "plan-frozen":
        missing = [f for f in PLAN_FILES if not (directory / f).is_file()]
        decisions = (directory / "01-human-design-decisions.md").read_text(encoding="utf-8")
        if missing or "| 미결정 |" in decisions:
            print(json.dumps({"missing": missing, "pending_human_decision": "| 미결정 |" in decisions}, ensure_ascii=False), file=sys.stderr)
            return 2
        hashes = {f: sha256_file(directory / f) for f in PLAN_FILES}
        manifest["plan_hashes"] = hashes
        manifest["status"] = "PLAN_FROZEN"
        manifest["human_decision_status"] = "captured"
        save_manifest(directory, manifest)
        return 0
    if name == "pre-implement":
        if manifest["status"] != "PLAN_FROZEN":
            print("plan is not frozen", file=sys.stderr)
            return 2
        for filename, expected in manifest.get("plan_hashes", {}).items():
            if sha256_file(directory / filename) != expected:
                print(f"plan hash changed: {filename}", file=sys.stderr)
                return 2
        return 0
    if name == "post-verify":
        before = manifest.get("snapshots", {}).get("verify-before")
        after = manifest.get("snapshots", {}).get("verify-after")
        unchanged = bool(before and before == after)
        manifest["verifier_tree_unchanged"] = unchanged
        save_manifest(directory, manifest)
        return 0 if unchanged else 2
    raise ValueError(f"unknown gate: {name}")


def capture_command(args: argparse.Namespace) -> int:
    directory = Path(args.dir).resolve()
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        raise ValueError("command is required")
    manifest = load_manifest(directory)
    repo = Path(manifest["repo_root"])
    started = now()
    started_ns = time.time_ns()
    try:
        proc = subprocess.run(command, cwd=repo, text=True, encoding="utf-8", errors="replace", capture_output=True, timeout=args.timeout, shell=False)
        code, stdout, stderr = proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as exc:
        code = 124
        stdout = exc.stdout or ""
        stderr = (exc.stderr or "") + "\n[TIMEOUT]"
    log_dir = directory / ("verification" if args.role == "verifier" else "codex/self-check")
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"{safe_slug(args.name)}.log"
    log_path.write_text(redact_text(f"$ {' '.join(command)}\n\nSTDOUT\n{stdout}\nSTDERR\n{stderr}\nEXIT {code}\n"), encoding="utf-8", newline="\n")
    receipt = {"name": args.name, "role": args.role, "argv": redact(command), "started_at": started, "completed_at": now(), "duration_ns": time.time_ns() - started_ns, "exit_code": code, "log": str(log_path.relative_to(directory))}
    append_jsonl(directory / ("verification/commands.jsonl" if args.role == "verifier" else "codex/exec-receipts.jsonl"), receipt)
    manifest.setdefault("verification", {})[args.name] = {
        "status": "passed" if code == 0 else "failed",
        "executed_by": args.role,
        "argv": receipt["argv"],
        "exit_code": code,
        "log": receipt["log"],
    }
    save_manifest(directory, manifest)
    return code


def write_checksums(directory: Path) -> None:
    rows = []
    for path in sorted(directory.rglob("*")):
        if path.is_file() and path.name not in {"checksums.sha256"} and not path.name.endswith(".lock"):
            rows.append(f"{sha256_file(path)}  {path.relative_to(directory).as_posix()}")
    (directory / "checksums.sha256").write_text("\n".join(rows) + "\n", encoding="utf-8", newline="\n")


def verify_checksums(directory: Path) -> list[str]:
    failures = []
    checksum = directory / "checksums.sha256"
    if not checksum.is_file():
        return ["checksums.sha256 missing"]
    for line in checksum.read_text(encoding="utf-8").splitlines():
        expected, rel = line.split("  ", 1)
        path = directory / rel
        if not path.is_file() or sha256_file(path) != expected:
            failures.append(rel)
    return failures


def validate(directory: Path, final: bool = False) -> list[str]:
    failures = []
    manifest = load_manifest(directory)
    if manifest.get("schema_version") != SCHEMA_VERSION:
        failures.append("schema_version")
    for base in ("00-user-request.md", "01-human-design-decisions.md", "manifest.json"):
        if not (directory / base).is_file():
            failures.append(base)
    for filename, expected in manifest.get("plan_hashes", {}).items():
        if not (directory / filename).is_file() or sha256_file(directory / filename) != expected:
            failures.append(f"plan hash: {filename}")
    if final:
        for filename in PLAN_FILES + [ROLE_FILES["codex-log"], ROLE_FILES["codex-result"], ROLE_FILES["claude-verification"], ROLE_FILES["final-summary"]]:
            if not (directory / filename).is_file():
                failures.append(filename)
        if manifest.get("verifier_tree_unchanged") is not True:
            failures.append("verifier_tree_unchanged")
        if any(d.get("severity") in ("blocking", "high") and d.get("status") == "Open" for d in manifest.get("open_defects", [])):
            failures.append("open blocking/high defect")
        verifier_results = [
            result for result in manifest.get("verification", {}).values()
            if result.get("executed_by") == "verifier"
        ]
        if not verifier_results:
            failures.append("independent verifier commands")
        config_path = Path(manifest["repo_root"]) / "evidence.config.json"
        if config_path.is_file():
            config = json.loads(config_path.read_text(encoding="utf-8"))
            for required in config.get("required", []):
                result = manifest.get("verification", {}).get(required)
                if not result or result.get("executed_by") != "verifier" or result.get("status") != "passed":
                    failures.append(f"required verifier command: {required}")
                    continue
                expected_argv = config.get("commands", {}).get(required)
                if expected_argv and result.get("argv") != expected_argv:
                    failures.append(f"required verifier argv: {required}")
        for name, result in manifest.get("verification", {}).items():
            if result.get("executed_by") == "verifier" and result.get("status") != "passed":
                failures.append(f"verification failed: {name}")
    return failures


def finalize(args: argparse.Namespace) -> int:
    directory = Path(args.dir).resolve()
    failures = validate(directory, final=args.outcome == "succeeded")
    if failures:
        print(json.dumps({"ok": False, "failures": failures}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 2
    manifest = load_manifest(directory)
    manifest["status"] = "FINALIZED" if args.outcome == "succeeded" else "FAILED"
    manifest["final_outcome"] = args.outcome
    manifest["completed_at"] = now()
    save_manifest(directory, manifest)
    write_checksums(directory)
    return 0


def validate_command(args: argparse.Namespace) -> int:
    failures = validate(Path(args.dir), args.final)
    print(json.dumps({"failures": failures}, ensure_ascii=False))
    return 2 if failures else 0


def verify_checksums_command(args: argparse.Namespace) -> int:
    failures = verify_checksums(Path(args.dir))
    print(json.dumps({"failures": failures}, ensure_ascii=False))
    return 2 if failures else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser("start"); p.add_argument("--request-file", required=True); p.add_argument("--slug", required=True); p.set_defaults(func=start)
    p = sub.add_parser("record"); p.add_argument("--dir", required=True); p.add_argument("--kind", required=True); p.add_argument("--source", required=True); p.set_defaults(func=record)
    p = sub.add_parser("snapshot"); p.add_argument("--dir", required=True); p.add_argument("--stage", required=True); p.set_defaults(func=snapshot)
    p = sub.add_parser("gate"); p.add_argument("--dir", required=True); p.add_argument("--name", required=True); p.set_defaults(func=gate)
    p = sub.add_parser("capture-command"); p.add_argument("--dir", required=True); p.add_argument("--role", choices=["implementer", "verifier"], required=True); p.add_argument("--name", required=True); p.add_argument("--timeout", type=int, default=600); p.add_argument("command", nargs=argparse.REMAINDER); p.set_defaults(func=capture_command)
    p = sub.add_parser("validate"); p.add_argument("--dir", required=True); p.add_argument("--final", action="store_true"); p.set_defaults(func=validate_command)
    p = sub.add_parser("finalize"); p.add_argument("--dir", required=True); p.add_argument("--outcome", choices=["succeeded", "failed", "blocked"], required=True); p.set_defaults(func=finalize)
    p = sub.add_parser("verify-checksums"); p.add_argument("--dir", required=True); p.set_defaults(func=verify_checksums_command)
    return parser


def main() -> int:
    try:
        args = build_parser().parse_args()
        return int(args.func(args))
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
