import { useCallback, useMemo, useState } from 'react';
import {
  FLOORS, POUCH_WARN, RELICS, applyRelic, finishFloor, libsOf, newRun, offerRelics,
  playerMove, playerPass, startBattle, toggleBomb, aiTurn,
  type BattleState, type RelicId, type RunState,
} from './engine';
import { BoardSvg } from './components/BoardSvg';
import { useAiTurn, type Screen } from './hooks/useAiTurn';

const reasonText = (battle: BattleState) => battle.reason === 'exhaust' ? '적의 돌 주머니가 바닥났다.' : battle.reason === 'depleted' ? '돌 주머니가 바닥났다.' : battle.status === 'win' ? '적 왕돌을 잡았다.' : '내 왕돌이 함락됐다.';

export const restartSummaryRun = (screen: Screen, run: RunState, battle: BattleState | null): RunState =>
  screen === 'battle' && battle ? { ...run, pouch: battle.pouchB } : run;

function Title({ onStart }: { onStart: () => void }) {
  return <main className="screen title-screen"><div className="title-seal">塔</div><h1 className="vertical-title">死活之塔</h1>
    <div className="rules-four"><p><b>一</b> 흑돌로 먼저 둔다</p><p><b>二</b> 왕돌을 살려라</p><p><b>三</b> 포획하면 돌을 되찾는다</p><p><b>四</b> 세 층을 모두 넘어라</p></div>
    <button className="primary" onClick={onStart}>등반 시작</button><p className="hint">왕 주위에 두 집을 지으면 어떤 마물도 그 왕을 잡지 못한다</p></main>;
}

function RulesModal({ close }: { close: () => void }) {
  return <div className="modal-backdrop"><section className="modal"><h2>탑의 규칙</h2><ul>
    <li><b>활로·포획</b> — 돌과 이어진 빈 교차점이 활로다. 활로가 없어진 무리는 포획된다.</li>
    <li><b>주머니 경제</b> — 내 착수는 돌 하나를 쓰고, 잡은 백돌은 되찾는다.</li>
    <li><b>왕돌·고갈 패배</b> — 내 왕돌이 잡히거나 돌이 바닥나면 패배한다.</li>
    <li><b>탈진 승리</b> — 적의 돌이 먼저 바닥나도 승리한다.</li><li><b>바위</b> — 둘 수 없고 활로도 주지 않는 벽이다.</li>
    <li><b>동형반복 금지</b> — 전투 중 지나간 판과 같은 모양은 만들 수 없다.</li><li><b>두 집</b> — 왕 주위에 서로 나뉜 두 집을 만들면 살아남는다.</li>
  </ul><button onClick={close}>규칙을 덮는다</button></section></div>;
}

function RestartModal({ run, close, restart }: { run: RunState; close: () => void; restart: () => void }) {
  return <div className="modal-backdrop"><section className="modal"><h2>등반을 다시 시작할까?</h2><p>{run.floor}층 · 돌 {run.pouch}개</p><p>유물: {run.relics.length ? run.relics.map((id)=>RELICS.find((r)=>r.id===id)!.name).join(', ') : '없음'}</p><div className="controls"><button onClick={close}>계속 오른다</button><button className="danger-button" onClick={restart}>새로 시작</button></div></section></div>;
}

export function Battle({ state, run, thinking, onMove, onPass, onBomb, onRestart, onRules, onAdvance }: {
  state: BattleState; run: RunState; thinking: boolean; onMove:(p:number)=>void; onPass:()=>void; onBomb:()=>void; onRestart:()=>void; onRules:()=>void; onAdvance:()=>void;
}) {
  const floor=FLOORS[state.floor]; const locked=thinking || state.turn!=='B' || state.status!=='playing';
  return <main className="screen battle-screen"><header className="battle-head"><span className="mini-title">死活之塔</span><div className="floor-seals">{([1,2,3] as const).map((f)=><span key={f} className={`floor-seal ${f<state.floor?'past':f===state.floor?'current':'future'}`}>{FLOORS[f].floorSeal}</span>)}</div></header>
    <section className="enemy"><span className="enemy-seal">{floor.seal2}</span><div><h2>{state.floor}층 · {floor.name}</h2><p>{floor.gimmick}</p></div></section>
    <section className="resources"><span className={state.pouchB<=POUCH_WARN?'low':''}>● 주머니 {state.pouchB}</span><span>포획 {state.capturedW}</span><span>손실 {state.lostB}</span><span>○ 적 {state.pouchW}</span></section>
    <div className="board-stage"><BoardSvg state={state} disabled={locked} onMove={onMove}/>{state.status!=='playing'&&<div className="result-overlay"><strong className={state.status==='win'?'victory':'death'}>{state.status==='win'?'勝':'死'}</strong><p>{reasonText(state)}</p><button onClick={onAdvance}>{state.status==='lose'?'기록을 남긴다':state.floor===3?'탑 꼭대기로':'전리품을 살핀다'}</button></div>}</div>
    <p className="status-line">{thinking?'…수를 읽는 중':state.turn==='B'?'당신의 차례다.':'적의 차례다.'}</p>
    <div className="controls"><button disabled={locked} onClick={onPass}>한 수 쉼</button>{state.relics.includes('bomb')&&<button disabled={locked||state.bomb.used} onClick={onBomb}>{state.bomb.armed?'폭발석 해제':'폭발석 장전'}</button>}<button disabled={thinking} onClick={onRestart}>새로하기</button><button disabled={thinking} onClick={onRules}>규칙</button></div>
    <div className="relic-chips">{run.relics.map((id)=><span key={id}>{RELICS.find((r)=>r.id===id)!.hanja} {RELICS.find((r)=>r.id===id)!.name}</span>)}</div>
    <ol className="battle-log">{state.log.slice(-3).map((line,i)=><li key={`${line}-${i}`} style={{opacity:.45+i*.25}}>{line}</li>)}</ol>
  </main>;
}

