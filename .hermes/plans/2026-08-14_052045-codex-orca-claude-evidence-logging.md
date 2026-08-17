# Codex 주도 Orca–Claude 증적 로깅 Implementation Plan

> **For Hermes:** 이 계획을 구현할 때 일반 서브에이전트가 아니라 Orca orchestration의 `Run → Task → Dispatch → worker_done` 수명주기를 사용한다. Hermes(Codex)가 계획·핵심 설계·검증을 소유하고 Claude Code가 코드 편집과 구현 명령을 수행한다.

**Goal:** 게임 개발의 모든 사용자 프롬프트마다 Codex 계획, Orca 작업/Dispatch, Claude 구현 지시와 결과, Codex 리뷰와 수정 지시, 수정 전후 diff, 독립 검증 로그, 사람의 게임 디자인 결정을 날짜별·프롬프트별 폴더에 자동 보존하는 프로젝트 로컬 워크플로를 만든다.

**Architecture:** `scripts/evidence/`의 단일 Python CLI가 프롬프트 증적 폴더와 manifest를 생성·갱신하며, `AGENTS.md`가 Hermes의 매 프롬프트 운영 규칙을 고정한다. Claude Code의 `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop` hook은 작업자 측 이벤트를 같은 폴더에 기록하고, Orca CLI의 JSON 영수증은 coordinator가 직접 저장한다. Hermes 자체에 검증되지 않은 범용 prompt hook이 있다고 가정하지 않고, 프로젝트 컨텍스트 규칙과 오케스트레이션 진입 스크립트를 결합해 fail-closed로 운용한다.

**Tech Stack:** Python 3.11 표준 라이브러리, Git, Orca CLI 1.4.180 orchestration, Claude Code 2.1.231 hooks, Markdown/JSON/JSONL, pytest(스크립트 테스트용).

---

## 1. 현재 상태와 선행 조건

### 확인된 상태

- 작업 경로: `D:\개인 pjt\codex 게임 해커톤`
- 현재 경로는 **Git 저장소가 아니다**.
- Orca runtime은 실행 중이며 orchestration capability를 제공한다.
- Claude Code 2.1.231은 설치·로그인되어 있다.
- 현재 바인딩된 Orca Run은 없고, `run_legacy_local`은 inspect-only 상태다.
- 현재 확인된 산출물은 `codex_game_builders_guide.md`와 `.hermes/` 내부 계획·출처 파일이다.

### 구현 전 인간 결정 게이트

Git diff와 수정 전후 비교를 신뢰하려면 Git 저장소가 필수다. 구현자는 자의적으로 `git init`하지 않는다. 다음 중 하나를 인간이 명시적으로 선택해야 한다.

1. 이 경로를 실제 게임 저장소로 초기화하도록 승인한다.
2. 기존 Git 게임 저장소의 정확한 경로를 제공한다.
3. Git 없이 파일 스냅샷 기반으로만 시작한다. 이 경우 commit SHA 기반 증적과 정확한 rename/delete diff는 제공할 수 없음을 승인한다.

**권장:** 1 또는 2. 이후 모든 프롬프트는 깨끗한 작업 트리 또는 프롬프트 전용 Orca worktree에서 시작한다.

---

## 2. 목표 역할 구조

### Hermes(Codex) — coordinator, planner, design/verification owner

매 프롬프트마다 다음을 직접 책임진다.

1. 사용자 요청 원문 보존 및 범위 분류
2. 사람의 게임 디자인 결정과 미결정 사항 분리
3. 코드베이스 조사와 구현 계획 작성
4. 핵심 게임 로직의 알고리즘, 상태 전이, 불변식, 테스트 벡터 설계
5. Claude에게 전달할 구체적 구현 지시 작성
6. Orca Run/Task/Dispatch 생성과 완료 추적
7. Claude 결과의 실제 파일·diff 독립 검사
8. 결함 보고서와 수정 지시 작성
9. 수정 후 테스트·린트·타입 검사·빌드 독립 실행
10. 최종 승인 또는 차단 판정

Codex의 기여가 단순 관리에 그치지 않도록 각 프롬프트의 `02-codex-plan.md`에 최소한 아래 중 하나를 포함시킨다.

- 핵심 로직 알고리즘 또는 상태 머신
- 데이터 모델·API 계약
- 실패 조건과 엣지 케이스
- 테스트 케이스와 예상 결과
- 성능·안정성 제약
- Claude 초안에서 발견한 구체적 결함과 수정 설계

