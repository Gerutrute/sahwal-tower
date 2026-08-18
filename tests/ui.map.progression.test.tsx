// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

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

function mount(completedNodeIds: readonly string[] = []): void {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = { ...state, completedNodeIds };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={state} />));
}

describe('지도 도달 가능성 UI', () => {
  it('첫 열 두 노드만 open이고 나머지와 보스는 disabled다', () => {
    mount();
    const buttons = [...(host?.querySelectorAll<HTMLButtonElement>('[data-node-id]') ?? [])];
    expect(buttons.filter(({ dataset }) => dataset.state === 'open')).toHaveLength(2);
    expect(buttons.filter(({ dataset }) => dataset.state === 'locked').every(({ disabled }) => disabled)).toBe(true);
    expect(host?.querySelector<HTMLButtonElement>('[data-state="open"]')?.disabled).toBe(false);
    expect(host?.querySelector<HTMLButtonElement>('[data-node-id$="boss"]')?.disabled).toBe(true);
    expect(host?.querySelector('[aria-label="여정 시설"]')).toBeNull();
  });

  it('잠긴 노드는 클릭해도 화면을 바꾸지 않는다', () => {
    mount();
    const locked = host?.querySelector<HTMLButtonElement>('[data-state="locked"]');
    act(() => locked?.click());
    expect(host?.querySelector('[data-screen="map"]')).toBeTruthy();
    expect(host?.querySelector('[data-screen="battle"]')).toBeNull();
  });

  it('완료 노드와 그 next만 done/open 상태로 표시한다', () => {
    const state = createInitialGameState(DRAFT_GAME_CONFIG);
    const completed = state.map.starts[0];
    const completedNode = state.map.columns.flat().find(({ id }) => id === completed)!;
    mount([completed]);

    expect(host?.querySelector(`[data-node-id="${completed}"]`)?.getAttribute('data-state')).toBe('current');
    for (const next of completedNode.next) {
      expect(host?.querySelector(`[data-node-id="${next}"]`)?.getAttribute('data-state')).toBe('open');
    }
  });
});
