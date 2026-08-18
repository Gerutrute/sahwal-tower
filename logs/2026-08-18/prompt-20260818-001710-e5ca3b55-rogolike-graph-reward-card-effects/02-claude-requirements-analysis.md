# 02 — Claude 요구 분석 (그래프 지도 · 보상 상세 · 특수돌 효과 개편)

- 작성자: Claude Code planner (Orca task `task_de51fe0392c4` / dispatch `ctx_169986e74553`, 읽기 전용)
- 기준 문서: `00-user-request.md`, `01-human-design-decisions.md` (HDD-001~012 전부 "승인" 상태)
- 기준 코드: dev 브랜치 baseline tree `bc2da5dc9aba316a344740d0f116299846f75646` (manifest 기록)
- 본 문서의 R-* ID는 `03`(계획)·`04`(수락 기준)·`05`(구현 지시)에서 그대로 참조한다.
- 표기 규칙: **[Human]** = HDD로 승인된 사람 결정. **[AI-제안]** = 승인 결정을 구현 가능하게 만들기 위한 기계적 해석·구현 세부로, 사람이 사후에 변경할 수 있다. AI-제안은 게임 디자인 결정이 아니라 구현 세부에 한정했다.

## 0. 현재 상태 요약 (읽기 전용 분석 결과)

| 영역 | 현재 구현 | 관련 파일 |
|---|---|---|
| 지도 UI | `map-column` grid의 버튼 목록. 연결선 없음. 상태 `done/open/locked` 3종 (`data-state`) | `src/App.tsx` MapScreen, `src/styles.css` |
| 지도 데이터 | `MapNode { id, column, lane, type, next }`, `selectableNodeIds(map, completedNodeIds)`가 마지막 완료 노드의 `next`만 open으로 계산 | `src/game/map.ts` |
| 보상 UI | 이름+종류 1줄 버튼. 클릭 즉시 `CHOOSE_REWARD` 확정. 상세 정보·보유 수량 없음 | `src/App.tsx` RewardScreen, `src/game/rewards.ts` |
| 돌 카드 텍스트 | `STONE_DEFINITIONS[kind].ui = { summary, condition, strategy, classKey, icon }` — `effect`(실제 효과)·`synergy`(추천 연계) 없음 | `src/game/content/stones.ts` |
| 부적/유물 텍스트 | `name`·`style`·`behavior` 계약만 존재. 사용자용 상세 문구 없음 | `src/game/content/charms.ts`, `relics.ts` |
| 시작 덱 | `STARTING_DECK` = 일반석 6 + 척후·수호·희생·장군 각 1 (기병석 없음) | `stones.ts:252` |
| 척후석 | 착수 후 덱 위 2장 확인·재정렬만 (`resolveScoutEffect`) | `stones.ts`, `GameProvider.tsx` inspectionAfterMove |
| 장군석 | 포획 시 5냥(주입 상한) — 추가 드로우 없음. 냥은 플레이어 경로(GameProvider)에서만 | `stones.ts`, `GameProvider.tsx` commitMove |
| 기병석 | 직전 포획 시 손패 진입 때 덱 위 1장 열람만. 교환·덱 아래 순환 없음 | `stones.ts` resolveCavalryEffect |
| 수호석 | 활로≤2 인접 시 덱 위 2장 열람만. 보호 개념 없음 | `stones.ts` resolveGuardianEffect |
| 희생석 | 상대 착수 포획 시 `addTemporaryHandLimit({amount:1, remainingTurns:1})` → 즉시 1장 드로우 + 패 한도 +1. **단, `expireTemporaryHandLimits`가 제품 코드 어디서도 호출되지 않아 한도 증가가 만료되지 않음** | `deck.ts`, `GameProvider.tsx` |
| 덱 순환 | `resolveCardUse` → 사용 카드 discard → `drawToLimit`가 패를 즉시 한도까지 보충 | `src/game/deck.ts` |
| 확인 패널 | `PendingDeckInspection { sourceKind: 'scout'\|'cavalry'\|'guardian', cards, orderedIds, reorderable }` 단일 슬롯 + `REORDER/CONFIRM/CANCEL_INSPECTION`. 확정/취소가 `END_TURN`을 유발 | `GameProvider.tsx`, `App.tsx` |
| AI | `captured.length × aiCaptureWeight + (candidatePlacementTriggersEffect ? aiEffectWeight : 0)` 단일 스칼라 가중치 | `src/game/ai.ts`, `GameProvider.tsx` |
| 모바일 검증 | `scripts/playwright-mobile-check.mjs` 380×844, `data-state`/`data-node-id$="-boss"`/`1막 지도` selector 의존 | scripts |

