# AGENTS.md — OpenAI Game Builders 게임 개발 프로젝트

이 문서는 `D:\개인 pjt\codex 게임 해커톤` 저장소에서 AI 에이전트가 따라야 할 프로젝트 규칙과 검증 절차를 정의한다.

## 1. 프로젝트 선언

- **목적:** OpenAI Game Builders 참가용 게임을 기획·구현·검증하고, AI별 기여와 사람의 게임 디자인 결정을 재현 가능한 증적으로 보존한다.
- **현재 단계:** 게임 기술 스택과 게임 디자인은 아직 확정 전이다. 기술 스택, 엔진, 런타임, 빌드 명령을 추측해서 추가하지 않는다.
- **현재 구현:** Python 표준 라이브러리 기반의 프롬프트 증적 CLI, Claude Code hooks, Orca orchestration wrapper와 테스트가 존재한다.
- **버전 관리:** 저장소는 Git `main` 브랜치로 초기화됐지만 아직 최초 커밋이 없는 unborn HEAD 상태일 수 있다.
- **커밋 정책:** 사용자가 명시적으로 요청하기 전에는 commit, push, reset, rebase, history rewrite를 하지 않는다.
- **행사 가이드:** 참가·제출·심사 관련 사실은 `codex_game_builders_guide.md`를 우선 확인한다.

## 2. 역할과 소유권

### 2.1 Claude Code — 계획 및 독립 검증

Claude Code는 다음 작업만 소유한다.

1. 사용자 요구사항과 코드베이스를 읽기 전용으로 분석한다.
2. 구현 계획, 파일별 변경 범위, 엣지 케이스와 기계 검증 가능한 수락 기준을 작성한다.
3. 사람의 게임 디자인 결정과 AI 제안, 미결정 사항을 구분한다.
4. Hermes/Codex 구현 후 fresh Orca dispatch에서 실제 diff와 수락 기준을 독립 검증한다.
5. 테스트·린트·타입 검사·빌드 명령을 직접 실행하고 결함을 보고한다.

Claude Code는 게임 코드나 증적 도구의 소스를 직접 수정하지 않는다. 계획·검증 보고서처럼 지정된 evidence artifact만 작성할 수 있다. 결함을 발견해도 직접 고치지 않고 Hermes/Codex에 수정 요청을 보낸다.

### 2.2 Hermes(Codex) — 조정 및 유일한 구현자

Hermes/Codex는 다음 작업을 소유한다.

1. 사용자 프롬프트의 증적 수명주기를 시작하고 Orca Run/Task/Dispatch를 관리한다.
2. Claude 계획과 수락 기준이 동결된 뒤 실제 코드와 파일을 생성·수정한다.
3. 구현 명령, 변경 파일, 자체 점검과 patch를 증적에 기록한다.
4. Claude가 발견한 결함을 수정하고 새로운 Claude 검증 dispatch를 요청한다.
5. 모든 닫힌 게이트가 통과한 경우에만 완료를 보고한다.

게임 코드와 도구 코드의 실제 작성 주체는 Hermes/Codex여야 한다. Claude에 구현을 위임하거나 Claude가 검증 중 소스를 수정하게 해서는 안 된다.

### 2.3 사람 — 게임 디자인 최종 결정권자

다음은 인간 개발자만 최종 결정할 수 있다.

- 게임 콘셉트, 장르, 핵심 재미와 플레이 루프
- 난이도, 밸런스, 승패 조건과 보상 구조
- 비주얼, 사운드, 내러티브와 사용자 경험 방향
- 일정·품질·범위 트레이드오프
- AI 제안의 채택·변경·기각

AI 제안은 사람의 결정으로 기록하지 않는다. 구현을 좌우하는 미결정 사항은 decision gate로 차단한다.

### 2.4 Orca — 조정 이력

Orca는 Claude의 계획 및 검증 Task/Dispatch, 질문·응답, escalation, `worker_done`을 추적한다. 구조화된 멀티에이전트 작업은 일반 서브에이전트로 대체하지 않는다.

## 3. 코딩 프롬프트 필수 수명주기

게임 코드, 도구, 설정 또는 프로젝트 문서를 변경하는 프롬프트는 다음 순서를 따른다.

