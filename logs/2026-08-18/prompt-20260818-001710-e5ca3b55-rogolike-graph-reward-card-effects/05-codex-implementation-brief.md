# 05 — Codex 구현 지시서 (그래프 지도 · 보상 상세 · 특수돌 효과 개편)

- 작성자: Claude Code planner (Orca task `task_de51fe0392c4` / dispatch `ctx_169986e74553`)
- 수신자: Hermes/Codex — **이 저장소의 유일한 구현자**
- 함께 읽을 것: `02`(요구·엣지·마이그레이션), `03`(정확한 계약·Task 순서), `04`(통과 조건 전체)
- PROMPT_DIR = `logs/2026-08-18/prompt-20260818-001710-e5ca3b55-rogolike-graph-reward-card-effects`

## 1. 절대 규칙 (위반 시 검증 무효)

1. **TDD 순서 강제:** 모든 동작은 "실패 테스트 1개 → `npx vitest run <file> -t "<정확한 이름>"` RED 기록 → 최소 구현 → 같은 명령 GREEN → Task 파일 전체 + `npm test` 회귀 0건". 구문 오류·import 실패는 RED가 아니다. 각 Task의 첫 RED·마지막 GREEN·전체 회귀를 `python scripts/evidence/evidence.py capture-command --dir <PROMPT_DIR> --role implementer --name <이름> -- <명령>`으로 보존하라. 첫 RED 테스트 이름은 03 §2 표의 이름을 **글자 그대로** 사용하라(04의 `-t` 명령과 일치해야 함).
2. **수치 게이트:** `aiEffectWeights`(6키 전부)·`EffectLimits`·`EconomyConfig`·`MapWeights`·enemy 정의는 무기본값 필수 주입을 유지하고 초안 수치는 `tests/fixtures/`와 `scripts/playwright-mobile-check.mjs` 내 draft config에만 둔다. HDD 승인 규칙 수치(척후 3장·기병 2장·장군 +1장/5냥·수호 1회·희생 +1)는 `src/` 리터럴 허용.
3. **바둑 규칙 불변:** `tryPlay`/`canonicalKoKey`/`legalPlayPoints`/`scoreArea`의 시그니처·의미를 바꾸지 마라. 수호 무효화는 **해결 단계**에서만 작동한다(합법성 판정 변경 금지). 추가 착수 부여 금지.
4. **금지:** commit/push/reset/rebase, 신규 런타임 의존성, hover 전용 상호작용, Claude artifact(02~05, 08, 09) 수정, 비밀 로그. 3회 동일 실패 시 인간 escalation.
5. **구형 폐기 순서:** 대체 테스트 GREEN 후 같은 묶음에서만 구형 함수/테스트 제거. 최종 grep-0 목록은 03 §3 · AC-NEG-001.

## 2. 착수 전 (Task 0)

1. 02~05 작성 완료 상태에서 `python scripts/evidence/evidence.py gate --dir <PROMPT_DIR> --name plan-frozen` → `--name pre-implement` exit 0 확인 (manifest `plan_hashes` 동결 확인).
2. `python scripts/evidence/evidence.py snapshot --dir <PROMPT_DIR> --stage implementation` 후 구현 시작.
3. `scripts/check-ac-mapping.mjs` 실행 인자는 이번 run의 `04-claude-acceptance-criteria.md` 경로를 사용한다(스크립트는 이미 인자화되어 있음 — 수정 불필요).

## 3. Task 순서와 핵심 지시 (상세 계약은 03 §1, 통과 조건은 04)

### T1~T2 — 지도 그래프
- `src/game/mapLayout.ts` 신규: `computeMapLayout`/`mapNodeUiState`/`mapEdgeUiState` — 03 §1.1 시그니처 그대로. column 0 최하단·boss 최상단, `width ≤ 380`, edge는 `next` 1:1(1막 18개).
- `src/components/MapGraph.tsx` 신규 + `App.tsx` MapScreen 교체: `aria-hidden` SVG 연결선 층(`.map-edge`, `data-edge`, `data-edge-state`) 위에 절대 배치 `.map-node` 버튼. **보존할 selector:** `data-node-id`, `data-state`, `disabled`, `<nav aria-label="{N}막 지도">`, `[data-node-id$="-boss"]`. 신규 상태: 마지막 완료 노드만 `data-state="current"`.
- `tests/ui.map.progression.test.tsx`는 마지막 완료 노드 기대값을 done→current로 갱신(그 외 시나리오 유지).

