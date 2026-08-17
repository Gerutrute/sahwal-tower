# 03 — Claude 구현 계획 (RoGolike MVP + 음악 통합)

- 작성자: Claude Code planner (Orca dispatch `task_9fde52777d0a` / `ctx_98fa5d528924`, 읽기 전용)
- 기준 계획: `.hermes/plans/2026-08-17_172618-gwiseokrok-mvp-music-integration.md` — SHA-256 `94efc5bd04b8ee9cf0344486eacd127193de1909b31077aff35f8380ef64d7ea` (검증 완료)
- 본 문서는 동결 계획을 evidence 측 실행 계획으로 구체화한다. 동결 계획과 충돌하는 내용은 없으며, 충돌이 발견되면 본 문서가 아니라 escalation으로 처리한다.
- 요구사항 ID(R-*)는 `02-claude-requirements-analysis.md`, 수락 기준 ID(AC-*)는 `04-claude-acceptance-criteria.md`를 참조한다.

## 0. 실행 원칙

1. **구현 주체:** 모든 소스·테스트·설정 변경은 Hermes/Codex만 수행한다. Claude는 계획·AC·검증 보고만 작성한다 (AGENTS §2).
2. **strict vertical TDD:** Task마다 "실패 테스트 1개 → focused RED 기록 → 최소 구현 → focused GREEN → Task 파일 전체 + `npm test` 회귀 0건" 사이클을 동작 단위로 반복한다. 테스트 구문 오류·import 실패는 유효한 RED가 아니다. 각 Task의 첫 RED, 마지막 GREEN, 전체 회귀는 `evidence.py capture-command --role implementer`로 보존한다.
3. **게이트 보존:** 미승인 초안 수치(HDD-009~012)와 인간 대기 값(HDD-008, HDD-013)은 주입 설정·fixture로만 존재한다. 엔진 모듈은 이 값들을 무기본값 필수 인자로 받는다.
4. **구형 계약 폐기 순서:** 구형 테스트 삭제는 대응 신규 계약 테스트가 먼저 GREEN이 된 뒤 같은 변경 묶음에서만 수행한다.
5. **facade 전략:** `src/engine.ts`는 마이그레이션 동안 새 모듈 public API의 re-export facade로 유지하고, Task 8 이후 구형 export(`FLOORS`, `START_POUCH`, `sweepDead`, `kingB/kingW`, `pouchB/pouchW`, 폭발석·바위·왕돌·superko 관련) 소비자 0개를 검색 테스트로 확인 후 제거한다.
6. **commit:** 사용자 명시 요청 시에만, `dev` 브랜치에서, 동결 계획 §4의 커밋 경계를 따른다.

## 1. Task 흐름과 게이트 매트릭스

```text
Task 0 (evidence·config 동결)
→ Task 1 (board/rng) → Task 2 (rules/scoring, komi 주입)
→ Task 3 (deck) → Task 4 (effects/stones, 상한 주입)
→ Task 5 (battle/ai/revival + benchmark)
→ Task 6 (run/map/economy, 경제·가중치 주입)
→ Task 7 (React 화면·동적 보드) → Task 8 (콘텐츠 UI·결과 분석)
→ Task 9 (audio) → Task 10/10-1 (telemetry/unlocks)
→ Task 11 (전체 회귀·모바일·수동 QA) → Task 12 (독립 검증·finalize)
```

| Task | 차단 결정 | 미확정 상태에서 허용되는 범위 (동결 계획 준거) |
|---|---|---|
| 0, 1, 3, 7 | 없음 | 전체 구현 |
| 2 | HDD-008 | `komi` 함수 인자 엔진·테스트만. 제품 기본 덤 금지 |
| 4 | HDD-010/011 | STONE-001~006 + 주입형 상한 엔진. 임의 상한 확정 금지 |
| 5 | HDD-009 | 부활 phase·전용 착수 메커니즘·벤치마크 전체 구현. 2단계 특성 수치·보스 콘텐츠는 주입 정의 |
| 6/8 | HDD-010/012 | 맵 불변식·reducer 골격·주입 경제. 임의 수치로 완료 선언 금지 |
| 9 | HDD-013 | 확정 라우팅·상태 머신 전체. exact gain/loop/crossfade는 청음 후 |
| 10 | HDD-008~010 | 계측 도구 전체. 밸런스 결론·제품 수치 확정 금지 |