1. **Start:** 첫 프로젝트 side effect로 evidence prompt 폴더와 baseline을 만든다.
2. **Human decisions:** 사람의 결정, AI 제안과 blocking 미결정을 분리 기록한다.
3. **Claude plan:** Orca의 Claude planner가 요구 분석·계획·수락 기준·Codex 구현 brief를 작성한다.
4. **Plan freeze:** `plan-frozen`과 `pre-implement` 게이트가 exit 0인지 확인한다.
5. **Codex implementation:** Hermes/Codex가 실제 코드를 구현하고 구현 receipt와 patch를 보존한다.
6. **Claude verification:** 이전 계획 세션과 다른 fresh Claude verifier가 소스를 수정하지 않고 검증한다.
7. **Correction:** 결함이 있으면 Codex가 수정하고 새 Task/Dispatch에서 Claude가 재검증한다.
8. **Finalize:** 검증 전후 source tree가 같고 필수 명령·checksum·artifact가 모두 유효할 때만 완료한다.

동일 실패를 세 번 반복해도 해결되지 않으면 루프를 중단하고 인간에게 에스컬레이션한다.

설명, 질의응답 등 저장소 변경이 없는 요청은 lightweight mode로 처리할 수 있다. 코드·설정·문서를 변경하는 요청은 full lifecycle을 생략하지 않는다.

## 4. 증적 구조

각 코딩 프롬프트의 증적은 아래에 저장한다.

```text
logs/YYYY-MM-DD/prompt-YYYYMMDD-HHMMSS-<uuid>-<slug>/
```

주요 파일의 작성 주체는 다음과 같다.

| 파일 | 소유자 | 내용 |
|---|---|---|
| `00-user-request.md` | Hermes | 사용자 요청 원문 |
| `01-human-design-decisions.md` | Human/Hermes 기록 | 사람 결정·제안·미결정 |
| `02-claude-requirements-analysis.md` | Claude | 요구 분석 |
| `03-claude-implementation-plan.md` | Claude | 구현 계획 |
| `04-claude-acceptance-criteria.md` | Claude | 수락 기준과 검증 방법 |
| `05-codex-implementation-brief.md` | Claude | Codex 구현 지시 |
| `06-codex-implementation-log.md` | Hermes/Codex | 실제 구현 기록 |
| `07-codex-result.md` | Hermes/Codex | 구현 결과 |
| `08-claude-verification-report.md` | Claude | 독립 검증 결과 |
| `09-claude-defect-report.md` | Claude | 결함 및 수정 요청 |
| `10-codex-fix-log.md` | Hermes/Codex | 수정 기록 |
| `11-final-summary.md` | Hermes | 최종 결과와 남은 인간 판단 |

`manifest.json`은 Git tree, 계획 hash, Orca ID, Claude 세션, Codex 구현 receipt와 검증 결과를 연결한다. 역할이 뒤바뀐 artifact는 유효한 증적으로 취급하지 않는다.

## 5. 증적 도구 명령

### 5.1 시작

```bash
python scripts/evidence/evidence.py start \
  --request-file <request-file> \
  --slug <short-slug>
```

### 5.2 계획 동결

```bash
python scripts/evidence/evidence.py gate --dir <prompt-dir> --name plan-frozen
python scripts/evidence/evidence.py gate --dir <prompt-dir> --name pre-implement
```

### 5.3 구현·검증 snapshot

```bash
python scripts/evidence/evidence.py snapshot --dir <prompt-dir> --stage implementation
python scripts/evidence/evidence.py snapshot --dir <prompt-dir> --stage verify-before
python scripts/evidence/evidence.py snapshot --dir <prompt-dir> --stage verify-after
python scripts/evidence/evidence.py gate --dir <prompt-dir> --name post-verify
```

### 5.4 명령 기록

```bash
python scripts/evidence/evidence.py capture-command \
  --dir <prompt-dir> --role implementer --name <name> -- <command>

python scripts/evidence/evidence.py capture-command \
  --dir <prompt-dir> --role verifier --name <name> -- <command>
```

### 5.5 완료

```bash
python scripts/evidence/evidence.py finalize --dir <prompt-dir> --outcome succeeded
python scripts/evidence/evidence.py verify-checksums --dir <prompt-dir>
```

필수 artifact, 계획 hash, 독립 verifier 명령, tree 불변성, 열린 blocking/high 결함, checksum 중 하나라도 유효하지 않으면 완료 상태로 보고하지 않는다.

## 6. 현재 검증 명령

증적 도구를 수정한 경우 아래 명령을 실행한다.

### 6.1 전체 테스트

```bash
python -m unittest discover -s tests -v
```

성공 기준: 종료 코드 0, 실패와 오류 0건.

### 6.2 Python 구문 검사

```bash
python -m py_compile scripts/evidence/*.py tests/evidence/*.py
```

