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
}

export const STONE_DEFINITIONS: Readonly<Record<StoneKind, StoneDefinition>> = {
  'STONE-001': { id: 'STONE-001', name: '일반석', effect: null },
  'STONE-002': {
    id: 'STONE-002',
    name: '척후석',
    effect: { trigger: 'after-placement', priority: 8, perMoveLimit: 1 },
  },
  'STONE-003': {
    id: 'STONE-003',
    name: '장군석',
    effect: { trigger: 'capture-success', priority: 7, perMoveLimit: 1 },
  },
  'STONE-004': {
    id: 'STONE-004',
    name: '기병석',
    effect: { trigger: 'card-entered-hand', priority: 8, perMoveLimit: 1 },
  },
  'STONE-005': {
    id: 'STONE-005',
    name: '수호석',
    effect: { trigger: 'adjacent-endangered-group', priority: 6, perMoveLimit: 1 },
  },
  'STONE-006': {
    id: 'STONE-006',
    name: '희생석',
    effect: { trigger: 'captured-by-opponent-placement', priority: 4, perMoveLimit: 1 },
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

function reorderInspected(
  deck: DeckState,
  inspected: readonly StoneCard[],
  orderedIds: readonly string[],
): DeckState {
  if (orderedIds.length !== inspected.length) {
    throw new RangeError('reordered cards must contain every inspected card');
  }
  const inspectedById = new Map(inspected.map((card) => [card.id, card]));
  const reordered = orderedIds.map((id) => inspectedById.get(id));
  if (reordered.some((card) => card === undefined) || new Set(orderedIds).size !== orderedIds.length) {
    throw new RangeError('reordered cards must be a permutation of inspected cards');
  }
  return {
    ...deck,
    drawPile: [...reordered as StoneCard[], ...deck.drawPile.slice(inspected.length)],
  };
}

export interface ScoutEffectResult {
  readonly deck: DeckState;
  readonly inspected: readonly StoneCard[];
  readonly triggered: boolean;
  readonly triggeredSources: readonly string[];
}

export function resolveScoutEffect(
  deck: DeckState,
  orderedIds: readonly string[],
  triggeredSources: readonly string[],
  sourceId = 'STONE-002',
): ScoutEffectResult {
  if (triggeredSources.includes(sourceId)) {
    return { deck, inspected: [], triggered: false, triggeredSources };
  }
  const inspected = inspectTop(deck, 2);
  return {
    deck: reorderInspected(deck, inspected, orderedIds),
    inspected,
    triggered: true,
    triggeredSources: [...triggeredSources, sourceId],
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

export interface DeckInspectionEffectResult {
  readonly deck: DeckState;
  readonly inspected: readonly StoneCard[];
  readonly triggered: boolean;
  readonly extraMoves: 0;
}

export function resolveCavalryEffect(
  deck: DeckState,
  previousOwnMoveCaptured: boolean,
): DeckInspectionEffectResult {
  return {
    deck,
    inspected: previousOwnMoveCaptured ? inspectTop(deck, 1) : [],
    triggered: previousOwnMoveCaptured,
    extraMoves: 0,
  };
}

export function resolveGuardianEffect(
  boardBeforePlacement: BoardState,
  point: number,
  color: StoneColor,
  deck: DeckState,
): DeckInspectionEffectResult {
  const checked = new Set<number>();
  let endangered = false;
  for (const adjacent of neighbors(boardBeforePlacement.size, point)) {
    const adjacentStone = boardBeforePlacement.points[adjacent];
    if (adjacentStone === null || adjacentStone.color !== color || checked.has(adjacent)) continue;
    const group = groupAt(boardBeforePlacement, adjacent);
    group.forEach((member) => checked.add(member));
    if (libertiesOf(boardBeforePlacement, group).length <= 2) endangered = true;
  }
  return {
    deck,
    inspected: endangered ? inspectTop(deck, 2) : [],
    triggered: endangered,
    extraMoves: 0,
  };
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
  'STONE-001',
  'STONE-002',
  'STONE-005',
  'STONE-006',
  'STONE-003',
];