### T3 — 시작 덱·문구
- `STARTING_DECK` = `STONE-001`×5 + 002/003/004/005/006 각 1. `STONE_DEFINITIONS.ui`를 신규 효과 서술로 갱신하고 `effect`·`synergy` 필드를 추가하라(수치 명시: 3장/5냥+1장/2장+맨 아래/활로 2+무효/패 한도+1장 — AC-RWD-004).

### T4 — 보상 상세
- `charms.ts`/`relics.ts`에 `ui { summary, condition, effect, strategy, synergy }` 추가(behavior와 모순 금지, 한국어, 원시 ID 금지). `rewards.ts`에 `describeRewardCandidate(candidate, inventory)` 순수 함수(03 §1.2).
- RewardScreen: face 버튼(aria-expanded, onClick 토글·onFocus·onMouseEnter 펼침) + 펼친 후보에만 `aria-label="{이름} 상세"` 영역과 6요소 dl + `이 보상을 선택` 버튼. **첫 tap/클릭은 절대 CHOOSE_REWARD를 dispatch하지 않는다.** 한 번에 한 후보만 펼침. `보상을 받지 않는다`·부적 교체 flow 유지.

### T5 — 척후석
- `stones.ts`: `startScoutInspection`(위 3장)·`resolveScoutExchange`(원자 적용·RangeError·임시 반납 소멸) — 03 §1.4. 구 `resolveScoutEffect`는 대체 테스트 GREEN 후 제거.
- `GameProvider.tsx`: `PendingDeckInspection` → `PendingInteraction` union + `queuedInspections` FIFO(03 §1.6). 신규 액션 `INSPECT_TAKE`/`INSPECT_RETURN`(스테이징 — battle 덱은 CONFIRM에서만 변경), `REORDER_INSPECTION`은 scout order 단계 전용으로 재정의, `CANCEL_INSPECTION`은 덱 완전 불변. head 소거 후 대기열 shift, 비면 `endsTurnOnResolve`에 따라 END_TURN. `RETURN_TO_MAP`·battle 종료 시 두 필드 모두 초기화.
- `App.tsx` 패널: 단계 안내문 + 카드 버튼(`data-inspect-card-id`) + order 단계 카드별 `위로` 버튼 + 확정/취소. hover 의존 금지.

### T6 — 장군석·기병석
- `deck.ts`: `drawExtra(state, maxHandSize, rng)` 신규(03 §1.3 — handLimit 초과 허용·maxHandSize 절대 상한·임시 생성 금지). `discardUsed`/`resolveCardUse`: 비임시 `STONE-004`는 drawPile 맨 아래로 붙인 뒤 보충(다른 병종·임시는 기존).
- `battle.ts`: `CreateBattleInput`/`BattleState`에 `maxHandSize` 추가(모든 생성 소비처 갱신 — GameProvider `openBattle`은 `config.effectLimits.maxHandSize` 주입), `previousCaptureBy` 추가·PLAY_CARD/부활 착수에서 갱신, 로그 타입 `'effect'` 추가. 장군 드로우는 PLAY_CARD 해결에서 양측 대칭(03 §1.5 순서 3b). 냥 경로(GameProvider·주입 상한)는 불변.
- `stones.ts`: `startCavalryInspection`(위 2장)·`resolveCavalryExchange`(taken→hand·discarded→discard·임시 소멸·미선택 원순서 잔류). 구 `resolveCavalryEffect` 제거. GameProvider 손패 진입 diff로 발동·큐잉(AI 턴 중 진입은 `endsTurnOnResolve:false`). **AI(W)의 교환은 생성하지 않는다(명시적 decline 정책).**

### T7 — 수호석 보호
- `battle.ts`: `GroupProtection`·`protections`·`captureNegatedBy` — 03 §1.5 계약 그대로. 부여(착수 전 `hasAdjacentEndangeredGroup` 참 → 착수 후 `groupAt` 병합 그룹 멤버 고정, 착수당 1개), 무효화(판·ko 키 이전 값 그대로 유지 — **board 재생성 금지**, 카드는 정상 소비, moveNumber+1, 토큰 소비, `'effect'` 로그, 과반 판정 생략), 만료(정상 해결된 상대 착수 1회 경과·패스 비소모·무효화 착수는 타 토큰 비만료), 다중 교차 시 grantedAtMove 최소 1개만 소비. 부활 전용 착수도 상대 착수로 취급.
- `resolveGuardianEffect`(덱 열람)와 inspection의 guardian 분기 제거. `BoardSvg`에 `protectedPoints` prop·`data-protected` 마커 추가, BattleScreen이 활성 토큰 멤버를 판에서 스캔해 전달.

