# 04 — Claude 수락 기준 (RoGolike Vercel 브랜치 배포)

- 작성자: Claude Code planner (Orca `task_5a76f99e39d6` / `ctx_4fcf6fa6d3a8`, 읽기 전용)
- 모든 AC는 **명령 + 통과 조건**으로 기계 검증한다. fresh Claude verifier는 각 AC를 실제 실행 증거와 1:1 매핑하며, 실행하지 않은 명령을 통과로 기록할 수 없다.
- 백틱 안의 `npx vitest run tests/...` 명령은 `node scripts/check-ac-mapping.mjs logs/2026-08-18/prompt-20260818-102353-bdbf9f9f-rogolike-vercel-branch-deployment/04-claude-acceptance-criteria.md`가 자동 실행한다(각각 exit 0 + passing ≥1).
- env 조작 명령은 PowerShell 기준으로 표기한다. `<PROMPT_DIR>`는 이 증적 디렉터리.
- **RED/GREEN 증거 규칙:** 신규 테스트 파일 3개는 구현 전 RED 로그(assertion 실패 — 구문·import 오류는 RED가 아님)와 구현 후 GREEN 로그를 `<PROMPT_DIR>/codex/self-check/`에 capture-command로 보존해야 한다. 03이 고정한 첫 테스트 이름과 `-t` 명령이 일치해야 한다.

## 1. Fail-closed 환경 검증 (AC-ENV)

사전: `$env:VERCEL_ENV='preview'`. 각 명령 후 `$LASTEXITCODE` 확인. 출력은 파일로 저장해 검사한다.

| ID | 명령 | 통과 조건 |
|---|---|---|
| AC-ENV-001 | `Remove-Item Env:ROGOLIKE_GAME_CONFIG_JSON -ErrorAction SilentlyContinue; npm.cmd run build:vercel` | exit≠0, 출력에 `RUNTIME_CONFIG_MISSING` |
| AC-ENV-002 | `$env:ROGOLIKE_GAME_CONFIG_JSON='   '; npm.cmd run build:vercel` | exit≠0, `RUNTIME_CONFIG_MISSING` |
| AC-ENV-003 | `$env:ROGOLIKE_GAME_CONFIG_JSON='{"seed":LEAKCHECK-9Q4'; npm.cmd run build:vercel *> ac-env-003.log` | exit≠0, 로그에 `RUNTIME_CONFIG_INVALID_JSON` 존재 **그리고** `Select-String -Path ac-env-003.log -SimpleMatch 'LEAKCHECK-9Q4'` 0건(값 에코 금지) |
| AC-ENV-004 | `$env:ROGOLIKE_GAME_CONFIG_JSON='{"seed":"x"}'; npm.cmd run build:vercel` | exit≠0, `RUNTIME_CONFIG_SCHEMA_INVALID` + 위반 필드 경로 표기(값 미표기) |
| AC-ENV-005 | draft fixture JSON에서 `audioTuning.masterGain`을 `null`로 바꾼 값으로 `npm.cmd run build:vercel` | exit≠0, `RUNTIME_CONFIG_BOOT_FAILED` — 얕은 검증(구조·komi·병종·enemyDeck)은 통과하고 심층 `createInitialGameState` 단계에서만 실패하는 변형. (`enemyDeck: []`는 얕은 단계 `RUNTIME_CONFIG_SCHEMA_INVALID`로 걸러지므로 이 AC의 입력으로 쓸 수 없음) |
| AC-ENV-006 | 위 5건 실행 직후 `npm.cmd run build` | exit 0 — 음성 케이스가 로컬 빌드 상태를 오염시키지 않음 |

## 2. 단위 테스트 RED/GREEN (AC-UNIT)

| ID | 검증 명령 | 통과 조건 |
|---|---|---|
| AC-UNIT-001 | `npx vitest run tests/vercel.runtime-config.test.ts -t "값이 없으면 RUNTIME_CONFIG_MISSING으로 실패한다"` | GREEN. RED 로그 `codex/self-check/vercel-runtime-config-red.log`(exit≠0) 존재 |
| AC-UNIT-002 | `npx vitest run tests/vercel.runtime-config.test.ts` | MISSING/INVALID_JSON/SCHEMA_INVALID(최상위 키 부재·komi 비유한수·병종 6종 불일치·빈 enemyDeck)/draft fixture ok/render 전역 2종·target별 playtest 값/inject 1회·중복 throw·`</head>` 부재 throw/실패 결과 직렬화에 입력 마커 미포함 — 전부 GREEN |
| AC-UNIT-003 | `npx vitest run tests/vercel.validate-boot.test.ts -t "draft fixture 구성으로 게임 상태를 부팅한다"` | GREEN. RED 로그 `codex/self-check/vercel-validate-boot-red.log` 존재 |
| AC-UNIT-004 | `npx vitest run tests/vercel.validate-boot.test.ts` | `createInitialGameState` 실호출 경유 + `enemyDeck: []` → `RUNTIME_CONFIG_SCHEMA_INVALID`(얕은 검증 재사용 증명) + `audioTuning.masterGain: null` → `RUNTIME_CONFIG_BOOT_FAILED`(얕은 통과·심층 실패 증명) — 전부 GREEN |
| AC-UNIT-005 | `npx vitest run tests/ui.deploy-badge.test.tsx -t "preview 배포 메타는 플레이테스트 라벨을 표시한다"` | GREEN. RED 로그 `codex/self-check/deploy-badge-red.log` 존재 |
| AC-UNIT-006 | `npx vitest run tests/ui.deploy-badge.test.tsx` | preview → `[data-deploy-note="playtest"]` 텍스트 정확히 `개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다` / production meta·meta 부재 → 요소 0개 / 배너 존재 시 `등반 시작`→`[data-screen="map"]` 전환 — 전부 GREEN |