## 2. Task별 실행 계획

### Task 0 — evidence run 정합과 명세 동결

- **선행 완료:** `evidence.py start`는 이미 실행됨(`manifest.json` status STARTED, baseline `94705b8f…`). 이 run 폴더를 계속 사용한다.
- **Codex 변경:**
  - `evidence.config.json`: `commands.benchmark_ai=["npm.cmd","run","benchmark:ai"]`, `commands.runtime_audit=["npm.cmd","audit","--omit=dev","--audit-level=high"]`, `commands.mobile_check=["npm.cmd","run","check:mobile"]` 추가, `required`=기존 3개+이 3개.
  - `scripts/evidence/evidence.py`: required verifier receipt의 실제 argv가 config의 exact argv와 동일해야 통과.
  - `tests/evidence/test_evidence_cli.py`: 올바른 이름+다른 argv alias receipt는 finalize 실패, exact argv만 성공하는 회귀 추가.
  - (AI 권고, Hermes 재량) `scripts/check-ac-mapping.mjs`의 AC 경로를 이번 run의 `04-claude-acceptance-criteria.md`로 갱신하거나 인자화.
- **게이트:** 본 artifact 4종 작성 후 `evidence.py gate --name plan-frozen`·`--name pre-implement` exit 0 확인, manifest `plan_hashes`에 계획 SHA `94efc5bd…` 기록.
- **검증:** `python -m unittest discover -s tests -v` exit 0 (AC-EVID-001~003).

### Task 1 — 동적 바둑판·결정적 RNG

- **Files:** Create `src/game/types.ts`, `src/game/rng.ts`, `src/game/go.ts`; Modify `src/engine.ts`(facade); Create `tests/go.board.test.ts`, `tests/rng.test.ts`.
- **첫 슬라이스(RED):** `tests/go.board.test.ts` `7×7과 9×9 판을 만든다` — `createBoard` 미정의로 FAIL. GREEN: `npx vitest run tests/go.board.test.ts tests/rng.test.ts`.
- **이후 슬라이스:** 귀·변·중앙 이웃(size 매개변수), `groupAt`·활로, 입력 불변성(readonly), seed 재현(`rng.test.ts`).
- **설계:** `BoardState={size:7|9; points:readonly (Stone|null)[]}`, `Stone={color:'B'|'W'; kind:StoneKind; instanceId:string}`. 좌표 함수는 전부 `size` 인자. seeded RNG 하나가 셔플·보상·맵·AI tie-break의 유일한 난수원.
- **Exit:** AC-GO-001~003.

### Task 2 — 단순패·패스·면적 계가

- **Files:** Modify `src/game/go.ts`; Create `src/game/scoring.ts`, `tests/go.rules.test.ts`, `tests/go.scoring.test.ts`; 신규 suite GREEN 후 `tests/engine.rules.test.ts` 교체.
- **첫 슬라이스(RED):** `tests/go.rules.test.ts` `병종이 달라도 즉시 되따냄은 단순패다` — `canonicalKoKey` 미정의. GREEN: `npx vitest run tests/go.rules.test.ts tests/go.scoring.test.ts`.
- **슬라이스 순서:** 포획→다중 그룹 동시 제거→자충수 금지→단순패(색 배치만 직렬화, 병종 무관)→패스의 단순패 해제·무소비→연속 패스/자동 패스 종료→단색 영역·혼합 중립 계가→`흑=돌+영역`, `백=돌+영역+komi(인자)`→`.5` 무승부 없음.
- **게이트:** `scoreArea(board, komi)` 형태로만 구현. 어떤 모듈도 기본 덤 상수를 export하지 않는다(AC-NEG-001).
- **Exit:** AC-GO-010~017, AC-NEG-001.

