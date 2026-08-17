# 05 — Codex 구현 지시서 (RoGolike MVP + 음악 통합)

- 작성자: Claude Code planner (Orca dispatch `task_9fde52777d0a` / `ctx_98fa5d528924`)
- 수신자: Hermes/Codex — **이 저장소의 유일한 구현자**
- 동결 계획: `.hermes/plans/2026-08-17_172618-gwiseokrok-mvp-music-integration.md` (SHA-256 `94efc5bd04b8ee9cf0344486eacd127193de1909b31077aff35f8380ef64d7ea`)
- 함께 읽을 것: `02-claude-requirements-analysis.md`(요구·경계), `03-claude-implementation-plan.md`(Task 순서·슬라이스), `04-claude-acceptance-criteria.md`(통과 조건 전체)
- 제품 표시명: 정확히 `RoGolike`. 저장소·npm 이름(`sahwal-tower`)은 유지.

## 1. 절대 규칙 (위반 시 검증 무효)

1. **TDD 순서 강제:** 모든 동작은 "실패 테스트 1개 작성 → `npx vitest run <file> -t "<정확한 이름>"` RED 기록 → 최소 구현 → 같은 명령 GREEN → Task 파일 전체 + `npm test` 회귀 0건" 순서. 테스트 구문 오류·import 오류는 RED가 아니다. 각 Task의 첫 RED·마지막 GREEN·전체 회귀를 `python scripts/evidence/evidence.py capture-command --dir <PROMPT_DIR> --role implementer --name <이름> -- <명령>`으로 보존하라. 동결 계획 §3의 Task별 첫 테스트 이름·focused 명령을 그대로 사용하라(AC의 `-t` 명령과 일치해야 함).
2. **초안 수치 둔갑 금지:** HDD-009(부활·보스), HDD-010(경제·도장·장군석 냥 상한), HDD-011(효과 상한), HDD-012(지도 가중치), HDD-013(오디오 청음값)의 수치는 `src/`에 리터럴 기본값으로 넣지 마라. 엔진은 `EffectLimits`·`EconomyConfig`·`MapWeights`·`AudioTuning`·enemy/boss 정의를 **무기본값 필수 인자**로 받고, 초안 수치는 `tests/fixtures/`(또는 명확히 draft로 명명된 fixture 모듈)에만 둔다. 덤(HDD-008)은 `komi` 함수 인자만 허용, 어떤 형태의 기본 덤 상수도 export 금지.
3. **구형 계약 폐기 순서:** 구형 테스트 삭제는 대응 신규 계약 테스트가 먼저 GREEN이 된 뒤 같은 변경 묶음에서만. 최종적으로 `FLOORS|START_POUCH|sweepDead|pouchB|pouchW|kingB|kingW|superko`가 `src/ tests/ scripts/`에서 0건이어야 한다(AC-NEG-004).
4. **금지 사항:** 사용자 명시 요청 없는 commit/push/reset/rebase, `music/*.mp3` 수정·재인코딩(필요 시 무손실 remux만), 새 런타임 의존성 추가(`react`/`react-dom` 외), 외부 네트워크·분석 API, 비밀 로그. Claude artifact(02~05, 08, 09)는 수정 금지.
5. **3회 동일 실패 시** 루프를 멈추고 인간에게 escalation.

## 2. 착수 순서 (03의 Task 0→12 순서를 따르라)

### Task 0 — 즉시 수행

1. `evidence.config.json`에 exact argv 추가:
   - `"benchmark_ai": ["npm.cmd", "run", "benchmark:ai"]`
   - `"runtime_audit": ["npm.cmd", "audit", "--omit=dev", "--audit-level=high"]`
   - `"mobile_check": ["npm.cmd", "run", "check:mobile"]`
   - `required`: `["full_tests", "typecheck", "build", "benchmark_ai", "runtime_audit", "mobile_check"]`
2. `scripts/evidence/evidence.py`: required verifier receipt의 실제 argv가 config exact argv와 동일해야 통과하도록 강화. `tests/evidence/test_evidence_cli.py`에 alias receipt(올바른 이름+다른 argv) finalize 실패 회귀 추가 → `python -m unittest discover -s tests -v` exit 0.
3. **(AI 권고, 재량)** `scripts/check-ac-mapping.mjs`의 AC 경로를 `logs/2026-08-17/prompt-20260817-190947-3b7f0199-rogolike-mvp/04-claude-acceptance-criteria.md`로 갱신(또는 인자화). 갱신하지 않으면 AC 백틱 명령 자동 실행이 구 run을 검사하므로 이번 run 검증에 쓸 수 없다.
4. `python scripts/evidence/evidence.py gate --dir <PROMPT_DIR> --name plan-frozen` 및 `--name pre-implement` exit 0 확인. manifest에 계획 hash `94efc5bd…`가 동결되는지 확인.
5. `python scripts/evidence/evidence.py snapshot --dir <PROMPT_DIR> --stage implementation` 후 구현 시작.

### Task 1~10-1 — 수직 슬라이스

`03-claude-implementation-plan.md` §2의 Task별 Files·슬라이스 순서·설계 계약을 그대로 구현하라. Task마다:

