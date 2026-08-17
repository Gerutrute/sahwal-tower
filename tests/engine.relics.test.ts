import { describe, expect, it } from 'vitest';
import { RELICS, aiTurn, applyRelic, boardKey, detonateBomb, idx, newRun, offerRelics, playerMove, startBattle, toggleBomb, type Cell } from '../src/engine';

describe('유물', () => {
  it('유물 6종의 키와 이름이 명세와 일치한다', () => {
    expect(RELICS.map((r)=>[r.id,r.name,r.hanja])).toEqual([
      ['recover','회수의 손','回收'],['soul','사석의 혼','捨石'],['pouch7','두둑한 주머니','碁囊'],
      ['tempo','선수의 부채','先手'],['bomb','폭발석','爆石'],['guard','왕의 호위','護衛'],
    ]);
  });
  it('pouch7을 선택하면 주머니가 즉시 7 늘어난다',()=>expect(applyRelic(newRun(),'pouch7').pouch).toBe(35));
  it('tempo는 매 전투 첫 턴에 2연속 착수를 준다',()=>expect(startBattle({...newRun(),relics:['tempo']},1).pendingB).toBe(2));
  it('guard는 B왕 주위 위·왼쪽·오른쪽·아래 순 첫 빈 칸에 무료로 놓인다',()=>{
    const state=startBattle({...newRun(),relics:['guard']},1);
    expect(state.board[idx(4,3)]).toBe('B'); expect(state.pouchB).toBe(28);
  });
  it('bomb은 전투당 1회만 장전할 수 있다',()=>{
    const state=startBattle({...newRun(),relics:['bomb']},1); const armed=toggleBomb(state);
    expect(armed.bomb.armed).toBe(true); expect(toggleBomb({...armed,bomb:{armed:false,used:true,pos:idx(0,0)}})).toEqual({...armed,bomb:{armed:false,used:true,pos:idx(0,0)}});
  });
  it('폭발석 연쇄는 상하좌우 W 파괴 후 sweepDead하고 회수량을 합산한다',()=>{
    const base=startBattle({...newRun(),relics:['bomb','recover','soul']},1); const board=Array<Cell>(49).fill(null);
    board[idx(3,2)]='W'; board[idx(2,3)]='W';
    const state={...base,board,history:[boardKey(board)],kingW:idx(0,0),bomb:{armed:false,used:true,pos:idx(3,3)}};
    const next=detonateBomb(state);
    expect(next.board[idx(3,2)]).toBeNull(); expect(next.board[idx(2,3)]).toBeNull();
    expect(next.pouchB).toBe(base.pouchB+4);
  });
  it('미보유 유물 3개가 중복 없이 제시된다',()=>{
    const offer=offerRelics(['recover'],()=>0); expect(offer).toHaveLength(3); expect(new Set(offer).size).toBe(3); expect(offer).not.toContain('recover');
  });

  it('불법수가 거부되면 폭발석 장전이 소모되지 않는다', () => {
    const armed = toggleBomb(startBattle({ ...newRun(), relics: ['bomb'] }, 1));
    const next = playerMove(armed, armed.kingB!);
    expect(next.bomb).toEqual({ armed: true, used: false, pos: null });
    expect(next.pouchB).toBe(armed.pouchB);
  });

  it('폭발석으로 W왕이 제거되면 부활 또는 승리가 적용된다', () => {
    const base = startBattle({ ...newRun(), relics: ['bomb'] }, 1);
    const board = Array<Cell>(49).fill('R');
    board[idx(0,0)] = 'B'; board[idx(0,1)] = null; board[idx(1,0)] = 'W';
    const next = aiTurn({ ...base, board, history:[boardKey(board)], turn:'W', kingB:idx(0,0), kingW:idx(1,0), bomb:{armed:false,used:true,pos:idx(0,0)} }, () => 0);
    expect(next.status).toBe('win');
    expect(next.reason).toBe('king');
    const third=startBattle({...newRun(),relics:['bomb']},3); const revivalBoard=Array<Cell>(49).fill(null);
    revivalBoard[third.kingB!]='B'; revivalBoard[idx(3,2)]='W'; revivalBoard[idx(3,3)]='B';
    const revived=detonateBomb({...third,board:revivalBoard,history:[boardKey(revivalBoard)],kingW:idx(3,2),bomb:{armed:false,used:true,pos:idx(3,3)}});
    expect(revived.status).toBe('playing'); expect(revived.revived).toBe(true); expect(revived.kingW).not.toBeNull();
  });
});
