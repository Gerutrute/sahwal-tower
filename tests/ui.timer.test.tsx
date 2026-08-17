// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { readFileSync } from 'node:fs';

let host: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(()=>{ if(root) act(()=>root!.unmount()); host?.remove(); root=null; host=null; vi.useRealTimers(); });
function mount(){ host=document.createElement('div'); document.body.append(host); root=createRoot(host); act(()=>root!.render(<App/>)); return host; }
function click(text:string){ const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes(text)) as HTMLButtonElement; expect(button).toBeTruthy(); act(()=>button.click()); }
function move00(view:HTMLElement){ const hit=view.querySelector('[data-hit="0-0"]') as SVGCircleElement; act(()=>hit.dispatchEvent(new MouseEvent('click',{bubbles:true}))); }

describe('AI 타이머',()=>{
  it('화면을 떠난 뒤 만료된 타이머는 아무 것도 하지 않는다',()=>{
    vi.useFakeTimers(); const view=mount(); click('등반 시작'); click('새로하기'); move00(view); click('새로 시작');
    const before=view.textContent; act(()=>vi.advanceTimersByTime(620)); expect(view.textContent).toBe(before);
  });

  it('B 착수 후 620ms 뒤에 AI가 둔다',()=>{
    vi.useFakeTimers(); const view=mount(); click('등반 시작'); move00(view);
    expect(view.querySelectorAll('.stone-w')).toHaveLength(1);expect(view.textContent).toContain('…수를 읽는 중');expect((view.querySelector('.controls button') as HTMLButtonElement).disabled).toBe(true);act(()=>vi.advanceTimersByTime(619)); expect(view.querySelectorAll('.stone-w')).toHaveLength(1);
    act(()=>vi.advanceTimersByTime(1)); expect(view.querySelectorAll('.stone-w').length).toBeGreaterThanOrEqual(2); expect(view.textContent).toContain('당신의 차례다.');
  });

  it('같은 턴에 타이머가 중복 생성되지 않는다',()=>{
    vi.useFakeTimers(); const view=mount(); click('등반 시작');const spy=vi.spyOn(globalThis,'setTimeout');spy.mockClear();move00(view);expect(spy).toHaveBeenCalledTimes(1);act(()=>vi.advanceTimersByTime(620));
    expect(view.textContent).toContain('○ 적 19'); expect(view.querySelectorAll('.stone-w')).toHaveLength(2);
  });

  it('타이머 콜백은 화면·턴·상태·세대를 재검사한다',()=>{
    vi.useFakeTimers(); const view=mount(); click('등반 시작'); click('새로하기'); move00(view); click('새로 시작');
    const before=view.innerHTML; act(()=>vi.advanceTimersByTime(2000)); expect(view.innerHTML).toBe(before);
    const source=readFileSync('src/hooks/useAiTurn.ts','utf8');for(const guard of ["current.screen !== 'battle'","current.battle?.turn !== 'W'","current.battle.status !== 'playing'",'generation.current !== token'])expect(source).toContain(guard);
  });
});
