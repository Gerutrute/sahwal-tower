# 08 — Claude 독립 재검증 보고서 (「사활(死活)의 탑」) — Codex 수정 후 2차

- 검증자: fresh Claude verifier (계획 세션·구현 세션·1차 검증 세션과 분리, read-only)
- Orca task: `task_0a823409843f` / dispatch `ctx_27b2231ff358`
- 대상 prompt dir: `logs/2026-08-15/prompt-20260815-015036-599aa1b4-sahwal-tower`
- 검증 기준: `04-claude-acceptance-criteria.md`(hash 동결 확인), `AGENTS.md`, `00-user-request.md`, `01-human-design-decisions.md`
- 대상 source tree: `cfa7d5750c073ef8e9dee933a13000a41d2e240c`
- 소스 수정: **없음**. 제품(`src/**`)·테스트(`tests/**`)·스크립트(`scripts/**`)·설정(`package.json`, `tsconfig*.json`, `vite.config.ts`, `evidence.config.json`, `.gitignore`, `index.html`)·거버넌스(`AGENTS.md`)·동결 계획 artifact(`00`~`05`)를 한 글자도 편집하지 않았다. 본 파일과 `09-claude-defect-report.md`, 그리고 `evidence.py`가 생성한 검증 로그·manifest만 기록했다.

---

## 0. 최종 판정

> **PASS — blocking 0 / high 0 / medium 0 / low 3(권고, 게이트 아님)**
>
> 1차 검증의 **D-01 ~ D-11이 전부 해소**됐고 독립 실측으로 재현 확인했다. **D-12는 Hermes의 `11-final-summary.md` 기재 조건이 아직 남아 있는 이월 항목**이다.
>
> 다만 **아래 두 항목은 자동 통과로 보고하지 않는다**(AGENTS §10):
> - **밸런스 목표 2·3층 미달성 — 인간 decision gate 필요**(CONFLICT-01 / HDD-006). 측정·보고 의무는 충족했고, 이는 실패 판정이 아니다.
> - **AC-824(실브라우저 380px 실측)** 은 HUMAN 항목이다. 구현자의 headless Chrome CDP 측정은 참고 증적이며 인간 확인을 대체하지 않는다.

---

## 1. 검증자가 직접 실행한 명령

전부 `python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role verifier --name <name> -- <command>` 로 실행했고, 원출력과 exit code를 `verification/*.log`, receipt를 `verification/commands.jsonl`, 상태를 `manifest.verification`에 보존했다.

| name | 명령 | exit | 로그 | 결과 |
|---|---|---|---|---|
| `full_tests` | `npm.cmd test` | **0** | `verification/full_tests.log` | **14 files / 104 tests passed**, 실패·스킵 0 |
| `typecheck` | `npm.cmd run typecheck` | **0** | `verification/typecheck.log` | `tsc --noEmit` 진단 0건 (`src`+`tests`+`scripts`) |
| `build` | `npm.cmd run build` | **0** | `verification/build.log` | clean-dist → `tsc --noEmit` → `vite build`, 34 modules, `dist/index.html` 생성 |
| `balance` | `npm.cmd run balance` | **0** | `verification/balance.log` | 1층 12/12 100.0% `in_range=true` · 2층 2/12 16.7% `false` · 3층 0/12 0.0% `false` · `report=` 경로 출력 |
| `simulation` | `npm.cmd run simulate` | **0** | `verification/simulation.log` | 층별 3회 총 9판, 최대 46턴, 400수 이내 종료, 음수 자원 0 |
| `runtime_audit` | `npm.cmd audit --omit=dev --audit-level=high` | **0** | `verification/runtime_audit.log` | `found 0 vulnerabilities` |
| `ac_mapping` | `node scripts/check-ac-mapping.mjs` | **0** | `verification/ac_mapping.log` | **AC vitest mappings: 89/89** 실제 테스트 ≥1개 실행·통과 |
| `dev_server` | `node <scratchpad>/dev-check.mjs` | **0** | `verification/dev_server.log` | `npm run dev` 기동 → `GET http://127.0.0.1:5207/` → **HTTP/1.1 200 OK**, `<div id="root">` 포함 |

`evidence.config.json`의 `required`(`full_tests`, `typecheck`, `build`) 3개는 모두 `executed_by: "verifier"`, `status: "passed"`로 manifest에 기록됐다.

### 1.1 증적 도구 회귀 (AC-003 / AC-004 / AC-1004)

