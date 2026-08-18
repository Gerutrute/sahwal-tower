# 05 — Codex 구현 지시서 (RoGolike Vercel 브랜치 배포)

- 작성자: Claude Code planner (Orca `task_5a76f99e39d6` / `ctx_4fcf6fa6d3a8`)
- 수신자: Hermes/Codex — **이 저장소의 유일한 구현자**
- 함께 읽을 것: `02`(기준선·위험·H-항목), `03`(Task 0~8·고정 계약 문자열), `04`(통과 조건 전체)

## 1. 절대 규칙 (위반 시 검증 무효)

1. **TDD:** 신규 테스트 3파일(`tests/vercel.runtime-config.test.ts`, `tests/vercel.validate-boot.test.ts`, `tests/ui.deploy-badge.test.tsx`)은 각각 03이 고정한 첫 테스트 이름으로 RED(assertion 실패 — 구문·import 오류는 RED 아님)를 `capture-command --role implementer`로 기록한 뒤 최소 구현→GREEN→`npm test` 회귀 0건. RED 로그 이름은 04 §2가 지정한 파일명으로 self-check에 보존.
2. **값 에코 금지:** 빌드·검증 스크립트의 어떤 stdout/stderr에도 `ROGOLIKE_GAME_CONFIG_JSON` 값·config 본문·env dump를 출력하지 마라. 오류는 코드(`RUNTIME_CONFIG_MISSING`/`_INVALID_JSON`/`_SCHEMA_INVALID`/`_BOOT_FAILED`)와 필드 경로만. report·증적 로그도 동일.
3. **커밋 금지 항목:** 승인 수치, env 값, `runtime-config.js` 실물, `.vercel/`. 생성물은 gitignore된 `dist/` 안에만 쓴다. 저장소 `index.html`·`vite.config.ts`는 수정하지 않는다(태그는 빌드 산출물에만 주입).
4. **고정 계약 문자열**(03 §1)을 그대로 사용: env 이름, 오류 코드, 전역 2종, 로더 태그, 배너 문구 `개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다`, `data-deploy-note="playtest"`. AC가 문자열 일치로 검사한다.
5. **Git:** Task 8 전까지 commit/push 금지. main·origin/main은 어떤 명령으로도 건드리지 않는다(HDD-007). push는 `origin dev` 한정, HDD-006 승인 근거를 06 로그와 커밋 메시지에 남긴다. force-push·reset·rebase·history rewrite 금지.
6. **3회 동일 실패 시** 중단하고 인간 escalation.

## 2. 착수 순서

03 §2의 Task 0→8을 순서대로. Task별 신규/수정 파일:

| Task | 파일 | 핵심 |
|---|---|---|
| 0 | `evidence.config.json` | `vercel_preview_check` exact argv 추가 + required. 게이트·snapshot |
| 1 | `scripts/vercel-runtime-config.mjs`, `tests/vercel.runtime-config.test.ts` | validate/render/inject 순수 함수. RED: `값이 없으면 RUNTIME_CONFIG_MISSING으로 실패한다` |
| 2 | `scripts/vercel-validate-boot.ts`, `tests/vercel.validate-boot.test.ts` | `createInitialGameState` 실호출 + CLI 가드. RED: `draft fixture 구성으로 게임 상태를 부팅한다`. 심층 음성 케이스는 `audioTuning.masterGain: null`(얕은 통과→BOOT_FAILED) — `enemyDeck: []`는 얕은 단계 SCHEMA_INVALID이므로 BOOT_FAILED 케이스로 쓰지 마라(03 §2 Task 2·04 AC-UNIT-004) |
| 3 | `scripts/vercel-build.mjs`, `package.json`(`build:vercel`) | env→2층 검증→`npm run build` 재사용→dist 생성·주입·자가검증. Windows spawn `shell:true` |
| 4 | `src/App.tsx`(DeployMeta·배너), `src/main.tsx`(전역 읽기), `src/styles.css`, `tests/ui.deploy-badge.test.tsx` | RED: `preview 배포 메타는 플레이테스트 라벨을 표시한다`. 380px overflow 0 |
| 5 | `scripts/vercel-export-draft-config.ts`, `scripts/vercel-preview-check.mjs`, `package.json`(`check:vercel-preview`) | sentinel seed→build:vercel→포트 4174 preview→무주입 Playwright 380×844→report/스크린샷→`finally` clean-dist. 03 §2 Task 5의 assert 목록 전부 |
| 6 | `vercel.json`, `.gitignore`, `docs/04_prototype/04_Vercel_배포.md`, `docs/CHANGELOG.md` | 03 §2 Task 6 내용 + §4 runbook 반영 |
| 7 | — | 전체 suite + 04 §1 음성 4종 receipt + verify-before → fresh verifier dispatch |
| 8 | — | finalize 후 `git add -A`→dev commit(권장 2분할)→`git push origin dev`→04 §7 ref 게이트 확인 |

