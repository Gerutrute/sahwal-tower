# 03 — Claude 구현 계획 (그래프 지도 · 보상 상세 · 특수돌 효과 개편)

- 작성자: Claude Code planner (Orca task `task_de51fe0392c4` / dispatch `ctx_169986e74553`, 읽기 전용)
- 요구 ID(R-*)는 `02-claude-requirements-analysis.md`, 수락 기준(AC-*)은 `04-claude-acceptance-criteria.md` 참조.
- 계획 hash는 `plan-frozen` 게이트가 02~05 작성 완료 시점에 계산·동결한다.

## 0. 실행 원칙

1. **구현 주체:** 모든 소스·테스트·스크립트·docs 변경은 Hermes/Codex만 수행한다. Claude는 계획·AC·검증 보고만 작성한다.
2. **strict vertical TDD:** Task마다 "실패 테스트 1개 작성 → focused RED 기록 → 최소 구현 → 같은 명령 GREEN → Task 파일 전체 + `npm test` 회귀 0건" 사이클. 구문 오류·import 실패는 유효한 RED가 아니다. 각 Task의 첫 RED·마지막 GREEN·전체 회귀를 `evidence.py capture-command --role implementer`로 보존한다.
3. **구형 계약 폐기 순서:** 대체 테스트가 먼저 GREEN이 된 뒤 같은 변경 묶음에서만 구형 테스트/함수를 제거한다.
4. **수치 게이트:** `aiEffectWeights`·`EffectLimits`·`EconomyConfig` 등 조정형 수치는 주입 전용(무기본값 필수 인자, draft fixture에만 초안 존재). HDD 승인 규칙 수치(3장/2장/+1장/1회/5냥)는 리터럴 허용.
5. **금지:** commit/push, 신규 런타임 의존성, 기존 바둑 규칙 함수 의미 변경, hover 전용 UI.

## 1. 정확한 상태·데이터 계약

### 1.1 지도 (신규 `src/game/mapLayout.ts` + `src/components/MapGraph.tsx`)

```ts
// src/game/mapLayout.ts — 순수 계층, React 无의존
export type MapNodeUiState = 'done' | 'current' | 'open' | 'locked';
export type MapEdgeUiState = 'traveled' | 'open' | 'inactive';

export interface MapLayoutNode {
  readonly id: string;
  readonly node: MapNode;
  readonly x: number;   // viewBox px, 0..MAP_VIEW_WIDTH
  readonly y: number;   // viewBox px, column이 클수록 작다(위)
}
export interface MapLayoutEdge {
  readonly fromId: string;
  readonly toId: string;
  readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number;
}
export interface MapLayout {
  readonly width: number;    // MAP_VIEW_WIDTH = 380 이하
  readonly height: number;   // 행 수 × 행 높이 (레이아웃 상수는 UI 상수로 자유)
  readonly nodes: readonly MapLayoutNode[];   // boss 포함 전 노드
  readonly edges: readonly MapLayoutEdge[];   // 모든 node.next 관계 1:1, 그 외 없음
}
export function computeMapLayout(map: ActMap): MapLayout;
export function mapNodeUiState(
  map: ActMap, completedNodeIds: readonly string[], nodeId: string,
): MapNodeUiState;
export function mapEdgeUiState(
  completedNodeIds: readonly string[], openIds: ReadonlySet<string>, edge: MapLayoutEdge,
): MapEdgeUiState;
```

- 좌표 규칙: column 0이 최하단, boss가 최상단(`y`가 column 단조 감소). lane 0/1은 좌/우 고정 x, boss는 중앙. 구체 픽셀 상수는 UI 자유이나 `width ≤ 380`.
- 상태 파생: R-MAP-06 그대로. `mapNodeUiState`는 `selectableNodeIds`를 내부 재사용해 도달성 로직을 중복하지 않는다.
- `MapGraph` 컴포넌트: `<nav className="map-graph" aria-label="{act}막 지도">` 안에 (a) `aria-hidden` SVG 연결선 층 — edge마다 `<line class="map-edge" data-edge="{fromId}>{toId}" data-edge-state="...">`, (b) 절대 배치된 기존 `.map-node` 버튼(레이아웃 좌표를 %로 환산해 `style` 지정, `transform: translate(-50%,-50%)`). 버튼 계약(`data-node-id`, `data-state`, `disabled`, 라벨 텍스트)은 기존 MapScreen과 동일하되 `data-state`에 `current`가 추가된다. 버튼 최소 터치 타깃 44px 유지.
- `App.tsx` MapScreen은 목록 렌더를 MapGraph 호출로 교체. `NODE_NAMES`·`nodeDescription`은 유지·전달.