## 1. 요구사항 번역 (HDD → R-*)

### R-MAP (HDD-001) — 세로형 그래프 지도

- R-MAP-01 **[Human]** 지도는 아래→위로 진행하는 세로형 그래프다. column 0(시작)이 화면 아래, boss가 맨 위에 위치한다.
- R-MAP-02 **[Human]** 노드 사이의 실제 `MapNode.next` 관계를 연결선으로 렌더한다. 존재하지 않는 연결선을 그리거나 실제 연결을 생략하면 안 된다. (1막 구조상 연결선 수는 항상 18개: column 0~3 노드 8개 × next 2 + column 4 노드 2개 × next 1.)
- R-MAP-03 **[Human]** 노드 상태 4종을 시각·의미적으로 구별한다: `done`(완료), `current`(현재 위치 = 마지막 완료 노드), `open`(현재 선택 가능), `locked`(잠김). 완료 이력이 없으면 `current`는 없고 시작 노드 2개만 `open`.
- R-MAP-04 **[Human]** 현재 노드에서 `next`로 이어진 1~3개 노드만 활성화(클릭 가능)한다. 기존 `selectableNodeIds` 의미를 그대로 사용하며 도달성 규칙은 변경하지 않는다.
- R-MAP-05 **[Human, HDD-012 결합]** 380px 폭에서 가로 스크롤 없이 판독 가능해야 한다. 연결선 겹침 자체는 금지하지 않으나(2-lane 교차선은 교차할 수 있음) 각 선의 시작·끝이 어느 노드인지 판독 가능해야 한다.
- R-MAP-06 **[AI-제안]** 상태 파생 규칙: `current` = `completedNodeIds.at(-1)`, `done` = 나머지 완료 노드, `open` = `selectableNodeIds(...)`, `locked` = 그 외. 연결선 상태는 `traveled`(완료 경로의 연속 쌍), `open`(current→open), `inactive`(그 외) 3종으로 구별한다.
- R-MAP-07 **[AI-제안]** 기존 자동화 계약 유지: 노드는 실제 `<button>`으로 유지하고 `data-node-id`, `data-state`, `disabled`, `<nav aria-label="N막 지도">` selector를 보존한다(기존 vitest·playwright가 의존). 기존 `data-state="done"` 중 마지막 완료 노드만 `current`로 바뀌는 것이 유일한 계약 변화다.

### R-RWD (HDD-002, HDD-003) — 보상 카드 상세

