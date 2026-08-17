// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

function renderApp(): HTMLDivElement {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App />));
  return host;
}

function clickButton(name: string): void {
  const button = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.includes(name)) as HTMLButtonElement | undefined;
  expect(button, `${name} 버튼`).toBeTruthy();
  act(() => button?.click());
}

describe('RoGolike 게임 UI', () => {
  it('타이틀에 RoGolike를 표시한다', () => {
    const view = renderApp();
    expect(document.title).toBe('RoGolike');
    expect(view.querySelector('h1')?.textContent).toBe('RoGolike');
  });

  it('시작 선택 없이 지도와 모든 한국어 화면으로 이동한다', () => {
    const view = renderApp();
    expect(view.textContent).not.toContain('기풍 선택');
    clickButton('등반 시작');
    for (const name of ['일반전', '정예전', '보스전', '사건', '상점', '도장']) {
      expect(view.textContent).toContain(name);
    }
    clickButton('상점');
    expect(view.dataset.screen ?? view.querySelector('[data-screen]')?.getAttribute('data-screen')).not.toBe('title');
    expect(view.textContent).not.toContain('새로고침');
    clickButton('지도로 돌아가기');
    clickButton('사건');
    expect(view.querySelector('[data-screen="event"]')).toBeTruthy();
    clickButton('조용히 떠난다');
    clickButton('도장');
    expect(view.querySelector('[data-screen="dojo"]')).toBeTruthy();
    expect(view.textContent).not.toContain('디버그 초기화');
  });

  it('7×7과 9×9 판이 비중첩 터치 좌표와 키보드 이름을 렌더한다', () => {
    const view = renderApp();
    clickButton('등반 시작');
    clickButton('일반전');
    let hits = [...view.querySelectorAll<SVGCircleElement>('.hit')];
    expect(hits).toHaveLength(49);
    expect(hits[0].getAttribute('r')).toBe('22');
    expect(hits[0].getAttribute('aria-label')).toContain('7×7 바둑판 1행 1열');
    clickButton('지도로 물러나기');
    clickButton('보스전');
    hits = [...view.querySelectorAll<SVGCircleElement>('.hit')];
    expect(hits).toHaveLength(81);
    expect(hits[0].getAttribute('r')).toBe('21');
    expect(Number(hits[1].getAttribute('cx')) - Number(hits[0].getAttribute('cx'))).toBe(42);
    expect(Number(hits[0].getAttribute('r')) * 2).toBe(42);
  });

  it('카드 선택 전 착수를 막고 미리보기 뒤 같은 좌표에서 확정한다', () => {
    const view = renderApp();
    clickButton('등반 시작');
    clickButton('일반전');
    const first = view.querySelector<SVGCircleElement>('[data-hit="0-0"]')!;
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.textContent).toContain('놓을 카드를 먼저 선택하세요.');
    clickButton('일반석');
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.querySelector('.preview-stone')).toBeTruthy();
    expect(view.textContent).toContain('미리보기');
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.querySelectorAll('.stone-b')).toHaveLength(1);
    expect(view.textContent).toContain('착수 효과를 해결했습니다.');
  });

  it('상대 정보·손패 4장·덱과 버림·부적·연속 패스·효과 기록을 표시한다', () => {
    const view = renderApp();
    clickButton('등반 시작');
    clickButton('정예전');
    expect(view.querySelector('[aria-label="상대 정보"]')?.textContent).toContain('공격 기풍');
    expect(view.querySelectorAll('.hand .card')).toHaveLength(4);
    for (const text of ['내 덱 6', '버림', '부적 1', '연속 패스', '효과 기록']) expect(view.textContent).toContain(text);
  });

  it('보스 부활 뒤 결과에 결정적 복기 후보 1~3개를 표시한다', () => {
    const view = renderApp();
    clickButton('등반 시작');
    clickButton('보스전');
    clickButton('패스');
    expect(view.textContent).toContain('부활 2단계');
    clickButton('패스');
    expect(view.querySelector('[data-screen="result"]')).toBeTruthy();
    expect(view.textContent).toContain('복기 후보');
    const candidates = view.querySelectorAll('.effect-panel li');
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates.length).toBeLessThanOrEqual(3);
  });

  it('AI 예약은 화면 이탈 뒤 실행되지 않는다', () => {
    vi.useFakeTimers();
    const view = renderApp();
    clickButton('등반 시작');
    clickButton('일반전');
    clickButton('일반석');
    const first = view.querySelector<SVGCircleElement>('[data-hit="0-0"]')!;
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    clickButton('지도로 물러나기');
    const before = view.textContent;
    act(() => vi.advanceTimersByTime(1_000));
    expect(view.textContent).toBe(before);
  });
});
