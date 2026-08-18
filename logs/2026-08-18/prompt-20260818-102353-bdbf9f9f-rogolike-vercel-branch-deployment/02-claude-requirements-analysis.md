# 02 — Claude 요구사항 분석 (RoGolike Vercel 브랜치 배포)

- 작성자: Claude Code planner (Orca `task_5a76f99e39d6` / `ctx_4fcf6fa6d3a8`, 읽기 전용)
- 기준 문서: `00-user-request.md`, `01-human-design-decisions.md` (HDD-001~009), `AGENTS.md`, `evidence.config.json`
- 저장소: `https://github.com/Gerutrute/sahwal-tower.git` (origin), 현재 브랜치 `dev`

## 1. 요청 요약

한 개의 Vercel 프로젝트에 저장소를 연결해 `main`=Production, `dev`=Preview로 자동 배포한다. 최신 dev 제품은 승인 수치를 코드에 내장하지 않으므로, Vercel 빌드가 **환경 변수에서 GameConfig를 읽어 `runtime-config.js`를 생성**하고, 값이 없거나 잘못되면 **fail closed** 한다. Preview 화면에는 개발 플레이테스트 구성임을 표시하고, 검증된 로컬 dev 변경 전체를 dev에 commit·push한다(HDD-006 승인). main은 건드리지 않는다(HDD-007).

## 2. 현재 코드 기준선 (읽기 전용 확인 결과)

| 항목 | 확인 내용 |
|---|---|
| `src/main.tsx` | `window.__ROGOLIKE_GAME_CONFIG__`가 있으면 `<App config={…}/>`, 없으면 "승인된 GameConfig가 필요합니다" 화면(`role="alert"`). **주입 지점이 이미 존재** — 빠진 것은 배포 환경에서 이 전역을 채우는 로더뿐 |
| `index.html` | `runtime-config` 로더 없음. `<title>RoGolike</title>`, module script 1개 |
| `src/game/GameProvider.tsx` | `GameConfig` 인터페이스(seed·komiBySize·economy·mapWeights·effectLimits·enemyDeck·bossByAct·rewards·shop·AI 가중치·audioTuning)와 `assertConfig()`(유한 수치, 6개 병종 가중치, enemyDeck 비어있지 않음). `createInitialGameState()`가 부팅 검증의 단일 진실 |
| `vite.config.ts` | `base: './'`, `publicDir: 'public'`, legacy plugin. vitest include `tests/**/*.test.{ts,tsx}` |
| `package.json` | `build` = `node scripts/clean-dist.mjs && tsc --noEmit && vite build`. `preview` = `vite preview --host 127.0.0.1`(기본 4173). `check:mobile` = playwright 검사. Vercel 관련 스크립트 없음 |
| `scripts/playwright-mobile-check.mjs` | 380×844에서 `addInitScript`로 draft config를 직접 주입해 검사. **응답 400 이상을 실패로 집계** → index.html에 무조건적인 `runtime-config.js` 태그를 넣으면 로컬 빌드 검사에서 404로 깨짐 |
| `tests/fixtures/draft-game-config.ts` | `DRAFT_GAME_CONFIG` — 커밋된 **미승인 draft** fixture (HDD-013 pending 주석). 로컬 Vercel-방식 빌드 검증의 입력 재료로 재사용 가능 |
| `.gitignore` | `dist/`, `playwright-results/`, `.vite/` 무시. `.vercel/`·`runtime-config.js`는 아직 없음 |
| `evidence.config.json` | required: full_tests·typecheck·build·benchmark_ai·runtime_audit·mobile_check (exact argv 강제) |
| `scripts/check-ac-mapping.mjs` | AC 경로를 argv/`AC_PATH`로 받음(하드코딩 아님) — 이번 run 04 경로로 실행 가능 |
| Git refs | `main`=`origin/main`=`2c00919d0943…`(구형 프로토타입), `dev`=`origin/dev`=`8df1159983b0…`. **작업 트리는 대규모 dirty**: 2026-08-17 MVP 보정·playtest-ux 결과물(src/tests/scripts/docs/logs 수십 개 수정·신규·삭제)이 미커밋 상태 — 이것이 HDD-006의 commit·push 대상 |
| `vercel.json` / `.vercel/` | 없음 |
| `package-lock.json` | 존재 → Vercel install은 `npm ci` 가능 |

## 3. 요구사항 (기계 검증 가능 형태)

상태: **확정**=인간 결정 완료, **인간**=인간만 수행 가능(대시보드/승인).

