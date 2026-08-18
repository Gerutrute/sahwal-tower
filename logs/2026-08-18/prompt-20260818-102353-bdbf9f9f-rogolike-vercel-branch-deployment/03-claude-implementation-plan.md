# 03 — Claude 구현 계획 (RoGolike Vercel 브랜치 배포)

- 작성자: Claude Code planner (Orca `task_5a76f99e39d6` / `ctx_4fcf6fa6d3a8`, 읽기 전용)
- 전제: `02-claude-requirements-analysis.md`의 기준선·제약. 구현자는 Hermes/Codex 단독.
- 원칙: 소스 index.html·로컬 빌드 계약 불변, 승인 수치·env 값 커밋 0, 실패 시 fail closed, 로그에 값 에코 0.

## 1. 아키텍처 개요

```
Vercel build (npm run build:vercel = node scripts/vercel-build.mjs)
  1) env ROGOLIKE_GAME_CONFIG_JSON 읽기
  2) 얕은 검증  scripts/vercel-runtime-config.mjs  (parse + 구조 검사, 값 에코 금지)
  3) 심층 검증  npx vite-node scripts/vercel-validate-boot.ts  (createInitialGameState 실호출)
  4) npm run build  (기존 로컬 계약 그대로: clean-dist → tsc → vite build)
  5) dist/runtime-config.js 생성  (__ROGOLIKE_DEPLOY_META__ + __ROGOLIKE_GAME_CONFIG__)
  6) dist/index.html </head> 직전에 <script src="./runtime-config.js"></script> 1회 주입 + 자가검증
  실패는 어느 단계든 exit≠0 (fail closed)

브라우저 부팅: runtime-config.js(classic, head) → main.tsx(module, deferred)가 전역을 읽어 App 렌더
Preview 라벨: VERCEL_ENV!=='production' → __ROGOLIKE_DEPLOY_META__.playtest=true → App 배너
```

고정 계약(AC와 1:1 — 문자열 정확 일치):

- env 변수명: `ROGOLIKE_GAME_CONFIG_JSON` (VITE_ 접두사 금지 — import.meta.env로 번들에 새지 않게)
- 오류 코드: `RUNTIME_CONFIG_MISSING` / `RUNTIME_CONFIG_INVALID_JSON` / `RUNTIME_CONFIG_SCHEMA_INVALID` / `RUNTIME_CONFIG_BOOT_FAILED`, 성공 마커 `RUNTIME_CONFIG_OK`
- 전역: `window.__ROGOLIKE_GAME_CONFIG__`(기존), `window.__ROGOLIKE_DEPLOY_META__ = Object.freeze({ target: 'production'|'preview', playtest: boolean })` — `target`은 `VERCEL_ENV==='production'`일 때만 `'production'`, 그 외(preview·development·부재)는 `'preview'`+`playtest:true` (라벨 fail-safe)
- 로더 태그: `<script src="./runtime-config.js"></script>` — `</head>` 직전, 정확히 1개, 첫 `<script type="module"`보다 앞
- 배너: `[data-deploy-note="playtest"]`, 텍스트 정확히 `개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다`

## 2. Task 순서 (TDD: 각 Task는 RED→GREEN→회귀)

### Task 0 — 게이트·검증 인프라

1. `plan-frozen`·`pre-implement` 게이트 exit 0 확인, `snapshot --stage implementation`.
2. `evidence.config.json`: `"vercel_preview_check": ["npm.cmd", "run", "check:vercel-preview"]`를 commands에 추가, `required`에 `vercel_preview_check` 추가.
3. AC 자동 실행은 `node scripts/check-ac-mapping.mjs logs/2026-08-18/prompt-20260818-102353-bdbf9f9f-rogolike-vercel-branch-deployment/04-claude-acceptance-criteria.md` (스크립트는 이미 인자화됨 — 수정 불필요).

### Task 1 — runtime-config 순수 라이브러리

