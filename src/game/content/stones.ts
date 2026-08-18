import { groupAt, libertiesOf, neighbors } from '../go';
import type { DeckState, HandLimitModifier, StoneCard } from '../deck';
import type { EffectDefinition, EffectPriority } from '../effects';
import type { BoardState, Stone, StoneColor, StoneKind } from '../types';

export type StoneEffectTrigger =
  | 'after-placement'
  | 'capture-success'
  | 'card-entered-hand'
  | 'adjacent-endangered-group'
  | 'captured-by-opponent-placement';

export interface StoneEffectTemplate {
  readonly trigger: StoneEffectTrigger;
  readonly priority: EffectPriority;
  readonly perMoveLimit: number;
}

export interface StoneDefinition {
  readonly id: StoneKind;
  readonly name: string;
  readonly effect: StoneEffectTemplate | null;
  readonly ui: {
    readonly summary: string;
    readonly condition: string;
    readonly effect: string;
    readonly strategy: string;
    readonly synergy: string;
    readonly classKey: string;
    readonly icon: string;
  };
}

export const STONE_DEFINITIONS: Readonly<Record<StoneKind, StoneDefinition>> = {
  'STONE-001': {
    id: 'STONE-001', name: '일반석', effect: null,
    ui: { summary: '효과 없는 기본 돌.', condition: '항상 착수 가능.', effect: '추가 효과 없이 일반 바둑돌로 착수한다.', strategy: '덱을 안정시키고 효과 밀도를 조절한다.', synergy: '어떤 부적·유물과도 부담 없이 어울린다.', classKey: 'basic', icon: '基' },
  },
  'STONE-002': {
    id: 'STONE-002',
    name: '척후석',
    effect: { trigger: 'after-placement', priority: 8, perMoveLimit: 1 },
    ui: { summary: '착수 후 덱 위 3장을 살핀다.', condition: '이 카드를 착수했을 때.', effect: '3장 중 1장을 가져오고 손패 1장을 되돌린 뒤 덱 위 순서를 정한다.', strategy: '다음 드로우를 설계해 원하는 병종을 준비한다.', synergy: '포획 뒤 추가로 뽑는 장군석과 연계하면 선택지가 넓어진다.', classKey: 'scout', icon: '斥' },
  },
  'STONE-003': {
    id: 'STONE-003',
    name: '장군석',
    effect: { trigger: 'capture-success', priority: 7, perMoveLimit: 1 },
    ui: { summary: '포획하면 5냥과 카드 1장을 얻는다.', condition: '이 착수로 상대 돌을 잡았을 때.', effect: '주입된 상한까지 5냥을 얻고 안전 패 상한 안에서 카드 1장을 추가로 뽑는다.', strategy: '포획 수를 경제와 손패 우위로 바꾼다.', synergy: '척후석으로 덱 위를 정리한 뒤 사용하면 원하는 카드를 받을 수 있다.', classKey: 'general', icon: '將' },
  },
  'STONE-004': {
    id: 'STONE-004',
    name: '기병석',
    effect: { trigger: 'card-entered-hand', priority: 8, perMoveLimit: 1 },
    ui: { summary: '덱 위 2장과 손패를 교환하고 사용 후 맨 아래로 간다.', condition: '직전 내 착수가 포획이고 이 카드가 손패에 들어왔을 때.', effect: '덱 위 2장 중 1장을 가져오고 손패 1장을 버린다. 착수한 기병석은 덱 맨 아래로 돌아간다.', strategy: '포획 흐름을 이어 필요한 패를 빠르게 찾는다.', synergy: '장군석의 추가 드로우로 손패에 들어오면 교환 기회를 만들기 쉽다.', classKey: 'cavalry', icon: '騎' },
  },
  'STONE-005': {
    id: 'STONE-005',
    name: '수호석',
    effect: { trigger: 'adjacent-endangered-group', priority: 6, perMoveLimit: 1 },
    ui: { summary: '위기 그룹의 다음 포획을 1회 무효화한다.', condition: '활로 2 이하인 아군 그룹 옆에 착수했을 때.', effect: '병합된 아군 그룹에 수호를 부여해 다음 상대 착수의 포획 전체를 무효화한다.', strategy: '위기 그룹을 한 차례 지키며 반격할 시간을 번다.', synergy: '희생석을 지킬지 일부러 내줄지 선택해 손패 흐름을 조절한다.', classKey: 'guardian', icon: '守' },
  },
  'STONE-006': {
    id: 'STONE-006',
    name: '희생석',
    effect: { trigger: 'captured-by-opponent-placement', priority: 4, perMoveLimit: 1 },
    ui: { summary: '잡히면 다음 내 턴 패 한도 +1과 카드 1장을 얻는다.', condition: '상대의 착수로 포획됐을 때.', effect: '즉시 카드 1장을 뽑고 다음 내 턴이 끝날 때까지 패 한도를 1 높인다.', strategy: '버림돌로 유인하고 손패 이득을 챙긴다.', synergy: '기병석이 들어오면 직전 포획 조건을 활용해 교환할 수 있다.', classKey: 'sacrifice', icon: '犧' },
  },
};

