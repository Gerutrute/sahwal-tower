import { describe, expect, it } from 'vitest';
import { aiTurn, legalMoves, newRun, playerMove, playerPass, startBattle, type BattleState, type FloorId } from '../src/engine';

function rng(seed:number){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}}
function play(floor:FloorId, seed:number){const random=rng(seed);let state=startBattle(newRun(),floor);let moves=0;
  while(state.status==='playing'&&moves<400){
    if(state.turn==='B'){const legal=legalMoves(state.board,'B',state.history);state=legal.length?playerMove(state,legal[Math.floor(random()*legal.length)]):playerPass(state)}
    else state=aiTurn(state,random);
    expect(state.pouchB).toBeGreaterThanOrEqual(0);expect(state.pouchW).toBeGreaterThanOrEqual(0);expect(state.capturedW).toBeGreaterThanOrEqual(0);expect(state.lostB).toBeGreaterThanOrEqual(0);moves++;
  }
  return {state,moves};
}
describe('무작위 흑 대 AI 백 시뮬레이션',()=>{
  for(const floor of [1,2,3] as const) for(let game=0;game<3;game++) it(`${floor}층 ${game+1}회가 400수 안에 예외 없이 끝난다`,()=>{const result=play(floor,floor*100+game);expect(result.state.status).not.toBe('playing');expect(result.moves).toBeLessThanOrEqual(400)});
  it('층별 3회 이상 무작위 대국이 400수 안에 예외 없이 종료된다',()=>{
    const results=[1,2,3].flatMap((floor)=>[0,1,2].map((game)=>play(floor as FloorId,floor*100+game)));
    expect(results).toHaveLength(9); expect(results.every(({state,moves})=>state.status!=='playing'&&moves<=400)).toBe(true);
  });
  it('시뮬레이션 도중 자원이 음수가 되지 않는다',()=>{
    for(const floor of [1,2,3] as FloorId[]) for(let game=0;game<3;game++){const {state}=play(floor,floor*100+game);expect(state.pouchB).toBeGreaterThanOrEqual(0);expect(state.pouchW).toBeGreaterThanOrEqual(0);expect(state.capturedW).toBeGreaterThanOrEqual(0);expect(state.lostB).toBeGreaterThanOrEqual(0)}
  });
  it('시뮬레이션 종료 사유가 기록된다',()=>{
    for(const floor of [1,2,3] as FloorId[]) for(let game=0;game<3;game++){const {state}=play(floor,floor*100+game);expect(state.reason).toMatch(/king|exhaust|depleted/)}
  });
});