### Claude Code — implementation worker

- Codex가 승인한 계획과 acceptance criteria를 바탕으로 실제 파일을 생성·수정한다.
- 필요한 구현 명령과 집중 테스트를 수행한다.
- 변경 파일, 명령, 결과, 미완료 사항을 `worker_done`으로 보고한다.
- Codex가 작성한 결함·수정 지시를 적용한다.
- 별도 승인 없이는 commit, push, history rewrite를 하지 않는다.

### 사람 — game design authority

- 콘셉트, 재미, 난이도, 아트·사운드 방향, 우선순위, 트레이드오프를 결정한다.
- Codex나 Claude가 임의로 디자인 결정을 확정하지 못하도록 미결정 항목은 decision gate로 남긴다.
- 각 프롬프트의 `01-human-design-decisions.md`에는 `결정됨 / 제안 / 미결정 / 변경됨` 상태를 기록한다.

---

## 3. 로그 디렉터리 규격

프로젝트 루트에 다음 구조를 만든다.

```text
logs/
└── YYYY-MM-DD/
    └── prompt-YYYYMMDD-HHMMSS-<short-id>-<slug>/
        ├── manifest.json
        ├── 00-user-request.md
        ├── 01-human-design-decisions.md
        ├── 02-codex-plan.md
        ├── 03-codex-implementation-design.md
        ├── 04-claude-implementation-brief.md
        ├── 05-claude-result.md
        ├── 06-codex-review.md
        ├── 07-codex-fix-request.md
        ├── 08-final-verification.md
        ├── 09-final-summary.md
        ├── orca/
        │   ├── run-create.json
        │   ├── task-create.json
        │   ├── worker-start.json
        │   ├── dispatch-show.json
        │   ├── worker-done.json
        │   ├── correction-task-create.json
        │   ├── correction-worker-start.json
        │   └── messages.jsonl
        ├── claude/
        │   ├── prompt-events.jsonl
        │   ├── tool-events.jsonl
        │   ├── stop-event.json
        │   └── transcript-summary.md
        ├── diff/
        │   ├── 00-baseline-status.txt
        │   ├── 01-baseline-metadata.json
        │   ├── 10-claude-first-pass.patch
        │   ├── 20-codex-reviewed.patch
        │   ├── 30-after-fix.patch
        │   └── 40-fix-only.patch
        ├── verification/
        │   ├── commands.json
        │   ├── focused-tests.log
        │   ├── lint.log
        │   ├── typecheck.log
        │   ├── full-tests.log
        │   ├── build.log
        │   └── result.json
        └── checksums.sha256
```

### 명명 규칙

- 날짜 폴더는 로컬 운영 날짜 `YYYY-MM-DD`를 사용한다.
- 프롬프트 폴더는 `prompt-YYYYMMDD-HHMMSS-<8자 UUID>-<slug>`로 생성한다.
- 동일 초에 병렬 프롬프트가 시작되어도 UUID로 충돌을 방지한다.
- `manifest.json`의 `prompt_id`가 파일 시스템·Orca task spec·Claude 환경 변수의 공통 상관관계 ID가 된다.

### manifest 필수 필드

```json
{
  "schema_version": "1.0",
  "prompt_id": "prompt-20260814-052045-a1b2c3d4-example",
  "created_at": "ISO-8601 with timezone",
  "completed_at": null,
  "status": "started",
  "user_request_sha256": "...",
  "repo_root": "...",
  "git_head_before": "...",
  "git_head_after": null,
  "git_branch": "...",
  "dirty_at_start": false,
  "human_decision_status": "captured|pending|not_applicable",
  "orca_run_id": null,
  "orca_task_ids": [],
  "orca_dispatch_ids": [],
  "claude_session_id": null,
  "verification": {
    "focused_tests": "pending",
    "lint": "pending",
    "typecheck": "pending",
    "full_tests": "pending",
    "build": "pending"
  },
  "final_outcome": null
}
```

---

## 4. 자동화 경계와 hook 설계

### 중요한 제약

Claude Code는 공식 hook 이벤트를 제공하지만, 현재 확인된 Hermes 설치에 Claude와 동일한 `UserPromptSubmit` 프로젝트 hook이 있다고 단정할 근거는 없다. 따라서 구현은 존재하지 않는 Hermes hook을 꾸며내지 않는다.