- 첫 RED는 동결 계획이 고정한 테스트 이름으로 시작한다 (Task 1 `7×7과 9×9 판을 만든다` / Task 2 `병종이 달라도 즉시 되따냄은 단순패다` / Task 3 `10장에서 4장을 뽑는다` / Task 4 `동일 입력은 동일 로그를 낸다` / Task 5 `두 번째 패스 뒤 계가한다` / Task 6 `모든 경로에 일반전 1~3개` / Task 7 `9×9가 81개 좌표를 비중첩 렌더한다` / Task 8 `복제는 선택 카드만 한 장 추가한다` / Task 9 `첫 gesture 전 context를 만들지 않는다` / Task 10 `동일 run은 동일 익명 지표를 낸다` / Task 10-1 `잠긴 ID는 후보에서 제외된다`).
- Task 종료 시 04의 해당 AC 그룹이 전부 GREEN이어야 다음 Task로 이동.
- `src/engine.ts`는 각 Task에서 새 모듈 public API의 re-export facade로 갱신, Task 8 이후 구형 export 제거.

핵심 계약 요약(상세는 03·04):

- **바둑:** `size` 인자 순수 엔진, `canonicalKoKey`=색 배치만, 면적 계가+주입 komi, 잔존 돌 전원 생존.
- **덱:** `createDeckState(deckList, rng)` 주입 + HDD-004 확정 시작 덱 상수(일반석×6·척후·수호·희생·장군). 카드↔판 위 돌 상태 분리. 빈 덱 임시 일반석.
- **효과:** data-driven 정의, 우선순위 1~10 + 4-bucket comparator + acquisitionOrder + sourceId tie-break, `resolveMove()` dry-run=미리보기=커밋 단일 경로, 주입 `EffectLimits` 초과 시 원자적 rollback+`EFFECT_LIMIT_EXCEEDED`.
- **전투·AI:** 명시적 phase 머신, 부적 pre-move 한정, 0.2.3 부활 계약 전체(보상 보류·상태 유지·전용 착수 1회·후보 0=자동 패스), 고정 순서 전수 평가+seeded tie-break, 시간 중단 금지. 2단계 특성·BOSS-001은 주입 정의.
- **벤치마크:** `scripts/benchmark-ai.mjs` — Vite server+Playwright CDP 4× throttle, fixture 7×7 5·9×9 5, warm-up 10·측정 100, candidate 수 대조, p95 7×7≤100ms·9×9≤200ms, exit 규약, `finally` 정리. `package.json`에 `benchmark:ai` 추가.
- **맵·경제:** 생성기 단계 경로 불변식(5노드·전투 1~3·비전투≥2), HDD-003 확정 ID만 콘텐츠 정의(각 ID별 발동 조건·시점·대상·지속·중첩·횟수·패스/종료 테스트 필수), `EconomyConfig`/`MapWeights` 주입.
- **UI:** `RoGolike` 정확 표기, 구형 문자열 0(`src/`·`index.html`·`scripts/`), size 기반 BoardSvg, hit target 규격, aria/키보드, 순수 reducer 경유·이중 결제 금지, `criticalMoveCandidates` 결정적 1~3개 '복기 후보'.
- **오디오:** gesture 전 AudioContext 금지, HDD-007 라우팅(부활 2단계=boss), 단일 context·곡별 gain, lazy fetch·2곡 LRU, generation token, localStorage 분리, BASE_URL, HTMLAudio fallback, `vite.config.ts` `publicDir:'music'`, 원본 무수정.
- **계측·해금:** 결정적 지표·PII 0·로컬 JSON, komi 후보 입력형 시뮬레이션(색 반전 쌍+Wilson CI, 결론 금지), `UnlockState` 필터 전용.

### Task 11 — 전체 검증 준비

`npm test` → `npm run typecheck` → `npm run build` → `npm.cmd audit --omit=dev --audit-level=high` → `npm run benchmark:ai` 전부 exit 0. preview는 background 시작→`curl -sf http://127.0.0.1:4173/` readiness→별도 foreground `BASE_URL=http://127.0.0.1:4173/ npm run check:mobile`→보고서 확인→process 종료·4173 LISTENING 0. `scripts/playwright-mobile-check.mjs`는 04 AC-CMD-006 항목 전체를 검사하도록 재작성(Chrome 경로: `PLAYWRIGHT_CHROMIUM_EXECUTABLE`→Playwright Chromium→Windows Chrome, `try/finally`).

### Task 12 — 검증 인계

1. `snapshot --stage verify-before` 후 **fresh Claude verifier dispatch**를 요청하라(이 planner와 다른 세션, 읽기 전용). verifier가 required 명령을 `--role verifier`·exact argv로 직접 실행한다.
2. 결함 보고(09) 수신 시 수정 후 `10-codex-fix-log.md` 기록, 새 Task/Dispatch로 재검증 요청.
3. `snapshot --stage verify-after`(tree 동일 필수) → `gate --name post-verify` → `finalize --outcome succeeded` → `verify-checksums`.
4. `06-codex-implementation-log.md`·`07-codex-result.md`에 실제 명령·변경 파일·receipt를 기록하라. 실행하지 않은 명령을 통과로 쓰지 마라.

## 3. 완료 보고 조건

- 04의 §1~§11 AC 전부에 실행 증거 존재. `주입` 게이트 AC는 draft fixture로 통과하되 **밸런스 확정으로 보고 금지**.
- `11-final-summary.md`에 반드시 명시: HDD-008(덤)·HDD-009(부활/보스 수치)·HDD-010(경제/도장)·HDD-011(상한)·HDD-012(가중치)·HDD-013(청음값)은 인간 결정 대기이며, 실기 Android/iOS 청음 QA·시각적 재미·밸런스 판단은 자동 검증 밖의 열린 인간 판단이다.
- 조건 미충족 시 `BLOCKED`/`FAILED`로 보고하고 성공으로 포장하지 마라 (AGENTS §11).