- R-RWD-01 **[Human]** 데스크톱: hover와 keyboard focus 모두에서 상세가 열린다. hover 전용 상호작용 금지.
- R-RWD-02 **[Human]** 모바일: 첫 tap은 상세 펼침만 수행하고 보상을 확정하지 않는다. 확정은 상세 내부의 명시적 선택 버튼으로만 한다.
- R-RWD-03 **[Human]** 상세 내용 6요소: 효과 요약, 발동 조건, 실제 효과, 전략, 추천 연계, 현재 보유 수량. 돌·부적·유물 3종 모두 제공한다. 원시 ID(`STONE-*`, `ITEM-*`, `RELIC-*`)와 내부 trigger 문자열 노출 금지(기존 카드 명시성 계약 유지).
- R-RWD-04 **[AI-제안]** 보유 수량 정의: 돌 = `run.deck`에서 해당 `stoneKind` 개수, 부적 = `run.charms`에서 해당 `charmId` 개수, 유물 = 보유 시 1 아니면 0.
- R-RWD-05 **[AI-제안]** 접근성 계약: 카드 face는 `aria-expanded`를 가진 버튼. focus 진입 시 상세 펼침, 클릭 시 토글. 상세는 `aria-label="<이름> 상세"` 영역이며 내부 선택 버튼이 Tab으로 도달 가능. 한 번에 하나의 후보만 펼쳐진다. hover(mouseenter)도 펼침을 유발하되 collapse는 명시적 상호작용으로만 한다(hover-out으로 내용이 사라지지 않음 → 모바일·전환 사용자 보호).
- R-RWD-06 **[AI-제안]** 상세 문구의 단일 진실 공급원은 콘텐츠 정의다: `StoneDefinition.ui`에 `effect`·`synergy` 필드 추가, `CharmDefinition`·`RelicDefinition`에 `ui { summary, condition, effect, strategy, synergy }` 추가. 조회는 순수 함수 `describeRewardCandidate(candidate, inventory)` 하나로 한다. 문구 자체는 docs/03_content를 근거로 한 한국어 초안이며 사람이 언제든 다듬을 수 있다(테스트는 정확 문구가 아니라 존재·한국어·수치 언급·ID 비노출을 검사).

### R-DECK (HDD-004) — 시작 덱

- R-DECK-01 **[Human]** `STARTING_DECK` = 일반석(STONE-001) 5장 + 척후석·장군석·기병석·수호석·희생석 각 1장 = 총 10장. 기존 "일반석 6 + 특수 4(기병 없음)" 구성을 대체한다.

### R-SCT (HDD-005) — 척후석 개편

- R-SCT-01 **[Human]** 착수 후 덱 위 3장을 확인한다.
- R-SCT-02 **[Human]** 확인한 3장 중 1장을 손패로 가져오고, 손패 1장을 되돌리며, 나머지의 순서를 정한다.
- R-SCT-03 **[AI-제안]** 정밀 규칙(테스트 가능한 최소 놀람 해석):
  - 확인 창 = `drawPile.slice(0, min(3, drawPile.length))`. 재셔플로 창을 채우지 않으며 창이 0장이면 발동하지 않는다(기존 척후석과 동일 원칙).
  - 가져오기(take)는 확인 창에서 1장 → 손패. 되돌리기(return)는 take 이후 손패의 아무 카드 1장(방금 가져온 카드 포함) → 확인 창. 손패 수는 순변화 0으로 패 한도를 침범하지 않는다.
  - 순서 정하기(reorder)는 "확인 창 잔여 2장 + 되돌린 1장 = 최대 3장"의 완전 순열을 플레이어가 정하고, 그 결과가 drawPile 최상단에 그대로 놓인다. 창 밖의 drawPile은 불변.
  - 임시 일반석(temporary)을 되돌리면 기존 불변식("임시 카드는 drawPile/discardPile에 절대 들어가지 않는다")에 따라 소멸하며 reorder 대상에 포함되지 않는다.
  - 발동은 착수당 1회. 플레이어는 어느 단계에서든 취소(전체 포기)할 수 있고 취소 시 덱은 변하지 않는다. 단계별 개별 undo는 이번 범위에서 제공하지 않는다.

### R-GEN (HDD-006) — 장군석 개편

- R-GEN-01 **[Human]** 해당 착수로 포획하면 기존 5냥 보상(주입 상한 `generalCaptureMoneyCap` 유지)과 **함께 카드 1장을 추가 드로우**한다.
- R-GEN-02 **[AI-제안, 검증 시 인간 확인 권장]** "패 한도 적용"의 기계적 해석. 현재 엔진은 `resolveCardUse`가 착수 직후 패를 한도까지 자동 보충하므로, "hand < handLimit일 때만 1장" 해석은 **항상 no-op**이 된다(패가 한도 미만인 유일한 경우는 뽑을 카드도 없는 경우임을 분석으로 확인). 따라서 채택한 해석:
  - 보충 완료 후 즉시 1장을 추가로 뽑는다(재셔플 포함). 이때 패는 일시적으로 `handLimit`을 1 초과할 수 있으나, 주입 안전 상한 `effectLimits.maxHandSize`는 절대 넘지 않는다(넘으면 드로우 생략). 초과분은 다음 착수 시 보충이 일어나지 않는 방식으로 자연 수렴한다(강제 버림 없음).
  - 기각한 대안: (a) 한도 미만일 때만 드로우 → 실질 사문화, (b) 희생석식 임시 패 한도 +1 부여 → HDD-006이 "패 한도를 지킨다"고 명시했고 희생석과 정체성이 중복됨.
  - 이 해석은 구현 세부이며 사람이 검증 단계에서 (a)/(b)로 변경 지시할 수 있다.
