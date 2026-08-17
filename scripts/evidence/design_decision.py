from __future__ import annotations

import argparse
from pathlib import Path

VALID = {"결정됨", "제안", "미결정", "변경됨"}


def append(path: Path, decision_id: str, status: str, area: str, text: str, owner: str, impact: str) -> None:
    if status not in VALID:
        raise ValueError(f"invalid status: {status}")
    if status == "결정됨" and owner.lower() not in {"human", "user", "사람", "사용자"}:
        raise ValueError("AI proposal cannot be recorded as a human decision")
    if not path.exists():
        path.write_text("# Human Design Decisions\n\n| ID | 상태 | 영역 | 결정/질문 | 결정 주체 | 구현 영향 |\n|---|---|---|---|---|---|\n", encoding="utf-8")
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(f"| {decision_id} | {status} | {area} | {text.replace('|', '/')} | {owner} | {impact.replace('|', '/')} |\n")


def main() -> int:
    p = argparse.ArgumentParser(); p.add_argument("--file", required=True); p.add_argument("--id", required=True); p.add_argument("--status", required=True); p.add_argument("--area", required=True); p.add_argument("--text", required=True); p.add_argument("--owner", required=True); p.add_argument("--impact", required=True)
    a = p.parse_args(); append(Path(a.file), a.id, a.status, a.area, a.text, a.owner, a.impact); return 0


if __name__ == "__main__": raise SystemExit(main())
