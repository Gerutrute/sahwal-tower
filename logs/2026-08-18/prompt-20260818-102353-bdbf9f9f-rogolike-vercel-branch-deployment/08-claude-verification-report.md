# 08 — Claude 독립 검증 보고서 (RoGolike Vercel 브랜치 배포)

- 검증자: fresh Claude Code verifier (Orca `task_8647ecd7110e` / `ctx_dc3ff12ba408`) — planner 세션(`task_5a76f99e39d6`)·구현자(Hermes/Codex)와 독립, 소스 읽기 전용
- 검증일: 2026-08-18
- 기준 문서: 동결된 `01`~`05` (plan hash는 manifest `plan_hashes`와 일치하는 파일 기준), 구현 로그 `06`·`07`
- 신뢰 원칙: 문서 주장 아님 — 라이브 소스, 실제 diff, 검증자 본인이 실행한 명령의 결과만 근거로 삼았다. 성공 검증 receipt는 `verification/commands.jsonl`, 의도된 fail-closed 음성 receipt는 `verification/negative-commands.jsonl`, 전체 출력은 `verification/*.log`에 보존.

## 1. 무결성 게이트 (판정 전제)

| 항목 | 결과 |
|---|---|
| 현재 작업 트리 snapshot (`snapshot_tree` 동일 알고리즘 재계산) | `e66f4f8e91f3e48ac25dedd139b259904bbf6df5` — manifest의 `implementation`·`verify-before`와 **일치**. 검증 시작·종료 시 각각 재계산해 동일 확인 (검증이 소스를 변경하지 않음) |
| `git rev-parse --abbrev-ref HEAD` | `dev` |
| `main` / `origin/main` (`git rev-parse` + `git ls-remote`) | 둘 다 `2c00919d094310950633ae40237bf1764fc078b3` — 불변 (HDD-007) |
| `dev` / `origin/dev` | 둘 다 `8df1159983b0642cf5d144761f518188a64bcc15` — 검증 전후 불변 (commit·push는 Task 8 대기) |
| `git status --porcelain` 검증 전후 비교 | 추적 파일 변화 0 — 차이는 증적 디렉터리(`logs/`)와 gitignore된 산출물뿐 (AC-SEC-005) |
| `index.html`·`vite.config.ts` | `git diff --stat` 무변경 (AC-BLD-006) |

## 2. AC ↔ 실행 증거 1:1 매핑

실행 주체가 "verifier"인 항목은 이 보고서 작성자가 exact argv로 직접 실행했고, receipt는 `verification/` 에 있다.

### 2.1 AC-ENV (fail-closed) — 전부 PASS

| AC | 검증자 receipt | 결과 |
|---|---|---|
| AC-ENV-001 (env 부재) | `ac-env-001-verifier` | exit 1, `RUNTIME_CONFIG_MISSING` |
| AC-ENV-002 (공백) | `ac-env-002-verifier` | exit 1, `RUNTIME_CONFIG_MISSING` |
| AC-ENV-003 (invalid JSON + 마커) | `ac-env-003-verifier` | exit 1, `RUNTIME_CONFIG_INVALID_JSON`, 로그에 마커(`LEAKCHECK-9Q4` 상당) 0건 — 값 에코 없음. 마커는 receipt argv 오염을 막기 위해 스크립트 내부에서 분할 문자열로 조립 |
| AC-ENV-004 (schema 위반) | `ac-env-004-verifier` | exit 1, `RUNTIME_CONFIG_SCHEMA_INVALID` + 위반 필드 경로만 출력(값 미표기) |
| AC-ENV-005 (`audioTuning.masterGain: null`) | `ac-env-005-verifier` | exit 1, `RUNTIME_CONFIG_BOOT_FAILED` — 얕은 검증 통과 후 심층 `createInitialGameState` 단계에서만 실패함을 확인 |
| AC-ENV-006 (음성 후 일반 build) | `build` | exit 0 — 상태 오염 없음 |

### 2.2 AC-UNIT (RED/GREEN) — 전부 PASS

- `ac_mapping` receipt: `node scripts/check-ac-mapping.mjs <04 경로>` exit 0 — **6/6** vitest 명령이 각각 exit 0 + passing ≥1 (AC-UNIT-001~006의 백틱 명령 전부 검증자 환경에서 재실행됨).
- RED 로그 3종(`codex/self-check/vercel-runtime-config-red.log`, `vercel-validate-boot-red.log`, `deploy-badge-red.log`)을 직접 열람: 각각 03이 동결한 첫 테스트 이름 그대로 **AssertionError**(구문·import 오류 아님)로 exit 1 — RED 규칙 충족.
- 테스트 파일 3종의 내용이 04의 통과 조건(스키마 음성 케이스, 전역 2종 직렬화·freeze, inject 1회·중복 throw·`</head>` 부재 throw, 마커 미포함, `enemyDeck: []`→SCHEMA_INVALID·`masterGain: null`→BOOT_FAILED, 배너 문구·production/부재 무배너·지도 전환 유지)과 1:1 대응함을 소스 열람으로 확인.