### 1.2 보상 상세 (콘텐츠 정의 + `describeRewardCandidate`)

```ts
// src/game/content/stones.ts — ui 확장
readonly ui: {
  readonly summary: string;   // 효과 요약
  readonly condition: string; // 발동 조건
  readonly effect: string;    // 실제 효과(정확한 규칙 서술) ← 신규
  readonly strategy: string;  // 전략
  readonly synergy: string;   // 추천 연계 ← 신규
  readonly classKey: string;
  readonly icon: string;
};

// charms.ts / relics.ts — 신규 ui 블록 (behavior는 유지)
readonly ui: {
  readonly summary: string; readonly condition: string; readonly effect: string;
  readonly strategy: string; readonly synergy: string;
};

// src/game/rewards.ts — 신규 순수 조회
export interface RewardDetail {
  readonly name: string;
  readonly kindLabel: '특수 돌' | '부적' | '유물';
  readonly summary: string; readonly condition: string; readonly effect: string;
  readonly strategy: string; readonly synergy: string;
  readonly ownedCount: number;  // R-RWD-04 규칙
}
export function describeRewardCandidate(
  candidate: RewardCandidate,
  inventory: Pick<InventoryState, 'deck' | 'charms' | 'relics'>,
): RewardDetail;
```

- RewardScreen 구조(로컬 `useState<string | null>` expandedId, reducer 변경 없음):

```tsx
<article className="reward-card" data-candidate-id={id} data-expanded={expanded}>
  <button className="reward-face" aria-expanded={expanded} aria-controls={`reward-detail-${id}`}
    onClick={toggle} onFocus={expand} onMouseEnter={expand}>이름 · 종류 · 요약 1줄</button>
  {expanded && (
    <section id={`reward-detail-${id}`} className="reward-detail" aria-label={`${name} 상세`}>
      <dl>요약/발동 조건/실제 효과/전략/추천 연계/현재 보유 {ownedCount}개</dl>
      <button className="primary reward-select"
        onClick={() => dispatch({ type: 'CHOOSE_REWARD', candidateId: id })}>이 보상을 선택</button>
    </section>
  )}
</article>
```

- 한 번에 하나만 펼침(expandedId 교체). face 재클릭 시 접힘. `보상을 받지 않는다`·부적 교체 flow는 기존 유지.
- 문구 초안 근거: `docs/03_content/01_특수돌.md`(HDD 반영 갱신본)·`02_부적과_유물.md`. 부적/유물 문구는 behavior 계약(발동 조건·시점·대상)과 모순되지 않게 작성.

### 1.3 덱 (`src/game/deck.ts`)

```ts
// 변경: 사용 카드 목적지 분기 (R-CAV-05)
export function discardUsed(state, cardId, rng): DeckState
// 내부 규칙: card.kind === 'STONE-004' && !card.temporary
//   → drawPile = [...drawPile, card] (맨 아래), discardPile 불변
//   그 외 비임시 → discardPile, 임시 → 소멸(기존)
// 목적지 결정 후 기존 drawToLimit 보충 순서 유지.

// 신규: 장군석 추가 드로우 (R-GEN-02)
export function drawExtra(state: DeckState, maxHandSize: number, rng: RandomSource): DeckState;
// hand.length >= maxHandSize → 상태 그대로.
// drawPile 비면 reshuffle 시도, 그래도 없으면 그대로(임시 일반석 생성 금지).
// handLimit과 무관하게 1장 추가(일시 초과 허용). handLimit/모디파이어 불변.

// 기존 함수 재사용: addTemporaryHandLimit / expireTemporaryHandLimits (시그니처 불변)
```

- `STARTING_DECK`(stones.ts) = `['STONE-001'×5, 'STONE-002', 'STONE-003', 'STONE-004', 'STONE-005', 'STONE-006']`.

### 1.4 척후·기병 교환 엔진 (`src/game/content/stones.ts`)

