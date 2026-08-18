import { describe, expect, it } from 'vitest';

import { battleReducer, createBattleState } from '../src/game/battle';
import { createBoard } from '../src/game/go';
import type { StoneCard } from '../src/game/deck';

const card = (id: string, kind: StoneCard['kind']): StoneCard => ({ id, kind, temporary: false });

function guardianBattle() {
  const points = [...createBoard(7).points];
  points[1] = { color: 'B' as const, kind: 'STONE-001' as const, instanceId: 'friend' };
  points[2] = { color: 'W' as const, kind: 'STONE-001' as const, instanceId: 'block-right' };
  points[8] = { color: 'W' as const, kind: 'STONE-001' as const, instanceId: 'block-down' };
  const state = createBattleState({
    act: 1, board: { size: 7, points }, playerDeck: ['STONE-001'], enemyDeck: ['STONE-001'],
    enemy: { id: 'protection-test' }, komi: 6.5, rng: () => 0, maxHandSize: 8,
  });
  return {
    ...state,
    phase: 'choose-point' as const,
    selectedCardId: 'guardian',
    decks: { ...state.decks, B: {
      ...state.decks.B,
      hand: [card('guardian', 'STONE-005'), card('h1', 'STONE-001'), card('h2', 'STONE-001'), card('h3', 'STONE-001')],
      drawPile: [card('d1', 'STONE-001')],
    } },
  };
}

describe('수호 보호 토큰', () => {
  it('수호석은 위기 그룹에 수호 1회를 부여한다', () => {
    const next = battleReducer(guardianBattle(), { type: 'PLAY_CARD', point: 0, rng: () => 0 });
    expect(next.protections).toHaveLength(1);
    expect(next.protections[0]).toMatchObject({ color: 'B' });
    expect(new Set(next.protections[0].memberInstanceIds)).toEqual(new Set(['friend', 'battle-1']));
  });

  it('보호 그룹 포획 착수 전체를 무효화하고 카드와 토큰만 소비한다', () => {
    let protectedState = battleReducer(guardianBattle(), { type: 'PLAY_CARD', point: 0, rng: () => 0 });
    protectedState = battleReducer(battleReducer(protectedState, { type: 'RESOLVE_MOVE' }), { type: 'END_TURN' });
    const enemyCard = protectedState.decks.W.hand[0];
    const ready = { ...protectedState, phase: 'choose-point' as const, selectedCardId: enemyCard.id, koForbiddenKey: 'unchanged-ko' };
    const boardBefore = ready.board;
    const next = battleReducer(ready, { type: 'PLAY_CARD', point: 7, rng: () => 0 });
    expect(next.board).toBe(boardBefore);
    expect(next.koForbiddenKey).toBe('unchanged-ko');
    expect(next.protections).toEqual([]);
    expect(next.decks.W).not.toBe(ready.decks.W);
    expect(next.selectedCardId).toBeNull();
    expect(next.previousCaptureBy.W).toBe(false);
    expect(next.log.at(-1)).toMatchObject({ type: 'effect', message: '수호 효과가 포획을 무효화했습니다.' });
  });

  it('상대의 정상 착수에는 만료되고 패스에는 남는다', () => {
    let protectedState = battleReducer(guardianBattle(), { type: 'PLAY_CARD', point: 0, rng: () => 0 });
    protectedState = battleReducer(battleReducer(protectedState, { type: 'RESOLVE_MOVE' }), { type: 'END_TURN' });
    const passed = battleReducer({ ...protectedState, phase: 'choose-card' }, { type: 'PASS' });
    expect(passed.protections).toHaveLength(1);
    const enemyCard = protectedState.decks.W.hand[0];
    const normal = battleReducer({ ...protectedState, phase: 'choose-point', selectedCardId: enemyCard.id }, {
      type: 'PLAY_CARD', point: 48, rng: () => 0,
    });
    expect(normal.protections).toEqual([]);
  });

  it('여러 토큰이 교차하면 가장 오래된 토큰 하나만 고른다', async () => {
    const { captureNegatedBy } = await import('../src/game/battle');
    const board = guardianBattle().board;
    const tokens = [
      { id: 'new', color: 'B' as const, memberInstanceIds: ['friend'], grantedAtMove: 5 },
      { id: 'old', color: 'B' as const, memberInstanceIds: ['friend'], grantedAtMove: 2 },
    ];
    expect(captureNegatedBy(board, [1], tokens, 'W')?.id).toBe('old');
  });

  it('보호·비보호 그룹의 혼합 포획도 전체 무효화하고 선택되지 않은 토큰은 보존한다', async () => {
    const { captureNegatedBy } = await import('../src/game/battle');
    const base = guardianBattle();
    const mixedPoints = [...base.board.points];
    mixedPoints[3] = { color: 'B', kind: 'STONE-001', instanceId: 'unprotected-friend' };
    const mixedBoard = { ...base.board, points: mixedPoints };
    const mixedTokens = [{
      id: 'protected-token',
      color: 'B' as const,
      memberInstanceIds: ['friend'],
      grantedAtMove: 1,
    }];
    expect(captureNegatedBy(mixedBoard, [1, 3], mixedTokens, 'W')?.id).toBe('protected-token');

    let protectedState = battleReducer(base, { type: 'PLAY_CARD', point: 0, rng: () => 0 });
    protectedState = battleReducer(battleReducer(protectedState, { type: 'RESOLVE_MOVE' }), { type: 'END_TURN' });
    const selected = protectedState.protections[0];
    const other = {
      id: 'other-token',
      color: 'B' as const,
      memberInstanceIds: ['unrelated-group'],
      grantedAtMove: selected.grantedAtMove + 1,
    };
    const enemyCard = protectedState.decks.W.hand[0];
    const ready = {
      ...protectedState,
      phase: 'choose-point' as const,
      selectedCardId: enemyCard.id,
      protections: [selected, other],
    };
    const negated = battleReducer(ready, { type: 'PLAY_CARD', point: 7, rng: () => 0 });
    expect(negated.protections).toEqual([other]);
    expect(negated.board).toBe(ready.board);
  });
});