| 명령 | exit | 결과 |
|---|---|---|
| `python -m unittest discover -s tests -v` | **0** | `Ran 22 tests ... OK` (실패·오류 0) |
| `python -m py_compile scripts/evidence/*.py tests/evidence/*.py` | **0** | stderr 없음 |
| `python scripts/evidence/claude_hook.py self-test` | **0** | `{"ok": true, "events": [...4종...]}` |

### 1.2 AC-108 (`npm run dev`) 실측 — D-11 해소 확인

`package.json`의 `dev` 스크립트가 `vite --host 127.0.0.1`로 변경돼 IPv4 루프백에 명시 바인드된다.

```
vite banner: VITE v5.4.21  ready in 168 ms |   ➜  Local:   http://127.0.0.1:5207/
GET http://127.0.0.1:5207/ -> HTTP/1.1 200 OK
contains <div id="root">: true
GET http://[::1]:5207/  -> (응답 없음)
DEV_SERVER_CHECK: PASS
```

**절차 투명성 고지 3건**

1. 첫 `dev_server` 시도는 검증자 헬퍼가 Node 24에서 `spawn('npm.cmd', …, {shell:false})`로 `EINVAL`을 내 exit 1로 기록됐다. **제품 결함이 아니라 검증자 헬퍼의 문제**였고 `shell:true`로 고쳐 재실행했다. 실패 receipt도 `commands.jsonl`에 그대로 남겼다.
2. AC-108 원문 포트 `5199`는 **이전 세션이 남긴 vite 프로세스가 점유**하고 있어(`netstat`: `127.0.0.1:5199 LISTENING`, `127.0.0.1:5173 LISTENING`) `--strictPort`가 기동을 거부했다. 그 상태의 200 응답은 내가 띄운 서버의 것이 아니므로 채택하지 않고, **비어 있는 포트 5207로 재실행한 결과만 증거로 삼았다.**
3. 검증 헬퍼(`dev-check.mjs`, `indep-check*.mjs`)는 전부 저장소 **바깥** scratchpad에 두어 source tree hash에 영향이 없다.

### 1.3 계획 동결 hash 재계산 (AC-000 / AC-1005 전제)

| 파일 | manifest 기록 | 재계산 | 판정 |
|---|---|---|---|
| `02-claude-requirements-analysis.md` | `d2e52017666d…` | `d2e52017666d…` | 일치 |
| `03-claude-implementation-plan.md` | `98b5a9ba18ca…` | `98b5a9ba18ca…` | 일치 |
| `04-claude-acceptance-criteria.md` | `29b4b149c17e…` | `29b4b149c17e…` | 일치 |
| `05-codex-implementation-brief.md` | `d0e8f187a136…` | `d0e8f187a136…` | 일치 |

수락 기준은 수정 라운드 동안 재동결 없이 그대로 유지됐다. **AC를 구현에 맞춰 고친 흔적 없음.**

### 1.4 Source tree 불변성 (AC-002)

| 항목 | 값 |
|---|---|
| `snapshots.baseline` | `74cb2a6b9c7650934c3b9a5485d70c249759c813` |
| `snapshots.implementation` | `cfa7d5750c073ef8e9dee933a13000a41d2e240c` |
| `snapshots.verify-before` | `cfa7d5750c073ef8e9dee933a13000a41d2e240c` |
| 검증 착수 시 독립 재계산 | `cfa7d5750c073ef8e9dee933a13000a41d2e240c` (일치) |
| `snapshots.verify-after` | `cfa7d5750c073ef8e9dee933a13000a41d2e240c` (일치) |
| `gate --name post-verify` | **exit 0**, `manifest.verifier_tree_unchanged = true` |

1차 검증 대상 tree(`4f5c8689…`) → 현재 tree(`cfa7d575…`) 수정 diff는 21개 파일 `+389 / −49`이며, 제품 소스 변경은 `src/engine.ts`(11줄), `src/App.tsx`(테스트용 `export` 3개), `src/components/BoardSvg.tsx`(접근성 6줄), `package.json`, `tsconfig.json`뿐이다. **결함 목록 밖의 기능 변경·대량 리팩터링은 없다.**

---

## 2. 1차 결함 D-01 ~ D-12 처분