| ID | 요구사항 | 상태 | 출처 |
|---|---|---|---|
| R-DEP-01 | Vercel 프로젝트 1개, Production Branch=`main`, `dev` push→Preview 배포 | 확정 | HDD-001·002 |
| R-DEP-02 | Vercel 빌드 명령이 env `ROGOLIKE_GAME_CONFIG_JSON`을 읽어 `dist/runtime-config.js`를 생성하고 `dist/index.html`에 로더 태그를 주입 | 확정 | 요구 1, HDD-003 |
| R-DEP-03 | env 부재·빈 값·JSON 파싱 실패·스키마 위반·부팅 불가 config → 빌드 exit≠0 (fail closed). 실패 메시지는 **원인 코드만** 출력하고 env 값 원문을 절대 에코하지 않음 | 확정 | 요구 2, AGENTS §9 |
| R-DEP-04 | 일반 로컬 계약 불변: `npm run build`/`npm test`/`npm run typecheck`/`npm run check:mobile`은 env 없이 기존과 동일하게 동작. 로컬 빌드 dist에는 runtime-config 태그·파일이 **없음**(404 유발 금지) | 확정 | 요구 3 |
| R-DEP-05 | 생성 파일과 환경 값이 Git에 커밋되지 않음: 생성물은 gitignore된 `dist/` 내부에만 쓰고, 방어적으로 `runtime-config.js`·`.vercel/`을 gitignore에 추가 | 확정 | 요구 4 |
| R-DEP-06 | Preview(및 development) 빌드 화면에 상시 라벨 `개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다` 표시. Production은 라벨 없음. 라벨 여부는 `VERCEL_ENV`에서 파생(코드에 분기 수치 내장 금지) | 확정 | 요구 대의, HDD-004·005·009 |
| R-DEP-07 | 실제 Vercel-방식 빌드를 로컬에서 fixture env로 재현하고, 380×844 실브라우저에서 **주입 스크립트 없이** 부팅(타이틀→지도 진입)·라벨 표시·가로 스크롤 없음·콘솔/네트워크 오류 0을 검증 | 확정 | 요구 5 |
| R-DEP-08 | 검증 GREEN + finalize 후 dirty tree 전체를 `dev`에 commit, `origin/dev`로 push. main·origin/main ref는 전 과정에서 불변 | 확정 | 요구 6·7, HDD-006·007 |
| R-DEP-09 | Vercel 계정·GitHub import·env 등록은 인간이 대시보드에서 수행. 정확한 단계별 runbook을 저장소 문서로 제공. credentials 추측·기록 금지 | 인간 | 요구 8, HDD-008 |
| R-DEP-10 | 빌드 로그·증적 로그·report에 config 값·env 전체 dump가 남지 않음(코드·경로·불리언만). 검증은 per-run 무작위 sentinel로 누출 0을 기계 확인 | 확정 | AGENTS §9 |
| R-DEP-11 | Production/Preview env 값은 Vercel 환경 스코프로 분리 등록(같은 변수명, 다른 스코프) | 확정(등록은 인간) | HDD-005 |

## 4. 비범위 (Non-goals)

- main 병합·수정·push·checkout (HDD-007). 승인된 Production GameConfig 값 결정(미존재, 인간 대기).
- Vercel 계정 자동화·CLI 로그인·토큰 취급. 커스텀 도메인. 새 런타임 의존성. SPA rewrites(단일 페이지라 불필요).
- 실배포 URL 스모크: 프로젝트 import가 인간 단계이므로 배포 후 인간 확인 항목으로 남긴다(§6).

## 5. 제약·위험

1. **로컬 check:mobile 회귀 위험:** index.html에 정적 태그를 넣으면 로컬 preview에서 404 → 응답≥400 집계로 실패. 따라서 태그 주입은 **Vercel 빌드 경로에서 빌드 산출물(dist/index.html)에만** 수행한다. 저장소 index.html은 불변.
2. **스크립트 실행 순서:** 로더는 `</head>` 직전의 classic script — parser가 즉시 실행하므로 deferred module(`src/main.tsx`)·legacy nomodule보다 항상 먼저 전역을 채운다.
3. **NODE_ENV footgun:** Vercel 프로젝트 env에 `NODE_ENV=production`을 넣으면 devDependencies(vite 포함)가 설치되지 않아 빌드 전체가 깨진다. runbook에 금지 명시.
4. **검증 깊이 vs 드리프트:** 스키마를 스크립트에 재구현하면 `assertConfig`와 어긋날 수 있다 → 얕은 구조 검증(순수 mjs) + `createInitialGameState()` 실호출 심층 검증(vite-node) 2층으로 단일 진실을 유지한다. vite-node의 node 환경에서 `GameProvider.tsx` import가 module scope에서 브라우저 API를 건드리면 실패할 수 있음 — 신규 vitest(node env) 테스트가 이를 먼저 잡는다.
5. **main Production의 현재 상태:** import 직후 Production은 main(`2c00919`, 구형 사활의탑 프로토타입, vercel.json·`build:vercel` 없음)을 기본 설정(`npm run build`)으로 빌드한다. 즉 **Production 도메인에는 당분간 구형 프로토타입이 뜨거나**(기본 동작), 대시보드에서 build command를 project 전역 override하면 main 빌드가 실패해 Production이 비어 있게 된다. 어느 쪽을 택할지는 인간 결정(§6) — runbook에 두 선택지와 결과를 명시한다.
6. **첫 Production 배포 실패 가능성:** 추후 main에 이번 작업이 병합되면, 승인된 Production `ROGOLIKE_GAME_CONFIG_JSON`이 등록될 때까지 Production 빌드는 fail closed로 실패한다. 이는 설계 의도이며 결함이 아니다.
7. **Windows spawn:** `.cmd` spawn은 `shell: true`(또는 `npm.cmd` 명시)가 필요. Vercel(linux)·로컬(win32) 모두에서 도는 spawn 코드를 작성한다.
8. **env 값 크기:** GameConfig JSON은 수 KB — Vercel env 한도(총 64KB) 내 여유.