### Task 3 — 순환형 돌 덱

- **Files:** Create `src/game/deck.ts`, `src/game/content/stones.ts`(카드 정의 시작), `tests/deck.test.ts`.
- **첫 슬라이스(RED):** `10장에서 4장을 뽑는다` — `createDeckState` 미정의. GREEN: `npx vitest run tests/deck.test.ts`.
- **슬라이스:** 초기 셔플·4장 드로우→착수 성공 후에만 버림→패스 무소비→버림 재셔플(동일 RNG 스트림)→카드 1장·같은 병종 다수 배치→덱 0장 임시 일반석 생성·사용 후 소멸→일시 패 한도 중첩·만료.
- **상태:** `drawPile/hand/discardPile/temporaryCards/handLimit/nextCardId` 분리. 카드↔판 위 돌은 `kind`만 공유. `createDeckState(deckList, rng)` 주입형이되, HDD-004 승인 완료이므로 확정 시작 덱 상수(`일반석×6+척후+수호+희생+장군`) export 허용.
- **Exit:** AC-DECK-001~007.

### Task 4 — 결정적 효과 큐·MVP 특수 돌

- **Files:** Create `src/game/effects.ts`; Expand `src/game/content/stones.ts`; Create `tests/effects.queue.test.ts`, `tests/stones.test.ts`.
- **첫 슬라이스(RED):** `동일 입력은 동일 로그를 낸다` — `resolveEffectQueue` 미정의. GREEN: `npx vitest run tests/effects.queue.test.ts tests/stones.test.ts`.
- **설계:** 효과=data-driven `{trigger, priority, sideRelation, sourceKind, acquisitionOrder, sourceId, perMoveLimit}`. 동일 priority comparator: active stone→active relic→opponent captured stone→opponent relic→acquisitionOrder→sourceId. 실제 처리와 미리보기는 같은 `resolveMove()` dry-run.
- **슬라이스:** 척후석 확인/재정렬→장군석 포획 냥 1회·주입 상한→기병석 조건부 확인→수호석 위험 그룹 인접→희생석 상대 포획만·다중 중첩→자기 재발동 차단→주입형 `EffectLimits` 초과 시 원자적 미커밋+`EFFECT_LIMIT_EXCEEDED` 구조화 로그+한국어 안내→네 source bucket 전체 순서·동시 다중 포획·획득 순서 tie·sourceId tie-break 정밀 assertion.
- **게이트:** `EffectLimits`(효과 64·깊이 8·생성 8·총 40·손패 10 등 HDD-011 초안)와 장군석 대국당 냥 상한(HDD-010 초안 15냥)은 주입 전용. draft fixture 이름으로만 존재(AC-NEG-002).
- **Exit:** AC-EFF-001~008, AC-NEG-002.

### Task 5 — 전투 상태 머신·AI 부활 2단계·벤치마크

