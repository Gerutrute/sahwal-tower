import { describe, expect, it } from 'vitest';
import { aiTurn, applyRelic, autoPlayerMove, boardKey, finishFloor, idx, newRun, offerRelics, playerMove, playerPass, startBattle, type Cell, type FloorId, type RunState } from '../src/engine';

describe('런 진행',()=>{
  it('층 승리 시 주머니가 4 늘어난다',()=>{
    const run=newRun(); const battle={...startBattle(run,1),status:'win' as const,reason:'king' as const,pouchB:20};
    expect(finishFloor(run,battle).pouch).toBe(24);
  });
  it('승리 후 유물 3개 제시와 선택을 거쳐 다음 층으로 간다',()=>{
    const run=newRun(); const won=finishFloor(run,{...startBattle(run,1),status:'win',reason:'king'});
    const offer=offerRelics(won.relics,()=>0); const selected=applyRelic(won,offer[0]);
    expect(offer).toHaveLength(3); expect(selected.relics).toContain(offer[0]); expect(selected.floor).toBe(2);
  });

  it('층 승리 후 미보유 유물 3개가 중복 없이 제시된다', () => {
    const run=finishFloor(newRun(),{...startBattle(newRun(),1),status:'win',reason:'king'});
    const offered=offerRelics(run.relics,()=>0);
    expect(offered).toHaveLength(3); expect(new Set(offered).size).toBe(3);
  });

  it('3층 승리 후에는 유물 화면 없이 클리어한다', () => {
    const run:RunState={...newRun(),floor:3,clearedFloors:2};
    const done=finishFloor(run,{...startBattle(run,3),status:'win',reason:'king'});
    expect(done.clearedFloors).toBe(3); expect(done.floor).toBe(3);
  });

  it('3층까지 연속 승리하면 클리어 상태가 된다', () => {
    const complete=(initialSeed:number)=>{let seed=initialSeed;const random=()=>{seed=(seed*1103515245+12345)>>>0;return seed/4294967296};let run=newRun();
      for(const floor of [1,2,3] as FloorId[]){let battle=startBattle(run,floor);let turns=0;
        while(battle.status==='playing'&&turns++<400){if(battle.turn==='B'){const move=autoPlayerMove(battle,random);battle=move===null?playerPass(battle):playerMove(battle,move)}else battle=aiTurn(battle,random)}
        if(battle.status!=='win')return null;run=finishFloor(run,battle);if(floor<3){const offered=offerRelics(run.relics,random);run=applyRelic(run,offered[0])}}
      return run};
    const cleared=complete(33);
    expect(cleared?.clearedFloors).toBe(3);
  });

  it('B왕이 잡히면 런이 즉시 종료된다', () => {
    const base=startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    board[idx(0,0)]='B'; board[idx(1,0)]='W'; board[idx(0,1)]=null;
    const next=aiTurn({...base,board,history:[boardKey(board)],turn:'W',kingB:idx(0,0),kingW:idx(1,0)},()=>0);
    expect(next.status).toBe('lose'); expect(next.reason).toBe('king');
  });

  it('주머니가 고갈되면 런이 종료된다', () => {
    const base=startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    const next=aiTurn({...base,board,history:[boardKey(board)],turn:'W',pouchB:0},()=>0);
    expect(next.status).toBe('lose'); expect(next.reason).toBe('depleted');
  });

  it('유물을 건너뛰어도 다음 층으로 간다', () => {
    const won=finishFloor(newRun(),{...startBattle(newRun(),1),status:'win',reason:'king'});
    expect(startBattle(won,won.floor).floor).toBe(2); expect(won.relics).toEqual([]);
  });

  it('주머니는 층 사이에 유지된다', () => {
    const run=newRun(); const won=finishFloor(run,{...startBattle(run,1),status:'win',reason:'king',pouchB:17});
    expect(startBattle(won,2).pouchB).toBe(21);
  });
});