## 6. 열린 인간 판단 (완료 보고에 반드시 잔존 명시)

| 항목 | 내용 |
|---|---|
| H-1 | Vercel 로그인·GitHub import·프로젝트 생성 (HDD-008) |
| H-2 | `ROGOLIKE_GAME_CONFIG_JSON` Production/Preview 스코프 등록. Preview 값은 draft 기반(미승인 라벨), Production 값은 **승인 수치 미확정 → 등록 전까지 fail closed 유지** |
| H-3 | main Production의 당분간 상태 선택: 구형 프로토타입 노출 허용 vs 대시보드 override로 Production 비활성 (§5-5) |
| H-4 | 실배포 Preview URL의 380px 실기기 확인(로컬 재현 검증은 이번 범위에서 기계 수행) |
| H-5 | 추후 main 병합 시점·승인 (이번 범위 아님, HDD-007) |

## 7. 부록 — plan freeze 전 정정 (2026-08-18, 별도 검토 세션)

- 검토자: Claude planning-correction worker (Orca `task_fc37c3f0f791` / `ctx_4f03139b447c`). 문서(02~05)만 수정, 소스 무변경.
- **정정 1 — 얕은/심층 검증 모순 (03 §2 Task 2, 04 AC-ENV-005·AC-UNIT-004):** 얕은 검증(03 Task 1)이 `enemyDeck` 빈 배열을 `RUNTIME_CONFIG_SCHEMA_INVALID`로 걸러내고 심층 검증은 얕은 검증을 재사용하므로, `enemyDeck: []`는 `RUNTIME_CONFIG_BOOT_FAILED`에 도달할 수 없다(명시적 모순이었음). 심층 음성 케이스를 `audioTuning.masterGain: null`로 교체 — 얕은 검증은 audioTuning 내부를 검사하지 않아 통과하고, 현행 `assertConfig`(src/game/GameProvider.tsx)의 유한 수치 검사가 `Number.isFinite(null)=false`로 상수 메시지 RangeError를 throw해 `createInitialGameState` 단계에서 BOOT_FAILED가 된다. draft fixture에 `audioTuning.masterGain: 0.7` 존재, `null`은 JSON 표현 가능(현행 코드 기준 확인). `enemyDeck: []`는 얕은 재사용 증명 케이스(SCHEMA_INVALID)로 이동.
- **정정 2 — `git.deploymentEnabled` 반화이트리스트 오류 (03 Task 6, 04 AC-DOC-001, 05 §4-4):** Vercel 공식 문서상 `deploymentEnabled`에 미명시된 브랜치는 **기본 활성**이므로 `{main:true, dev:true}`는 다른 브랜치를 차단하지 못한다. `{"**": false, "main": true, "dev": true}`로 교체(규칙이 겹치면 하나라도 true인 브랜치는 배포됨 — 공식 semantics). 한계 병기: 규칙은 push된 커밋의 vercel.json에서 읽히므로 vercel.json이 없는 브랜치에는 미적용.
- **확인 3 — 한 프로젝트 main/dev 동작 (05 §4-1·4-5 표현 정정):** `vercel.json`은 병합 전까지 dev에만 존재한다. import 화면은 기본 브랜치 main 기준이라 Vite 기본값이 표시되며(vercel.json 값이 보이는 것이 아님), main Production은 자체 기본값(`npm run build`)으로 구형 프로토타입을 배포하고, dev Preview는 dev 커밋의 vercel.json을 배포 단위로 읽어 대시보드 설정보다 우선 적용한다. 따라서 H-3의 project 전역 Build Command override(§5-5)는 실행 가능하며 dev Preview에는 영향이 없다 — 불가능한 project-level 지시 없음.