### 적용 방식

1. **Hermes 매 프롬프트 강제:** 프로젝트 루트 `AGENTS.md`에 evidence lifecycle을 필수 규칙으로 기록한다.
2. **프롬프트 시작:** Hermes는 코딩 관련 사용자 프롬프트를 받으면 가장 먼저 `python scripts/evidence/evidence.py start ...`를 호출한다.
3. **Orca dispatch 전:** `evidence.py record-plan`, `record-human-decisions`, `record-brief`가 성공하지 않으면 dispatch를 금지한다.
4. **Claude worker hook:** `.claude/settings.json`에서 Claude hook runner를 등록하고 `EVIDENCE_DIR`, `PROMPT_ID`, `ORCA_TASK_ID`, `ORCA_DISPATCH_ID`를 worker 시작 환경에 전달한다.
5. **Codex 검증:** Claude 완료 후 coordinator가 직접 diff를 생성하고 검증 명령을 실행한다. Claude의 self-report를 통과 증거로 사용하지 않는다.
6. **종료 hook 역할:** `evidence.py finalize`가 필수 파일, Orca JSON, diff, 검증 로그를 확인하고 누락 시 non-zero로 실패한다.

### Claude hook 이벤트

`.claude/settings.json`에 다음 이벤트를 프로젝트 로컬로 등록한다.

- `UserPromptSubmit` → `scripts/evidence/claude_hook.py user-prompt-submit`
- `PreToolUse` → `scripts/evidence/claude_hook.py pre-tool-use`
- `PostToolUse` → `scripts/evidence/claude_hook.py post-tool-use`
- `Stop` → `scripts/evidence/claude_hook.py stop`

Hook은 JSON stdin을 받아 JSONL로 append한다. 다음 보안 규칙을 적용한다.

- `.env`, 인증 토큰, 쿠키, API key 값은 저장하지 않는다.
- 명령 전체에 secret 패턴이 있으면 값 부분을 `[REDACTED]`로 바꾼다.
- 파일 본문 전체를 tool log에 복제하지 않고 파일 경로, operation, 결과 상태, hash만 저장한다.
- hook 실패 시 코드 편집을 조용히 계속하지 않고, `EVIDENCE_REQUIRED=1`이면 non-zero로 중단한다.
- 로그 파일에는 append lock을 사용해 병렬 tool 이벤트 손상을 막는다.

---

## 5. 프롬프트별 상태 머신

```text
RECEIVED
  → STARTED
  → HUMAN_DECISIONS_CAPTURED | DECISION_GATE_PENDING
  → PLAN_FROZEN
  → DISPATCHED_TO_CLAUDE
  → CLAUDE_DONE
  → CODEX_REVIEWED
  → FIX_REQUIRED → CORRECTION_DISPATCHED → CLAUDE_DONE
  → CODEX_VERIFIED
  → FINALIZED
```

### Fail-closed 조건

다음 중 하나라도 발생하면 `FINALIZED`로 만들지 않고 `BLOCKED` 또는 `FAILED`로 종료한다.

- Git 저장소가 아니며 스냅샷 모드 승인도 없음
- 시작 시 dirty working tree인데 사용자 승인·격리 worktree가 없음
- 사용자 요청 원문 또는 사람 디자인 결정 파일 누락
- Codex 계획 없이 Claude dispatch 시도
- Orca task/dispatch 영수증 누락
- `worker_done` 없이 Claude 완료로 간주
- Codex 리뷰 없이 최종 검증 시도
- 필수 테스트·빌드 명령이 정의되지 않음
- 검증 명령 non-zero
- diff 또는 checksum 누락
- secret scanner가 민감정보를 발견

---

## 6. 구현 작업 계획

### Task 0: Git/저장소 결정 게이트

**Objective:** diff와 baseline을 신뢰할 수 있는 저장소 경계를 확정한다.

**Files:** 없음 — 인간 결정 전에는 코드 파일을 만들지 않는다.

**Steps:**

1. `git rev-parse --show-toplevel`을 실행해 실제 저장소인지 확인한다.
2. 저장소가 아니라면 이 계획의 §1 선택지를 사용자에게 제시한다.
3. 승인된 repo root를 `repo_root`로 고정한다.
4. `git status --porcelain=v1` 결과가 비어 있는지 확인한다.
5. 기존 변경이 있으면 새 Orca worktree 사용 또는 사용자의 명시적 baseline 승인 중 하나를 선택한다.