### 2.3 AC-BLD (Vercel-방식 빌드 + 로컬 계약) — 전부 PASS

| AC | 검증자 receipt / 확인 | 결과 |
|---|---|---|
| AC-BLD-001 | `ac-bld-preview-verifier` (draft export→env 주입→`npm run build:vercel`, `VERCEL_ENV=preview`) | exit 0, `RUNTIME_CONFIG_OK` |
| AC-BLD-002 | dist 직접 검사 | `dist/runtime-config.js` 존재, 로더 태그 정확히 1건, `…</head>` 직전, 태그 index 342 < 첫 `<script type="module"` index 402, head 잔존 module script 0 |
| AC-BLD-003 | `dist/runtime-config.js` 검사 | `__ROGOLIKE_DEPLOY_META__`·`__ROGOLIKE_GAME_CONFIG__` 존재, `"target":"preview","playtest":true` |
| AC-BLD-004 | `ac-bld-production-verifier` (`VERCEL_ENV=production`) | exit 0, `"target":"production"`·`"playtest":false` |
| AC-BLD-005 | `build` receipt + dist 검사 | exit 0, `dist/index.html`에 `runtime-config` 0건, `dist/runtime-config.js` 부재 — 로컬 계약 불변 |
| AC-BLD-006 | `git diff --stat -- index.html vite.config.ts` | 무변경 |

### 2.4 런타임 스크립트 배치 심층 검사 (실제 Vite modern+legacy HTML)

일반 빌드 HTML(비주입 기준선)과 주입 HTML을 문자 단위로 비교했다.

- **기준선 head**: module script 4개 — ① modern polyfills(src) ② modern entry(src) ③ inline 감지기(`__vite_is_modern_browser`) ④ inline fallback(동적 import 미지원 modern 브라우저용 legacy 로더). **body 끝**: Safari 10.1 nomodule fix, `vite-legacy-polyfill`(nomodule src), `vite-legacy-entry`(nomodule inline `System.import`).
- **주입 후**: 로더는 head 유일의 classic script로 `</head>` 직전 1개. head의 module 4개는 **원래 상대 순서 그대로** `<body>` 직후로 이동(①②③④ 순서 보존, 속성 보존). nomodule 3종은 원위치 불변. `<meta charset>`은 여전히 문서 선두 1KB 이내. stylesheet head 잔존(FOUC 변화 없음).
- **경로별 실행 순서 판정**:
  - modern(module+dynamic import): head classic 로더가 파싱 중 동기 실행 → 전역 설정 완료 후 deferred module들이 문서 순서(polyfills→entry→감지기→fallback)로 실행. 감지기가 fallback보다 앞이므로 legacy 이중 로드 없음. **안전**
  - modern(동적 import 미지원): 감지기 parse 실패 → fallback이 legacy polyfill+entry 로드 — 로더 실행 이후. **안전**
  - legacy(nomodule): module 전부 무시, head classic 로더(내용은 ES5 — 리터럴 대입 + `Object.freeze`) → body의 legacy polyfill → `System.import` entry 순. **안전**
  - 로더 파일 자체가 로드 실패하는 경우: 파싱은 계속되고 앱은 `main.tsx`의 config-required alert로 fail-safe (실배포에서는 빌드가 파일을 직접 생성하며 preview 검사가 HTTP 200을 단언).
- module script는 위치와 무관하게 deferred이므로 이 이동은 실행 시점을 바꾸지 않고, "로더가 `</head>` 직전"과 "첫 module보다 텍스트상 앞"이라는 두 AC 요구를 동시에 충족하기 위한 유일하게 합리적인 변형이다. `scripts/vercel-build.mjs`의 자가검증과 `vercel-preview-check.mjs`의 재검증이 빌드마다 이 계약을 강제한다. **비안전 재배열 없음 판정.**
- 실증: 검증자 실수로 production 주입 dist 위에서 `check:mobile`을 실행했을 때 initScript 주입 config가 runtime-config.js로 **덮여** 시나리오가 어긋나 실패했다(§4-1) — 로더가 실브라우저에서 앱 부팅 전에 실행됨을 역으로 입증.

### 2.5 AC-PRV (380px 무주입 실브라우저) — 전부 PASS