- Files: `scripts/vercel-runtime-config.mjs`(신규), `tests/vercel.runtime-config.test.ts`(신규, node env)
- 첫 RED 테스트 이름: **`값이 없으면 RUNTIME_CONFIG_MISSING으로 실패한다`**
- export 계약:
  - `validateGameConfigText(text)` → `{ ok: true, config }` 또는 `{ ok: false, code, fields?: string[] }`. 검사: undefined/공백 → MISSING; `JSON.parse` 실패 → INVALID_JSON; 객체 아님/필수 최상위 키 부재(`seed, komiBySize, economy, mapWeights, effectLimits, generalCaptureMoneyCap, enemyDeck, bossByAct, rewards, shop, eventCurrencyReward, aiCaptureWeight, aiEffectWeights, aiPassScoreThreshold, analysisCaptureWeight, analysisEffectWeight, audioTuning`)/`komiBySize`의 7·9 비유한수/`aiEffectWeights` 6병종 불일치/`enemyDeck` 빈 배열 → SCHEMA_INVALID + 위반 **필드 경로만**(값 금지).
  - `renderRuntimeConfigJs(config, target)` → 파일 내용 문자열. 두 전역 설정, config는 `JSON.stringify` 직렬화만 포함(env dump 금지).
  - `injectRuntimeConfigScript(html)` → `</head>` 직전 1회 삽입. `</head>` 부재·이미 주입됨 → throw.
- 실패 결과의 직렬화(`JSON.stringify(result)`)에 입력 원문이 포함되지 않음을 마커 문자열로 테스트.

### Task 2 — 심층 부팅 검증 (vite-node)

- Files: `scripts/vercel-validate-boot.ts`(신규), `tests/vercel.validate-boot.test.ts`(신규, node env)
- 첫 RED 테스트 이름: **`draft fixture 구성으로 게임 상태를 부팅한다`**
- export `validateBootFromText(text)`: Task 1 얕은 검증 재사용 후 `createInitialGameState(config)`(src/game/GameProvider) 실호출. throw 시 `{ ok:false, code:'RUNTIME_CONFIG_BOOT_FAILED', message: error.message }`(assertConfig 메시지는 상수 문자열 — 값 미포함). 성공 시 `{ ok:true }`.
- CLI 모드(`process.argv[1]` 가드): env `ROGOLIKE_GAME_CONFIG_JSON`을 읽어 성공 시 `RUNTIME_CONFIG_OK` 출력·exit 0, 실패 시 코드 출력·exit 1. `vercel-build.mjs`가 `npx vite-node scripts/vercel-validate-boot.ts`로 호출.
- 테스트: draft fixture 직렬화 → ok; `enemyDeck: []` 변형 → `RUNTIME_CONFIG_SCHEMA_INVALID`(얕은 검증 재사용 증명 — 빈 enemyDeck은 Task 1 얕은 단계에서 걸러져 심층까지 도달하지 않음); `audioTuning.masterGain: null` 변형 → `RUNTIME_CONFIG_BOOT_FAILED`(얕은 검증은 audioTuning 내부를 검사하지 않아 통과하고, 현행 `assertConfig`의 유한 수치 검사가 `Number.isFinite(null)=false`로 상수 메시지 RangeError를 throw — src/game/GameProvider.tsx 기준 확인, draft fixture에 `audioTuning.masterGain: 0.7` 존재·null은 JSON 표현 가능).

### Task 3 — Vercel 빌드 엔트리

- Files: `scripts/vercel-build.mjs`(신규), `package.json`(`"build:vercel": "node scripts/vercel-build.mjs"` 추가)
- 흐름: §1 아키텍처 1→6. 4단계는 `spawnSync(npm, ['run','build'], { stdio:'inherit', shell: process.platform==='win32' })`로 **로컬 build 스크립트를 그대로 재사용**(체인 중복 금지). 6단계 후 자가검증: 파일 존재, 태그 정확히 1개, 태그 index < 첫 module script index — 위반 시 exit≠0.
- stdout 규율: 단계 배너·코드·바이트 수만. config 내용·env 목록 출력 금지.
- dist/ 밖 쓰기 금지 가드(clean-dist.mjs와 같은 경로 방어 패턴).

### Task 4 — Preview 라벨 UI

