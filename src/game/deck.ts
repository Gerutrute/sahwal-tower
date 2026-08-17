import { shuffle } from './rng';
import type { RandomSource } from './rng';
import type { Stone, StoneColor, StoneKind } from './types';

export interface StoneCard {
  readonly id: string;
  readonly kind: StoneKind;
  readonly temporary: boolean;
}

export interface DeckState {
  readonly drawPile: readonly StoneCard[];
  readonly hand: readonly StoneCard[];
  readonly discardPile: readonly StoneCard[];
  readonly temporaryCards: readonly string[];
  readonly baseHandLimit: number;
  readonly handLimit: number;
  readonly handLimitModifiers: readonly HandLimitModifier[];
  readonly nextCardId: number;
}

export interface HandLimitModifier {
  readonly sourceId: string;
  readonly amount: number;
  readonly remainingTurns: number;
}

const INITIAL_HAND_LIMIT = 4;

export function createDeckState(
  deckList: readonly StoneKind[],
  rng: RandomSource,
): DeckState {
  const cards = deckList.map<StoneCard>((kind, index) => ({
    id: `card-${index + 1}`,
    kind,
    temporary: false,
  }));
  const shuffled = shuffle(cards, rng);
  return drawToLimit({
    drawPile: shuffled,
    hand: [],
    discardPile: [],
    temporaryCards: [],
    baseHandLimit: INITIAL_HAND_LIMIT,
    handLimit: INITIAL_HAND_LIMIT,
    handLimitModifiers: [],
    nextCardId: cards.length + 1,
  }, rng);
}

export function reshuffle(state: DeckState, rng: RandomSource): DeckState {
  if (state.drawPile.length > 0 || state.discardPile.length === 0) return state;
  return {
    ...state,
    drawPile: shuffle(state.discardPile, rng),
    discardPile: [],
  };
}

function addTemporaryNormalStone(state: DeckState): DeckState {
  const temporary: StoneCard = {
    id: `temporary-${state.nextCardId}`,
    kind: 'STONE-001',
    temporary: true,
  };
  return {
    ...state,
    hand: [...state.hand, temporary],
    temporaryCards: [...state.temporaryCards, temporary.id],
    nextCardId: state.nextCardId + 1,
  };
}

export function drawToLimit(state: DeckState, rng: RandomSource): DeckState {
  let next: DeckState = state;

  while (next.hand.length < next.handLimit) {
    if (next.drawPile.length === 0) {
      next = reshuffle(next, rng);
      if (next.drawPile.length === 0) {
        return next.hand.length === 0 ? addTemporaryNormalStone(next) : next;
      }
    }

    const [drawn, ...remaining] = next.drawPile;
    next = {
      ...next,
      drawPile: remaining,
      hand: [...next.hand, drawn],
    };
  }

  return next;
}

export function discardUsed(
  state: DeckState,
  cardId: string,
  rng: RandomSource,
): DeckState {
  const card = state.hand.find((candidate) => candidate.id === cardId);
  if (card === undefined) throw new RangeError(`card is not in hand: ${cardId}`);

  const afterUse: DeckState = {
    ...state,
    hand: state.hand.filter((candidate) => candidate.id !== cardId),
    discardPile: card.temporary ? state.discardPile : [...state.discardPile, card],
    temporaryCards: card.temporary
      ? state.temporaryCards.filter((temporaryId) => temporaryId !== cardId)
      : state.temporaryCards,
  };
  return drawToLimit(afterUse, rng);
}

export function resolveCardUse(
  state: DeckState,
  cardId: string,
  placementSucceeded: boolean,
  rng: RandomSource,
): DeckState {
  return placementSucceeded ? discardUsed(state, cardId, rng) : state;
}

export function passDeckTurn(state: DeckState): DeckState {
  return state;
}

export function createStoneFromCard(
  card: StoneCard,
  color: StoneColor,
  instanceId: string,
): Stone {
  return { color, kind: card.kind, instanceId };
}

function handLimitFor(
  baseHandLimit: number,
  modifiers: readonly HandLimitModifier[],
): number {
  return baseHandLimit + modifiers.reduce((total, modifier) => total + modifier.amount, 0);
}

export function addTemporaryHandLimit(
  state: DeckState,
  modifier: HandLimitModifier,
  rng: RandomSource,
): DeckState {
  if (!Number.isSafeInteger(modifier.amount) || modifier.amount <= 0) {
    throw new RangeError('hand limit modifier amount must be a positive integer');
  }
  if (!Number.isSafeInteger(modifier.remainingTurns) || modifier.remainingTurns <= 0) {
    throw new RangeError('hand limit modifier remainingTurns must be a positive integer');
  }

  const handLimitModifiers = [...state.handLimitModifiers, { ...modifier }];
  return drawToLimit({
    ...state,
    handLimitModifiers,
    handLimit: handLimitFor(state.baseHandLimit, handLimitModifiers),
  }, rng);
}

export function expireTemporaryHandLimits(state: DeckState): DeckState {
  const handLimitModifiers = state.handLimitModifiers
    .map((modifier) => ({ ...modifier, remainingTurns: modifier.remainingTurns - 1 }))
    .filter((modifier) => modifier.remainingTurns > 0);
  return {
    ...state,
    handLimitModifiers,
    handLimit: handLimitFor(state.baseHandLimit, handLimitModifiers),
  };
}