| ID | 심각도(1차) | 처분 | 독립 확인 증거 |
|---|---|---|---|
| **D-01** 동결 층 데이터(W호위) 변경 | blocking | **FIXED** | `src/engine.ts:147,148` → `guardsW: [idx(1,2), idx(1,4)]`. 런타임 실측 `FLOOR2 {rocks:[16,18,30,32], guardsW:[9,11], pouchW:24}`, `FLOOR3 {rocks:[24,0,6], guardsW:[9,11], pouchW:30}`, `FLOOR1 {rocks:[], guardsW:[], pouchW:20, kingW:10, kingB:38}` — 원문 §4와 완전 일치. `tests/engine.floors.test.ts:206,207` 기대값도 동결값으로 복원. **밸런스 사유의 재변경 흔적 없음** |
| **D-02** AC 지정 테스트 파일 2개 부재 | blocking | **FIXED** | `tests/meta.deps.test.ts`(3 tests), `tests/engine.purity.test.ts`(3 tests) 신규 존재, AC-101/102/109·103/104/105가 지정한 이름 6개 그대로 |
| **D-03** `-t` 매핑 38건 위장 통과 | blocking | **FIXED** | `node scripts/check-ac-mapping.mjs` → **89/89**. 검증자가 `04`를 독립 파싱해 `npx vitest run tests/…` 백틱 명령 90건(고유 89건)을 추출, 하니스 추출 집합과 **차집합 0**임을 확인. 스킵만 발생하는 명령 0건 |
| **D-04** 3대 재현 경로 테스트 부재 | high | **FIXED** | `tests/run.flow.test.ts`에 AC-701(시드 33으로 1→2→3층 실제 상태 전이 클리어, `clearedFloors===3`), AC-702(`lose`/`king`), AC-703(`lose`/`depleted`), AC-705, AC-706 존재·통과 |
| **D-05** 밸런스 hard gate + 리포트 부재 | high | **FIXED** | `scripts/balance.ts`의 `throw` 제거, `in_range` 컬럼 출력, `balance-report.md` 생성 및 경로 stdout 출력. `tests/balance.harness.test.ts`의 승률 단언 제거. `npm run balance` **exit 0**(2·3층 이탈에도). `07-codex-result.md:28`에 "밸런스 목표 미달성 — 인간 결정 필요(CONFLICT-01/HDD-006)" 명시 |
| **D-06** 폭발 승리가 B왕 포획에 덮임 | medium | **FIXED** | `src/engine.ts:413`에 `next.status === 'playing'` 가드 추가. 검증자 독립 재현(폭발석=B왕 그룹, 폭발 4방향에 W왕): `{"status":"win","reason":"king","kingW":null,"cell10":null}` — 1차의 `lose` 재현이 `win`으로 뒤집힘 |
| **D-07** 판 교차점 button 계약 미충족 | medium | **FIXED** | `BoardSvg.tsx:21-25`에 `role="button"`, `tabIndex={disabled ? -1 : 0}`, 한국어 `aria-label`(`n행 m열에 착수`), Enter/Space `onKeyDown`(+`preventDefault`) 추가 |
| **D-08** 타입 검사 범위 누락 | medium | **FIXED** | `tsconfig.json` `include: ["src","tests","scripts","vite.config.ts"]`, `types`에 `node`/`vitest/globals` 추가, `@types/node@22.10.2` devDependency 추가. `npm run typecheck` exit 0 |
| **D-09** 골렘 2연타 두 번째 수 무료 | low | **FIXED** | `aiTurn` 루프 조건에 `next.pouchW > 0` 추가. 독립 실측: `pouchW=24`→2수 두고 22, **`pouchW=1`→1수만 두고 0**(W돌 증가 1개) |
| **D-10** `-120` 가드의 죽은 조건식 | low | **FIXED** | `src/engine.ts:280` 조건절 삭제. 독립 실측: 인접에 빈 칸이 있으면 −120 미적용(`-143`), 사방 W·바위면 적용(`-260`) |
| **D-11** AC-108 `127.0.0.1` 불일치 | low | **FIXED** | `dev` 스크립트에 `--host 127.0.0.1` 명시. §1.2 실측 HTTP 200 |
| **D-12** `dist-debug-old/` 잔여 | low | **이월(CARRY-FORWARD)** | 디렉터리는 여전히 존재하나 `.gitignore`에 등재돼 tree hash·빌드·제품 경로에서 완전히 배제됨을 재확인. `10-codex-fix-log.md:17`이 "최종 요약에 남긴다"고 약속했으나 **`11-final-summary.md`가 아직 없다.** Hermes가 finalize 시 기재해야 종결 |

---

## 3. 수락 기준 1:1 매핑 (AC-000 ~ AC-1006)

판정: **PASS**=명령 exit 0 + 기대 증거 확인, **HUMAN**=인간 판단 항목, **PENDING**=Hermes finalize 단계, **PASS(주1)** 등은 §4의 잔여 관찰 참조.