- **Files:** Create `src/game/battle.ts`, `src/game/ai.ts`, `tests/battle.flow.test.ts`, `tests/battle.revival.test.ts`, `tests/fixtures/ai-benchmark.ts`, `scripts/ai-benchmark-browser.ts`, `scripts/benchmark-ai.mjs`; Modify `package.json`(`benchmark:ai`). `tests/battle.revival.test.ts` GREEN 후 `tests/engine.revival.test.ts` 폐기.
- **첫 슬라이스(RED):** `두 번째 패스 뒤 계가한다` — battle reducer 미정의. GREEN: `npx vitest run tests/battle.flow.test.ts tests/battle.revival.test.ts`.
- **Phases:** `turn-start | pre-move | choose-card | choose-point | resolving | turn-end | scoring | result | revival-special-move`. 부적은 `pre-move`만. 합법 수 없으면 자동 패스.
- **부활 슬라이스(0.2.3 확정 계약, 전부 구현):** 1단계 패배 판정→보상 보류→종료·연속 패스 초기화→판면/양측 덱·패·유물·병종 유지→새 특성 추가→일반 손패·보충 없는 전용 착수 1회(합법성·자충수·단순패·우선순위 1~8 준수)→후보 없으면 자동 패스 로그→플레이어 턴. 전용 착수 점수화 가중치·동률 규칙·2막 보스(BOSS-001) 게이지·전용 카드는 주입 enemy 정의+draft fixture(HDD-009).
- **AI 계약:** `hand card order → board position index` 고정 순서 전수 평가, 동점만 seeded RNG, 시간 중단 없음 → 결정적.
- **벤치마크:** `scripts/benchmark-ai.mjs` — 임시 Vite server + Playwright Chromium CDP `Emulation.setCPUThrottlingRate({rate:4})` + fixture(고정 seed 7×7 5개·9×9 5개, warm-up 10·측정 100, `performance.now()` 경계). JSON에 판 크기별 sample·p50/p95/max·기대/실제 candidate 수·seed. 실제 평가 수≠독립 열거 합법 조합 수 또는 7×7 p95>100ms·9×9 p95>200ms면 exit 1. browser/server는 `finally` 종료.
- **Exit:** AC-BAT-001~009, AC-CMD-005.

### Task 6 — 런·맵·보상·냥 경제

- **Files:** Create `src/game/run.ts`, `map.ts`, `rewards.ts`, `content/relics.ts`, `content/charms.ts`, `content/enemies.ts`, `content/events.ts`, `tests/map.property.test.ts`, `tests/run.progression.test.ts`, `tests/economy.test.ts`. 두 대체 suite GREEN 후 `tests/engine.economy.test.ts`, `tests/run.flow.test.ts` 폐기.
- **첫 슬라이스(RED):** `모든 경로에 일반전 1~3개` — map generator 미정의. GREEN: `npx vitest run tests/map.property.test.ts tests/run.progression.test.ts tests/economy.test.ts`.
- **슬라이스:** 다중 seed 경로 불변식(전투 1~3·5노드·비전투≥2, 생성기 단계 검증)→1막 7×7→2막 9×9 전환·덱 유지→보상 3후보 무중복·기풍 1+확장 1·전체 거절 무보상→상점 3돌/2부적/1유물/제거 1회·`50+25n`·덱 0 허용→부적 최대 2·교체→패배/기권 즉시 런 종료.
- **콘텐츠:** HDD-003 확정 ID만 정의(RELIC 8종·ITEM 5종·ENEMY 3종·EVENT 3종). 각 ID는 발동 조건·시점·대상·지속·중첩·횟수·패스/종료 테스트를 ID별로 갖춰야 Task 완료(동결 계획 §3).
- **게이트:** `EconomyConfig`(시작 냥·보상·가격·도장 비용·무료 정비)와 `MapWeights`(25/30/25/20·상점 접근)는 주입 전용 draft. 불변식은 가중치와 무관하게 항상 성립(AC-RUN-001).
- **Exit:** AC-RUN-001~008, AC-NEG-003.

### Task 7 — React 화면·동적 바둑판

- **Files:** Refactor `src/App.tsx`; Create `src/app/GameProvider.tsx`, `src/screens/{Title,Map,PreBattle,Battle,Reward,Shop,Dojo,Event,Result}Screen.tsx`; Modify `src/components/BoardSvg.tsx`(size 기반 viewBox), `index.html`(`<title>RoGolike</title>`); Create/replace `tests/ui.shell.test.tsx`, `tests/ui.board.test.tsx`, `tests/ui.battle.test.tsx`. styles 분리는 selector 추적 가능할 때만.
- **첫 슬라이스(RED):** `9×9가 81개 좌표를 비중첩 렌더한다` — 새 screen/board 미정의. GREEN: `npx vitest run tests/ui.shell.test.tsx tests/ui.board.test.tsx tests/ui.battle.test.tsx`.
- **핵심 계약:** `document.title`·표시 제목 정확히 `RoGolike`(대소문자), `귀석록`/`사활의 탑`/`死活之塔` 잔존 0. hit target: 9×9 비중첩 최대 42×42, 7×7 ≥44×44 CSS px. aria-label 판 크기·행·열, Enter/Space 착수. 구형 UI 테스트(`ui.render`, `ui.timer`, `ui.responsive`)는 새 계약 GREEN 후 교체.
- **Exit:** AC-UI-001~005.