```ts
// 척후 (R-SCT) — 구 resolveScoutEffect 대체
export function startScoutInspection(deck: DeckState): readonly StoneCard[];
// = deck.drawPile.slice(0, Math.min(3, deck.drawPile.length))

export interface ScoutExchangeInput {
  readonly takenCardId: string;              // inspected 중 1장
  readonly returnedCardId: string;           // take 반영 후 손패 중 1장
  readonly orderedIds: readonly string[];    // (inspected ∖ taken) ∪ (returned가 비임시일 때 returned)의 완전 순열
}
export function resolveScoutExchange(
  deck: DeckState, inspectedIds: readonly string[], input: ScoutExchangeInput,
): DeckState;
// 원자적: 검증 실패 시 RangeError, 상태 불변. 성공 시
//   hand: -returned +taken (순변화 0), drawPile: [ordered..., 창 밖 나머지...]
//   returned가 임시 카드면 소멸(orderedIds에 포함 금지) + temporaryCards 정리

// 기병 (R-CAV) — 구 resolveCavalryEffect 대체
export function startCavalryInspection(
  deck: DeckState, previousOwnMoveCaptured: boolean,
): readonly StoneCard[];  // 조건 미충족 또는 drawPile 0장 → []

export interface CavalryExchangeInput {
  readonly takenCardId: string;      // inspected 중 1장
  readonly discardedCardId: string;  // take 반영 후 손패 중 1장 (기병석 자신 포함 가능)
}
export function resolveCavalryExchange(
  deck: DeckState, inspectedIds: readonly string[], input: CavalryExchangeInput,
): DeckState;
// 가져오지 않은 창 카드는 원래 상대 순서로 drawPile 위에 잔류.
// discarded: 비임시 → discardPile, 임시 → 소멸. 원자적 검증 동일.

// 삭제: resolveScoutEffect(구), resolveCavalryEffect(구), resolveGuardianEffect,
//        DeckInspectionEffectResult, ScoutEffectResult(구 shape)
// 유지: resolveGeneralCaptureEffect(냥), resolveSacrificeEffects,
//        candidatePlacementTriggersEffect(의미 유지), createStoneEffectDefinition
```

### 1.5 전투 (`src/game/battle.ts`)

```ts
export interface GroupProtection {
  readonly id: string;                          // `protection-${grantedAtMove}`
  readonly color: StoneColor;                   // 보호되는 측
  readonly memberInstanceIds: readonly string[];// 부여 시점 병합 그룹의 정확한 돌 instanceId
  readonly grantedAtMove: number;
}

export interface BattleState {
  // …기존 필드 유지…
  readonly maxHandSize: number;                                   // 주입 (M-09)
  readonly previousCaptureBy: Readonly<Record<StoneColor, boolean>>; // R-CAV-03
  readonly protections: readonly GroupProtection[];               // R-GRD-04
}
export interface CreateBattleInput { /* 기존 + */ readonly maxHandSize: number; }

export interface BattleLogEntry {
  readonly type: 'move' | 'pass' | 'charm' | 'relic' | 'revival' | 'result' | 'effect'; // 'effect' 추가
  // …기존 필드…
}

// 신규 순수 함수 (reducer와 AI 평가가 공유 — R-AI-03)
export function captureNegatedBy(
  board: BoardState, capturedPoints: readonly number[],
  protections: readonly GroupProtection[], mover: StoneColor,
): GroupProtection | null;  // 교차 토큰 중 grantedAtMove 최소 1개 또는 null
```

PLAY_CARD 해결 순서(양측 공통, 결정 순서를 계약으로 고정):

