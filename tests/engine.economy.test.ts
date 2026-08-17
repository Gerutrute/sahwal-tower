import { describe, expect, it } from 'vitest';
import {
  START_POUCH,
  aiTurn,
  applyRelic,
  boardKey,
  idx,
  newRun,
  playerMove,
  playerPass,
  startBattle,
  type BattleState,
  type Cell,
} from '../src/engine';

const withBoard = (state: BattleState, board: Cell[]): BattleState => ({
  ...state,
  board,
  history: [boardKey(board)],
});

describe('주머니 경제와 승패', () => {
  it('시작 주머니는 28이고 상한이 없다', () => {
    const run = applyRelic(applyRelic(newRun(), 'pouch7'), 'pouch7');
    expect(START_POUCH).toBe(28);
    expect(run.pouch).toBe(42);
  });

  it('B 착수는 -1, 포획은 +n이다', () => {
    const base = startBattle(newRun(), 1);
    const board = Array<Cell>(49).fill(null);
    board[idx(0, 0)] = 'W'; board[idx(1, 0)] = 'B';
    const next = playerMove(withBoard({ ...base, kingW: idx(1, 3) }, board), idx(0, 1));
    expect(next.pouchB).toBe(START_POUCH);
    expect(next.capturedW).toBe(1);
  });

  // AC의 -t 패턴에서 `+`가 정규식 수량자로 해석되는 경우에도 같은 계약을 실행한다.
  it('B 착수는 -1, 포획은 n이다', () => {
    const base = startBattle(newRun(), 1);
    const board = Array<Cell>(49).fill(null);
    board[idx(0, 0)] = 'W'; board[idx(1, 0)] = 'B';
    const next = playerMove(withBoard({ ...base, kingW: idx(1, 3) }, board), idx(0, 1));
    expect(next.pouchB).toBe(START_POUCH);
    expect(next.capturedW).toBe(1);
  });

  it('recover 보유 시 포획 회수가 2배다', () => {
    const base = startBattle({ ...newRun(), relics: ['recover'] }, 1);
    const board = Array<Cell>(49).fill(null);
    board[idx(0, 0)] = 'W'; board[idx(1, 0)] = 'B';
    const next = playerMove(withBoard({ ...base, kingW: idx(1, 3) }, board), idx(0, 1));
    expect(next.pouchB).toBe(START_POUCH + 1);
  });

  it('soul 보유 시 잃은 돌의 ceil(n/2)를 환급한다', () => {
    const base = startBattle({ ...newRun(), relics: ['soul'] }, 1);
    const board = Array<Cell>(49).fill('R');
    board[idx(0, 0)] = 'B'; board[idx(0, 1)] = null;
    board[idx(1, 0)] = 'W'; board[idx(6, 6)] = 'B';
    const state = withBoard({ ...base, turn: 'W', kingB: idx(6, 6), kingW: idx(1, 0) }, board);
    const next = aiTurn(state, () => 0);
    expect(next.lostB).toBe(1);
    expect(next.pouchB).toBe(START_POUCH + 1);
  });

  it('W는 착수와 패스 모두 주머니를 1 소모한다', () => {
    const base = startBattle(newRun(), 1);
    const board = Array<Cell>(49).fill('R');
    board[idx(1, 3)] = 'W'; board[idx(5, 3)] = 'B';
    const next = aiTurn(withBoard({ ...base, turn: 'W' }, board), () => 0);
    expect(next.pouchW).toBe(19);
  });

  it('W턴 시작 시 주머니가 0 이하면 탈진 승리다', () => {
    const next = aiTurn({ ...startBattle(newRun(), 1), turn: 'W', pouchW: 0 }, () => 0);
    expect(next.status).toBe('win');
    expect(next.reason).toBe('exhaust');
  });

  it('W턴 종료 후 미결이고 B 주머니가 0 이하면 고갈 패배다', () => {
    const base = startBattle(newRun(), 1);
    const board = Array<Cell>(49).fill('R');
    board[idx(1, 3)] = 'W'; board[idx(5, 3)] = 'B';
    const next = aiTurn(withBoard({ ...base, turn: 'W', pouchB: 0 }, board), () => 0);
    expect(next.status).toBe('lose');
    expect(next.reason).toBe('depleted');
  });

  it('B 패스는 비용 0이며 tempo 잔여 연속수를 소멸시킨다', () => {
    const state = startBattle({ ...newRun(), relics: ['tempo'] }, 1);
    const next = playerPass(state);
    expect(next.pouchB).toBe(START_POUCH);
    expect(next.pendingB).toBe(0);
    expect(next.turn).toBe('W');
  });

  it('돌이 0개면 착수할 수 없다', () => {
    const state = { ...startBattle(newRun(), 1), pouchB: 0 };
    const next = playerMove(state, idx(0, 0));
    expect(next).toBe(state);
  });

  it('tempo 중 마지막 돌을 쓴 뒤 두 번째 돌을 무료로 둘 수 없다', () => {
    const state = { ...startBattle({ ...newRun(), relics: ['tempo'] }, 1), pouchB: 1 };
    const first = playerMove(state, idx(0, 0));
    const second = playerMove(first, idx(0, 1));
    expect(first.pouchB).toBe(0);
    expect(second).toBe(first);
    expect(second.board[idx(0, 1)]).toBeNull();
  });

  it('왕 그룹이 잡히면 승패가 결정된다', () => {
    const base = startBattle(newRun(), 1);
    const board = Array<Cell>(49).fill(null);
    board[idx(0, 0)] = 'W'; board[idx(1, 0)] = 'B';
    const next = playerMove(withBoard({ ...base, kingW: idx(0, 0) }, board), idx(0, 1));
    expect(next.status).toBe('win');
    expect(next.reason).toBe('king');
  });
});