- R-GEN-03 **[AI-제안]** 드로우는 엔진(battle reducer) 수준에서 양측 대칭으로 처리한다(적 장군석도 드로우). 냥 보상은 기존대로 플레이어 경로에만 존재한다(적은 냥 개념이 없음 — 기존 동작 유지).

### R-CAV (HDD-007) — 기병석 개편

- R-CAV-01 **[Human]** 직전 내 착수가 포획이었을 때, 이 카드가 손패에 들어오면 덱 위 2장 중 1장을 가져오고 손패 1장을 버린다.
- R-CAV-02 **[Human]** 사용(착수)된 기병석 카드는 버림 더미가 아니라 **덱 맨 아래**로 이동한다.
- R-CAV-03 **[AI-제안]** "직전 내 착수" 추적: `BattleState.previousCaptureBy: Record<StoneColor, boolean>` — 각 색의 가장 최근 **착수(placement)** 가 포획이었는지 기록. 착수 해결 시 갱신하고, 패스는 갱신하지 않으며, 수호 무효화된 착수는 `false`로 기록한다. 기병석이 어떤 경로(착수 후 보충, 장군 추가 드로우, 희생석 드로우 등)로든 손패에 들어오는 순간의 자기 색 플래그로 판정한다.
- R-CAV-04 **[AI-제안]** 교환 정밀 규칙: 확인 창 = `drawPile.slice(0, min(2, drawPile.length))`(재셔플 없음, 0장이면 미발동). 가져오기 1장 → 손패, 버리기는 손패의 아무 카드 1장(기병석 자신·방금 가져온 카드 포함) → 버림 더미(임시 카드는 소멸). 가져오지 않은 창 카드는 원래 상대 순서로 덱 위에 남는다. 손패 순변화 0. 카드 인스턴스별 손패 진입 1회당 1번 발동하며 취소(포기) 가능.
- R-CAV-05 **[AI-제안]** 덱 아래 순환은 `resolveCardUse`에서 `kind === 'STONE-004'`(비임시)일 때 discard 대신 drawPile 맨 아래로 붙인 뒤 보충한다. drawPile이 비어 있던 극단 상황에서는 방금 사용한 기병석이 즉시 다시 뽑힐 수 있다 — 결정적 동작으로 허용하고 테스트로 고정한다.
- R-CAV-06 **[AI-제안]** 상대(AI) 기병석: 덱 아래 순환은 엔진 공통이므로 자동 적용. 손패 진입 교환은 이번 반복에서 AI가 항상 포기(decline)한다 — AI 교환 정책 설계는 별도 결정 사항이며, 미구현이 아니라 명시적 정책이다.

### R-GRD (HDD-008) — 수호석 개편