**Verification:**

```bash
git rev-parse --is-inside-work-tree
git status --porcelain=v1
git branch --show-current
```

Expected: 첫 명령 `true`; 새 프롬프트 기본값은 clean working tree.

---

### Task 1: 증적 스키마와 운영 문서 정의

**Objective:** 모든 산출물의 이름, 필수 여부, 상태 전이를 기계 검증 가능하게 정의한다.

**Files:**

- Create: `docs/evidence-workflow.md`
- Create: `scripts/evidence/schema.json`
- Create: `tests/evidence/test_schema.py`

**Steps:**

1. 실패하는 schema validation 테스트를 작성한다.
2. 누락된 `prompt_id`, Orca IDs, verification 결과가 실패하는지 확인한다.
3. `schema.json`과 상태 전이를 구현한다.
4. 문서에 역할 분담, 폴더 구조, redaction, fail-closed 조건을 기록한다.

**Verification:**

```bash
python -m pytest tests/evidence/test_schema.py -v
```

Expected: schema positive/negative cases all pass.

---

### Task 2: Evidence CLI 구현

**Objective:** 프롬프트 폴더 생성, artifact 기록, manifest 전이, checksum, finalize를 한 CLI로 제공한다.

**Files:**

- Create: `scripts/evidence/__init__.py`
- Create: `scripts/evidence/evidence.py`
- Create: `scripts/evidence/redact.py`
- Create: `tests/evidence/test_evidence_cli.py`
- Create: `tests/evidence/test_redact.py`

**CLI 계약:**

```text
python scripts/evidence/evidence.py start --request-file <path> --slug <slug>
python scripts/evidence/evidence.py record --dir <prompt-dir> --kind <kind> --source <file>
python scripts/evidence/evidence.py capture-git --dir <prompt-dir> --stage baseline|first-pass|after-review|after-fix
python scripts/evidence/evidence.py capture-orca --dir <prompt-dir> --kind <kind> --source <json>
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --name <name> -- <command...>
python scripts/evidence/evidence.py finalize --dir <prompt-dir> --outcome succeeded|failed|blocked
python scripts/evidence/evidence.py validate --dir <prompt-dir>
```

**Steps:**

1. 임시 repo에서 `start` 폴더 구조를 검증하는 실패 테스트를 작성한다.
2. timestamp + UUID 생성과 atomic `manifest.json` write를 구현한다.
3. artifact kind allowlist와 파일명 매핑을 구현한다.
4. Git baseline과 patch 캡처를 구현한다.
5. command argv, 시작/종료 시각, exit code, stdout/stderr log path를 기록한다.
6. secret redaction과 checksum 생성을 구현한다.
7. 필수 artifact가 빠진 finalize가 실패하는 테스트를 작성한다.
8. 성공 경로와 중간 실패 경로를 통합 테스트한다.

**Verification:**

```bash
python -m pytest tests/evidence/test_evidence_cli.py tests/evidence/test_redact.py -v
```

Expected: 폴더 충돌, partial write, secret redaction, missing artifact, failed command cases 포함 전부 pass.

---

### Task 3: 수정 전후 diff의 정확한 정의 구현

**Objective:** “수정 전후 diff”를 모호한 스크린샷이 아니라 재현 가능한 Git patch 세트로 만든다.

**Files:**

- Modify: `scripts/evidence/evidence.py`
- Create: `tests/evidence/test_git_capture.py`

**Patch 의미:**

- `00-baseline-status.txt`: 프롬프트 시작 시 status
- `01-baseline-metadata.json`: HEAD SHA, branch, tracked/untracked 목록
- `10-claude-first-pass.patch`: baseline HEAD/승인된 index 대비 Claude 첫 구현 전체
- `20-codex-reviewed.patch`: Codex 리뷰 시점 전체 변경
- `30-after-fix.patch`: 수정 후 최종 전체 변경
- `40-fix-only.patch`: 첫 pass 스냅샷과 수정 후 스냅샷 사이의 교정분

Git object에 임시 commit을 만들거나 사용자의 history를 변경하지 않는다. 필요하면 임시 snapshot tree/index를 `logs/.../diff/` 밖의 OS temp에 만들고 종료 시 제거한다.

**Verification:**