- Files: `src/App.tsx`(`export interface DeployMeta` + `App` optional prop `deployMeta` + 배너 렌더), `src/main.tsx`(`__ROGOLIKE_DEPLOY_META__` 전역 선언·읽기·prop 전달), `src/styles.css`(배너 스타일 — 380px에서 가로 overflow 0), `tests/ui.deploy-badge.test.tsx`(신규, jsdom)
- 첫 RED 테스트 이름: **`preview 배포 메타는 플레이테스트 라벨을 표시한다`**
- 배너는 `.app-shell` 안에서 **모든 screen에 상시** 렌더(playtest=true일 때만). `role="note"`, `data-deploy-note="playtest"`, §1의 고정 문구. production meta·meta 부재 → 요소 자체 없음.
- 테스트 3건: preview 표시 / production·부재 미표시 / 배너 존재 시 `등반 시작`→map 전환 무간섭.
- config 부재 화면(main.tsx의 configuration-required)은 불변.

### Task 5 — Vercel-방식 로컬 브라우저 검증

- Files: `scripts/vercel-export-draft-config.ts`(신규), `scripts/vercel-preview-check.mjs`(신규), `package.json`(`"check:vercel-preview": "node scripts/vercel-preview-check.mjs"`)
- `vercel-export-draft-config.ts`: `DRAFT_GAME_CONFIG`(tests/fixtures)를 **한 줄 compact JSON**으로 stdout 출력(vite-node 실행). 미승인 draft임을 주석 명시. 단일 진실 = fixture 모듈, 재생성 명령 = 이 스크립트.
- `vercel-preview-check.mjs` 흐름:
  1. sentinel = `process.env.VERCEL_CHECK_SENTINEL ?? crypto.randomUUID().replace(/-/g,'')`
  2. `npx vite-node scripts/vercel-export-draft-config.ts` stdout 파싱 → `config.seed = 'vercel-check-' + sentinel` 덮어쓰기 → env `ROGOLIKE_GAME_CONFIG_JSON` 구성
  3. `npm run build:vercel` spawn (env + `VERCEL_ENV='preview'`), stdout/stderr를 `playwright-results/vercel-build.log`에 저장 → **로그에 sentinel 부재 assert**
  4. dist 자산 assert: `dist/runtime-config.js` 존재·sentinel 포함(전달 경로 증명), `dist/index.html` 태그 1개
  5. `npx vite preview --host 127.0.0.1 --port 4174 --strictPort` spawn → HTTP readiness 대기
  6. Playwright chromium 380×844 (기존 `browserOptions()` 패턴 재사용), **config 주입 initScript 없음**. 수집: console error/pageerror/requestfailed/응답≥400
  7. assert: 문서 200, `h1` `RoGolike`, `등반 시작` 버튼 표시(=runtime-config 경유 부팅 성공), `[data-deploy-note="playtest"]` 표시·문구 일치, `scrollWidth ≤ 380`, 오류 수집 4종 모두 0, `runtime-config.js` 응답 200. `등반 시작` 클릭 → `[data-screen="map"]` 표시(config가 실제 게임 상태를 구동함을 증명)
  8. `playwright-results/vercel-preview-380.png` 스크린샷, `playwright-results/vercel-report.json` 기록 — **report에 config·sentinel 미포함**(불리언·수치만)
  9. `finally`: preview 서버 종료 + `node scripts/clean-dist.mjs` 실행(= fixture 값이 dist에 잔존하지 않음 — cleanup 후 무누출 계약)
- 참고: 기존 `check:mobile`(4173)과 포트 분리(4174)로 동시 실행 충돌 방지.

### Task 6 — Vercel 프로젝트 설정·문서

- Files: `vercel.json`(신규), `.gitignore`(append), `docs/04_prototype/04_Vercel_배포.md`(신규), `docs/CHANGELOG.md`(항목 추가)
- `vercel.json`:
  ```json
  {
    "buildCommand": "npm run build:vercel",
    "outputDirectory": "dist",
    "installCommand": "npm ci",
    "git": { "deploymentEnabled": { "**": false, "main": true, "dev": true } }
  }
  ```
  (Vercel 공식 semantics: `deploymentEnabled`에 **미명시된 브랜치는 기본 활성**이므로 `{main:true, dev:true}`만으로는 다른 브랜치가 차단되지 않는다. minimatch `"**": false` + main·dev 명시 `true` 화이트리스트가 그 외 브랜치 배포를 차단한다 — 규칙이 겹치는 브랜치는 하나라도 `true`면 배포된다. 한계: 이 규칙은 push된 커밋의 vercel.json에서 읽히므로, vercel.json이 없는 브랜치(예: 병합 전 main에서 갈라진 브랜치)에는 적용되지 않는다. SPA rewrites 불필요 — 단일 페이지.)
  이번 작업에서 `vercel.json`은 **dev에만 존재**한다(HDD-007로 main 병합 금지). 따라서 main Production 빌드는 병합 전까지 자체 Vite 기본값(`npm run build`)으로 구형 프로토타입을 배포하고, dev Preview 빌드만 dev 커밋의 vercel.json(`npm run build:vercel`)을 배포 단위로 읽는다.
