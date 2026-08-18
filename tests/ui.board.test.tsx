// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { App } from '../src/App';
import { createInitialGameState, gameReducer } from '../src/game/GameProvider';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function click(text: string): void {
  const button = [...(host?.querySelectorAll('button') ?? [])]
    .find((candidate) => candidate.textContent?.includes(text));
  expect(button, `${text} 버튼`).toBeTruthy();
  act(() => button?.click());
}

it('9×9가 81개 좌표를 비중첩 렌더한다', () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'RESOLVE_BATTLE_FOR_ENGINE', battle: 'boss', resolution: 'win', capturedStones: 0 }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'boss' }, DRAFT_GAME_CONFIG);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={state} />));
  expect(host.querySelector('[data-game-engine="integrated"]')).toBeTruthy();
  const hits = [...host.querySelectorAll<SVGCircleElement>('.hit')];
  expect(hits).toHaveLength(81);
  const first = hits[0];
  const second = hits[1];
  const diameter = Number(first.getAttribute('r')) * 2;
  const step = Number(second.getAttribute('cx')) - Number(first.getAttribute('cx'));
  expect(diameter).toBeLessThanOrEqual(step);
  expect(new Set(hits.map((hit) => `${hit.getAttribute('cx')}:${hit.getAttribute('cy')}`))).toHaveLength(81);
});

it('좌표는 행·열 이름과 Enter/Space 착수를 제공한다', () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} />));
  click('등반 시작');
  click('일반전');
  click('일반석');
  const hit = host.querySelector<SVGCircleElement>('[data-hit="0-0"]');
  expect(hit?.getAttribute('aria-label')).toContain('1행 1열');
  act(() => hit?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  expect(host.querySelectorAll('.stone-b')).toHaveLength(1);
});