```bash
python -m pytest tests/evidence/test_git_capture.py -v
```

Expected: modify/add/delete/rename/untracked 및 공백 포함 경로가 모두 정확히 표현된다.

---

### Task 4: Claude Code hook runner 구현

**Objective:** Claude에게 전달된 프롬프트와 tool lifecycle을 해당 prompt 폴더에 자동 연결한다.

**Files:**

- Create: `scripts/evidence/claude_hook.py`
- Create: `tests/evidence/test_claude_hook.py`
- Create: `.claude/settings.json`

**Steps:**

1. 샘플 Claude hook JSON을 fixture로 만든다.
2. `EVIDENCE_DIR`이 없을 때 fail-closed 동작을 테스트한다.
3. prompt, pre-tool, post-tool, stop 이벤트를 JSONL에 append한다.
4. tool input의 secret와 파일 본문을 축약·redact한다.
5. Windows 경로와 UTF-8 한글 프롬프트를 검증한다.
6. `.claude/settings.json`에는 절대 경로 대신 `$CLAUDE_PROJECT_DIR` 기반 명령을 사용한다.

**Verification:**

```bash
python -m pytest tests/evidence/test_claude_hook.py -v
python scripts/evidence/claude_hook.py self-test
```

Expected: 네 hook 유형, redaction, 동시 append, Windows path 모두 pass.

---

### Task 5: Hermes 프로젝트 규칙 적용

**Objective:** 코딩 관련 모든 사용자 프롬프트가 evidence lifecycle을 우회하지 못하게 한다.

**Files:**

- Create: `AGENTS.md`
- Create: `templates/evidence/codex-plan.md`
- Create: `templates/evidence/human-design-decisions.md`
- Create: `templates/evidence/claude-brief.md`
- Create: `templates/evidence/codex-review.md`
- Create: `templates/evidence/final-verification.md`
- Create: `tests/evidence/test_project_rules.py`

**AGENTS.md 핵심 규칙:**

1. 코딩·게임 디자인·버그 수정 프롬프트는 `evidence.py start`가 첫 side effect다.
2. 질문·설명처럼 repo 변경이 없는 프롬프트는 lightweight record를 남기되 Orca dispatch는 생략한다.
3. 코드 작성 전 Codex plan과 human decision 파일을 생성한다.
4. Claude 편집은 반드시 Orca tracked dispatch로만 수행한다.
5. Claude 결과는 self-report이며 Codex가 diff와 테스트를 독립 검증한다.
6. 결함이 있으면 Codex review와 fix request를 기록한 뒤 같은 terminal 재사용 또는 새 correction dispatch를 만든다.
7. 완료 답변 전 `evidence.py finalize`가 성공해야 한다.
8. commit/push는 사용자 명시 요청 없이는 금지한다.

**주의:** 현재 상위 프로젝트에서 로드된 `AGENTS.md`는 다른 경로의 통합 GPU 대시보드 규칙을 담고 있으므로, 실제 게임 저장소 root가 확정된 뒤 그 root에 맞는 프로젝트 규칙을 작성한다. 잘못된 폴더에 규칙을 덮어쓰지 않는다.

**Verification:**

```bash
python -m pytest tests/evidence/test_project_rules.py -v
```

Expected: 필수 lifecycle 문구, 경로, 금지사항이 모두 확인된다.

---

### Task 6: Orca coordinator wrapper 구현

**Objective:** Run/Task/Dispatch JSON을 매 프롬프트 폴더에 빠짐없이 저장한다.

**Files:**

- Create: `scripts/evidence/orca_prompt.py`
- Create: `tests/evidence/test_orca_prompt.py`

**동작:**

1. 프롬프트별 새 Run을 만들거나 활성 개발 세션 Run에 prompt task를 parent로 만든다.
2. 구현 Task spec에 `prompt_id`, 계획 경로, acceptance criteria, 금지사항, 보고 형식을 포함한다.
3. `orca orchestration worker-start --task ... --worktree current --agent claude --json` 영수증을 저장한다.
4. `check --wait --types worker_done,escalation,question`으로 완료를 추적한다.
5. question은 Codex가 답하고 모든 message를 `orca/messages.jsonl`에 저장한다.
6. worker_done 후 즉시 correction task로 재사용하거나 `worker-release`한다.
7. correction은 새로운 task/dispatch ID를 부여해 최초 구현과 구분한다.

