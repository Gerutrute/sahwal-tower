import { describe, expect, it } from 'vitest';
import { FLOORS, aiTurn, boardKey, idx, newRun, startBattle, type Cell } from '../src/engine';

describe('층 데이터와 기믹', () => {
  it('층 데이터는 확정값과 정확히 일치한다', () => {
    expect(FLOORS[1]).toMatchObject({ rocks: [], guardsW: [], pouchW: 20, kingW: idx(1, 3), kingB: idx(5, 3) });
    expect(FLOORS[2]).toMatchObject({ rocks: [idx(2,2),idx(2,4),idx(4,2),idx(4,4)], guardsW: [idx(1,2),idx(1,4)], pouchW: 24 });
    expect(FLOORS[3]).toMatchObject({ rocks: [idx(3,3),idx(0,0),idx(0,6)], guardsW: [idx(1,2),idx(1,4)], pouchW: 30 });
  });
  it('왕돌은 전투 시작 시 배치된다', () => {
    for (const floor of [1,2,3] as const) {
      const state = startBattle(newRun(), floor);
      expect(state.board[state.kingW!]).toBe('W');
      expect(state.board[state.kingB!]).toBe('B');
      expect(state.history).toEqual([boardKey(state.board)]);
    }
  });
  it('골렘은 3의 배수 턴에 2연속 착수하며 각 수마다 -1이다', () => {
    const base = startBattle(newRun(), 2);
    const board = Array<Cell>(49).fill('R');
    board[idx(0,0)] = board[idx(0,1)] = board[idx(0,2)] = null;
    board[idx(1,3)] = 'W'; board[idx(5,3)] = 'B';
    const next = aiTurn({ ...base, board, history:[boardKey(board)], turn:'W', turnCountW:2 }, () => 0);
    expect(next.turnCountW).toBe(3);
    expect(next.pouchW).toBe(22);
  });
  it('골렘 2연타는 수 사이에 승패를 판정하고 결정되면 두 번째 수를 두지 않는다', () => {
    const base = startBattle(newRun(), 2);
    const board = Array<Cell>(49).fill('R');
    board[idx(0,0)] = 'B'; board[idx(1,0)] = 'W'; board[idx(0,1)] = null;
    const next = aiTurn({ ...base, board, history:[boardKey(board)], kingB:idx(0,0), kingW:idx(1,0), turn:'W', turnCountW:2 }, () => 0);
    expect(next.status).toBe('lose');
    expect(next.pouchW).toBe(23);
  });

  it('골렘은 남은 적 돌로 비용을 낼 수 있는 수만 둔다', () => {
    const base = startBattle(newRun(), 2);
    const board = Array<Cell>(49).fill('R');
    board[idx(0,0)] = board[idx(0,1)] = board[idx(0,2)] = null;
    board[idx(1,3)] = 'W'; board[idx(5,3)] = 'B';
    const next = aiTurn({ ...base, board, history:[boardKey(board)], turn:'W', turnCountW:2, pouchW:1 }, () => 0);
    expect(next.pouchW).toBe(0);
    expect(next.board.filter((cell) => cell === 'W')).toHaveLength(2);
  });
});
