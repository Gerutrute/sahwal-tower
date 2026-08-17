import { describe, expect, it } from 'vitest';
import {
  boardKey,
  getGroup,
  idx,
  legalMoves,
  libsOf,
  sweepDead,
  tryMove,
  type Board,
  type Cell,
} from '../src/engine';

const emptyBoard = (): Cell[] => Array<Cell>(49).fill(null);
const frozen = (cells: Cell[]): Board => cells;

describe('바둑 코어 규칙', () => {
  it('귀의 1점을 포획한다', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = 'W';
    board[idx(1, 0)] = 'B';
    const result = tryMove(frozen(board), idx(0, 1), 'B', [boardKey(board)]);
    expect(result.ok).toBe(true);
    expect(result.captured).toEqual([idx(0, 0)]);
    expect(result.board[idx(0, 0)]).toBeNull();
  });

  it('활로 0이 되는 자살수는 불법이다', () => {
    const board = emptyBoard();
    board[idx(0, 1)] = board[idx(1, 0)] = board[idx(1, 2)] = board[idx(2, 1)] = 'W';
    const before = [...board];
    const result = tryMove(board, idx(1, 1), 'B', [boardKey(board)]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('suicide');
    expect(result.board).toEqual(before);
    expect(board).toEqual(before);
  });

  it('포획이 발생하면 자살이 아니다', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = 'W';
    board[idx(1, 0)] = 'B';
    expect(tryMove(board, idx(0, 1), 'B', [boardKey(board)]).ok).toBe(true);
  });

  it('패의 즉시 되따냄은 superko로 불법이다', () => {
    const original = emptyBoard();
    original[idx(0, 1)] = 'W';
    original[idx(1, 0)] = 'W';
    original[idx(0, 2)] = 'B';
    original[idx(1, 1)] = 'B';
    const capture = tryMove(original, idx(0, 0), 'B', [boardKey(original)]);
    expect(capture.ok).toBe(true);
    const recapture = tryMove(capture.board, idx(0, 1), 'W', [boardKey(original), capture.key]);
    expect(recapture.ok).toBe(false);
    expect(recapture.reason).toBe('superko');
  });

  it('판 키는 49자이며 시작 상태부터 기록된다', () => {
    const board = emptyBoard();
    board[0] = 'R'; board[1] = 'B'; board[2] = 'W';
    expect(boardKey(board)).toHaveLength(49);
    expect(boardKey(board)).toMatch(/^[.BWR]{49}$/);
  });

  it('바위와 판 밖은 활로를 주지 않는다', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = 'B';
    board[idx(0, 1)] = 'R';
    expect(getGroup(board, idx(0, 0))).toEqual([idx(0, 0)]);
    expect(libsOf(board, idx(0, 0))).toBe(1);
  });

  it('여러 그룹을 동시에 잡을 때 중복 없이 제거한다', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = board[idx(0, 2)] = 'W';
    board[idx(1, 0)] = board[idx(1, 2)] = board[idx(0, 3)] = 'B';
    const result = tryMove(board, idx(0, 1), 'B', [boardKey(board)]);
    expect(result.ok).toBe(true);
    expect(new Set(result.captured).size).toBe(result.captured.length);
    expect(result.captured.sort((a, b) => a - b)).toEqual([idx(0, 0), idx(0, 2)]);
  });

  it('sweepDead는 W를 먼저 정리하고 재계산 후 B를 정리한다', () => {
    const board = Array<Cell>(49).fill('R');
    board[idx(0, 0)] = 'W'; board[idx(0, 1)] = board[idx(1, 0)] = board[idx(1, 1)] = 'B';
    const result = sweepDead(board);
    expect(result.removedW).toEqual([idx(0, 0)]); expect(result.removedB).toEqual([]);
    const reversed=[...board]; const removedB:number[]=[]; const seen=new Set<number>();
    for(let p=0;p<49;p++) if(reversed[p]==='B'&&!seen.has(p)){const group=getGroup(reversed,p);group.forEach((q)=>seen.add(q));if(libsOf(reversed,p)===0){removedB.push(...group);group.forEach((q)=>{reversed[q]=null})}}
    const removedW:number[]=[]; seen.clear();
    for(let p=0;p<49;p++) if(reversed[p]==='W'&&!seen.has(p)){const group=getGroup(reversed,p);group.forEach((q)=>seen.add(q));if(libsOf(reversed,p)===0){removedW.push(...group);group.forEach((q)=>{reversed[q]=null})}}
    expect(removedB.sort((a,b)=>a-b)).toEqual([idx(0,1),idx(1,0),idx(1,1)]); expect(removedW).toEqual([]);
    expect({removedW:result.removedW,removedB:result.removedB}).not.toEqual({removedW,removedB});
  });

  it('legalMoves는 불법수를 제외한다', () => {
    const board = emptyBoard();
    board[idx(0, 0)] = 'R'; board[idx(0, 1)]='B';
    expect(legalMoves(board, 'B', [boardKey(board)])).not.toContain(idx(0, 0));
    expect(legalMoves(board, 'B', [boardKey(board)])).not.toContain(idx(0, 1));
    const suicide=emptyBoard(); suicide[idx(0,1)]=suicide[idx(1,0)]=suicide[idx(1,2)]=suicide[idx(2,1)]='W';
    expect(legalMoves(suicide,'B',[boardKey(suicide)])).not.toContain(idx(1,1));
    const ko=emptyBoard(); ko[idx(0,1)]='W';ko[idx(1,0)]='W';ko[idx(0,2)]='B';ko[idx(1,1)]='B';
    const captured=tryMove(ko,idx(0,0),'B',[boardKey(ko)]); expect(captured.ok).toBe(true);
    expect(legalMoves(captured.board,'W',[boardKey(ko),captured.key])).not.toContain(idx(0,1));
  });
});