**중요:** wrapper가 shell 출력 문자열을 임의 파싱하지 않고 Orca `--json` 결과를 JSON으로 검증한다.

**Verification:**

```bash
python -m pytest tests/evidence/test_orca_prompt.py -v
orca status --json
```

실 Orca smoke test는 no-op Claude task로 수행하고 다음을 확인한다.

```bash
orca orchestration task-list --json
orca orchestration dispatch-show --task <task-id> --json
```

Expected: 저장된 task/dispatch IDs가 runtime 조회 결과와 일치한다.

---

### Task 7: Codex 독립 리뷰·교정 루프 구현

**Objective:** Claude 첫 구현과 Codex 검증·수정 지시를 분리된 증적으로 남긴다.

**Files:**

- Modify: `scripts/evidence/orca_prompt.py`
- Create: `scripts/evidence/review_gate.py`
- Create: `tests/evidence/test_review_gate.py`

**Review 문서 필수 항목:**

- Finding ID
- severity: blocking/high/medium/low
- file:line
- 재현 절차
- 예상 동작과 실제 동작
- root cause
- Codex 수정 설계
- 필요한 테스트
- 상태: Open/Fixed/Rejected/Escalated

**Steps:**

1. Claude 첫 pass 후 즉시 `10-claude-first-pass.patch`를 고정한다.
2. Codex가 실제 diff와 파일을 읽고 `06-codex-review.md`를 작성한다.
3. open finding이 있으면 `07-codex-fix-request.md`를 만든다.
4. correction Task/Dispatch를 만들고 Claude에게 전달한다.
5. 수정 후 `30-after-fix.patch`, `40-fix-only.patch`를 생성한다.
6. 모든 blocking/high finding이 Fixed가 아니면 finalize를 차단한다.

**Verification:**

```bash
python -m pytest tests/evidence/test_review_gate.py -v
```

Expected: unresolved blocking finding이 있는 경우 finalize non-zero.

---

### Task 8: 테스트·린트·빌드 증적 실행기 구현

**Objective:** Codex가 직접 실행한 품질 게이트의 원문 로그와 exit code를 보존한다.

**Files:**

- Create: `evidence.config.json`
- Modify: `scripts/evidence/evidence.py`
- Create: `tests/evidence/test_command_capture.py`

**설정 예시:**

```json
{
  "commands": {
    "focused_tests": [],
    "lint": [],
    "typecheck": [],
    "full_tests": [],
    "build": []
  },
  "required": ["focused_tests", "lint", "full_tests", "build"]
}
```

실제 게임 기술 스택이 결정된 후 정확한 명령을 채운다. package manifest를 확인하기 전 `npm test`, `pytest` 등을 추측해서 넣지 않는다.

**Steps:**

1. argv array만 허용해 shell injection을 방지한다.
2. 각 명령의 cwd, env allowlist, 시작/종료 시각, exit code를 기록한다.
3. stdout/stderr를 원문 log에 저장한다.
4. 실패 명령이 있으면 `result.json`과 manifest를 failed로 갱신한다.
5. Claude가 실행한 로그와 Codex가 독립 실행한 로그를 구분한다.

**Verification:**

```bash
python -m pytest tests/evidence/test_command_capture.py -v
```

Expected: 성공, 실패, timeout, UTF-8, 대용량 출력 케이스 pass.

---

### Task 9: 사람의 게임 디자인 결정 ledger 구현

**Objective:** 매 프롬프트에서 인간 결정과 AI 제안을 명확히 구분한다.

**Files:**

- Create: `docs/game-design-decisions.md`
- Create: `scripts/evidence/design_decision.py`
- Create: `tests/evidence/test_design_decision.py`

**프롬프트별 표 형식:**

```markdown
| ID | 상태 | 영역 | 결정/질문 | 결정 주체 | 근거 | 이전 결정 | 구현 영향 |
|---|---|---|---|---|---|---|---|
| HDD-001 | 결정됨 | Core Loop | ... | Human | 사용자 원문 | - | ... |
| HDD-002 | 미결정 | Difficulty | ... | Human required | ... | - | BLOCKING |
```