## 3. 완료 보고 조건

- 04 §1~§8 전 AC에 실행 증거 존재, blocking/high 결함 0, 검증 전후 tree 동일, manifest·finalize·checksum 통과.
- `07-codex-result.md`·`11-final-summary.md`에 **반드시 명시:** H-1~H-5(02 §6)가 열린 인간 판단으로 남아 있음 — 특히 (a) Vercel import·env 등록 전에는 어떤 실배포도 존재하지 않음, (b) Production은 승인 수치 등록 전까지 fail closed가 정상, (c) main Production의 구형 프로토타입 노출 여부는 인간 선택. 실행하지 않은 명령을 통과로 쓰지 마라. 조건 미충족 시 `BLOCKED`/`FAILED`로 보고한다.

## 4. 사용자 전달용 Vercel Dashboard runbook (docs/04_prototype/04_Vercel_배포.md에 수록, 11에도 요약)

1. **Import:** vercel.com 로그인(GitHub 인증) → Add New → Project → `Gerutrute/sahwal-tower` Import. import 화면은 기본 브랜치 `main` 기준이며 main에는 `vercel.json`이 없으므로 Vite 기본값(`npm run build` / `dist`)이 표시된다 — 확인만 하고 override하지 않는다(단, H-3에서 Production 차단을 선택한 경우 제외). `dev` 배포는 dev 커밋의 `vercel.json`(`npm run build:vercel` / `dist` / `npm ci`)을 배포 단위로 읽으며 이 값이 대시보드 설정보다 우선한다. main Production은 추후 병합 전까지 자체 기본값으로 빌드되어 구형 프로토타입이 배포된다(H-3 참고).
2. **환경 변수:** Project → Settings → Environment Variables에서 `ROGOLIKE_GAME_CONFIG_JSON`을 **두 번** 등록한다 — ① Environment=Production만 체크: 승인된 Production GameConfig JSON(현재 미확정 — 등록 전 Production 빌드는 의도적으로 실패), ② Environment=Preview만 체크: 개발 플레이테스트 JSON. Preview 값은 로컬에서 `npx vite-node scripts/vercel-export-draft-config.ts` 출력(미승인 draft)을 복사해 쓰고, 필요 시 seed만 바꾼다. 값은 Vercel에만 존재해야 하며 저장소·이슈·채팅에 붙여넣지 않는다.
3. **금지:** `NODE_ENV` 변수를 추가하지 마라(devDependencies 미설치로 빌드 전체가 깨진다).
4. **브랜치:** Settings → Git에서 Production Branch가 `main`인지 확인(기본값). `dev` push는 자동으로 Preview 배포가 되며, 고정 URL은 `sahwal-tower-git-dev-<scope>.vercel.app` 형식, 배포별 URL은 Deployments 탭에서 확인한다. `vercel.json`의 `git.deploymentEnabled`(`"**": false` + main·dev `true` 화이트리스트)로 vercel.json을 포함한 브랜치 중 main·dev 외에는 배포되지 않는다 — Vercel은 미명시 브랜치를 기본 활성으로 두므로 `"**": false`가 필수이며, vercel.json이 없는 브랜치(예: 병합 전 main에서 갈라진 브랜치)에는 이 규칙이 적용되지 않는다.
5. **H-3 선택(인간):** 현재 main은 구형 프로토타입 커밋이다. (기본) 그대로 두면 Production 도메인에 구형 빌드가 배포된다 / (대안) Project Build Command를 `npm run build:vercel`로 override하면 구형 main 빌드가 실패해 Production이 비어 있게 된다(사실상 차단). 이 override는 dev Preview에 영향이 없다 — dev 커밋의 `vercel.json`이 대시보드 설정보다 우선한다. 원하는 쪽을 선택한다.
6. **확인:** env 등록 후 실패한 배포는 Deployments → Redeploy. Preview URL을 380px(모바일 에뮬레이션)로 열어 `개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다` 배너와 타이틀 화면을 확인한다(H-4).
