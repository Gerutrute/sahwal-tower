// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App, Battle, End, RelicChoice, restartSummaryRun } from '../src/App';
import { BoardSvg } from '../src/components/BoardSvg';
import { idx, newRun, startBattle, type Cell } from '../src/engine';
import { readFileSync } from 'node:fs';

let host: HTMLDivElement | null = null;
let roots:Root[]=[];
afterEach(()=>{ for(const root of roots) act(()=>root.unmount()); roots=[]; host?.remove(); host=null; });
function render(){ host=document.createElement('div'); document.body.append(host); const root=createRoot(host); roots.push(root); act(()=>root.render(<App/>)); return host; }
function renderNode(node:ReactNode){host=document.createElement('div');document.body.append(host);const root=createRoot(host);roots.push(root);act(()=>root.render(node));return host}
function click(text:string){ const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes(text)) as HTMLButtonElement; expect(button).toBeTruthy(); act(()=>button.click()); }

describe('화면 렌더',()=>{
  it('타이틀 화면 요소가 모두 있다',()=>{
    const view=render(); expect(view.textContent).toContain('塔'); expect(view.textContent).toContain('死活之塔');
    expect(view.textContent).toContain('등반 시작'); expect(view.textContent).toContain('왕 주위에 두 집을 지으면 어떤 마물도 그 왕을 잡지 못한다');
  });
  it('전투 화면 요소가 명세 순서대로 배치된다',()=>{
    const view=render(); click('등반 시작');
    expect(view.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 340 340');
    for(const text of ['1층 · 침입귀','한 수 쉼','새로하기','규칙']) expect(view.textContent).toContain(text);
    expect([...view.querySelector('.battle-screen')!.children].map((element)=>element.className)).toEqual(['battle-head','enemy','resources','board-stage','status-line','controls','relic-chips','battle-log']);
  });
  it('규칙 모달이 7개 주제를 모두 설명한다',()=>{
    const view=render(); click('등반 시작'); click('규칙');
    for(const text of ['활로','포획','주머니','왕돌','탈진','바위','동형반복','두 집']) expect(view.textContent).toContain(text);
  });
  it('새로하기는 현재 층·돌·유물 요약 모달을 띄운다',()=>{
    const view=render(); click('등반 시작'); click('새로하기');
    expect(view.textContent).toContain('계속 오른다'); expect(view.textContent).toContain('새로 시작');
  });

  it('새로하기 모달은 전투 중 현재 돌 수를 보여준다',()=>{
    vi.useFakeTimers();
    try {
      const view=render(); click('등반 시작');
      const point=view.querySelector('svg [role="button"]') as SVGElement;
      act(()=>point.dispatchEvent(new MouseEvent('click',{bubbles:true})));
      act(()=>vi.advanceTimersByTime(620));
      click('새로하기');
      expect(view.textContent).toContain('1층 · 돌 27개');
    } finally { vi.useRealTimers(); }
  });

  it('유물 화면의 새로하기 요약은 휴식 보너스가 반영된 런 주머니를 보여준다',()=>{
    const run={...newRun(),floor:2 as const,pouch:21};
    const previousBattle={...startBattle(newRun(),1),pouchB:17};
    expect(restartSummaryRun('battle',run,previousBattle).pouch).toBe(17);
    expect(restartSummaryRun('relic',run,previousBattle)).toBe(run);
    expect(restartSummaryRun('relic',run,previousBattle).pouch).toBe(21);
  });

  it('새로 시작하면 타이틀 없이 1층 전투로 간다',()=>{
    const view=render(); click('등반 시작'); click('새로하기'); click('새로 시작');
    expect(view.textContent).toContain('1층 · 침입귀'); expect(view.textContent).not.toContain('등반 시작');
  });

  it('주머니가 5 이하면 경고 색으로 표시된다',()=>{
    const run=newRun();const state={...startBattle(run,1),pouchB:5};const noop=()=>{};
    const view=renderNode(<Battle state={state} run={run} thinking={false} onMove={noop} onPass={noop} onBomb={noop} onRestart={noop} onRules={noop} onAdvance={noop}/>);
    expect(view.querySelector('.resources .low')?.textContent).toContain('주머니 5');expect(readFileSync('src/styles.css','utf8')).toMatch(/\.resources \.low,.danger-line\{color:var\(--ju\)/);
  });

  it('SVG 판은 viewBox 340×340이며 구성요소를 갖춘다',()=>{
    const run={...newRun(),relics:['bomb' as const]};const state=startBattle(run,3);state.lastMove=state.kingB;state.bomb={armed:false,used:true,pos:state.kingB};const view=renderNode(<BoardSvg state={state} disabled={false} onMove={()=>{}}/>);const svg=view.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 340 340'); expect(svg.querySelector('.star')).toBeTruthy();
    expect(svg.querySelectorAll('.grid-line')).toHaveLength(14); expect(svg.querySelectorAll('.king-ring')).toHaveLength(2);expect(svg.querySelector('.last-ring')).toBeTruthy();expect(svg.querySelector('.rock')).toBeTruthy();expect(svg.textContent).toContain('✸');expect(svg.textContent).toContain('王');
  });

  it('왕이 단수면 경고 문구와 펄스가 나타난다',()=>{
    const state=startBattle(newRun(),1); const board=Array<Cell>(49).fill('R');
    board[idx(0,0)]='B';board[idx(0,1)]=null;board[idx(6,6)]='W';board[idx(6,5)]=null;board[idx(5,6)]=null;
    const view=renderNode(<BoardSvg state={{...state,board,kingB:idx(0,0),kingW:idx(6,6)}} disabled={false} onMove={()=>{}}/>);
    expect(view.textContent).toContain('위험 — 내 왕돌이 단수에 몰렸다!');expect(view.querySelectorAll('.atari-ring')).toHaveLength(1);
    const enemyBoard=[...board];enemyBoard[idx(0,1)]=null;enemyBoard[idx(1,0)]=null;enemyBoard[idx(6,5)]=null;enemyBoard[idx(5,6)]='R';
    act(()=>roots.at(-1)!.render(<BoardSvg state={{...state,board:enemyBoard,kingB:idx(0,0),kingW:idx(6,6)}} disabled={false} onMove={()=>{}}/>));expect(view.textContent).toContain('기회 — 적 왕돌이 단수다. 한 수면 잡는다.');expect(view.querySelectorAll('.atari-ring')).toHaveLength(1);
  });

  it('승패 오버레이 문구와 버튼이 명세와 같다',()=>{
    const run=newRun();const state={...startBattle(run,1),status:'win' as const,reason:'king' as const};const noop=()=>{};
    const view=renderNode(<Battle state={state} run={run} thinking={false} onMove={noop} onPass={noop} onBomb={noop} onRestart={noop} onRules={noop} onAdvance={noop}/>);
    expect(view.querySelector('.result-overlay')?.textContent).toContain('勝');expect(view.textContent).toContain('적 왕돌을 잡았다.');expect(view.textContent).toContain('전리품을 살핀다');
    const source=readFileSync('src/App.tsx','utf8');for(const text of ['탑 꼭대기로','기록을 남긴다'])expect(source).toContain(text);
  });

  it('유물 화면은 카드 3장과 건너뛰기·새로하기를 보여준다',()=>{
    const view=renderNode(<RelicChoice offer={['recover','soul','bomb']} choose={()=>{}} skip={()=>{}} restart={()=>{}}/>);expect(view.querySelectorAll('.relic-card')).toHaveLength(3);expect(view.textContent).toContain('비운 채로 오른다');expect(view.textContent).toContain('새로하기');
  });

  it('종료 화면은 生 또는 死 인장과 기록을 보여준다',()=>{
    const view=renderNode(<End alive={true} run={{...newRun(),floor:3,clearedFloors:3,totalCaptured:7,relics:['recover']}} restart={()=>{}}/>);for(const text of ['生','도달 층 3','총 포획 7','회수의 손','처음부터 다시 오른다'])expect(view.textContent).toContain(text);
  });

  it('게임 텍스트에 영문 문장이 없다',()=>{
    const view=render(); expect(view.textContent).not.toMatch(/[A-Za-z]{3,}/); click('등반 시작'); expect(view.textContent).not.toMatch(/[A-Za-z]{3,}/);
  });
});