### 3.1 게이트·전제

| AC | 판정 | 증거 |
|---|---|---|
| AC-000 계획 동결 | PASS | `manifest.status`가 동결 이후 단계, `plan_hashes` 4종 재계산 일치(§1.3) |
| AC-001 구현 snapshot | PASS | `snapshots.implementation = cfa7d575…`, `diff/10-codex-implementation.patch` 존재 |
| AC-002 verifier 전후 tree 동일 | PASS | `verify-before` = `verify-after` = `cfa7d575…`, `post-verify` exit 0, `verifier_tree_unchanged === true` |
| AC-003 증적 도구 회귀 | PASS | 22 tests OK |
| AC-004 Python 구문 검사 | PASS | exit 0, stderr 없음 |

### 3.2 스택·의존성·순수성

| AC | 판정 | 증거 |
|---|---|---|
| AC-101 런타임 의존성 2개 | PASS | `dependencies = {react:18.3.1, react-dom:18.3.1}`, 금지 라이브러리 문자열 11종 부재 |
| AC-102 devDeps 설치본 일치 | PASS | 각 devDependency의 `node_modules/<pkg>/package.json` 버전 문자열 일치 |
| AC-103 engine import 0건 | PASS | `src/engine.ts` 전체에 `^import`, `require(`, `from '` 0건(검증자 육안 재확인) |
| AC-104 부수효과 토큰 부재 | PASS | `Math.random`/`Date`/`window`/`document`/`setTimeout`/`console`/`process` 등 0건 |
| AC-105 입력 불변성 | PASS | `structuredClone` 전후 deep-equal |
| AC-106 타입 검사 | PASS | `npm run typecheck`(=`tsc --noEmit`) exit 0 |
| AC-107 프로덕션 빌드 | PASS | `npm run build` exit 0, `dist/index.html` 생성 |
| AC-108 `npm run dev` | PASS | §1.2 (포트만 5207로 대체, 사유 명시) |
| AC-109 외부 CDN·폰트 없음 | PASS | `index.html`/`styles.css`/`App.tsx`/`main.tsx`에 `https?://`, `@import url(` 0건 |

### 3.3 바둑 코어

| AC | 판정 | 증거 |
|---|---|---|
| AC-201 귀 1점 포획 | PASS | vitest 매핑 + 독립 확인 |
| AC-202 자살 불법 | PASS | `reason==='suicide'`, 입력 판 불변 |
| AC-203 포획 동반 시 합법 | PASS | vitest |
| AC-204 패 즉시 되따냄 superko | PASS | 독립 실측 `{capOk:true, reOk:false, reason:"superko"}` |
| AC-205 판 키 49자·시작부터 기록 | PASS | 독립 실측 `history.length===1`, `key.length===49` |
| AC-206 바위·판 밖은 벽 | PASS | vitest |
| AC-207 다중 그룹 중복 없는 제거 | PASS | vitest |
| AC-208 `sweepDead` W→B 순서 | PASS | 순서 반전 대조군이 다른 결과임을 함께 단언(1차 지적 반영). 독립 실측 `{removedW:[0], removedB:[]}` |
| AC-209 `legalMoves` 불법수 배제 | PASS | 점유·바위·자살·superko 4종 배제 확인 |

### 3.4 자원 경제·승패

| AC | 판정 | 증거 |
|---|---|---|
| AC-301 `START_POUCH=28`·상한 없음 | PASS | `pouch7` 2회 적용 시 42 |
| AC-302 B 착수 −1 / 포획 +n | PASS | vitest(`+`가 정규식 수량자로 해석되는 경우까지 커버하는 동일 계약 테스트 병행) |
| AC-303 `recover` +2n | PASS | 독립 실측 2점 포획 시 pouchB Δ`+3`(=−1+4), 무유물 Δ`+1` |
| AC-304 `soul` `ceil(n/2)` 환급 | PASS(주1) | 독립 실측 **n=3 → Δ+2**(AC 본문의 기대값 그대로), 무유물 Δ0. 저장소 테스트는 n=1만 고정 |
| AC-305 W 착수·패스 각 −1, 회수 없음 | PASS | 독립 실측 `pouchW` Δ−1, 회수 0 |
| AC-306 탈진 승리 | PASS | `status:'win'`, `reason:'exhaust'` (W턴 시작 판정) |
| AC-307 돌 고갈 패배 | PASS | `status:'lose'`, `reason:'depleted'` (W턴 종료 판정) |
| AC-308 B 패스 비용 0·tempo 소멸 | PASS | `pouchB` 불변, `pendingB===0`, `turn==='W'` |
| AC-309 `REST_BONUS=4` | PASS | 독립 실측 17 → 21 |
| AC-310 왕 그룹 포획 승패 | PASS | vitest |