export function RelicChoice({ offer, choose, skip, restart }: { offer:RelicId[]; choose:(id:RelicId)=>void; skip:()=>void; restart:()=>void }) {
  return <main className="screen"><h1>전리품</h1><p>하나를 골라 다음 층으로 오른다.</p><div className="relic-cards">{offer.map((id)=>{const relic=RELICS.find((r)=>r.id===id)!;return <button className="relic-card" key={id} onClick={()=>choose(id)}><b>{relic.hanja}</b><strong>{relic.name}</strong><span>{relic.desc}</span></button>})}</div><div className="controls"><button onClick={skip}>비운 채로 오른다</button><button onClick={restart}>새로하기</button></div></main>;
}

export function End({ alive, run, restart }: { alive:boolean; run:RunState; restart:()=>void }) { return <main className="screen end-screen"><div className={`end-seal ${alive?'alive':'dead'}`}>{alive?'生':'死'}</div><h1>{alive?'탑을 정복했다':'등반이 끝났다'}</h1><p>도달 층 {run.floor} · 총 포획 {run.totalCaptured}</p><p>유물 {run.relics.length ? run.relics.map((id)=>RELICS.find((r)=>r.id===id)!.name).join(', ') : '없음'}</p><button className="primary" onClick={restart}>처음부터 다시 오른다</button></main>; }

export function App() {
  const [screen,setScreen]=useState<Screen>('title'); const [run,setRun]=useState<RunState>(newRun());
  const [battle,setBattle]=useState<BattleState|null>(null); const [offer,setOffer]=useState<RelicId[]>([]);
  const [modal,setModal]=useState<'rules'|'restart'|null>(null); const [alive,setAlive]=useState(false);
  const start=useCallback(()=>{const fresh=newRun();setRun(fresh);setBattle(startBattle(fresh,1));setScreen('battle');setModal(null)},[]);
  const performAi=useCallback(()=>setBattle((current)=>current?aiTurn(current,Math.random):current),[]);
  const {thinking}=useAiTurn({screen,battle,onAiTurn:performAi});
  const advance=()=>{if(!battle)return;if(battle.status==='lose'){const final={...run,pouch:battle.pouchB,totalCaptured:run.totalCaptured+battle.capturedW,totalLost:run.totalLost+battle.lostB};setRun(final);setAlive(false);setScreen('end');return;}const won=finishFloor(run,battle);setRun(won);if(battle.floor===3){setAlive(true);setScreen('end')}else{setOffer(offerRelics(won.relics,Math.random));setScreen('relic')}};
  const climb=(id?:RelicId)=>{const next=id?applyRelic(run,id):run;setRun(next);setBattle(startBattle(next,next.floor));setScreen('battle')};
  const content=useMemo(()=>{
    if(screen==='title')return <Title onStart={start}/>;
    if(screen==='battle'&&battle)return <Battle state={battle} run={run} thinking={thinking} onMove={(p)=>setBattle((s)=>s?playerMove(s,p):s)} onPass={()=>setBattle((s)=>s?playerPass(s):s)} onBomb={()=>setBattle((s)=>s?toggleBomb(s):s)} onRestart={()=>setModal('restart')} onRules={()=>setModal('rules')} onAdvance={advance}/>;
    if(screen==='relic')return <RelicChoice offer={offer} choose={(id)=>climb(id)} skip={()=>climb()} restart={()=>setModal('restart')}/>;
    return <End alive={alive} run={run} restart={()=>{setScreen('title');setRun(newRun());setBattle(null)}}/>;
  },[screen,battle,run,thinking,offer,alive]);
  return <div className="app-shell">{content}{modal==='rules'&&<RulesModal close={()=>setModal(null)}/>} {modal==='restart'&&<RestartModal run={restartSummaryRun(screen,run,battle)} close={()=>setModal(null)} restart={start}/>}</div>;
}
