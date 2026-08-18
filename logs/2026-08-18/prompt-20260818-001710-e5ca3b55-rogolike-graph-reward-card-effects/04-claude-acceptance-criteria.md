# 04 — Claude 수락 기준 (그래프 지도 · 보상 상세 · 특수돌 효과 개편)

- 작성자: Claude Code planner (Orca task `task_de51fe0392c4` / dispatch `ctx_169986e74553`, 읽기 전용)
- 모든 AC는 **명령 + 통과 조건**으로 기계 검증한다. fresh Claude verifier는 각 AC를 실제 실행 증거와 1:1 매핑해야 하며, 실행하지 않은 명령을 통과로 기록할 수 없다.
- 백틱 안의 `npx vitest run tests/...` 명령은 `scripts/check-ac-mapping.mjs`(AC 경로를 이번 run의 본 문서로 지정해 실행)가 자동 실행하며, 각 명령은 exit 0과 1개 이상의 passing test를 내야 한다.
- `-t` 명령의 테스트 이름은 03이 고정한 각 Task의 첫 수직 조각 이름이다. 정확히 이 이름의 테스트가 존재해야 한다.
- **게이트 표기** — `자유`: 즉시 완전 구현. `주입`: 엔진·테스트 완전 구현하되 수치는 주입/draft fixture만. `AI-제안`: 채택된 기계 해석으로 구현하되 검증 보고서에 인간 확인 항목으로 명시.

## 1. 지도 그래프 (T1~T2 · R-MAP)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-MAP-001 | `npx vitest run tests/map.graph.test.ts -t "아래에서 위로 향하는 열 좌표를 만든다"` | `computeMapLayout`: column이 클수록 y가 작아지고(boss 최소 y), 모든 x·y가 `0..width/height` 안, `width ≤ 380` | 자유 |
| AC-MAP-002 | `npx vitest run tests/map.graph.test.ts` | edge 집합이 모든 `MapNode.next` 관계와 정확히 1:1(1막 구조에서 18개), 존재하지 않는 연결 0건, 각 edge 좌표가 양 끝 노드 좌표와 일치 | 자유 |
| AC-MAP-003 | `npx vitest run tests/map.graph.test.ts` | `mapNodeUiState`: 완료 0개→시작 2개 open·current 없음, 완료 1개→그 노드만 current·`next`만 open, 완료 다수→마지막만 current·이전은 done·그 외 locked. `selectableNodeIds`와 결과 일치 | 자유 |
| AC-MAP-004 | `npx vitest run tests/ui.map.graph.test.tsx -t "실제 next 연결선을 세로 그래프로 그린다"` | MapScreen이 `.map-edge` 18개를 렌더하고 각 `data-edge`가 실제 next 쌍과 일치 | 자유 |
| AC-MAP-005 | `npx vitest run tests/ui.map.graph.test.tsx` | 노드 버튼: `data-state` 4종(current 포함) 정확, locked·done은 `disabled`, open 클릭→해당 화면 전환, current 노드에 시각 구별 속성(`data-state="current"`), SVG는 `aria-hidden`이고 nav `aria-label="1막 지도"` 유지 | 자유 |
| AC-MAP-006 | `npx vitest run tests/ui.map.progression.test.tsx` | 기존 도달성 UI 회귀 GREEN(마지막 완료 노드 기대값만 done→current로 갱신, 잠긴 노드 클릭 무반응 유지) | 자유 |