### 3.5 층 데이터·기믹

| AC | 판정 | 증거 |
|---|---|---|
| AC-401 층 데이터 동결값 | PASS | §2 D-01 행의 런타임 실측 3층 전부 원문 일치 |
| AC-402 왕돌 시작 배치 | PASS | 3개 층 모두 `board[kingW]==='W'`, `board[kingB]==='B'`, 시작 키 이력 1건 |
| AC-403 골렘 3의 배수 턴 2연속·각 −1 | PASS | 독립 실측 턴별 소모 `[1,1,2,1,1]`, 3턴에서 `pouchW` 24→22 |
| AC-404 2연타 수 사이 승패 판정 | PASS | 첫 수로 B왕 포획 시 `lose`이고 `pouchW`가 **1만** 감소(24→23), 두 번째 수 미반영 |
| AC-405 부활 1회 | PASS | `revived===true`, `status==='playing'`, 새 W왕 존재 |
| AC-406 부활 점수식 최대 지점 | PASS(주2) | 소스 대조: `libs×3 + 인접W×5 − 인접B×4 + B왕 맨해튼` — 원문과 항·계수 완전 일치. 저장소 테스트는 `reviveScore`와의 자기 일관성만 단언 |
| AC-407 무료·이력 push | PASS | 독립 실측 `pouchW` 불변, `history` +1 |
| AC-408 두 번째 제거 시 승리 | PASS | `status:'win'`, `reason:'king'` |
| AC-409 후보 없으면 즉시 승리 | PASS | vitest |
| AC-410 동점 시 최소 인덱스 | PASS | 독립 실측 선택값 = 최대 점수 후보 중 최소 인덱스 |

### 3.6 유물 6종

| AC | 판정 | 증거 |
|---|---|---|
| AC-501 6종 키·이름·한자 | PASS | `recover 회수의 손(回收)` … `guard 왕의 호위(護衛)` 순서·문자 일치 |
| AC-502 `pouch7` 즉시 +7 | PASS | 28 → 35 |
| AC-503 `tempo` 첫 턴 2연속·각 −1 | PASS | 독립 실측 `pendingB` 2→1→0, `pouchB` 28→27→26, 사이 턴이 B 유지 |
| AC-504 `guard` 위→왼→오→아래 | PASS | 1층에서 `(4,3)`에 무료 배치, `pouchB` 불변 |
| AC-505 `bomb` 전투당 1회 | PASS | `used` 이후 재장전 불가 |
| AC-506 불법수 거부 시 장전 유지 | PASS | `bomb` 상태·`pouchB` 불변 |
| AC-507 폭발석 연쇄 | PASS | 독립 실측: 4방향 W 2개 파괴 → `sweepDead` → `recover` 적용 회수 Δ`+4`, `capturedW` +2, **이력 +1**. 무작위 2층 120런 중 25런에서 실제 폭발 발생, 예외 0 |
| AC-508 폭발석 W왕 제거 시 부활/승리 | PASS | 1층 → `win/king`, 3층 미부활 → `revived===true`, `status==='playing'` |
| AC-509 미보유 3개 중복 없이 제시 | PASS | 독립 200회 반복: 길이 3·중복 0·보유분 미포함 100% |
| AC-510 3층은 바로 클리어 | PASS | `clearedFloors===3`, `App.tsx`가 `floor===3`이면 `relic` 화면을 건너뛰고 `end`로 전이 |

### 3.7 적 AI 휴리스틱

| AC | 판정 | 증거 |
|---|---|---|
| AC-601 포획 +100n / B왕 +100000 | PASS | vitest |
| AC-602 +4L, L=1 & 포획<2 → −150 | PASS | vitest |
| AC-603 사방 W·바위·밖 → −120 | PASS | 독립 실측 −260(적용) vs −143(미적용) |
| AC-604 구조 +60+크기×20, 왕 +8000 | PASS | vitest |
| AC-605 결과 W왕 단수 → −5000 | PASS | vitest |
| AC-606 인접 B 압박 점수 | PASS | vitest |
| AC-607 위치 보정 3항 | PASS | vitest |
| AC-608 `rand()×6` 주입 | PASS | vitest, `rng` 고정 시 결정론 |
| AC-609 최대 점수 선택 | PASS(주3) | vitest. 탐색 공간이 인위적으로 좁은 판이라 검증력은 낮음 |
| AC-610 합법수 없으면 패스 −1 | PASS | 독립 실측 패스 누적 후 다음 턴 시작에서 `win/exhaust` |

