# 06 — Codex 구현 로그

## Plan hash

- `03-claude-implementation-plan.md`: `1d5d85bbde412cf0b82d0cffb51942baf0c8dc74be5962afacd725896faa283f`
- 구현자: Hermes/Codex, Orca task `task_1188f32717cb`, dispatch `ctx_babcef2eeab3`
- 구현 snapshot: `e66f4f8e91f3e48ac25dedd139b259904bbf6df5`
- Git: `dev` dirty worktree 유지. commit/push/main 조작 없음.

## 구현 내용

1. `ROGOLIKE_GAME_CONFIG_JSON`을 값 에코 없이 파싱·얕은 검증하고, 실제 `createInitialGameState` 부팅까지 통과해야만 진행하는 2층 fail-closed 검증을 추가했다.
2. 기존 `npm run build`를 재사용한 뒤 `dist/runtime-config.js`와 loader를 dist에만 생성했다. Vite가 head에 만든 module script는 순서를 보존해 body 시작으로 옮겨 loader가 실제 `</head>` 직전이면서 첫 module script보다 앞이 되며, 이 계약을 자가검증한다.
3. `window.__ROGOLIKE_DEPLOY_META__`를 App에 전달해 preview에만 고정 문구의 플레이테스트 라벨을 모든 화면에서 표시했다.
4. fixture 단일 진실에서 draft를 export하고, 4174에서 실제 Vercel 방식 build/preview를 무주입 Playwright 380×844로 검증한 뒤 `dist`를 정리하는 `check:vercel-preview`를 추가했다.
5. `vercel.json`은 `"**": false`, `main: true`, `dev: true` 화이트리스트로 작성했고, Dashboard import/env/Production 선택지 runbook을 추가했다.
6. 기존 `check:mobile`은 `BASE_URL` 미지정 시 4173 Vite preview를 프로그램 내부에서 열고 `finally`에서 닫을 수 있게 해 exact command를 자체 완결형으로 유지했다. 최종 receipt는 이미 실행 중이던 4173 preview를 `BASE_URL`로 사용했다.

## 변경 파일

- 배포 설정: `.gitignore`, `evidence.config.json`, `package.json`, `vercel.json`
- Vercel 구현: `scripts/vercel-runtime-config.mjs`, `scripts/vercel-runtime-config.d.mts`, `scripts/vercel-validate-boot.ts`, `scripts/vercel-build.mjs`, `scripts/vercel-export-draft-config.ts`, `scripts/vercel-preview-check.mjs`
- 브라우저 검증 보강: `scripts/playwright-mobile-check.mjs`
- 앱/UI: `src/App.tsx`, `src/main.tsx`, `src/styles.css`
- 테스트: `tests/vercel.runtime-config.test.ts`, `tests/vercel.validate-boot.test.ts`, `tests/ui.deploy-badge.test.tsx`
- 문서: `docs/04_prototype/04_Vercel_배포.md`, `docs/CHANGELOG.md`
- 증적: 이 파일과 `07-codex-result.md`, `codex/exec-receipts.jsonl`, `codex/self-check/*`, `diff/10-codex-implementation.patch`, `manifest.json`

저장소의 기존 dirty MVP/playtest 변경은 보존했으며, `index.html`과 `vite.config.ts`는 수정하지 않았다.

## TDD receipts

| 대상 | RED | 최소 GREEN | 전체 focused/회귀 |
|---|---|---|---|
| runtime config | `vercel-runtime-config-red` exit 1, 지정 테스트 assertion 실패 | `vercel-runtime-config-green` exit 0 | `vercel-runtime-config-focused`, `vercel-runtime-config-regression` exit 0 |
| boot validation | `vercel-validate-boot-red` exit 1, 지정 테스트 assertion 실패 | `vercel-validate-boot-green` exit 0 | `vercel-validate-boot-focused`, `vercel-validate-boot-regression` exit 0 |
| preview badge | `deploy-badge-red` exit 1, 지정 테스트 assertion 실패 | `deploy-badge-green` exit 0 | `deploy-badge-focused`, `deploy-badge-regression` exit 0 |

## Fail-closed 및 배포 receipts