## 2. 보상 상세 (T3~T4 · R-DECK, R-RWD)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-RWD-001 | `npx vitest run tests/deck.test.ts -t "시작 덱은 일반석 5장과 특수돌 5종 각 1장이다"` | `STARTING_DECK` = STONE-001×5 + 002/003/004/005/006 각 1, 총 10장 | 자유 |
| AC-RWD-002 | `npx vitest run tests/rewards.detail.test.ts -t "보상 후보를 요약·조건·효과·전략·연계·보유량으로 서술한다"` | `describeRewardCandidate`가 돌·부적·유물 각각에 6요소(summary/condition/effect/strategy/synergy/ownedCount)를 반환, 전부 한국어 비어있지 않음 | 자유 |
| AC-RWD-003 | `npx vitest run tests/rewards.detail.test.ts` | ownedCount: 돌=덱 내 개수(0·1·다수), 부적=보유 개수, 유물=0 또는 1. 반환 문자열에 `STONE-`/`ITEM-`/`RELIC-`/내부 trigger 문자열 0건 | 자유 |
| AC-RWD-004 | `npx vitest run tests/stones.presentation.test.ts` | 6병종 ui에 `effect`·`synergy` 추가 포함 전부 한국어·무ID, 갱신 수치 명시: 척후 `3장`, 장군 `5냥`+`1장`, 기병 `2장`+`맨 아래`, 수호 `활로 2`+`무효`, 희생 `패 한도`+`1장` | 자유 |
| AC-RWD-005 | `npx vitest run tests/ui.reward.detail.test.tsx -t "모바일 첫 탭은 상세만 펼친다"` | 보상 face 첫 클릭 후: `aria-expanded="true"`·상세 영역 표시·`run.deck` 등 인벤토리 불변(CHOOSE 미발생)·화면은 reward 유지 | 자유 |
| AC-RWD-006 | `npx vitest run tests/ui.reward.detail.test.tsx` | 상세 안 `이 보상을 선택` 클릭 시에만 보상 반영(돌→덱 추가), focus 이벤트로도 상세 펼침(키보드 경로), 다른 후보 펼치면 이전 후보 접힘, 상세에 6요소와 `현재 보유` 수량 텍스트 표시 | 자유 |
| AC-RWD-007 | `npx vitest run tests/ui.card-clarity.test.tsx` | 카드 명시성 회귀 GREEN(원시 ID·trigger 비노출, 선택 카드 상세에 실제 효과 노출 포함) | 자유 |

## 3. 척후석 (T5 · R-SCT)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-SCT-001 | `npx vitest run tests/stones.test.ts -t "척후석은 덱 위 3장을 확인해 1장을 가져오고 1장을 되돌린 뒤 순서를 정한다"` | `startScoutInspection` 창=위 3장, `resolveScoutExchange` 적용 후 hand 순변화 0·taken이 hand에·returned가 창에·drawPile 상단 = orderedIds 순서·창 밖 불변 | 자유 |
| AC-SCT-002 | `npx vitest run tests/stones.test.ts` | 창 축소(drawPile 2/1/0장), 잘못된 takenId/returnedId/순열 → RangeError·상태 불변, 임시 카드 되돌리기 시 소멸(drawPile 미진입·temporaryCards 정리) | 자유 |
| AC-SCT-003 | `npx vitest run tests/battle.product-effects.test.ts` | 제품 reducer 경로: 척후 착수→INSPECT_TAKE→INSPECT_RETURN→REORDER→CONFIRM으로 실제 battle 덱이 원자 반영, CANCEL 시 덱 완전 불변, 확정/취소 후 END_TURN 발생 | 자유 |
| AC-SCT-004 | `npx vitest run tests/ui.battle.test.tsx` | 단계형 패널 UI: 척후 패널 노출·단계 진행·확정/취소 버튼 동작, 패널 열림 중 착수 불가(canAct 게이트 유지) | 자유 |