export interface StoneEffectSource {
  readonly sideRelation: EffectDefinition['sideRelation'];
  readonly acquisitionOrder: number;
  readonly sourceId: string;
}

export function createStoneEffectDefinition(
  kind: StoneKind,
  source: StoneEffectSource,
): EffectDefinition | null {
  const definition = STONE_DEFINITIONS[kind];
  if (definition.effect === null) return null;
  return {
    id: `${source.sourceId}:${definition.effect.trigger}`,
    trigger: definition.effect.trigger,
    priority: definition.effect.priority,
    sideRelation: source.sideRelation,
    sourceKind: 'stone',
    acquisitionOrder: source.acquisitionOrder,
    sourceId: source.sourceId,
    perMoveLimit: definition.effect.perMoveLimit,
    message: `${definition.name} 효과가 발동했다.`,
  };
}

function inspectTop(deck: DeckState, count: number): readonly StoneCard[] {
  return deck.drawPile.slice(0, count);
}

export function startScoutInspection(deck: DeckState): readonly StoneCard[] {
  return inspectTop(deck, Math.min(3, deck.drawPile.length));
}

export interface ScoutExchangeInput {
  readonly takenCardId: string;
  readonly returnedCardId: string;
  readonly orderedIds: readonly string[];
}

function assertExactPrefix(deck: DeckState, inspectedIds: readonly string[], maximum: number): readonly StoneCard[] {
  if (inspectedIds.length > maximum || new Set(inspectedIds).size !== inspectedIds.length) {
    throw new RangeError('inspection window is invalid');
  }
  const window = deck.drawPile.slice(0, inspectedIds.length);
  if (window.some((card, index) => card.id !== inspectedIds[index])) {
    throw new RangeError('inspection window no longer matches the deck');
  }
  return window;
}

function assertPermutation(actual: readonly string[], expected: readonly string[]): void {
  if (actual.length !== expected.length
    || new Set(actual).size !== actual.length
    || [...actual].sort().some((id, index) => id !== [...expected].sort()[index])) {
    throw new RangeError('card order must be a complete permutation');
  }
}

export function resolveScoutExchange(
  deck: DeckState,
  inspectedIds: readonly string[],
  input: ScoutExchangeInput,
): DeckState {
  const inspected = assertExactPrefix(deck, inspectedIds, 3);
  const taken = inspected.find(({ id }) => id === input.takenCardId);
  if (taken === undefined) throw new RangeError('taken card must be inspected');
  const handAfterTake = [...deck.hand, taken];
  const returned = handAfterTake.find(({ id }) => id === input.returnedCardId);
  if (returned === undefined) throw new RangeError('returned card must be in hand after taking');
  const remainingWindow = inspected.filter(({ id }) => id !== taken.id);
  const expectedOrdered = returned.temporary ? remainingWindow : [...remainingWindow, returned];
  assertPermutation(input.orderedIds, expectedOrdered.map(({ id }) => id));
  const byId = new Map(expectedOrdered.map((card) => [card.id, card]));
  const ordered = input.orderedIds.map((id) => byId.get(id)!);
  return {
    ...deck,
    hand: handAfterTake.filter(({ id }) => id !== returned.id),
    drawPile: [...ordered, ...deck.drawPile.slice(inspected.length)],
    temporaryCards: returned.temporary
      ? deck.temporaryCards.filter((id) => id !== returned.id)
      : deck.temporaryCards,
  };
}

