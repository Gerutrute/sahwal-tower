import { describe, expect, it } from 'vitest';
import {
  addTemporaryHandLimit,
  createDeckState,
  createStoneFromCard,
  discardUsed,
  drawToLimit,
  expireTemporaryHandLimits,
  passDeckTurn,
  resolveCardUse,
  type DeckState,
} from '../src/game/deck';
import { STARTING_DECK } from '../src/game/content/stones';
import { tryPlay } from '../src/game/go';
import { createSeededRng } from '../src/game/rng';
import type { BoardState, StoneKind } from '../src/game/types';

const allCards = (state: DeckState) => [
  ...state.drawPile,
  ...state.hand,
  ...state.discardPile,
];

describe('순환형 돌 덱', () => {
  it('10장에서 4장을 뽑는다', () => {
    const deckList = [...STARTING_DECK];
    const state = createDeckState(deckList, () => 0);

    expect(state.hand).toHaveLength(4);
    expect(state.drawPile).toHaveLength(6);
    expect(state.discardPile).toHaveLength(0);
    expect(new Set(allCards(state).map((card) => card.id)).size).toBe(10);
    expect(state.hand.map((card) => card.id)).not.toEqual(['card-1', 'card-2', 'card-3', 'card-4']);
    expect(deckList).toEqual(STARTING_DECK);
  });

  it('합법 착수 뒤에만 사용 카드를 버리고 보충한다', () => {
    const rng = createSeededRng('legal-placement');
    const state = createDeckState(STARTING_DECK, rng);
    const selected = state.hand[0];

    const illegal = resolveCardUse(state, selected.id, false, rng);
    const legal = resolveCardUse(state, selected.id, true, rng);

    expect(illegal).toBe(state);
    expect(legal.hand).toHaveLength(4);
    expect(legal.hand).not.toContainEqual(selected);
    expect(legal.discardPile).toContainEqual(selected);
    expect(state.hand).toContainEqual(selected);
  });

  it('패스는 카드를 소비하거나 보충하지 않는다', () => {
    const state = createDeckState(STARTING_DECK, createSeededRng('pass'));
    const before = structuredClone(state);

    const passed = passDeckTurn(state);

    expect(passed).toBe(state);
    expect(passed).toEqual(before);
  });

  it('뽑기 더미 소진 시 버림 더미를 같은 RNG 스트림으로 재현 가능하게 섞는다', () => {
    const initial = createDeckState(STARTING_DECK, createSeededRng('initial'));
    const depleted: DeckState = {
      ...initial,
      hand: initial.hand.slice(0, 3),
      drawPile: [],
      discardPile: [...initial.drawPile, initial.hand[3]],
    };

    const first = drawToLimit(depleted, createSeededRng('reshuffle'));
    const second = drawToLimit(depleted, createSeededRng('reshuffle'));

    expect(first).toEqual(second);
    expect(first.hand).toHaveLength(4);
    expect(first.discardPile).toEqual([]);
    expect(first.drawPile).toHaveLength(6);
    expect(depleted.drawPile).toEqual([]);
  });

  it('카드 한 장은 순환하여 같은 병종 돌을 여러 개 만들며 판 위 돌과 독립적이다', () => {
    const rng = createSeededRng('single-card');
    const state = createDeckState(['STONE-003'], rng);
    const card = state.hand[0];
    const firstStone = createStoneFromCard(card, 'W', 'board-general-a');
    const recycled = discardUsed(state, card.id, rng);
    const secondStone = createStoneFromCard(recycled.hand[0], 'W', 'board-general-b');

    expect(recycled.hand[0]).toEqual(card);
    expect(firstStone.kind).toBe('STONE-003');
    expect(secondStone.kind).toBe('STONE-003');
    expect(firstStone.instanceId).not.toBe(secondStone.instanceId);
    expect(firstStone.instanceId).not.toBe(card.id);

    const points: BoardState['points'][number][] = Array(49).fill(null);
    points[0] = firstStone;
    points[7] = createStoneFromCard(card, 'B', 'capturing-support');
    const board: BoardState = { size: 7, points };
    const beforeDeck = structuredClone(recycled);
    const capture = tryPlay(
      board,
      1,
      createStoneFromCard(card, 'B', 'capturing-stone'),
      null,
    );

    expect(capture.ok).toBe(true);
    if (capture.ok) expect(capture.captured).toEqual([0]);
    expect(recycled).toEqual(beforeDeck);
  });

  it('영구 덱이 비면 임시 일반석을 만들고 사용 후 소멸시킨다', () => {
    const deckList: StoneKind[] = [];
    const rng = createSeededRng('empty-deck');
    const initial = createDeckState(deckList, rng);
    const firstTemporary = initial.hand[0];

    expect(firstTemporary).toMatchObject({ kind: 'STONE-001', temporary: true });
    expect(initial.temporaryCards).toContain(firstTemporary.id);
    expect(initial.drawPile).toEqual([]);
    expect(initial.discardPile).toEqual([]);

    const nextTurn = discardUsed(initial, firstTemporary.id, rng);
    const nextTemporary = nextTurn.hand[0];

    expect(nextTemporary).toMatchObject({ kind: 'STONE-001', temporary: true });
    expect(nextTemporary.id).not.toBe(firstTemporary.id);
    expect(allCards(nextTurn).map((card) => card.id)).not.toContain(firstTemporary.id);
    expect(nextTurn.temporaryCards).toEqual([nextTemporary.id]);
    expect(deckList).toEqual([]);
  });

  it('임시 패 한도 증가는 중첩되고 지정 턴 뒤 만료된다', () => {
    const rng = createSeededRng('hand-limit');
    const initial = createDeckState(STARTING_DECK, rng);
    const stacked = addTemporaryHandLimit(
      addTemporaryHandLimit(initial, { sourceId: 'first', amount: 1, remainingTurns: 1 }, rng),
      { sourceId: 'second', amount: 2, remainingTurns: 2 },
      rng,
    );

    expect(stacked.handLimit).toBe(7);
    expect(stacked.hand).toHaveLength(7);

    const afterOneTurn = expireTemporaryHandLimits(stacked);
    expect(afterOneTurn.handLimit).toBe(6);
    expect(afterOneTurn.hand).toHaveLength(7);

    const afterTwoTurns = expireTemporaryHandLimits(afterOneTurn);
    expect(afterTwoTurns.handLimit).toBe(4);
    expect(afterTwoTurns.hand).toHaveLength(7);
  });

  it('확정 STARTING_DECK은 일반석 6장과 지정 특수석 4장이다', () => {
    expect(STARTING_DECK).toEqual([
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
    ]);
  });
});