| AC | 증거 | 결과 |
|---|---|---|
| AC-PRV-001 / AC-CMD-007 | `vercel_preview_check` receipt — per-run 무작위 sentinel(guid hex)을 `VERCEL_CHECK_SENTINEL`로 주입해 exact argv `npm.cmd run check:vercel-preview` 실행 | exit 0 |
| AC-PRV-002 | `playwright-results/vercel-report.json` | documentStatus 200, heading·start·badge visible, badgeTextMatched true, scrollWidth 380 ≤ 380, runtimeConfigStatus 200, console/page/request/response 오류 전부 0, mapVisible true(등반 시작→지도 전환), `passed: true`. report에 config 본문·sentinel 0건 |
| AC-PRV-003 | `playwright-results/vercel-preview-380.png` | 존재 — 열람으로 배너 문구·지도 화면·가로 오버플로 없음 육안 확인 |
| AC-PRV-004 / AC-CMD-006 | `mobile_check` receipt (일반 build dist 전제) | exit 0, report `passed: true` — 주입식 로컬 검사 회귀 없음 (§4-1의 선행 실패는 검증자 순서 문제) |
| config-required 경로 (00 요구 3 방어선) | `config-required-380` receipt — 비주입 일반 dist를 4175 preview로 서빙, 380×844 무주입 브라우저 | alert visible + 문구 일치, `등반 시작` 버튼 0개, scrollWidth 380, pageerror 0 — **미승인 기본값 미내장** 실브라우저 확인 |

### 2.6 AC-SEC (무누출) — 전부 PASS

| AC | 결과 |
|---|---|
| AC-SEC-001 | `git grep -n <sentinel>` exit 1 (추적 파일 0건) |
| AC-SEC-002 | `logs/` 재귀 검색 sentinel 0건 (검증자 receipt 로그 포함) |
| AC-SEC-003 | 검사 종료 후 `dist/runtime-config.js` 부재 (cleanup 확인) |
| AC-SEC-004 | `playwright-results/vercel-build.log` sentinel 0건 |
| AC-SEC-005 | 검증 전후 `git status --porcelain` 동일 (증적 제외) |
| AC-SEC-006 | `git grep -nE "ROGOLIKE_GAME_CONFIG_JSON" -- src` exit 1 — 번들 경로 env 참조 없음 |
| AC-SEC-007 | `.gitignore`에 `.vercel/`·`runtime-config.js` 라인 존재 |

### 2.7 AC-CMD (전역 명령, verifier 직접 실행) — 전부 PASS

| AC | receipt | 결과 |
|---|---|---|
| AC-CMD-001 `npm.cmd test` | `full_tests` | exit 0 — 45 files / **237 tests passed** (구현자 주장과 일치) |
| AC-CMD-002 `npm.cmd run typecheck` | `typecheck` | exit 0 |
| AC-CMD-003 `npm.cmd run build` | `build` | exit 0 |
| AC-CMD-004 `npm.cmd audit --omit=dev --audit-level=high` | `runtime_audit` | exit 0 |
| AC-CMD-005 `npm.cmd run benchmark:ai` | `benchmark_ai` | exit 0 |
| AC-CMD-006 `npm.cmd run check:mobile` | `mobile_check` | exit 0 |
| AC-CMD-007 `npm.cmd run check:vercel-preview` | `vercel_preview_check` | exit 0 |
| AC-CMD-008 `evidence.config.json` | 파일 열람 | `vercel_preview_check` exact argv `["npm.cmd","run","check:vercel-preview"]` + `required` 포함 |

### 2.8 AC-GIT — 현 단계 해당분 PASS, 커밋분은 Task 8 대기

| AC | 상태 |
|---|---|
| AC-GIT-001 | PASS — `dev` |
| AC-GIT-002 | PASS — main·origin/main `2c00919…` 불변 |
| AC-GIT-003·004·005·007 | **대기(정상)** — 03 Task 8이 finalize·checksum 통과 후로 규정한 commit·push 단계. 현재 `git ls-files vercel.json docs/04_prototype/04_Vercel_배포.md` 빈 출력(미추적)·dirty tree 유지가 이 시점의 올바른 상태다. push 후 재확인 필요 |
| AC-GIT-006 | PASS — `codex/exec-receipts.jsonl` 전수 스캔: checkout main/merge/push main/force/reset/rebase/history rewrite 0건. 검증자도 읽기 전용 git 명령만 사용 |

### 2.9 AC-DOC — 전부 PASS

| AC | 결과 |
|---|---|
| AC-DOC-001 | `vercel.json` == `buildCommand: npm run build:vercel`, `outputDirectory: dist`, `installCommand: npm ci`, `git.deploymentEnabled: {"**": false, "main": true, "dev": true}` — 04 명세와 문자 일치 |
| AC-DOC-002 | runbook에 import 단계(§1)·env 스코프 분리 등록(§2)·Preview 값 생성 명령(§2)·NODE_ENV 금지(§2)·Production Branch=main(§3)·H-3 선택지(§4)·값 커밋 금지 원칙(서두·§2) 전부 존재, 실제 config 값 0건 |
| AC-DOC-003 | `미승인` 2건 (≥1) |
| AC-DOC-004 | CHANGELOG `0.3.1 — 2026-08-18` 배포 기반 항목 추가 확인 |