## 3. Vercel-방식 빌드 + 로컬 계약 (AC-BLD)

| ID | 명령 | 통과 조건 |
|---|---|---|
| AC-BLD-001 | `$json = (npx vite-node scripts/vercel-export-draft-config.ts); $env:ROGOLIKE_GAME_CONFIG_JSON=$json; $env:VERCEL_ENV='preview'; npm.cmd run build:vercel` | exit 0, 출력에 `RUNTIME_CONFIG_OK` |
| AC-BLD-002 | AC-BLD-001 직후 `Test-Path dist/runtime-config.js` / `Select-String -Path dist/index.html -SimpleMatch '<script src="./runtime-config.js"></script>'` | 파일 존재(True), 태그 정확히 1건, 태그가 첫 `<script type="module"`보다 앞(문자 index 비교) |
| AC-BLD-003 | AC-BLD-001의 dist에서 `Select-String -Path dist/runtime-config.js -SimpleMatch '__ROGOLIKE_DEPLOY_META__'` 및 `'__ROGOLIKE_GAME_CONFIG__'` | 두 전역 모두 존재, `"playtest":true` 포함 |
| AC-BLD-004 | `$env:VERCEL_ENV='production'`으로 AC-BLD-001 재실행 후 dist/runtime-config.js 검사 | `"target":"production"`·`"playtest":false` 포함 |
| AC-BLD-005 | `Remove-Item Env:ROGOLIKE_GAME_CONFIG_JSON…; Remove-Item Env:VERCEL_ENV…; npm.cmd run build` 후 dist 검사 | exit 0, dist/index.html에 `runtime-config` 문자열 0건, `Test-Path dist/runtime-config.js` False — **로컬 빌드 계약 불변** |
| AC-BLD-006 | `git diff --stat -- index.html vite.config.ts` | 두 파일 무변경(소스 index.html·빌드 설정 불변 원칙) |

## 4. 380px 실브라우저 부팅 + Preview 라벨 (AC-PRV)

| ID | 명령 | 통과 조건 |
|---|---|---|
| AC-PRV-001 | `$env:VERCEL_CHECK_SENTINEL=[guid]::NewGuid().ToString('N'); npm.cmd run check:vercel-preview` | exit 0 |
| AC-PRV-002 | `playwright-results/vercel-report.json` 검사 | 380×844·config 무주입 브라우저에서: 문서 200, `RoGolike` h1, `등반 시작` 표시(부팅 성공), `[data-deploy-note="playtest"]` 문구 일치, `scrollWidth ≤ 380`, console/pageerror/requestfailed/응답≥400 = 0, runtime-config.js 응답 200, `등반 시작` 클릭 후 map 화면 진입 — 전부 true. report에 config 본문·sentinel 미포함 |
| AC-PRV-003 | `Test-Path playwright-results/vercel-preview-380.png` | True (스크린샷 증적) |
| AC-PRV-004 | 기존 계약: `BASE_URL=http://127.0.0.1:4173/`로 `npm.cmd run check:mobile`(로컬 build+preview 절차) | exit 0 — 주입식 로컬 검사 회귀 없음 |

## 5. 무누출 (repo/logs/dist, cleanup 후) (AC-SEC)

AC-PRV-001과 같은 세션에서 sentinel 변수 유지 상태로 실행한다.

| ID | 명령 | 통과 조건 |
|---|---|---|
| AC-SEC-001 | `git grep -n $env:VERCEL_CHECK_SENTINEL` | exit 1 (추적 파일 매치 0건) |
| AC-SEC-002 | `Get-ChildItem logs -Recurse -File \| Select-String -SimpleMatch $env:VERCEL_CHECK_SENTINEL` | 0건 (증적 로그 무누출) |
| AC-SEC-003 | `Test-Path dist/runtime-config.js` | False — check:vercel-preview가 종료 시 clean-dist를 수행(cleanup 후 dist 무잔존) |
| AC-SEC-004 | `Select-String -Path playwright-results/vercel-build.log -SimpleMatch $env:VERCEL_CHECK_SENTINEL` | 0건 (빌드 로그에 값 에코 없음) |
| AC-SEC-005 | `git status --porcelain` 을 검증 전후 비교 | 검증 명령들이 추적 파일을 새로 변경하지 않음(증적 디렉터리 제외) |
| AC-SEC-006 | `git grep -nE "ROGOLIKE_GAME_CONFIG_JSON" -- src` | exit 1 — 소스 번들 경로에 env 직접 참조 없음(전역 window 주입만) |
| AC-SEC-007 | `.gitignore` 검사 | `.vercel/`·`runtime-config.js` 라인 존재 |