- `결정됨`: 사용자가 명시적으로 선택
- `제안`: Codex/Claude가 제안했으나 아직 승인 안 됨
- `미결정`: 구현 방향을 바꾸는 질문
- `변경됨`: 기존 결정을 사용자가 수정
- 디자인 영향이 있는 `미결정`은 Orca decision gate 또는 사용자 질문으로 차단한다.
- 프로젝트 전역 ledger에는 프롬프트별 결정 링크만 append하고, 원문 증적은 prompt 폴더에 둔다.

**Verification:**

```bash
python -m pytest tests/evidence/test_design_decision.py -v
```

Expected: AI 제안을 인간 결정으로 잘못 표시하면 validation 실패.

---

### Task 10: End-to-end dry run

**Objective:** 하나의 작은 테스트 변경을 통해 전체 흐름과 산출물 완전성을 검증한다.

**Files:** 실제 게임 저장소 확정 후 harmless fixture 또는 문서 테스트 파일 사용.

**Dry run 시나리오:**

1. 테스트용 사용자 프롬프트를 시작한다.
2. date/prompt 폴더와 baseline을 만든다.
3. 사람 결정 1개와 Codex plan/implementation design을 기록한다.
4. Orca Claude worker를 dispatch한다.
5. Claude가 작은 변경과 테스트를 수행하고 worker_done을 보낸다.
6. Codex가 의도적으로 발견 가능한 결함을 리뷰한다.
7. correction dispatch로 수정한다.
8. Codex가 모든 품질 게이트를 재실행한다.
9. diff 4종과 checksum을 생성한다.
10. finalize 후 schema와 필수 파일을 검증한다.

**Final verification commands:**

```bash
python -m pytest tests/evidence -v
python scripts/evidence/evidence.py validate --dir logs/<date>/<prompt-id>
sha256sum -c logs/<date>/<prompt-id>/checksums.sha256
orca orchestration task-list --json
orca orchestration dispatch-show --task <task-id> --json
```

Expected:

- tests all pass
- artifact validation exit 0
- checksum validation exit 0
- Orca runtime IDs와 저장 영수증 일치
- secret scan 0 findings
- unresolved blocking review 0

---

## 7. 매 프롬프트 실제 운영 순서

1. Hermes가 사용자 요청을 수신한다.
2. `start`로 prompt folder를 만들고 요청 원문을 저장한다.
3. Git baseline과 dirty state를 캡처한다.
4. 사람의 기존 결정, 새 결정, 미결정 항목을 작성한다.
5. 미결정 blocking 항목이 있으면 사용자에게 물어보고 기다린다.
6. Codex가 계획과 핵심 구현 설계를 작성한다.
7. 계획 hash를 manifest에 고정한다.
8. Claude implementation brief를 생성한다.
9. Orca Task와 Claude Dispatch를 만들고 JSON 영수증을 저장한다.
10. Claude hook이 prompt/tool/stop 이벤트를 자동 기록한다.
11. worker_done을 수신하고 Claude 결과를 저장한다.
12. 첫 pass patch를 고정한다.
13. Codex가 실제 diff·파일·테스트를 독립 리뷰한다.
14. 결함이 있으면 review/fix request를 기록하고 correction Dispatch를 만든다.
15. 수정 후 final/fix-only patch를 만든다.
16. Codex가 focused test, lint, typecheck, full test, build를 직접 실행한다.
17. 최종 요약과 사람에게 남은 판단을 기록한다.
18. checksum과 manifest를 finalize한다.
19. `finalize` exit 0인 경우에만 사용자에게 완료를 보고한다.

---

## 8. 로그 보존·Git 정책

### 권장 Git 추적 범위

- 추적 권장: `AGENTS.md`, `docs/evidence-workflow.md`, `scripts/evidence/`, `tests/evidence/`, templates, config schema
- 프롬프트 증적 `logs/`는 해커톤 제출 증거이므로 기본적으로 추적할 가치가 있다.
- 단, 원문 transcript와 tool log에 개인정보·절대경로·대용량 출력이 포함될 수 있어 공개 저장소라면 다음 중 하나를 인간이 선택한다.
  1. redacted logs만 Git 추적
  2. logs는 private repo에서만 추적
  3. logs는 `.gitignore`하고 제출 시 별도 archive

### 크기 제어

- tool event는 1건당 최대 크기를 제한한다.
- build/test log는 원문 파일로 두되 manifest에는 hash와 요약만 둔다.
- 바이너리·스크린샷은 별도 `artifacts/`에 두고 hash로 연결한다.
- prompt 폴더를 삭제·재작성하지 않고 append 또는 새 correction artifact로 남긴다.