- R-GRD-01 **[Human]** 활로 2 이하인 아군 그룹 **옆에** 착수하면 그 그룹에 수호 1회를 부여한다.
- R-GRD-02 **[Human]** 다음 상대 착수의 포획을 1회 무효화한다.
- R-GRD-03 **[Human]** 합법수·자충수·단순패 규칙은 그대로 유지되고 추가 착수는 없다.
- R-GRD-04 **[AI-제안]** 보호 토큰 계약(부분 포획 불가능 상태를 만들지 않는 해석):
  - 부여: 착수 전 판 기준 `hasAdjacentEndangeredGroup`(기존 함수, 활로≤2)이 참일 때, 착수 **후** 수호석이 포함된 병합 그룹(수호석은 인접 아군과 반드시 연결되므로 위기 그룹을 포함)의 **정확한 돌 instanceId 집합**을 멤버로 하는 토큰 1개를 만든다. 착수당 최대 1개.
  - 무효화: 토큰 보유 색의 **다음 상대 착수**가 해결될 때, 그 착수의 포획 집합이 토큰 멤버 instanceId와 교차하면 **착수 전체를 무효화**한다 — 판은 착수 이전 상태 그대로(공격 돌도 놓이지 않음), `koForbiddenKey` 불변, 상대 카드는 정상 소비(기병석이면 덱 아래), moveNumber는 증가, 무효화 로그 기록, 토큰 소비. 부분 포획(보호 그룹만 남기고 나머지 포획)을 허용하지 않으므로 활로 0 돌이 판에 남는 불가능 상태가 생기지 않고, 자충수·단순패 판정도 표준 규칙 그대로다(합법성 판정은 변경하지 않고 해결 단계에서 무효화).
  - 만료: 토큰은 "무효화로 소비"되거나, 상대의 **정상 해결된(무효화되지 않은) 착수 1회**가 지나가면 소멸한다. 상대의 패스는 토큰을 소모하지 않는다. 같은 방어측 토큰이 여럿일 때 무효화는 교차하는 토큰 중 가장 오래된 것 1개만 소비하고, 무효화된 착수는 다른 토큰을 만료시키지 않는다(판이 변하지 않았으므로).
  - 부활 전용 착수(W의 placement)도 "상대 착수"로 취급한다.
  - 그룹 성장/병합: 멤버 집합은 부여 시점에 고정된다. 이후 병합된 큰 그룹이 포획될 때도 원 멤버가 포획 집합에 포함되므로 무효화가 작동한다(문서화된 의도적 결과).
- R-GRD-05 **[AI-제안]** 기존 수호석 "덱 위 2장 확인" 효과와 `resolveGuardianEffect`는 제거한다(HDD-008이 효과를 교체). 보호 중인 돌은 판에서 시각 표시(방패 마커)한다 — 모바일에서도 상태를 알 수 있어야 hover 전용 금지 원칙과 일관된다.

### R-SAC (HDD-009) — 희생석

- R-SAC-01 **[Human]** 상대 착수로 포획되면 다음 내 턴 패 한도 +1과 **즉시 카드 1장 드로우**. 상대 손패 감소는 이번 범위에서 제외.
- R-SAC-02 분석 결과: 현행 `addTemporaryHandLimit({amount:1, remainingTurns:1})`가 즉시 드로우+한도 +1을 이미 구현한다. **결함**: `expireTemporaryHandLimits`가 제품 코드에서 호출되지 않아 "+1"이 영구 지속된다 — HDD-009의 "다음 내 턴" 범위 위반.
- R-SAC-03 **[AI-제안]** 만료 배선: battle reducer에서 **턴이 끝나는 색**의 덱에 `expireTemporaryHandLimits`를 적용한다(`END_TURN`과 패스 경로 모두). 상대 턴 중 부여(remainingTurns 1) → 내 다음 턴 종료 시 만료. 만료는 한도만 되돌리고 이미 뽑은 카드를 회수하지 않는다(강제 버림 없음 — 기존 `drawToLimit` 의미 유지). 자충수·자발 제거 비발동, 동시 다중 포획 개별 발동, `maxHandSize` 초과 시 착수 취소 가드는 기존 그대로 유지한다.

### R-AI (HDD-011) — AI 전략 평가

