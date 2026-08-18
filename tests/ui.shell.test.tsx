// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { App } from '../src/App';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

it('RoGolike 셸은 주입 config로 시작해 실제 지도를 표시한다', () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} />));
  expect(document.title).toBe('RoGolike');
  expect(host.querySelector('h1')?.textContent).toBe('RoGolike');
  const start = [...host.querySelectorAll('button')].find((button) => button.textContent === '등반 시작');
  act(() => start?.click());
  expect(host.querySelector('[data-screen="map"]')).toBeTruthy();
  expect(host.textContent).toContain(`냥 ${DRAFT_GAME_CONFIG.economy.startingCurrency}`);
});