### 개인정보·시크릿

- `.env`, credential 파일, OAuth token, cookie는 읽거나 로그로 복사하지 않는다.
- 이메일·전화번호 등 해커톤 신청 개인정보는 코드 개발 prompt log에서 제외한다.
- 제출용 공개 증적을 만들 때는 `scripts/evidence/evidence.py export --redacted` 기능을 후속 범위로 추가할 수 있다. 최초 구현에는 YAGNI 원칙상 필수 기능만 넣는다.

---

## 9. 수락 기준

- [ ] 모든 코딩 프롬프트에 `logs/YYYY-MM-DD/prompt-.../manifest.json`이 생성된다.
- [ ] 사용자 요청 원문과 사람의 디자인 결정이 구분되어 저장된다.
- [ ] Codex 계획과 핵심 구현 설계 없이 Claude Dispatch를 만들 수 없다.
- [ ] 모든 Claude 구현은 Orca task/dispatch ID와 연결된다.
- [ ] Claude prompt/tool/stop hook 이벤트가 같은 prompt folder에 기록된다.
- [ ] Claude 결과는 `worker_done`과 실제 diff 양쪽으로 검증된다.
- [ ] Codex 리뷰와 수정 지시는 별도 파일로 남는다.
- [ ] 최초 구현, 리뷰 시점, 수정 후 전체, fix-only patch를 재현할 수 있다.
- [ ] 테스트·린트·타입 검사·빌드의 명령, 원문 로그, exit code가 저장된다.
- [ ] 필수 artifact 누락 또는 검증 실패 시 finalize가 실패한다.
- [ ] checksum 검증이 통과한다.
- [ ] secret redaction 테스트가 통과한다.
- [ ] Git/Orca/Claude의 모든 ID가 manifest로 상호 연결된다.
- [ ] 최종 사용자 보고에 prompt log 경로와 검증 결과가 포함된다.

---

## 10. 위험과 트레이드오프

| 위험 | 영향 | 완화 |
|---|---|---|
| 현재 폴더가 Git repo가 아님 | 신뢰 가능한 diff 불가 | 구현 전 인간 Git 결정 게이트 |
| “매 프롬프트” hook을 Hermes가 네이티브 지원한다고 오인 | 자동화 누락 | AGENTS.md + mandatory start/finalize CLI, 확인된 Claude hook만 사용 |
| 로그에 secret/PII 포함 | 보안·공개 위험 | allowlist, redaction, 본문 미복제, secret scan |
| 로그가 과도하게 커짐 | repo 비대화 | JSONL 크기 제한, hash 중심 manifest, 보존 정책 |
| 병렬 프롬프트 충돌 | 증적 혼합 | UUID prompt ID, file lock, task/dispatch correlation |
| Claude self-report에 의존 | 허위 완료 가능 | Codex가 실제 diff와 품질 게이트 독립 실행 |
| 사용자 디자인과 AI 제안 혼동 | 제출 설명 부정확 | decision ledger 상태와 인간 승인 gate |
| Codex 기여가 관리에만 머묾 | Codex Collaboration 약화 | 매 prompt 핵심 설계·테스트·결함 수정 산출물 의무화 |
| hooks가 Claude 버전별 payload 차이 | 기록 중단 | fixture + unknown-field tolerant parser + schema version |

---

## 11. 구현 전 열려 있는 질문

1. 실제 게임 저장소는 현재 경로를 Git으로 초기화할 것인가, 별도 기존 저장소를 사용할 것인가?
2. `logs/`를 Git에 포함할 것인가, private archive로 관리할 것인가?
3. 게임 기술 스택과 정확한 test/lint/typecheck/build 명령은 무엇인가?
4. 하나의 장기 Orca Run 아래 prompt별 parent Task를 둘 것인가, prompt마다 Run을 분리할 것인가?
   - 권장: 한 개발 세션 Run + prompt별 parent Task. 세션 간 검색성과 worker 재사용성이 좋다.
5. 비코딩 질문도 full evidence를 남길 것인가?
   - 권장: 비코딩 질문은 `00-user-request.md`, `01-human-design-decisions.md`, `09-final-summary.md`, manifest만 남기는 lightweight mode.

이 다섯 항목 중 1번과 3번은 구현 시작 전 필수이며, 나머지는 위 권장값으로 진행할 수 있다.