### 3.8 런 흐름·재현 경로

| AC | 판정 | 증거 |
|---|---|---|
| AC-701 실제 클리어 경로 | PASS | 시드 33 색 반전 AI가 1→2→3층 실제 상태 전이로 클리어, `clearedFloors===3` |
| AC-702 왕 함락 패배 | PASS | `status:'lose'`, `reason:'king'` |
| AC-703 돌 고갈 패배 | PASS | `status:'lose'`, `reason:'depleted'` |
| AC-704 승리→유물3→선택→다음 층 | PASS | `run.relics` 반영, `run.floor` +1 |
| AC-705 건너뛰기 경로 | PASS | vitest |
| AC-706 주머니 층 간 유지 | PASS | 17 → 21로 이월 |
| AC-707 새 런은 타이틀 생략 | PASS | `새로하기 → 새로 시작` 후 `1층 · 침입귀` 렌더, `등반 시작` 미노출 |

### 3.9 UI·문자열·타이머·반응형

| AC | 판정 | 증거 |
|---|---|---|
| AC-801 타이틀 요소 | PASS | `塔`, `死活之塔`, `一`~`四`, `등반 시작`, 힌트 문장 정확 일치 |
| AC-802 전투 화면 배치 순서 | PASS | DOM 자식 클래스 순서 `[battle-head, enemy, resources, board-stage, status-line, controls, relic-chips, battle-log]` 단언(1차 지적 반영) |
| AC-803 주머니 ≤5 빨강 | PASS | `.resources .low` 노드 + `color:var(--ju)` 규칙 |
| AC-804 SVG viewBox·구성요소 | PASS | `0 0 340 340`, 격자 14, 화점, 마지막 수 링, 왕 링 2, `王`, `✸`, 바위 |
| AC-805 반칸 반지름 투명 터치영역 | PASS | `r={STEP/2}`(=25), `fill="transparent"` |
| AC-806 왕 단수 경고·펄스 | PASS | `위험 — 내 왕돌이 단수에 몰렸다!` / `기회 — 적 왕돌이 단수다. 한 수면 잡는다.` 양방향 + `.atari-ring` |
| AC-807 승패 오버레이 | PASS | `勝`(gold)/`死`(ju), 사유, 버튼 3종 |
| AC-808 유물 화면 | PASS | 카드 3, `비운 채로 오른다`, `새로하기` |
| AC-809 새로하기 확인 모달 | PASS | 층·돌·유물 요약 + `계속 오른다`/`새로 시작` |
| AC-810 종료 화면 | PASS | `生`, 도달 층·총 포획·유물, `처음부터 다시 오른다` |
| AC-811 규칙 모달 7주제 | PASS | 활로·포획 / 경제 / 왕·고갈 / 탈진 / 바위 / 동형반복 / 두 집 |
| AC-812 전 텍스트 한국어 | PASS | 타이틀·전투 렌더 텍스트에 `[A-Za-z]{3,}` 0건 |
| AC-813 620ms 지연 + 잠금 | PASS | 619ms 미착수·`…수를 읽는 중`·버튼 `disabled`, 620ms 착수 |
| AC-814 stale 타이머 가드 | PASS | 화면 이탈 후 타이머 진행에도 DOM 불변, 예외 0 |
| AC-815 타이머 중복 생성 금지 | PASS | `setTimeout` 스파이 1회 |
| AC-816 콜백 4중 재검사 | PASS | `generation`/`screen`/`turn`/`status` 4개 가드 전부 존재, 2000ms 진행 후 `innerHTML` 불변 |
| AC-817 380px 무가로스크롤 계약 | PASS | `overflow-x:hidden`, SVG 고정 px 폭 없음, 380px 초과 `min-width` 0건, viewport meta 존재 |
| AC-818 최대폭 430px 중앙 정렬 | PASS | `max-width:430px` + `margin-inline:auto` |
| AC-819 전 기능 터치 | PASS(주4) | `min-height:44px`, `touch-action:manipulation`, `flex-wrap:wrap`, 교차점 `role="button"`+`tabIndex`+`onKeyDown`. 다만 테스트는 "onClick 보유 요소 전수" 스캔이 아니라 문자열 검사다 |
| AC-820 색 토큰 9종 | PASS | 9개 전부 정확 일치 |
| AC-821 모션·reduced-motion | PASS | `stone-pop .18s`, `@media(prefers-reduced-motion:reduce)`가 `*` 전역에 `animation:none!important; transition:none!important` |
| AC-822 붉은색·glow 사용 범위 | PASS | `drop-shadow` 1건이며 `.board-wrap` 한정, `--ju` 계열 `box-shadow` 0건 |
| AC-823 숫자 tabular | PASS | `font-variant-numeric:tabular-nums` |
| **AC-824 실브라우저 380px 실측** | **HUMAN** | 자동 통과로 보고하지 않음. 구현자 CDP 측정(`mobile-browser-verification.md`: `scrollWidth=380`, 버튼 45.375px, hit r=25)은 **참고 증적**이며 인간 확인을 대체하지 않는다 |