## 4. 장군석·기병석 (T6 · R-GEN, R-CAV)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-GEN-001 | `npx vitest run tests/battle.effects.test.ts -t "장군석 포획은 안전 상한 안에서 즉시 카드 1장을 더 뽑는다"` | 장군석 포획 착수 후 mover 패 = handLimit+1(보충 후 추가 1장), `maxHandSize` 도달 시 드로우 생략, 포획 0이면 드로우 없음 | AI-제안(R-GEN-02) |
| AC-GEN-002 | `npx vitest run tests/battle.effects.test.ts` | 초과분 자연 수렴: 다음 착수 후 패가 handLimit로 복귀(강제 버림 없음). 드로우 불가(양 더미 빈) 시 no-op·임시 카드 미생성. W(적) 장군석도 대칭 드로우. `'effect'` 로그 기록 | 자유 |
| AC-GEN-003 | `npx vitest run tests/battle.product-effects.test.ts` | 기존 5냥·주입 상한(`generalCaptureMoneyCap`) 회귀 GREEN — 드로우 추가로 냥 계약 불변 | 주입(상한) |
| AC-CAV-001 | `npx vitest run tests/deck.test.ts -t "기병석은 사용 후 덱 맨 아래로 돌아간다"` | `resolveCardUse`로 사용된 비임시 STONE-004가 discard가 아닌 drawPile 맨 아래로 이동 후 보충. 다른 병종은 기존 discard 유지 | 자유 |
| AC-CAV-002 | `npx vitest run tests/battle.effects.test.ts -t "기병석은 직전 포획 뒤 손패에 들어오면 교환을 제안한다"` | `previousCaptureBy` 추적: 포획 착수 후 드로우된 기병석만 교환 발동, 비포획 착수·전투 첫 드로우 후는 미발동 | 자유 |
| AC-CAV-003 | `npx vitest run tests/stones.test.ts` | `startCavalryInspection` 창=위 2장(축소·0장 미발동), `resolveCavalryExchange`: taken→hand·discarded→discardPile(임시는 소멸)·미선택 창 카드 원순서 잔류·hand 순변화 0·잘못된 입력 RangeError | 자유 |
| AC-CAV-004 | `npx vitest run tests/battle.effects.test.ts` | 빈 drawPile에서 사용된 기병석이 맨 아래(=맨 위) 진입 후 보충으로 재드로우되는 결정적 엣지, 무효화된 착수 후 `previousCaptureBy[mover]=false` | 자유 |
| AC-CAV-005 | `npx vitest run tests/battle.product-effects.test.ts` | 제품 경로: 기병 교환 INSPECT_TAKE→INSPECT_RETURN→CONFIRM 원자 반영·CANCEL 불변, 동시 다중 기병 진입 시 대기열 FIFO 순차 처리 | 자유 |

## 5. 수호석 보호 (T7 · R-GRD)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-GRD-001 | `npx vitest run tests/battle.protection.test.ts -t "수호석은 위기 그룹에 수호 1회를 부여한다"` | 활로≤2 아군 그룹 인접 착수 → `protections`에 토큰 1개, `memberInstanceIds` = 착수 후 병합 그룹의 정확한 instanceId 집합(수호석 포함), 조건 미충족 시 토큰 0개 | 자유 |
| AC-GRD-002 | `npx vitest run tests/battle.protection.test.ts` | 무효화: 보호 그룹을 포획하는 상대 합법 착수 해결 시 — board 객체가 착수 이전과 동일 참조·`koForbiddenKey` 불변·상대 카드는 정상 소비·moveNumber+1·토큰 소비·`'effect'` 무효화 로그. 과반 판정 미발생 | 자유 |
| AC-GRD-003 | `npx vitest run tests/battle.protection.test.ts` | 만료: 상대의 무효화되지 않은 착수 1회 경과 시 토큰 소멸(그 후 같은 그룹 포획 성공), 상대 패스는 토큰 비소모, 무효화된 착수는 다른 토큰을 만료시키지 않음 | 자유 |
| AC-GRD-004 | `npx vitest run tests/battle.protection.test.ts` | 다중 그룹 동시 포획(보호+비보호 혼재)도 착수 전체 무효화(부분 포획 0건), 다중 토큰 교차 시 가장 오래된 1개만 소비, 부활 전용 착수도 상대 착수로 취급 | 자유 |
| AC-GRD-005 | `npx vitest run tests/go.rules.test.ts` | 표준 합법수·자충수·단순패 회귀 GREEN — `tryPlay`·`canonicalKoKey`·`legalPlayPoints` 의미 불변 | 자유 |
| AC-GRD-006 | `npx vitest run tests/ui.battle.test.tsx` | 보호 중인 그룹의 교차점에 `data-protected` 마커 렌더, 토큰 소멸 후 마커 제거 | 자유 |

