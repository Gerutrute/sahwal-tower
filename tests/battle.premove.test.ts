import { describe, expect, it } from 'vitest';

import { battleReducer, createBattleState, type BattleState } from '../src/game/battle';
import { createBoard } from '../src/game/go';
import { createSeededRng } from '../src/game/rng';
import { DRAFT_KOMI } from './fixtures/draft-battle-config';

function create(options: { charm?: boolean; relic?: boolean } = {}): BattleState {
  return createBattleState({
    act: 1,
    board: createBoard(7),
    playerDeck: ['STONE-001', 'STONE-002', 'STONE-003', 'STONE-004'],
    enemyDeck: ['STONE-001', 'STONE-002', 'STONE-003', 'STONE-004'],
    enemy: { id: 'PREMOVE-ENEMY' },
    komi: DRAFT_KOMI,
    playerCharms: options.charm ? ['ITEM-001'] : [],
    playerRelics: options.relic ? ['RELIC-001'] : [],
    rng: createSeededRng('premove-create'),
    maxHandSize: 8,
  });
}

describe('선택형 pre-move 흐름', () => {
  it('부적과 유물이 모두 없으면 BEGIN_TURN 직후 카드 선택으로 간다', () => {
    expect(battleReducer(create(), { type: 'BEGIN_TURN' }).phase).toBe('choose-card');
  });

  it('부적 또는 유물을 보유하면 pre-move를 유지한다', () => {
    expect(battleReducer(create({ charm: true }), { type: 'BEGIN_TURN' }).phase).toBe('pre-move');
    expect(battleReducer(create({ relic: true }), { type: 'BEGIN_TURN' }).phase).toBe('pre-move');
  });

  it('pre-move에서 카드를 바로 선택하면 좌표 선택으로 전이한다', () => {
    const begun = battleReducer(create({ charm: true }), { type: 'BEGIN_TURN' });
    const selected = battleReducer(begun, { type: 'SELECT_CARD', cardId: begun.decks.B.hand[0].id });

    expect(selected.phase).toBe('choose-point');
    expect(selected.selectedCardId).toBe(begun.decks.B.hand[0].id);
  });

  it('부적 사용 뒤에도 별도 확인 없이 카드를 선택할 수 있다', () => {
    const begun = battleReducer(create({ charm: true }), { type: 'BEGIN_TURN' });
    const used = battleReducer(begun, { type: 'USE_CHARM', charmId: 'ITEM-001' });
    const selected = battleReducer(used, { type: 'SELECT_CARD', cardId: used.decks.B.hand[0].id });

    expect(used.phase).toBe('pre-move');
    expect(selected.phase).toBe('choose-point');
  });

  it('합법 카드 수가 없으면 기존 자동 패스를 유지한다', () => {
    const state = create();
    const emptyHand = {
      ...state,
      decks: { ...state.decks, B: { ...state.decks.B, hand: [] } },
    };
    const next = battleReducer(emptyHand, { type: 'BEGIN_TURN' });

    expect(next).toMatchObject({ turn: 'W', phase: 'turn-start', consecutivePasses: 1 });
    expect(next.log.at(-1)).toMatchObject({ type: 'pass', automatic: true });
  });
});