### Task 8 — 결과·보상·상점·도장·사건 UI

- **Files:** Task 7 화면 구현 완성; Create `src/components/CardHand.tsx`, `EffectPreview.tsx`, `ScoreBreakdown.tsx`, `tests/ui.progression.test.tsx`, `tests/ui.dojo.test.tsx`, `tests/result.analysis.test.ts`.
- **첫 슬라이스(RED):** `복제는 선택 카드만 한 장 추가한다` — dojo reducer/UI 미정의. GREEN: `npx vitest run tests/ui.progression.test.tsx tests/ui.dojo.test.tsx tests/result.analysis.test.ts`.
- **핵심 계약:** 결과 화면 점수 분해(돌/영역/덤/차/포획/효과) + `criticalMoveCandidates` 1~3개 — `BattleState`의 착수별 최소 snapshot·seed에서 동일 one-ply evaluator 재평가로 결정적, '복기 후보' 표기. 모든 비전투 조작은 순수 run reducer 경유, 중복 클릭 이중 결제 금지. 이후 facade 구형 export 소비자 0 확인(AC-NEG-004).
- **Exit:** AC-UI-006~008, AC-NEG-004.

### Task 9 — 음악 자산 배치·오디오 상태 머신

- **Files:** Modify `vite.config.ts`(`publicDir:'music'`); Create `src/audio/tracks.ts`, `AudioManager.ts`, `useGameMusic.ts`, `src/components/AudioControls.tsx`, `tests/audio.manager.test.ts`, `tests/audio.routing.test.tsx`. `music/*.mp3` 원본 무수정.
- **첫 슬라이스(RED):** `첫 gesture 전 context를 만들지 않는다` — manager 미정의. GREEN: `npx vitest run tests/audio.manager.test.ts tests/audio.routing.test.tsx`.
- **슬라이스:** gesture unlock→라우팅(HDD-007 확정 표)→단일 context·곡별 gain 그래프→lazy fetch·2곡 LRU→동일 route 무재시작·위치 보존→0.4~1.5초 crossfade(주입 `AudioTuning`)→generation token stale 취소→visibility/interruption 재개→mute/volume localStorage 분리→BASE_URL 경로→HTMLAudio fallback→decode/storage 실패 비치명.
- **게이트:** 곡별 최종 gain·loopStart/loopEnd·정확 crossfade는 HDD-013 청음 후 반영. 그 전에는 기술 기본값을 draft 표기로 주입. 재인코딩 금지, cover/tag 제거 필요 시 무손실 remux만.
- **Exit:** AC-AUD-001~008.

### Task 10 / 10-1 — 계측·시뮬레이션·해금 골격

- **Files:** Create `src/game/telemetry.ts`, `tests/telemetry.test.ts`; Update `scripts/simulate.ts`, `scripts/balance.ts`(새 engine API, 7×7/9×9·komi 후보 입력); 대체 suite GREEN 후 `tests/balance.harness.test.ts`, `tests/sim.random.test.ts` 교체. Create `src/game/unlocks.ts`, `tests/unlocks.test.ts`. `docs/playtest-report-template.md`는 구현 단계에서 생성.
- **첫 슬라이스(RED):** Task 10 `동일 run은 동일 익명 지표를 낸다`; Task 10-1 `잠긴 ID는 후보에서 제외된다`. GREEN: `npx vitest run tests/telemetry.test.ts tests/balance.harness.test.ts tests/sim.random.test.ts` / `npx vitest run tests/unlocks.test.ts`.
- **게이트:** 시뮬레이션은 komi 후보(7×7 2.5~5.5, 9×9 4.5~7.5)를 **입력**으로 받아 색 반전 쌍·Wilson CI 결과를 산출만 한다. 밸런스 결론·기본값 확정 금지. `UnlockState`는 ID 집합 필터만, 점수 강화 필드 금지.
- **Exit:** AC-TEL-001~003, AC-UNL-001.