1. `tryPlay` 합법성 판정 — **표준 규칙 그대로**(보호 무관). 불법이면 기존과 동일.
2. `captureNegatedBy(...)` ≠ null이면 **무효화 경로**: board·koForbiddenKey는 착수 이전 값 유지, `decks[mover] = resolveCardUse(...)`(카드 소비·기병 순환·보충 포함), `moveNumber+1`, `consecutivePasses=0`, `previousCaptureBy[mover]=false`, 해당 토큰 1개 제거(다른 토큰 만료 없음), log `'effect'`(`sourceId`=토큰 id, message `'수호 효과가 포획을 무효화했습니다.'`), phase는 기존 흐름(`resolving`) 유지. 과반 판정 생략(판 불변).
3. 정상 경로: 기존 배치·카드 소비 후 —
   a. `previousCaptureBy[mover] = capturedCount > 0`.
   b. 장군석: `card.kind==='STONE-003' && capturedCount>0` → `decks[mover] = drawExtra(deck, state.maxHandSize, rng)` + log `'effect'` `'장군석 효과로 카드 1장을 추가로 뽑았습니다.'`.
   c. 수호석: `card.kind==='STONE-005' && hasAdjacentEndangeredGroup(boardBefore, point, mover)` → 착수 후 `groupAt(play.board, point)` 멤버로 토큰 생성(착수당 1개) + log `'effect'` `'수호석이 그룹에 수호를 부여했습니다.'`.
   d. 토큰 만료: `protections`에서 `color !== mover`인 토큰 전부 제거(정상 해결된 상대 착수 1회 경과 — R-GRD-04). c의 신규 토큰은 만료 대상 아님(자기 색).
4. 패스: 토큰·플래그 불변. **턴이 끝나는 색**의 덱에 `expireTemporaryHandLimits` 적용(END_TURN 경로 동일 — R-SAC-03).
5. `performRevivalSpecialMove`: W의 placement로 취급 — 2·3(a)·3(d) 동일 적용(카드 소비는 없음).

희생석 배선은 기존(GameProvider의 `resolveSacrificeEffects` + `addTemporaryHandLimit`)을 유지한다.

### 1.6 게임 셸 (`src/game/GameProvider.tsx`)

```ts
export type PendingInteraction =
  | {
      readonly kind: 'scout';
      readonly sourceId: string;                  // 사용한 척후석 card.id
      readonly inspected: readonly StoneCard[];   // 최대 3
      readonly takenCardId: string | null;        // null → 단계 'take'
      readonly returnedCardId: string | null;     // null → 단계 'return'
      readonly orderedIds: readonly string[];     // 단계 'order'에서 편집
      readonly endsTurnOnResolve: boolean;
    }
  | {
      readonly kind: 'cavalry';
      readonly sourceId: string;                  // 손패에 들어온 기병석 card.id
      readonly inspected: readonly StoneCard[];   // 최대 2
      readonly takenCardId: string | null;
      readonly discardedCardId: string | null;
      readonly endsTurnOnResolve: boolean;
    };

export interface GameState {
  // pendingInspection: PendingDeckInspection | null  ← 교체
  readonly pendingInspection: PendingInteraction | null;    // 활성(head)
  readonly queuedInspections: readonly PendingInteraction[]; // 대기열(FIFO)
  // …나머지 기존 필드…
}

export type GameAction =
  // 기존 유지 + 신규:
  | { readonly type: 'INSPECT_TAKE'; readonly cardId: string }
  | { readonly type: 'INSPECT_RETURN'; readonly cardId: string }  // scout=되돌리기, cavalry=버리기
  // REORDER_INSPECTION / CONFIRM_INSPECTION / CANCEL_INSPECTION 은 유지(의미 확장)
```

- 상호작용 생성: 플레이어 착수 해결 후 — 척후석 사용 시 `startScoutInspection`(창>0일 때, `endsTurnOnResolve:true`); 손패 진입 diff(기존 handIdsBefore 패턴)로 발견된 각 STONE-004 × `previousCaptureBy.B` → `startCavalryInspection`(`endsTurnOnResolve:true`), 복수면 드로우 순서대로 대기열. AI 턴 중 희생석 드로우로 들어온 플레이어 기병석은 `endsTurnOnResolve:false`로 큐잉. AI(W) 자신의 교환은 항상 decline(R-CAV-06) — 생성하지 않음.
- `INSPECT_TAKE`: 단계 검증 후 해당 필드 기록(스테이징 — battle 덱은 아직 불변). scout는 returned 후 `orderedIds` 초기값 = (창 ∖ taken) 순서 그대로 + (비임시 returned를 끝에).
- `REORDER_INSPECTION`: scout order 단계 전용. 순열 검증은 기존 로직 재사용(대상 집합만 교체).
- `CONFIRM_INSPECTION`: scout → `resolveScoutExchange`, cavalry → `resolveCavalryExchange`를 battle.decks.B에 원자 적용(RangeError 시 invalidReason 안내·상태 유지 — 기존 finishInspection 패턴). 성공 시 head 소거 → 대기열 shift → 비면 `endsTurnOnResolve`에 따라 `END_TURN`.
- `CANCEL_INSPECTION`: 덱 불변으로 head 소거 → 동일한 후속 처리.
- `moveEffectDefinitions`: guardian 분기는 유지하되 트리거 근거만 새 의미(토큰 부여)로 문구 갱신. 삭제된 guardian 열람 로직 참조 제거.
- `GameConfig`: `aiEffectWeight` → `aiEffectWeights: Readonly<Record<StoneKind, number>>`(assertConfig에서 6키 전부 유한값 검증). `openBattle`이 `maxHandSize: config.effectLimits.maxHandSize`를 battle에 주입.
- AI 평가기(performAiTurn): §1.5 `captureNegatedBy` 공유 →
  `effective = negated ? 0 : captured.length` / `score = effective×aiCaptureWeight + (candidatePlacementTriggersEffect(board, point, 'W', kind, effective) ? aiEffectWeights[kind] : 0)`.