### T8 — 희생석 만료
- `battle.ts`: 턴이 끝나는 색의 덱에 `expireTemporaryHandLimits` 적용 — `END_TURN`과 패스 경로 모두. 이미 뽑은 카드 미회수(강제 버림 없음). 기존 즉시 드로우+한도+1·다중 발동·비발동 조건·maxHandSize 가드는 회귀로 보존.

### T9 — AI
- `GameConfig.aiEffectWeight` → `aiEffectWeights: Readonly<Record<StoneKind, number>>`(assertConfig 6키 유한값 검증). 평가식: `유효포획×aiCaptureWeight + (candidatePlacementTriggersEffect(..., 유효포획) ? aiEffectWeights[kind] : 0)`, 유효포획 = `captureNegatedBy` 교차 시 0(reducer와 같은 함수 공유). fixture(`tests/fixtures/draft-game-config.ts`)·`scripts/playwright-mobile-check.mjs`·`scripts/simulate.ts`/`balance.ts`(사용 시) 동시 갱신.

### T10 — E2E·docs·회귀
- `scripts/playwright-mobile-check.mjs` 확장: AC-CMD-006 (a)~(d) 검사 추가(`.map-edge` 18개, 첫 완료 후 `current` 1개, 보상 face 첫 tap 후 reward 화면 유지+상세 노출, `이 보상을 선택`으로 지도 복귀). 기존 검사·selector 유지.
- `docs/03_content/01_특수돌.md` STONE-002~006을 승인 효과로 갱신, `docs/CHANGELOG.md` 추가.
- 전체: `npm test` → `npm run typecheck` → `npm run build` → `npm.cmd audit --omit=dev --audit-level=high` → `npm run benchmark:ai` → preview 기동 후 `BASE_URL=http://127.0.0.1:4173/ npm run check:mobile` 전부 exit 0. grep-0 목록(03 §3) 확인.

## 4. 구현 시 특히 주의할 결정 (02에서 AI-제안으로 라벨된 해석)

| 항목 | 채택 해석 | 근거 |
|---|---|---|
| 장군 드로우(R-GEN-02) | 보충 후 1장 추가, handLimit 일시 초과 허용, `maxHandSize` 절대 상한, 다음 보충에서 자연 수렴 | "한도 미만일 때만"은 자동 보충 구조상 사문화 — 검증 보고서에 인간 확인 항목으로 남김 |
| 척후 되돌리기 대상 | take 후 손패 아무 카드(방금 가져온 카드 포함), 임시는 소멸 | 손패 순변화 0으로 패 한도 불침범 |
| 기병 "직전 내 착수" | 색별 최근 placement 플래그(패스 비갱신·무효화 착수는 false) | 드로우 경로와 무관하게 일관 판정 |
| 수호 무효화 | 착수 전체 무효(공격 돌 미배치·판/ko 불변·카드 소비·토큰 1개 소비), 상대의 정상 착수 1회로 만료·패스 비소모 | 활로 0 좀비 돌·부분 포획 불가능 상태 원천 차단, 합법성 판정 불변 |
| AI 교환 정책 | 이번 반복은 decline 고정 | 정책 설계는 후속 인간 결정 |

이 해석을 바꾸고 싶으면 구현 전에 escalation으로 인간 결정을 받아라. 임의 변경 금지.

## 5. 완료 인계 (Task 11)

1. `snapshot --stage verify-before` → **fresh Claude verifier dispatch** 요청(이 planner와 다른 세션, 읽기 전용). verifier가 required 명령을 `--role verifier`·`evidence.config.json` exact argv로 직접 실행하고 04의 AC를 1:1 매핑한다.
2. 결함 보고(09) 수신 시 수정 후 `10-codex-fix-log.md` 기록, 새 Task/Dispatch 재검증.
3. `snapshot --stage verify-after`(tree 동일 필수) → `gate --name post-verify` → `finalize --outcome succeeded` → `verify-checksums`.
4. `06-codex-implementation-log.md`·`07-codex-result.md`에 실제 명령·변경 파일·receipt를 기록하라. 실행하지 않은 명령을 통과로 쓰지 마라. AI-제안 해석 채택 사실과 남은 인간 판단(§4 표, 문구·밸런스 톤)을 `11-final-summary.md`에 숨기지 말고 보고하라.