## 3. vercel.json 브랜치 화이트리스트 semantics 판정

- `"**": false` + `main: true` + `dev: true`는 02 §7 정정 2가 지시한 형태 그대로다. Vercel의 `git.deploymentEnabled`는 **미명시 브랜치를 기본 활성**으로 취급하므로 `"**": false` 없이는 화이트리스트가 성립하지 않는다 — 정정이 올바르게 반영됨.
- **문서화된 한계(중요, 결함 아님):** 이 규칙은 push된 커밋의 `vercel.json`에서 읽힌다. `vercel.json`은 현재 dev에만 존재하므로 **main(및 main에서 갈라진 브랜치)에는 병합 전까지 이 규칙이 적용되지 않는다.** 즉 main Production은 자체 Vite 기본값(`npm run build`)으로 구형 프로토타입을 빌드하며, 이 상태의 처리(노출 허용 vs Build Command override 차단)는 H-3 인간 선택으로 남아 있다. runbook §1·§3.4·§4와 05 §4가 이를 정확히 기술한다.
- 실 Vercel 계정에서의 동작 확인은 H-1(import) 이후에만 가능 — 기계 검증 범위 밖(04 §9와 일치).

## 4. 결함 목록

**Blocking: 0 / Major: 0 / Minor: 2 (기록성, 수정 불요)**

1. **[Minor] `check:mobile`의 dist 상태 의존성** — `npm run check:mobile`은 dist를 재빌드하지 않고 현재 dist를 4173으로 서빙한다. `build:vercel` 직후(주입된 dist)에 실행하면 runtime-config.js가 initScript 주입 config를 덮어 시나리오 seed가 달라져 timeout으로 실패한다(검증자 재현: `verification/commands.jsonl`의 mobile_check 1차 exit 1 → 일반 `npm run build` 후 2차 exit 0). 04의 AC 순서(§3 후 §4)와 "로컬 build+preview 절차" 전제를 지키면 발생하지 않으며, 역으로 로더 우선 실행의 실증이기도 하다. 후속 작업에서 check:mobile 서두에 dist 신선도 확인(예: runtime-config.js 존재 시 중단 또는 재빌드)을 넣으면 재발을 막는다.
2. **[Minor] 검증 harness 1차 시도 잔흔** — `verification/commands.jsonl`에 검증자 wrapper 스크립트의 인코딩 문제로 실패한 ac-env 1차 receipt(PowerShell 파서 오류)와, 그 과정에서 draft fixture 본문이 stderr로 에코된 1차 `ac-env-005` 로그가 있었다. 해당 로그 파일은 동명 재실행으로 대체되어 현재 `verification/*.log`에는 config 본문·sentinel이 없다(AC-SEC-002로 기계 확인). draft fixture는 저장소에 커밋된 미승인 draft로 비밀 아님. 구현 결함 아님 — 증적 투명성을 위해 기록.

09 결함 보고서는 작성하지 않는다(Blocking/Major 0).

## 5. 열린 인간 판단 (04 §9 — 잔존 필수)

- **H-1** Vercel 로그인·GitHub import·프로젝트 생성 (이 전에는 실배포 없음)
- **H-2** `ROGOLIKE_GAME_CONFIG_JSON` Production/Preview 스코프 분리 등록 (Production 승인 수치 미확정 → 등록 전 Production 빌드 fail closed가 설계 의도)
- **H-3** main Production: 구형 프로토타입 노출 허용 vs Build Command override 차단 선택
- **H-4** 실배포 Preview URL 380px 실기기 확인
- **H-5** 추후 main 병합 시점·승인

## 6. 판정

**PASS** — Blocking 0, Major 0. 동결된 02~05 계획·수락 기준에 대해 기계 검증 가능한 전 AC가 검증자 직접 실행 증거와 1:1로 매핑되어 통과했고, 작업 트리는 `verify-before` snapshot과 동일하며 main/dev 로컬·원격 ref는 불변이다.

단, 이 PASS는 **verify 단계까지의 판정**이다. 전체 작업 완료 선언에는 03 Task 8의 잔여 게이트 — `verify-after` snapshot, `post-verify` gate, finalize, checksum, HDD-006 근거의 dev commit·push, push 후 AC-GIT-003·004·005·007 재확인, 11-final-summary의 H-1~H-5 잔존 명시 — 가 남아 있다.
