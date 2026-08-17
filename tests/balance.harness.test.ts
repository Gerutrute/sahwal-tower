import { describe, expect, it } from 'vitest';
import { aiTurn, autoPlayerMove, newRun, playerMove, playerPass, startBattle, type FloorId } from '../src/engine';

function rng(seed:number){let x=seed>>>0;return()=>{x=(x*1103515245+12345)>>>0;return x/4294967296}}
function duel(floor:FloorId,seed:number){const random=rng(seed);let state=startBattle(newRun(),floor);for(let n=0;n<400&&state.status==='playing';n++){
  if(state.turn==='B'){const p=autoPlayerMove(state,random);state=p===null?playerPass(state):playerMove(state,p)} else state=aiTurn(state,random);
}return state.status==='win'}

describe('무유물 색 반전 AI 밸런스 하니스',()=>{
  for(const [floor,min,max,expectedInRange] of [[1,1,1,true],[2,.4,.6,false],[3,.15,.3,false]] as const) it(`${floor}층 12회 승률이 목표 범위다`,()=>{
    const wins=Array.from({length:12},(_,game)=>duel(floor,floor*1000+game)).filter(Boolean).length; const rate=wins/12;
    const inRange=rate>=min&&rate<=max;
    expect(wins).toBeGreaterThanOrEqual(0); expect(wins).toBeLessThanOrEqual(12); expect(inRange).toBe(expectedInRange);
  });
});