## 6. 전역 명령 (AC-CMD — verifier가 exact argv로 직접 실행)

| ID | 명령 (exact argv) | 통과 조건 |
|---|---|---|
| AC-CMD-001 | `npm.cmd test` | exit 0, 실패 0 |
| AC-CMD-002 | `npm.cmd run typecheck` | exit 0 |
| AC-CMD-003 | `npm.cmd run build` | exit 0 |
| AC-CMD-004 | `npm.cmd audit --omit=dev --audit-level=high` | exit 0 (신규 런타임 의존성 0 유지) |
| AC-CMD-005 | `npm.cmd run benchmark:ai` | exit 0 |
| AC-CMD-006 | `npm.cmd run check:mobile` (4173 preview 절차 포함) | exit 0 |
| AC-CMD-007 | `npm.cmd run check:vercel-preview` | exit 0 (AC-PRV-001과 동일 실행을 receipt로 보존) |
| AC-CMD-008 | `evidence.config.json` 검사 | `vercel_preview_check` exact argv `["npm.cmd","run","check:vercel-preview"]` + `required` 포함 |

## 7. Git ref 게이트 (AC-GIT — commit·push는 Hermes/Codex가 HDD-006 근거로 수행, verifier는 읽기 전용 재확인)

기준 sha: main 계열 `2c00919d094310950633ae40237bf1764fc078b3`, 작업 전 dev `8df1159983b0642cf5d144761f518188a64bcc15`.

| ID | 명령 | 통과 조건 |
|---|---|---|
| AC-GIT-001 | `git rev-parse --abbrev-ref HEAD` | `dev` — 전 과정 dev에서만 작업 |
| AC-GIT-002 | `git rev-parse main` / `git ls-remote origin refs/heads/main` | 둘 다 `2c00919d0943…` 불변 (병합·push 없음, HDD-007) |
| AC-GIT-003 | commit 증적 | `finalize`·`verify-checksums` 통과 **이후** `git add -A` 커밋 receipt 존재, 커밋 메시지에 prompt id·HDD-006 근거 명시, 부모가 `8df1159…` 계보 |
| AC-GIT-004 | `git push origin dev` receipt + `git ls-remote origin refs/heads/dev` | push exit 0, 원격 dev sha == 로컬 `git rev-parse dev` |
| AC-GIT-005 | push 후 `git status --porcelain` | 빈 출력 (dirty tree 전체가 커밋됨 — HDD-006의 "최신 로컬 dev 변경 전체") |
| AC-GIT-006 | 명령 이력 검사 | `git checkout main`·`merge`·`push origin main`·`push --force`·`reset --hard`·history rewrite receipt 0건 |
| AC-GIT-007 | `git ls-files vercel.json docs/04_prototype/04_Vercel_배포.md` | 두 파일 추적됨(배포 설정·runbook이 push에 포함) |

## 8. 문서·설정 (AC-DOC)

| ID | 명령 | 통과 조건 |
|---|---|---|
| AC-DOC-001 | `vercel.json` 내용 검사 | `buildCommand`=`npm run build:vercel`, `outputDirectory`=`dist`, `installCommand`=`npm ci`, `git.deploymentEnabled`={`"**"`:false, main:true, dev:true} — 미명시 브랜치는 Vercel 기본 활성이므로 `"**": false` 화이트리스트 필수 |
| AC-DOC-002 | `docs/04_prototype/04_Vercel_배포.md` 검사 | import 단계·env 스코프 분리 등록·Preview 값 생성 명령·NODE_ENV 금지 경고·Production Branch=main·H-3 선택지·값 커밋 금지 원칙 전부 포함, 실제 config 값 0건 |
| AC-DOC-003 | `Select-String -Path docs/04_prototype/04_Vercel_배포.md -SimpleMatch '미승인'` | ≥1건 — Preview 수치가 승인 수치가 아님을 문서에 명시(HDD-009) |
| AC-DOC-004 | `docs/CHANGELOG.md` diff | 이번 배포 인프라 항목 추가 |

## 9. 인간 판단 항목 (기계 검증 밖 — 11-final-summary에 잔존 명시 필수)

- H-1 Vercel 로그인·프로젝트 import, H-2 Production/Preview env 등록(Production 승인 수치 미확정 → 등록 전 Production 빌드 fail closed 유지), H-3 main Production 구형 노출 vs override 선택, H-4 실배포 Preview URL 380px 실기기 확인, H-5 추후 main 병합. 이 5건이 열린 상태로 보고되지 않으면 완료로 인정하지 않는다.
