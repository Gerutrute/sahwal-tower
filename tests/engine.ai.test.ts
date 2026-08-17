import { describe, expect, it } from 'vitest';
import { aiTurn, boardKey, chooseAiMove, idx, mirrorState, newRun, scoreAiMove, startBattle, type Cell } from '../src/engine';

describe('적 AI 휴리스틱', () => {
  it('포획은 100n이고 B왕 포획은 100000이다', () => {
    const base = startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    board[idx(0,0)]='B'; board[idx(1,0)]='W'; board[idx(0,1)]=null;
    const state={...base,board,history:[boardKey(board)],kingB:idx(0,0),kingW:idx(1,0),turn:'W' as const};
    const withoutKing = scoreAiMove({ ...state, kingB: null }, idx(0,1), 0);
    expect(scoreAiMove(state,idx(0,1),0) - withoutKing).toBe(100027);
  });
  it('난수항은 rand()×6이며 주입 가능하다', () => {
    const state=startBattle(newRun(),1); const p=idx(3,3);
    expect(scoreAiMove(state,p,6)-scoreAiMove(state,p,0)).toBe(6);
  });
  it('chooseAiMove는 최대 점수 지점을 고른다', () => {
    const base=startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    board[idx(0,0)]='B'; board[idx(1,0)]='W'; board[idx(0,1)]=null; board[idx(6,6)]=null;
    const state={...base,board,history:[boardKey(board)],kingB:idx(0,0),kingW:idx(1,0),turn:'W' as const};
    expect(chooseAiMove(state,()=>0)).toBe(idx(0,1));
  });
  it('mirrorState는 판·이력·왕을 함께 반전한다', () => {
    const state=startBattle(newRun(),2); const twice=mirrorState(mirrorState(state));
    expect(twice.board).toEqual(state.board); expect(twice.history).toEqual(state.history);
    expect(twice.kingB).toBe(state.kingB); expect(twice.kingW).toBe(state.kingW);
  });

  it('결과 활로는 4L이고 활로1에 포획 2 미만이면 -150이다', () => {
    const base={...startBattle(newRun(),1),kingB:null,kingW:null};
    const open=Array<Cell>(49).fill(null);
    expect(scoreAiMove({...base,board:open,history:[boardKey(open)]},idx(3,3),0)).toBe(19);
    const one=Array<Cell>(49).fill('R'); one[idx(3,3)]=null; one[idx(3,2)]=null;
    expect(scoreAiMove({...base,board:one,history:[boardKey(one)]},idx(3,3),0)).toBe(-143);
  });

  it('사방이 W·바위·판 밖이면 -120이다', () => {
    const base={...startBattle(newRun(),1),kingB:null,kingW:null};
    const board=Array<Cell>(49).fill('R'); board[idx(3,3)]=null; board[idx(3,2)]='W'; board[idx(3,1)]=null;
    expect(scoreAiMove({...base,board,history:[boardKey(board)]},idx(3,3),0)).toBe(-260);
  });

  it('활로1 W그룹 구조는 60+크기×20이고 왕 포함 시 8000을 더한다', () => {
    const base=startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    board[idx(0,0)]='W'; board[idx(0,1)]=null; board[idx(0,2)]=null; board[idx(1,1)]=null;
    const state={...base,board,history:[boardKey(board)],kingB:null,kingW:null};
    expect(scoreAiMove({...state,kingW:idx(0,0)},idx(0,1),0)-scoreAiMove(state,idx(0,1),0)).toBe(8000);
  });

  it('결과 W왕 그룹이 단수면 -5000이다', () => {
    const base=startBattle(newRun(),1); const board=Array<Cell>(49).fill(null); board[idx(0,0)]='W'; board[idx(1,0)]='R';
    const state={...base,board,history:[boardKey(board)],kingB:null,kingW:null};
    expect(scoreAiMove({...state,kingW:idx(0,0)},idx(6,6),0)-scoreAiMove(state,idx(6,6),0)).toBe(-5000);
  });

  it('인접 B그룹 압박 점수가 명세와 일치한다', () => {
    const base=startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    board[idx(3,3)]=null; board[idx(3,2)]='B'; board[idx(3,1)]=null; board[idx(2,3)]=null;
    const state={...base,board,history:[boardKey(board)],kingB:null,kingW:null};
    expect(scoreAiMove(state,idx(3,3),0)).toBe(-85);
  });

  it('위치 보정 항이 명세와 일치한다', () => {
    const base={...startBattle(newRun(),1),kingB:null,kingW:null}; const board=Array<Cell>(49).fill(null);
    const state={...base,board,history:[boardKey(board)]};
    expect(scoreAiMove(state,idx(3,3),0)).toBe(19);
    expect(scoreAiMove(state,idx(0,0),0)).toBe(8);
  });

  it('합법수가 없으면 패스하고 주머니가 1 줄어든다', () => {
    const base=startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    const next=aiTurn({...base,board,history:[boardKey(board)],turn:'W'},()=>0);
    expect(next.pouchW).toBe(19); expect(next.turn).toBe('B');
  });
});