## 6. 희생석·AI (T8~T9 · R-SAC, R-AI)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-SAC-001 | `npx vitest run tests/battle.effects.test.ts -t "희생석 패 한도 증가는 다음 내 턴이 끝나면 만료된다"` | 상대 착수로 희생석 포획→즉시 1장 드로우+한도+1(기존), 피해자의 다음 턴 종료(END_TURN·패스 모두)에 한도 원복, 이미 뽑은 카드는 회수하지 않음 | 자유 |
| AC-SAC-002 | `npx vitest run tests/battle.product-effects.test.ts` | 동시 다중 개별 발동·자충수/자발 제거 비발동·`maxHandSize` 초과 시 착수 취소 가드 회귀 GREEN. 상대 손패 감소 부재 확인 | 자유 |
| AC-AI-001 | `npx vitest run tests/ai.effects.test.ts -t "병종별 주입 가중치로 직접 효과를 평가한다"` | `aiEffectWeights`(6키 주입)로 후보 평가: 서로 다른 주입값→다른 선택 assertion, 전부 0 주입→기존 포획-만 평가와 동일 결과 | 주입 |
| AC-AI-002 | `npx vitest run tests/ai.effects.test.ts` | 보호 인지: 플레이어 보호 그룹을 포획하는 후보의 유효 포획 0 평가(reducer와 동일한 `captureNegatedBy` 공유), 장군 효과 판정도 유효 포획 기준. `candidatePlacementTriggersEffect`: 척후=항상·장군=유효포획>0·수호=위기 인접·기병/희생/일반=false | 자유 |
| AC-AI-003 | `npx vitest run tests/sim.random.test.ts tests/balance.harness.test.ts` | 시뮬·밸런스 하니스가 신규 config shape로 결정적 실행 GREEN | 주입 |

## 7. 명령·회귀·플랫폼 (T10 · R-PLT)

| ID | 검증 명령 | 통과 조건 | 게이트 |
|---|---|---|---|
| AC-CMD-001 | `npm.cmd test` | 전체 vitest exit 0, 실패 0 | 자유 |
| AC-CMD-002 | `npm.cmd run typecheck` | exit 0, 오류 0 | 자유 |
| AC-CMD-003 | `npm.cmd run build` | exit 0 | 자유 |
| AC-CMD-004 | `npm.cmd run benchmark:ai` | exit 0, 7×7 p95≤100ms·9×9 p95≤200ms·candidate 수 일치(기존 계약 불변) | 자유 |
| AC-CMD-005 | `npm.cmd audit --omit=dev --audit-level=high` | exit 0 — 신규 런타임 의존성 0(`dependencies`는 react/react-dom 그대로) | 자유 |
| AC-CMD-006 | `npm.cmd run check:mobile` (preview 서버 대상, `BASE_URL` 지정) | exit 0 + report.json passed. 스크립트에 추가된 검사: (a) 지도 `.map-edge` 18개·첫 완료 후 `data-state="current"` 1개, (b) 보상 화면에서 face 첫 tap 후 reward 화면 유지+상세 노출 확인, `이 보상을 선택` tap으로 지도 복귀, (c) 380px 무가로스크롤(기존), (d) config가 `aiEffectWeights` shape 사용 | 자유 |
| AC-NEG-001 | `git grep -nE "aiEffectWeight[^s]|resolveGuardianEffect|DeckInspectionEffectResult|PendingDeckInspection" -- src tests scripts` | 출력 0건 (exit 1) — 구형 계약 잔존 없음 | 자유 |
| AC-NEG-002 | `git grep -nE "STONE-00[1-6]" -- src/App.tsx src/components` | UI 계층에서 병종 원시 ID 표시 문자열 미노출(속성 값·타입 import 제외는 verifier가 맥락 판단, 사용자 노출 텍스트 0건) | 자유 |
| AC-EVID-001 | `python -m unittest discover -s tests -v` | evidence 도구 회귀 exit 0 (도구 수정이 없으면 현행 GREEN 확인) | 자유 |
| AC-DOC-001 | verifier 육안 + `git diff` | `docs/03_content/01_특수돌.md`의 STONE-002~006이 HDD-005~009 승인 효과와 일치, `docs/CHANGELOG.md` 갱신 | 자유 |

## 8. 검증 절차 요약 (fresh verifier용)

1. `evidence.py snapshot --stage verify-before` 이후 소스 무수정 상태에서 §7 required 명령을 `capture-command --role verifier`·exact argv(`evidence.config.json` 기준)로 직접 실행.
2. `scripts/check-ac-mapping.mjs logs/2026-08-18/prompt-20260818-001710-e5ca3b55-rogolike-graph-reward-card-effects/04-claude-acceptance-criteria.md`로 백틱 vitest 명령 전수 실행.
3. AC-* 각 항목을 실행 로그와 1:1 매핑. AI-제안 게이트 항목(AC-GEN-001)은 결과와 함께 "인간 확인 권장"으로 보고.
4. `snapshot --stage verify-after` tree 동일 확인 → `gate --name post-verify`.