### 3.10 시뮬레이션·밸런스

| AC | 판정 | 증거 |
|---|---|---|
| AC-901 층별 3회 이상 400수 종료 | PASS | vitest 9판 + `npm run simulate` 9판. 검증자 독립 확장: **층×200시드 = 600판**에서 예외 0, 미종료 0, 최장 50수 |
| AC-902 자원 음수 없음 | PASS | 600판 매 수 `pouchB/pouchW/capturedW/lostB >= 0`, 위반 0건 |
| AC-903 종료 사유 기록 | PASS | 600판 결과 `king` 565 / `exhaust` 35, `null` 0 |
| AC-904 밸런스 하니스 | PASS | exit 0, `in_range` 표 + `report=` 경로 출력, `balance-report.md` 갱신 |
| AC-905 색 반전 정확성 | PASS | `mirrorState` involution, 이력 키 반전, `kingB`↔`kingW` |
| **AC-906 목표치 측정·보고** | **보고 완료 / 결과는 목표 미달** | 1층 100.0% `in_range=true`, **2층 16.7% `false`**, **3층 0.0% `false`**. 통과 기준이 아님(판정 규칙) |
| AC-907 동결값 무변경 증명 | PASS | 층 데이터 테스트 통과 + 수정 diff에서 `FLOORS`가 **동결값으로 원복**된 것만 확인, 밸런스 사유 재변경 0 |
| AC-908 밸런스 이탈 시 처리 | PASS | `07-codex-result.md:28`에 "밸런스 목표 미달성 — 인간 결정 필요(CONFLICT-01/HDD-006)" 명시, 자동 튜닝 흔적 없음. **`11-final-summary.md`에도 동일 문구 필요(미작성)** |

### 3.11 전체 회귀

| AC | 판정 | 증거 |
|---|---|---|
| AC-1001 전체 게임 테스트 | PASS | 104/104 |
| AC-1002 타입 검사 | PASS | exit 0 |
| AC-1003 빌드 | PASS | exit 0 |
| AC-1004 증적 도구 회귀 | PASS | 22/22 |
| AC-1005 `validate --final` | **PENDING** | `validate` (비-final) → `{"failures": []}` exit 0. `--final` → `{"failures": ["11-final-summary.md"]}` exit 2. **유일한 미충족 항목이 Hermes의 최종 요약 부재**이며, `verifier_tree_unchanged`는 `post-verify`로 `true` 확정됐다 |
| AC-1006 `verify-checksums` | **PENDING** | `checksums.sha256`은 `finalize`가 생성한다. finalize 전 실행은 정상적으로 미존재 |

---

## 4. 잔여 관찰 (low, 게이트 아님 — `09`에 동일 항목 기재)

- **주1 / OBS-01** AC-304 저장소 테스트가 `soul` 환급을 `n=1`로만 고정한다. AC 본문의 `n=3 → +2`는 검증자가 런타임에서 직접 확인해 **동작은 정상**이나, 홀수 `n` 회귀를 막는 테스트가 없다.
- **주2 / OBS-02** AC-406 테스트가 `reviveScore`와 `applyRevival`의 자기 일관성만 단언한다. 점수식 자체가 잘못 바뀌면 두 쪽이 함께 틀려도 통과한다. 검증자는 소스를 원문과 항별 대조해 일치를 확인했다.
- **주3 / 주4 / OBS-03** AC-609의 탐색 판이 인위적으로 좁고, AC-819가 "onClick 보유 요소 전수 스캔"이 아닌 문자열 검사다. 현재 구현은 두 계약을 모두 만족하지만 회귀 방어력이 계약 문구보다 약하다.
- **OBS-04(참고, 결함 아님)** `playerMove`의 `pouchB` 0 클램프는 `tempo`로 첫 턴 2연속을 둘 때 이론상 음수를 감출 수 있다(D-09의 W측 대응 항목). 검증자 분석 결과 전투 시작 주머니는 1층 28, 2·3층 `pouchB+REST_BONUS ≥ 4`이므로 **현재 상태 전이에서 도달 불가**하다. 합성 상태에서만 재현된다.
- **OBS-05(운영)** `manifest.orca_tasks` / `orca_dispatches`가 여전히 `null`/`[]`이다. AGENTS §4는 manifest가 Orca ID를 연결하도록 요구한다. 본 라운드의 `task_0a823409843f` / `ctx_27b2231ff358`, 1차의 `task_7e48d30a8391` / `ctx_5ef403506fb6`가 산문에만 남아 있다. 기록 주체는 Hermes다.
- **OBS-06(환경)** 이전 세션이 남긴 vite 개발 서버가 `127.0.0.1:5173`, `127.0.0.1:5199`에서 계속 LISTENING이다. 제품과 무관하나 다음 AC-108 실행을 방해한다.