- R-AI-01 **[Human]** AI는 신규 카드 효과의 실제 전략 가치를 평가해야 하며 단순 포획 점수만 사용해서는 안 된다.
- R-AI-02 **[AI-제안]** 평가 계약: `GameConfig.aiEffectWeight: number`(단일 스칼라)를 `aiEffectWeights: Readonly<Record<StoneKind, number>>`(병종별 주입 가중치, 기본값 없음)로 교체한다. 후보 점수 = `유효 포획 수 × aiCaptureWeight + (배치 시 직접 효과 발동 ? aiEffectWeights[kind] : 0)`. 배치 시 직접 효과 판정은 기존 `candidatePlacementTriggersEffect` 의미를 유지한다(척후=항상, 장군=유효 포획>0, 수호=위기 인접; 기병·희생·일반은 배치 시점 직접 효과가 없어 false).
- R-AI-03 **[AI-제안]** 보호 인지: 후보의 포획 집합이 상대(플레이어) 보호 토큰과 교차하면 그 착수는 무효화될 것이므로 **유효 포획 수 = 0**으로 평가한다(장군석 효과 판정에도 유효 포획 수를 사용). 무효화 판정 함수는 reducer와 평가기가 같은 순수 함수를 공유한다.
- R-AI-04 벤치마크 계약(후보 열거 수·p95)은 변경하지 않는다.

### R-PLT (HDD-010, HDD-012) — 규칙·플랫폼 불변

- R-PLT-01 **[Human]** 합법수·자충수·단순패 규칙 유지, 추가 착수 부여 금지. `tryPlay`·`canonicalKoKey`·`legalPlayPoints` 시그니처와 의미는 변경하지 않는다.
- R-PLT-02 **[Human]** 380px 모바일 우선, hover 전용 금지, 신규 런타임 의존성 금지(`dependencies`는 react/react-dom 그대로).
- R-PLT-03 **[Human]** 미승인 밸런스 수치의 `src/` 기본값 금지. 단, HDD가 승인한 **규칙 수치**(척후 3장, 기병 2장, 장군 +1장·기존 5냥, 수호 1회, 희생 +1)는 밸런스 조정값이 아니라 승인된 규칙이므로 리터럴 허용(기존 5냥 리터럴과 동일 전례). `aiEffectWeights`·`EconomyConfig`·`EffectLimits` 등 조정형 수치는 계속 주입 전용.
- R-PLT-04 strict TDD + evidence lifecycle 준수, commit/push 금지, Claude는 소스 수정 금지.

## 2. 마이그레이션 영향 (기존 계약 파괴 지점)

| # | 기존 계약 | 변화 | 영향 파일 |
|---|---|---|---|
| M-01 | `PendingDeckInspection`(단일 3-종 공용 shape) | 척후/기병 전용 다단계 discriminated union + 대기열로 교체, guardian 분기 삭제 | `GameProvider.tsx`, `App.tsx`, `tests/battle.product-effects.test.ts`, `tests/ui.battle.test.tsx`, `tests/effects.queue.test.ts`(간접) |
| M-02 | `resolveScoutEffect(2장 재정렬)`·`resolveCavalryEffect(열람)`·`resolveGuardianEffect(열람)` | 신규 시그니처로 교체/삭제. 소비처 grep 0 필요 | `stones.ts`, `GameProvider.tsx`, `tests/stones.test.ts` |
| M-03 | `resolveCardUse` → 항상 discard | STONE-004는 덱 맨 아래 | `deck.ts`, `tests/deck.test.ts`, AI·시뮬 결정 경로(`scripts/simulate.ts`, `scripts/balance.ts` 재현 수열 변화) |
| M-04 | `expireTemporaryHandLimits` 미배선 | END_TURN/패스 배선 → 희생석 지속시간 변화 | `battle.ts`, `tests/battle.product-effects.test.ts` |
| M-05 | `GameConfig.aiEffectWeight: number` | `aiEffectWeights: Record<StoneKind, number>` | `GameProvider.tsx`, `tests/fixtures/draft-game-config.ts`, `tests/ai.effects.test.ts`, `scripts/playwright-mobile-check.mjs`, `scripts/simulate.ts`·`balance.ts`(config 사용 시) |
| M-06 | `STARTING_DECK` 구성·`stones.presentation` 수치 문구(2장/1장 등) | HDD-004~009 반영 텍스트·구성으로 갱신 | `stones.ts`, `tests/deck.test.ts`, `tests/stones.presentation.test.ts`, `tests/ui.card-clarity.test.tsx` |
| M-07 | MapScreen 목록 렌더 | MapGraph(SVG 연결선+절대 배치 버튼) 교체, `data-state`에 `current` 추가 | `App.tsx`, `styles.css`, `tests/ui.map.progression.test.tsx`(마지막 완료 노드 기대값 done→current), playwright |
| M-08 | RewardScreen 즉시 확정 | 첫 상호작용=펼침, 확정은 상세 내 버튼 | `App.tsx`, `styles.css`, playwright 보상 flow(`보상을 받지 않는다` 경로는 유지) |
| M-09 | `CreateBattleInput`/`BattleState` | `maxHandSize`(주입)·`previousCaptureBy`·`protections` 필드 추가, 로그 타입 `'effect'` 추가 | `battle.ts`, battle 생성 소비처 전부(GameProvider, tests fixtures, scripts) |
| M-10 | docs/03_content/01_특수돌.md의 STONE-002~006 효과 서술 | 승인된 HDD-005~009 효과로 갱신(문서-구현 불일치 방지) | docs (+ `docs/CHANGELOG.md`) |