성공 기준: 종료 코드 0, stderr 없음.

### 6.3 Claude hook 스모크

```bash
python scripts/evidence/claude_hook.py self-test
```

성공 기준: 종료 코드 0과 `"ok": true`.

### 6.4 게임 명령

게임 기술 스택 확정 후 `evidence.config.json`에 focused tests, lint, typecheck, full tests와 build 명령을 선언한다. 선언 전에는 npm, Unity, Godot 또는 다른 엔진 명령을 추측하지 않는다. 선언 후에는 Claude verifier가 필수 명령을 직접 실행해야 한다.

## 7. Claude hook 규칙

`.claude/settings.json`은 다음 이벤트를 기록한다.

- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`

Planner와 verifier의 소스 `Write`, `Edit`, `NotebookEdit`은 차단한다. 증적 디렉터리의 허용된 artifact만 작성할 수 있다. commit, push, reset, clean, stash와 파괴적 삭제 명령도 차단한다.

Windows 한국어·공백 경로를 지원하기 위해 hook stdin/stdout은 UTF-8로 처리한다. 작업 디렉터리가 바뀌어도 `$CLAUDE_PROJECT_DIR`에서 hook script와 active evidence pointer를 찾는다. 증적이 필수인데 context 또는 audit 기록이 깨지면 fail-open 하지 않고 deny한다.

## 8. Git과 diff 원칙

- unborn HEAD에서도 임시 `GIT_INDEX_FILE`과 tree object를 사용해 snapshot을 만든다.
- 사용자의 실제 index, refs와 history를 변경하지 않는다.
- `logs/`, Python cache와 선언된 빌드 산출물은 source tree 불변성 비교에서 제외한다.
- baseline, implementation, after-fix, fix-only patch를 가능한 범위에서 보존한다.
- Claude 검증 전후 source tree hash가 다르면 해당 검증은 무효다.
- 사용자가 명시적으로 요청하지 않으면 commit/push하지 않는다.

## 9. 보안·개인정보·라이선스

- `.env`, API key, token, cookie, password, 인증 헤더와 연결 문자열을 읽거나 로그에 복제하지 않는다.
- 로그 전 저장 값은 redaction을 거치며 비밀은 `[REDACTED]`로 대체한다.
- 환경변수 전체 dump와 자격증명 파일 본문을 증적에 남기지 않는다.
- 외부 코드·에셋·폰트·음악·모델을 추가하기 전에 라이선스와 해커톤 제출 가능 여부를 확인한다.
- 외부 네트워크, 계정, 유료 API 또는 새 런타임 의존성이 필요하면 먼저 인간에게 알린다.

## 10. 구현 규칙

- 관련 파일과 호출 경로를 먼저 읽고 실제 심볼·의존성을 확인한다.
- 신규/변경 로직에는 대응 테스트를 추가한다.
- 임시 TODO/FIXME/HACK, 죽은 코드와 검증되지 않은 placeholder를 완료 상태로 남기지 않는다.
- 기능 구현과 무관한 리팩터링·대량 포맷 변경을 섞지 않는다.
- 생성 파일과 계약 파일이 생기면 단일 진실 공급원과 재생성 명령을 문서화한다.
- 테스트 로그와 exit code를 실제 출력으로 보존한다. 실행하지 않은 명령을 통과했다고 쓰지 않는다.
- 시각적 재미, UX와 밸런스는 자동 검증만으로 확정하지 않고 사람의 판단 항목으로 남긴다.

## 11. 완료의 정의

작업은 다음 조건을 모두 만족해야 완료다.

1. Claude의 계획과 수락 기준이 존재하고 hash가 동결됐다.
2. Hermes/Codex가 실제 구현을 수행했고 변경 파일과 명령이 기록됐다.
3. 구현 patch가 존재한다.
4. fresh Claude verifier가 모든 수락 기준을 증거와 1:1로 매핑했다.
5. 필수 테스트·린트·타입 검사·빌드가 exit 0이다.
6. Claude 검증 전후 source tree가 동일하다.
7. blocking/high 결함이 모두 해결됐다.
8. 사람의 게임 디자인 결정과 미결정 사항이 분리 기록됐다.
9. manifest validation, finalize와 checksum 검증이 통과했다.
10. 사용자에게 남은 인간 판단, 미검증 범위와 위험을 숨기지 않고 보고했다.

위 조건이 충족되지 않으면 `BLOCKED`, `FAILED` 또는 미완료 상태로 보고하며 성공으로 포장하지 않는다.