### Task 11 — 전체 회귀·모바일·오디오 수동 QA

- **자동 명령(전부 exit 0):** `npm test` → `npm run typecheck` → `npm run build` → `npm.cmd audit --omit=dev --audit-level=high` → `npm run benchmark:ai` → preview(background)+readiness 후 `npm run check:mobile`.
- **Playwright 확장(`scripts/playwright-mobile-check.mjs` 재작성):** 380×800·430px에서 7×7/9×9 overflow 0, hit target `getBoundingClientRect()` 비중첩, 네 귀 edge 실제 클릭, 타이틀→지도→일반전→계가→보상→상점→보스 최소 경로, 카드 미선택 착수 차단·불법수 사유·패스/연속 패스, console/pageerror/requestfailed/badResponse 0, 네 BGM URL 200·첫 gesture 전 재생 시도 없음·mute 버튼, 실행 경로는 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`→Playwright Chromium→Windows Chrome 순서·`try/finally` 종료.
- **Preview 순서:** background preview 시작→`curl -sf http://127.0.0.1:4173/` readiness→별도 foreground `BASE_URL=… npm run check:mobile`→보고서 확인→process 종료·4173 LISTENING 0 확인.
- **수동 QA(인간):** 실기 Android/iOS 청음 — 첫 재생, 페이드, 복귀, 무음/볼륨 유지, 루프 seam, 체감 음량. 자동 테스트만으로 음악 품질 승인 금지(HDD-013 게이트).

### Task 12 — 독립 검증·완료 게이트

- implementation snapshot→verify-before→**fresh Claude verifier**(이 planner 세션과 다른 dispatch, 읽기 전용)가 AC 1:1 검증·required 명령 직접 실행(`--role verifier` capture, exact argv)→결함 시 Codex 수정+새 verifier→verify-after→post-verify→finalize→verify-checksums. verifier 전후 source tree 동일 필수. `docs/`·`music/` 라이선스 결정 포함 최종 manifest 반영.
- **완료 선언 조건:** AGENTS §11의 10개 조건 + 본 run의 미결정(HDD-008/009/010/011/012/013) 상태가 11-final-summary에 숨김 없이 보고될 것.

## 3. 커밋 경계 (사용자 요청 시에만, dev 브랜치)

1. `test/feat: dynamic go board and scoring`
2. `feat: add cyclic stone deck`
3. `feat: add deterministic effect queue and stone kinds`
4. `feat: add battle flow and revival phase`
5. `feat: add map progression and economy`
6. `feat: migrate RoGolike screens`
7. `feat: integrate routed game music`
8. `test: add telemetry simulations and mobile e2e`

## 4. 위험 대응 (동결 계획 §5 준거 요약)

- 신구 규칙 공존 방지: 새 계약 테스트 선행 GREEN 후 구형 폐기.
- 9×9 AI 성능: 전수 평가 계약 유지, 캐시·할당 최적화, p95 벤치마크 판정, 미달 시 escalate(wall-clock cutoff 금지, Worker는 별도 gate).
- 효과 이중 계산 방지: UI 미리보기=`resolveMove` dry-run 단일 경로.
- 맵 불변식: 생성기 검증, UI 보정 금지.
- 오디오: autoplay 금지·gesture unlock·play promise rejection 처리·lazy load·청음 전 루프 승인 금지.
- 3회 동일 실패 시 인간 escalation (AGENTS §3).
