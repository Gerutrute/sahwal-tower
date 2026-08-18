import { describe, expect, it } from 'vitest';

import { battleReducer, createBattleState } from '../src/game/battle';
import { createBoard } from '../src/game/go';
import type { StoneCard } from '../src/game/deck';
import { addTemporaryHandLimit } from '../src/game/deck';
import { startCavalryInspection } from '../src/game/content/stones';

const card = (id: string, kind: StoneCard['kind']): StoneCard => ({ id, kind, temporary: false });

function generalCaptureBattle() {
  const points = [...createBoard(7).points];
  points[1] = { color: 'W' as const, kind: 'STONE-001' as const, instanceId: 'target' };
  points[2] = { color: 'B' as const, kind: 'STONE-001' as const, instanceId: 'right' };
  points[8] = { color: 'B' as const, kind: 'STONE-001' as const, instanceId: 'down' };
  const state = createBattleState({
    act: 1,
    board: { size: 7, points },
    playerDeck: ['STONE-001'],
    enemyDeck: ['STONE-001'],
    enemy: { id: 'test' },
    komi: 6.5,
    rng: () => 0,
    maxHandSize: 5,
  });
  return {
    ...state,
    phase: 'choose-point' as const,
    selectedCardId: 'general',
    decks: {
      ...state.decks,
      B: {
        ...state.decks.B,
        hand: [card('general', 'STONE-003'), card('h1', 'STONE-001'), card('h2', 'STONE-001'), card('h3', 'STONE-001')],
        drawPile: [card('d1', 'STONE-001'), card('d2', 'STONE-001'), card('d3', 'STONE-001')],
        discardPile: [],
      },
    },
  };
}

describe('전투 병종 효과', () => {
  it('희생석 패 한도 증가는 다음 내 턴이 끝나면 만료된다', () => {
    const base = generalCaptureBattle();
    const boosted = addTemporaryHandLimit(base.decks.B, { sourceId: 'sacrifice', amount: 1, remainingTurns: 1 }, () => 0);
    const ready = { ...base, phase: 'turn-end' as const, turn: 'B' as const, decks: { ...base.decks, B: boosted } };
    const ended = battleReducer(ready, { type: 'END_TURN' });
    expect(ended.decks.B.handLimit).toBe(ended.decks.B.baseHandLimit);
    expect(ended.decks.B.hand).toHaveLength(boosted.hand.length);

    const passed = battleReducer({ ...ready, phase: 'choose-card' as const }, { type: 'PASS' });
    expect(passed.decks.B.handLimit).toBe(passed.decks.B.baseHandLimit);
  });

  it('장군석 포획은 안전 상한 안에서 즉시 카드 1장을 더 뽑는다', () => {
    const next = battleReducer(generalCaptureBattle(), { type: 'PLAY_CARD', point: 0, rng: () => 0 });
    expect(next.decks.B.hand).toHaveLength(next.decks.B.handLimit + 1);
    expect(next.log.at(-1)).toMatchObject({ type: 'effect' });
  });

  it('기병석은 직전 포획 뒤 손패에 들어오면 교환을 제안한다', () => {
    const base = generalCaptureBattle();
    const initial = {
      ...base,
      selectedCardId: 'normal',
      decks: { ...base.decks, B: {
        ...base.decks.B,
        hand: [card('normal', 'STONE-001'), ...base.decks.B.hand.slice(1)],
        drawPile: [card('cavalry', 'STONE-004'), card('d2', 'STONE-001'), card('d3', 'STONE-001')],
      } },
    };
    const next = battleReducer(initial, { type: 'PLAY_CARD', point: 0, rng: () => 0 });
    expect(next.previousCaptureBy.B).toBe(true);
    expect(next.decks.B.hand.some(({ id }) => id === 'cavalry')).toBe(true);
    expect(startCavalryInspection(next.decks.B, next.previousCaptureBy.B)).toHaveLength(2);
  });

  it('장군 추가 드로우는 안전 상한과 카드 재고를 지킨다', () => {
    const capped = { ...generalCaptureBattle(), maxHandSize: 4 };
    expect(battleReducer(capped, { type: 'PLAY_CARD', point: 0, rng: () => 0 }).decks.B.hand).toHaveLength(4);
    const empty = generalCaptureBattle();
    const noStock = { ...empty, decks: { ...empty.decks, B: {
      ...empty.decks.B,
      hand: [{ ...empty.decks.B.hand[0], temporary: true }, ...empty.decks.B.hand.slice(1)],
      drawPile: [], discardPile: [], temporaryCards: ['general'],
    } } };
    const next = battleReducer(noStock, { type: 'PLAY_CARD', point: 0, rng: () => 0 });
    expect(next.decks.B.hand).toHaveLength(3);
    expect(next.decks.B.temporaryCards).toEqual([]);
  });
});
