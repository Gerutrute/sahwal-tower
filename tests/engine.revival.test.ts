import { describe, expect, it } from 'vitest';
import { applyRevival, boardKey, idx, newRun, reviveCandidates, reviveScore, startBattle, type Cell } from '../src/engine';

describe('불사왕 부활', () => {
  const removed = () => {
    const base = startBattle(newRun(), 3);
    const board = [...base.board] as Cell[];
    board[base.kingW!] = null;
    return { ...base, board, history:[boardKey(board)], kingW:null };
  };
  it('불사왕은 처음 제거될 때 1회 부활한다', () => {
    const next = applyRevival(removed());
    expect(next.revived).toBe(true);
    expect(next.status).toBe('playing');
    expect(next.kingW).not.toBeNull();
    expect(next.board[next.kingW!]).toBe('W');
  });
  it('부활 위치는 점수식 최대 지점이다', () => {
    const state = removed();
    const candidates = reviveCandidates(state);
    const expected = [...candidates].sort((a,b) => reviveScore(state,b)-reviveScore(state,a) || a-b)[0];
    expect(applyRevival(state).kingW).toBe(expected);
  });
  it('부활은 무료이며 이력에 push된다', () => {
    const state = removed(); const next = applyRevival(state);
    expect(next.pouchW).toBe(state.pouchW);
    expect(next.history).toHaveLength(state.history.length+1);
  });
  it('부활한 왕이 다시 제거되면 승리한다', () => {
    const state = { ...removed(), revived:true };
    const next = applyRevival(state);
    expect(next.status).toBe('win');
    expect(next.reason).toBe('king');
  });
  it('부활 후보가 없으면 즉시 승리한다', () => {
    const state = removed(); const board = Array<Cell>(49).fill('R');
    const next = applyRevival({ ...state, board, history:[boardKey(board)] });
    expect(next.status).toBe('win');
  });
  it('부활 점수 동점이면 인덱스가 작은 칸을 고른다', () => {
    const state = removed(); const next = applyRevival(state);
    const best = Math.max(...reviveCandidates(state).map((p)=>reviveScore(state,p)));
    expect(next.kingW).toBe(Math.min(...reviveCandidates(state).filter((p)=>reviveScore(state,p)===best)));
  });
});