### 1.7 UI (App.tsx / BoardSvg / styles.css)

- BattleScreen 확인 패널 → 단계형 패널: scout `'척후 정찰'`(단계 안내문 + 카드 버튼 `data-inspect-card-id`, order 단계는 카드별 `위로` 버튼 + `확정`/`취소`), cavalry `'기병 교환'`(가져올 1장 → 버릴 1장 → `확정`/`취소`). 모든 조작은 버튼(터치·키보드 겸용), hover 의존 없음.
- BoardSvg: `protectedPoints?: readonly number[]` prop 추가 → 해당 교차점에 `<circle class="protection-ring" data-protected={point}>` 마커. BattleScreen이 활성 토큰 멤버 instanceId를 판에서 스캔해 전달.
- styles.css: `.map-graph`(relative, svg absolute), `.map-node[data-state="current"]`(강조 테두리+배지), `.map-edge[data-edge-state]` 3종, `.reward-card`/`.reward-face`/`.reward-detail`/`.reward-select`, `.protection-ring`, 단계형 패널 스타일. 380px 무가로스크롤 유지.

## 2. Task 분해 (vertical TDD)

각 Task: **첫 RED 테스트 이름 고정** → 최소 구현 → focused GREEN → 파일 전체 GREEN → `npm test` 회귀 0.

| Task | 범위 | 신규/수정 파일 | 첫 RED (파일 · 테스트 이름) |
|---|---|---|---|
| T1 | 지도 순수 계층 (R-MAP-01~06) | C `src/game/mapLayout.ts`, C `tests/map.graph.test.ts` | `tests/map.graph.test.ts` · `"아래에서 위로 향하는 열 좌표를 만든다"` |
| T2 | 지도 UI (R-MAP-02~07) | C `src/components/MapGraph.tsx`, M `src/App.tsx`, M `src/styles.css`, C `tests/ui.map.graph.test.tsx`, M `tests/ui.map.progression.test.tsx` | `tests/ui.map.graph.test.tsx` · `"실제 next 연결선을 세로 그래프로 그린다"` |
| T3 | 시작 덱·카드 문구 (R-DECK-01, M-06) | M `src/game/content/stones.ts`, M `tests/deck.test.ts`, M `tests/stones.presentation.test.ts` | `tests/deck.test.ts` · `"시작 덱은 일반석 5장과 특수돌 5종 각 1장이다"` |
| T4 | 보상 상세 (R-RWD-01~06) | M `stones.ts`/`charms.ts`/`relics.ts`(ui), M `src/game/rewards.ts`, M `src/App.tsx`, M `styles.css`, C `tests/rewards.detail.test.ts`, C `tests/ui.reward.detail.test.tsx`, M `tests/ui.card-clarity.test.tsx` | `tests/rewards.detail.test.ts` · `"보상 후보를 요약·조건·효과·전략·연계·보유량으로 서술한다"` |
| T5 | 척후 교환 엔진+UI (R-SCT) | M `stones.ts`, M `GameProvider.tsx`(PendingInteraction·액션), M `App.tsx`, M `tests/stones.test.ts`, M `tests/battle.product-effects.test.ts`, M `tests/ui.battle.test.tsx` | `tests/stones.test.ts` · `"척후석은 덱 위 3장을 확인해 1장을 가져오고 1장을 되돌린 뒤 순서를 정한다"` |
| T6 | 장군 드로우 + 기병 (R-GEN, R-CAV) | M `deck.ts`, M `battle.ts`(maxHandSize·previousCaptureBy·effect 로그), M `stones.ts`, M `GameProvider.tsx`, C `tests/battle.effects.test.ts`, M `tests/deck.test.ts`, M `tests/battle.product-effects.test.ts` | `tests/battle.effects.test.ts` · `"장군석 포획은 안전 상한 안에서 즉시 카드 1장을 더 뽑는다"` |
| T7 | 수호 보호 토큰 (R-GRD) | M `battle.ts`(protections·captureNegatedBy·무효화 경로), M `GameProvider.tsx`, M `BoardSvg.tsx`, M `styles.css`, C `tests/battle.protection.test.ts`, M `tests/stones.test.ts`(구 열람 삭제) | `tests/battle.protection.test.ts` · `"수호석은 위기 그룹에 수호 1회를 부여한다"` |
| T8 | 희생 만료 배선 (R-SAC-03) | M `battle.ts`(END_TURN·패스에 expire), M `tests/battle.effects.test.ts`, M `tests/battle.product-effects.test.ts` | `tests/battle.effects.test.ts` · `"희생석 패 한도 증가는 다음 내 턴이 끝나면 만료된다"` |
| T9 | AI 가중치·보호 인지 (R-AI) | M `GameProvider.tsx`(aiEffectWeights), M `tests/fixtures/draft-game-config.ts`, M `tests/ai.effects.test.ts`, M(필요 시) `scripts/simulate.ts`·`scripts/balance.ts`·`tests/fixtures/*` | `tests/ai.effects.test.ts` · `"병종별 주입 가중치로 직접 효과를 평가한다"` |
| T10 | 모바일 E2E·docs 동기화·회귀 | M `scripts/playwright-mobile-check.mjs`(config·지도 그래프·보상 상세 flow), M `docs/03_content/01_특수돌.md`, M `docs/CHANGELOG.md` | (E2E는 vitest RED 없음 — `npm run check:mobile` 실패→성공 기록으로 대체) |

