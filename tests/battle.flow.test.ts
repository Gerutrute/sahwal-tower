import { describe, expect, it } from 'vitest';
import { battleReducer, createBattleState } from '../src/game/battle';
import { createBoard } from '../src/game/go';
import { createSeededRng } from '../src/game/rng';
import { chooseBattleAiMove, enumerateLegalAiMoves } from '../src/game/ai';
import type { Stone } from '../src/game/types';
import { DRAFT_BATTLE_DEFINITION, DRAFT_KOMI } from './fixtures/draft-battle-config';

describe('전투 상태 머신', () => {
  it('두 번째 패스 뒤 계가한다', () => {
    const initial = createBattleState({
      act: 1,
      board: createBoard(7),
      playerDeck: [],
      enemyDeck: [],
      enemy: DRAFT_BATTLE_DEFINITION,
      komi: DRAFT_KOMI,
      rng: createSeededRng('two-passes'),
    });

    const afterPlayerPass = battleReducer(initial, { type: 'PASS' });
    const afterEnemyPass = battleReducer(afterPlayerPass, { type: 'PASS' });

    expect(afterEnemyPass.phase).toBe('scoring');
    expect(afterEnemyPass.consecutivePasses).toBe(2);
  });

  it('부적은 pre-move에서만 쓰고 착수나 패스로 계산하지 않는다', () => {
    const rng = createSeededRng('relic-phase');
    const initial = createBattleState({
      act: 1,
      board: createBoard(7),
      playerDeck: ['STONE-001'],
      enemyDeck: ['STONE-001'],
      enemy: DRAFT_BATTLE_DEFINITION,
      komi: DRAFT_KOMI,
      playerRelics: ['RELIC-TEST'],
      rng,
    });
    const preMove = battleReducer(initial, { type: 'BEGIN_TURN' });
    const used = battleReducer(preMove, { type: 'USE_RELIC', relicId: 'RELIC-TEST' });
    const chooseCard = battleReducer(used, { type: 'CONTINUE_TO_MOVE' });
    const rejected = battleReducer(chooseCard, { type: 'USE_RELIC', relicId: 'RELIC-TEST' });

    expect(preMove.phase).toBe('pre-move');
    expect(used.phase).toBe('pre-move');
    expect(used.consecutivePasses).toBe(0);
    expect(used.decks.B).toBe(initial.decks.B);
    expect(rejected).toBe(chooseCard);

    const selected = battleReducer(chooseCard, {
      type: 'SELECT_CARD',
      cardId: chooseCard.decks.B.hand[0].id,
    });
    const played = battleReducer(selected, { type: 'PLAY_CARD', point: 0, rng });
    const resolved = battleReducer(played, { type: 'RESOLVE_MOVE' });
    expect(played.phase).toBe('resolving');
    expect(resolved.phase).toBe('turn-end');
    expect(battleReducer(played, { type: 'USE_RELIC', relicId: 'RELIC-TEST' })).toBe(played);
  });

  it('합법 수가 없으면 자동 패스하고 양쪽 자동 패스 뒤 종료한다', () => {
    const points: Stone[] = Array.from({ length: 49 }, (_, point) => ({
      color: 'B',
      kind: 'STONE-001' as const,
      instanceId: `full-${point}`,
    }));
    const initial = createBattleState({
      act: 1,
      board: { size: 7, points },
      playerDeck: ['STONE-001'],
      enemyDeck: ['STONE-001'],
      enemy: DRAFT_BATTLE_DEFINITION,
      komi: DRAFT_KOMI,
      rng: createSeededRng('automatic-pass'),
    });

    const first = battleReducer(initial, { type: 'BEGIN_TURN' });
    const second = battleReducer(first, { type: 'BEGIN_TURN' });

    expect(first.log.at(-1)).toMatchObject({ type: 'pass', actor: 'B', automatic: true });
    expect(second.log.at(-1)).toMatchObject({ type: 'pass', actor: 'W', automatic: true });
    expect(second.phase).toBe('scoring');
  });
});

describe('전수 평가 AI', () => {
  const board = createBoard(7);
  const hand = [
    { id: 'card-z', kind: 'STONE-001' as const, temporary: false },
    { id: 'card-a', kind: 'STONE-002' as const, temporary: false },
  ];

  it('패 순서 뒤 판 인덱스 순서로 모든 합법 조합을 한 번씩 평가한다', () => {
    const input = { board, color: 'W' as const, hand, koForbiddenKey: null };
    const legal = enumerateLegalAiMoves(input);
    const calls: string[] = [];
    const result = chooseBattleAiMove(input, (candidate) => {
      calls.push(`${candidate.card.id}:${candidate.point}`);
      return candidate.point - candidate.cardIndex * 100;
    }, () => { throw new Error('동점이 아니면 RNG를 쓰면 안 된다'); });

    expect(calls).toEqual(legal.map((candidate) => `${candidate.card.id}:${candidate.point}`));
    expect(new Set(calls).size).toBe(calls.length);
    expect(result.evaluatedCount).toBe(legal.length);
    expect(result.move).toMatchObject({ cardIndex: 0, point: 48 });
  });

  it('동점에서만 seeded RNG를 써서 같은 입력을 재현한다', () => {
    const input = { board, color: 'W' as const, hand: hand.slice(0, 1), koForbiddenKey: null };
    const first = chooseBattleAiMove(input, () => 0, createSeededRng('tie'));
    const second = chooseBattleAiMove(input, () => 0, createSeededRng('tie'));
    expect(first).toEqual(second);
  });
});