| Receipt | 실제 결과 |
|---|---|
| `ac-env-001-missing` | exit 1, `RUNTIME_CONFIG_MISSING` |
| `ac-env-002-blank` | exit 1, `RUNTIME_CONFIG_MISSING` |
| `ac-env-003-invalid-json` | exit 1, `RUNTIME_CONFIG_INVALID_JSON`; sentinel log 0건 |
| `ac-env-004-schema-invalid` | exit 1, `RUNTIME_CONFIG_SCHEMA_INVALID` + 필드 경로만 출력 |
| `ac-env-005-boot-failed` | exit 1, `RUNTIME_CONFIG_BOOT_FAILED` |
| `ac-bld-preview` | exit 0, preview/playtest metadata와 loader 순서 확인 |
| `ac-bld-production` | exit 0, production/non-playtest metadata 확인 |

## 최종 self-check receipts

| 이름 / exact argv | 결과 |
|---|---|
| `full_tests`: `npm.cmd test` | exit 0, 45 files / 237 tests passed |
| `typecheck`: `npm.cmd run typecheck` | exit 0 |
| `build`: `npm.cmd run build` | exit 0, 57 modules; 일반 dist에 runtime loader/file 없음 확인 |
| `runtime_audit`: `npm.cmd audit --omit=dev --audit-level=high` | exit 0, vulnerabilities 0 |
| `benchmark_ai`: `npm.cmd run benchmark:ai` | exit 0; 7×7 p95 1.3ms, 9×9 p95 2.2ms, candidate counts 일치 |
| `mobile_check`: `npm.cmd run check:mobile` | 최신 receipt exit 0; 380/430px, 81 hit targets, 오류 배열 0, `passed:true` |
| `vercel_preview_check`: `npm.cmd run check:vercel-preview` | 최신 receipt exit 0; `VERCEL_PREVIEW_CHECK_OK`, report `passed:true`, cleanup 성공 |
| `python-tests` | exit 0, 23 tests |
| `python-compile-expanded` | exit 0, evidence Python 파일 전체 컴파일 |
| `hook-self-test` | exit 0, `"ok": true` |
| `ac-mapping` | exit 0, 6/6 Vitest 명령 실행·통과 |

## 보정 이력

- 최초 boot-failed 음성 실행에서 `vite-node`가 `process.argv[1]`을 runner 경로로 바꿔 CLI 가드가 실행되지 않는 결함을 발견했다. Vitest marker를 이용하는 가드로 수정한 뒤 같은 receipt를 재실행해 `RUNTIME_CONFIG_BOOT_FAILED`/exit 1을 확인했다.
- 첫 preview check는 heading visibility를 지도 전환 후 읽은 검사 순서와 cleanup child shell 호출 때문에 실패했다. 초기 화면 값을 전환 전에 캡처하고 cleanup을 직접 Node 실행으로 바꿔 GREEN을 보존했다.
- 문서의 `py_compile` glob은 Windows native argv에서 확장되지 않아 exit 1이었다. 동일 `.py` 집합을 PowerShell로 명시 확장한 `python-compile-expanded`가 exit 0이다.
- `mobile_check` 한 실행에서 오디오 전환 중 `shoptheme.mp3 ERR_ABORTED` 1건이 수집됐으나, 즉시 동일 exact command 재실행과 최종 재실행이 모두 exit 0이었다. 최신 log는 오류 배열 0이다.
- 전체 `git diff --check`는 이번 범위 밖의 2026-08-17 evidence patch에 이미 존재한 trailing whitespace 5곳 때문에 exit 2였다. 기존 증적은 수정하지 않았고 `diff-check-task-scope`와 신규 파일 trailing whitespace 검색은 통과했다.

## 보안·무누출 점검

- 최종 preview check의 per-run sentinel은 Git tracked files, `logs/`, `playwright-results/vercel-build.log`에서 모두 0건이었다.
- report에는 config 본문과 sentinel이 없고, 종료 후 `dist/runtime-config.js` 및 `dist`가 없다.
- `git grep -nE "ROGOLIKE_GAME_CONFIG_JSON" -- src` 결과 0건이며 browser bundle은 env를 직접 참조하지 않는다.
- config/env 전체 dump를 기록하지 않았다. 오류 출력은 고정 코드와 필드 경로로 제한했다.

## 인계 상태

구현과 implementer self-check는 완료했다. coordinator가 fresh Claude verifier를 실행하기 전이므로 post-verify, finalize, checksum, commit, push는 실행하지 않았다.