- `.gitignore` 추가: `.vercel/`, `runtime-config.js` (생성물이 dist 밖으로 나올 일이 없더라도 방어적 차단).
- `docs/04_prototype/04_Vercel_배포.md` 필수 내용(05 브리프 §4 runbook과 동일 골자): import 단계, env 등록(같은 변수명·Production/Preview 스코프 분리), Preview 값 생성 명령(`npx vite-node scripts/vercel-export-draft-config.ts` — 미승인 draft 명시), NODE_ENV 금지 경고, Production Branch=main 확인, dev 브랜치 Preview URL(`…-git-dev-….vercel.app`), vercel.json이 병합 전까지 dev에만 존재해 main Production은 자체 Vite 기본값으로 빌드된다는 점, §5-5·H-3(구형 main 노출 vs Production override) 선택지, 값은 Vercel에만 존재·커밋 금지 원칙.

### Task 7 — 전체 검증·인계

1. 전체 suite: `npm test` → `npm run typecheck` → `npm run build` → `npm.cmd audit --omit=dev --audit-level=high` → `npm run benchmark:ai` → check:mobile(4173 절차) → `npm run check:vercel-preview` 전부 exit 0.
2. fail-closed 음성 케이스 4종(04 §1)을 capture-command로 기록(값 에코 없는 출력 확인 포함).
3. `snapshot --stage verify-before` → fresh Claude verifier dispatch 요청(이 planner와 다른 세션). 결함 시 09/10 루프.

### Task 8 — commit·push (검증 GREEN + finalize 이후에만, HDD-006)

1. `gate post-verify` → `finalize --outcome succeeded` → `verify-checksums` 통과 확인.
2. `git add -A` 후 dev에 commit — 권장 2분할: (a) 미커밋 MVP 보정·playtest-ux 결과물+해당 증적, (b) 이번 Vercel 배포 작업+증적. 단일 커밋도 HDD-006 승인 범위 내에서 허용. 커밋 메시지에 대응 prompt id 명시.
3. `git push origin dev`. **금지: main checkout·merge·push, force-push, tag, history rewrite.**
4. ref 게이트 확인(04 §7): main·origin/main = `2c00919d094310950633ae40237bf1764fc078b3` 불변, push 후 dev = origin/dev, `git status --porcelain` 빈 출력.
5. push 후 Vercel Preview는 **인간이 H-1·H-2를 수행해야** 실제 배포됨 — 11-final-summary에 H-1~H-5 잔존 명시.

## 3. 위험·완화 요약

| 위험 | 완화 |
|---|---|
| vite-node가 node 환경에서 GameProvider import 실패 | Task 2 vitest(node env)가 먼저 재현. 실패 시 원인 모듈의 브라우저 API 접근을 lazy화(같은 Task에서 최소 수정) |
| 로더 태그가 로컬 빌드에 새어 들어감 | 저장소 index.html 불변 + 04 §3에서 일반 빌드 산출물 무태그를 기계 검증 |
| 빌드 로그에 값 누출 | 코드-만 출력 규율 + sentinel 부재 assert(스크립트 내부+검증자 재확인) |
| npm-in-npm Windows spawn 실패 | `shell: process.platform==='win32'` + `stdio:'inherit'`. Vercel(linux)은 무영향 |
| 포트 충돌 | 4174 `--strictPort`, `finally` 종료 |
| 동일 실패 3회 | 루프 중단·인간 escalation (AGENTS §3) |