export interface GeneralCaptureEffectInput {
  readonly money: number;
  readonly generalMoneyAwarded: number;
  readonly generalMoneyCap: number;
  readonly sourceId: string;
  readonly capturedCount: number;
  readonly triggeredSources: readonly string[];
}

export interface GeneralCaptureEffectResult {
  readonly money: number;
  readonly generalMoneyAwarded: number;
  readonly awarded: number;
  readonly triggeredSources: readonly string[];
}

export function resolveGeneralCaptureEffect(
  input: GeneralCaptureEffectInput,
): GeneralCaptureEffectResult {
  if (input.capturedCount <= 0 || input.triggeredSources.includes(input.sourceId)) {
    return { ...input, awarded: 0 };
  }
  const awarded = Math.max(0, Math.min(5, input.generalMoneyCap - input.generalMoneyAwarded));
  return {
    money: input.money + awarded,
    generalMoneyAwarded: input.generalMoneyAwarded + awarded,
    awarded,
    triggeredSources: [...input.triggeredSources, input.sourceId],
  };
}

export function startCavalryInspection(
  deck: DeckState,
  previousOwnMoveCaptured: boolean,
): readonly StoneCard[] {
  return previousOwnMoveCaptured ? inspectTop(deck, Math.min(2, deck.drawPile.length)) : [];
}

export interface CavalryExchangeInput {
  readonly takenCardId: string;
  readonly discardedCardId: string;
}

export function resolveCavalryExchange(
  deck: DeckState,
  inspectedIds: readonly string[],
  input: CavalryExchangeInput,
): DeckState {
  const inspected = assertExactPrefix(deck, inspectedIds, 2);
  const taken = inspected.find(({ id }) => id === input.takenCardId);
  if (taken === undefined) throw new RangeError('taken card must be inspected');
  const handAfterTake = [...deck.hand, taken];
  const discarded = handAfterTake.find(({ id }) => id === input.discardedCardId);
  if (discarded === undefined) throw new RangeError('discarded card must be in hand after taking');
  return {
    ...deck,
    hand: handAfterTake.filter(({ id }) => id !== discarded.id),
    drawPile: [
      ...inspected.filter(({ id }) => id !== taken.id),
      ...deck.drawPile.slice(inspected.length),
    ],
    discardPile: discarded.temporary ? deck.discardPile : [...deck.discardPile, discarded],
    temporaryCards: discarded.temporary
      ? deck.temporaryCards.filter((id) => id !== discarded.id)
      : deck.temporaryCards,
  };
}

export function hasAdjacentEndangeredGroup(
  boardBeforePlacement: BoardState,
  point: number,
  color: StoneColor,
): boolean {
  const checked = new Set<number>();
  for (const adjacent of neighbors(boardBeforePlacement.size, point)) {
    const adjacentStone = boardBeforePlacement.points[adjacent];
    if (adjacentStone === null || adjacentStone.color !== color || checked.has(adjacent)) continue;
    const group = groupAt(boardBeforePlacement, adjacent);
    group.forEach((member) => checked.add(member));
    if (libertiesOf(boardBeforePlacement, group).length <= 2) return true;
  }
  return false;
}

export function candidatePlacementTriggersEffect(
  board: BoardState,
  point: number,
  color: StoneColor,
  kind: StoneKind,
  capturedCount: number,
): boolean {
  if (kind === 'STONE-002') return true;
  if (kind === 'STONE-003') return capturedCount > 0;
  if (kind === 'STONE-005') return hasAdjacentEndangeredGroup(board, point, color);
  return false;
}

export type StoneRemovalCause = 'opponent-placement' | 'suicide' | 'voluntary-effect';

export function resolveSacrificeEffects(
  capturedStones: readonly Stone[],
  cause: StoneRemovalCause,
): readonly HandLimitModifier[] {
  if (cause !== 'opponent-placement') return [];
  return capturedStones
    .filter((captured) => captured.kind === 'STONE-006')
    .map((captured) => ({
      sourceId: captured.instanceId,
      amount: 1,
      remainingTurns: 1,
    }));
}

export const STARTING_DECK: readonly StoneKind[] = [
  'STONE-001',
  'STONE-001',
  'STONE-001',
  'STONE-001',
  'STONE-001',
  'STONE-002',
  'STONE-003',
  'STONE-004',
  'STONE-005',
  'STONE-006',
];