의존 순서: T1→T2, T3→T4, T5·T6·T7·T8은 T3 이후 순차(전투 상태 필드 공유), T9는 T6·T7 이후, T10 마지막. 각 Task 종료 시 04의 해당 AC 그룹 GREEN 확인 후 다음 Task 진행.

## 3. 삭제·grep-0 목록 (T10 종료 시점)

`src/ tests/ scripts/`에서 다음 심볼 참조 0건: `resolveGuardianEffect`, `resolveCavalryEffect`(구), `DeckInspectionEffectResult`, `ScoutEffectResult`(구 shape), `PendingDeckInspection`(구 타입명), `aiEffectWeight`(단수형), `sourceKind: 'guardian'`(inspection 문맥). 구 `resolveScoutEffect`는 신규 함수로 대체 후 이름 재사용 금지(혼동 방지 — `startScoutInspection`/`resolveScoutExchange`만 존재).

## 4. 위험과 완화

1. **결정 수열 변화(M-03/04/05):** `resolveCardUse` 분기·expire 배선·config 필드 교체로 시뮬/밸런스/모바일 스크립트의 기존 수열이 바뀐다 → 해당 스크립트와 fixture를 같은 Task에서 갱신하고 exit 0을 회귀 기준으로 삼는다(수치 판단은 인간 몫).
2. **battle 생성 소비처 누락(M-09):** `createBattleState` 호출부 전수 검색(`GameProvider`, tests, `scripts/simulate.ts`, `tests/fixtures/*`) 후 `maxHandSize` 주입. typecheck가 안전망.
3. **무효화 경로의 상태 누수:** 무효화 시 board 참조는 반드시 이전 객체 그대로(재생성 금지) — 판 불변 assertion을 AC에 포함.
4. **UI selector 회귀:** playwright가 쓰는 `data-state`/`data-node-id$="-boss"`/`1막 지도`/`.hit` 계약은 유지. 지도 개편 후 `npm run check:mobile`을 T2 직후 한 번, T10에서 최종 실행.
5. **대기열 상호작용 중 화면 전환:** `RETURN_TO_MAP`·battle 종료 시 `pendingInspection`·`queuedInspections`를 함께 초기화(기존 pendingInspection 초기화 지점 전수 갱신).