---

## 5. 인간 판단으로 남기는 항목 (AGENTS §10 마지막 줄, §11-10)

| ID | 내용 | 결정 주체 | 상태 |
|---|---|---|---|
| **HUMAN-01** | **밸런스 목표 미달성 decision gate.** 동결값(2·3층 호위 `(1,2)(1,4)`, 적 주머니 24/30) 기준 12회 측정이 2층 16.7%(목표 40~60%), 3층 0.0%(목표 15~30%)로 목표 밖이다. 값을 조정할지, 목표를 조정할지, 현 상태로 확정할지는 **인간 전권**이다(CONFLICT-01 / HDD-006). AI는 어느 쪽도 자동 적용하지 않았다 | Human | **미결 — 차단 아님** |
| **HUMAN-02** | 12회 표본의 통계적 신뢰도. 1차 검증자가 200회 측정에서 2층 40.0% / 3층 4.0%를 얻은 바 있어 **2층은 표본 크기에 따라 결론이 뒤집힌다.** 시행 수 상향 여부는 인간 결정 | Human | 미결 |
| **HUMAN-03** | AC-824 실브라우저 380px 무가로스크롤·터치 실측(각 화면 스크린샷 포함) | Human | 미실시 |
| **HUMAN-04** | 난이도·재미·시각 인상·모션 체감 등 자동 검증 불가 영역 | Human | 미실시 |
| **HUMAN-05** | `dist-debug-old/` 수동 삭제 여부(D-12) 및 `11-final-summary.md` 잔존 사유 기재 | Human/Hermes | 미결 |
| **HUMAN-06** | "Noto Serif KR"를 CSS `font-family`로만 지정하고 웹폰트를 번들하지 않았다(외부 CDN 금지 계약 준수의 결과). 미설치 환경에서는 시스템 serif로 대체된다. 폰트 번들·라이선스 판단은 인간 몫 | Human | 미결 |

---

## 6. 완료 조건(AGENTS §11) 점검

| # | 조건 | 상태 |
|---|---|---|
| 1 | 계획·수락 기준 존재 및 hash 동결 | **충족** (§1.3) |
| 2 | Hermes/Codex가 실제 구현·수정, 명령 기록 | **충족** (`06`, `10`, `codex/exec-receipts.jsonl`) |
| 3 | 구현 patch 존재 | **충족** (`diff/10-codex-implementation.patch`) |
| 4 | fresh verifier가 모든 AC를 증거와 1:1 매핑 | **충족** (§3) |
| 5 | 필수 테스트·타입 검사·빌드 exit 0 | **충족** (§1) |
| 6 | 검증 전후 source tree 동일 | **충족** — `verify-before` = `verify-after` = `cfa7d575…`, `post-verify` exit 0 |
| 7 | blocking/high 결함 해결 | **충족** (blocking 0 / high 0) |
| 8 | 인간 결정·미결정 분리 기록 | **충족** (`01`, §5) |
| 9 | manifest validation / finalize / checksum | **미충족 — `11-final-summary.md` 부재.** Hermes 작업 |
| 10 | 남은 인간 판단·미검증 범위·위험 보고 | **충족** (§4, §5) |

**결론:** 제품·테스트·증적 관점의 blocking/high 결함은 없다. 완료 선언은 **Hermes가 `11-final-summary.md`를 작성해 `validate --final`·`finalize`·`verify-checksums`를 통과시키고, HUMAN-01(밸런스 decision gate)과 HUMAN-03(실브라우저 실측)을 인간이 처리한 뒤**에만 가능하다.