## 3. 엣지 케이스 목록 (AC로 전부 커버)

1. 척후: drawPile 2장/1장/0장일 때 창 크기 축소·미발동. 임시 카드 되돌리기 소멸. 잘못된 순열 → RangeError·상태 불변. 취소 시 덱 완전 불변.
2. 장군: 포획 0이면 드로우·냥 없음. `maxHandSize` 도달 시 드로우 생략. drawPile+discard 모두 빈 경우 no-op(임시 일반석 생성하지 않음). 초과분이 다음 착수 보충에서 자연 수렴.
3. 기병: 직전 착수 비포획이면 미발동. 전투 첫 드로우(직전 착수 없음)는 미발동. 창 0장 미발동. 사용 후 덱 아래 → 빈 drawPile이면 즉시 재드로우 가능(결정적). 무효화된 착수 후에는 플래그 false.
4. 수호: 위기 그룹이 없으면 토큰 없음. 다중 위기 그룹 인접 시에도 병합 그룹 1개에 토큰 1개. 무효화 시 판·ko 키 완전 보존과 카드 소비. 동시 다중 그룹 포획(보호+비보호 혼재) 전체 무효화. 상대의 비포획 착수 1회로 만료, 패스는 비소모. 자충수·ko 판정은 표준 그대로(무효화는 합법 착수의 해결 단계).
5. 희생: 동시 다중 개별 발동(기존), 자충수·자발 제거 비발동(기존), 다음 내 턴 종료 시 한도 원복(신규 배선), `maxHandSize` 가드(기존).
6. 보상: 보유 0/1/다수 수량 표기. 부적 2개 보유 시 교체 flow 진입은 기존 그대로. 첫 tap이 CHOOSE를 유발하지 않음(회귀 방지 핵심).
7. 지도: 완료 0개(시작 2 open·current 없음), 중간(1 current·1~3 open), 보스 직전. 잠긴 노드 클릭 무반응 유지.
8. AI: 보호 그룹 포획 후보의 유효 포획 0 평가. 가중치 0 주입 시 기존 포획-만 평가와 동일 결과(회귀 앵커).

## 4. 미결정·위험

| 항목 | 상태 | 처리 |
|---|---|---|
| R-GEN-02 드로우 해석 | AI-제안 채택(안전 상한 내 일시 초과) | blocking 아님 — 구현 세부. 검증 보고서에서 인간 확인 항목으로 명시 |
| 보상·카드 상세 문구 초안 | AI 작성 한국어 초안 | 밸런스·톤은 사람이 사후 조정. 테스트는 문구 자유도 보장 |
| AI 교환 정책(R-CAV-06)·수호 가치 세부 | 이번 범위: decline / 주입 가중치 | 후속 반복에서 사람이 결정 |
| 시뮬·밸런스 스크립트 수열 변화(M-03/04/05) | 결정성은 유지, 수치는 변함 | 벤치마크·시뮬 exit 0만 요구, 수치 재해석은 인간 판단 |
