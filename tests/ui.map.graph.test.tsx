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

function mount(completedNodeIds: readonly string[] = []) {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = { ...state, completedNodeIds };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={state} />));
  return state;
}

describe('지도 그래프 UI', () => {
  it('실제 next 연결선을 세로 그래프로 그린다', () => {
    const state = mount();
    const expected = state.map.columns.flat().flatMap((node) => node.next.map((next) => `${node.id}>${next}`)).sort();
    const edges = [...(host?.querySelectorAll<SVGLineElement>('.map-edge') ?? [])];
    expect(edges).toHaveLength(18);
    expect(edges.map(({ dataset }) => dataset.edge).sort()).toEqual(expected);
    expect(host?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    expect(host?.querySelector<HTMLElement>('.map-graph')?.style.getPropertyValue('--map-aspect'))
      .toBe('356 / 576');
  });

  it('현재·완료·열림·잠김 노드를 구별한다', () => {
    const initial = createInitialGameState(DRAFT_GAME_CONFIG);
    const first = initial.map.starts[0];
    const state = mount([first]);
    expect(host?.querySelector(`[data-node-id="${first}"]`)?.getAttribute('data-state')).toBe('current');
    state.map.columns[0][0].next.forEach((id) => {
      const node = host?.querySelector<HTMLButtonElement>(`[data-node-id="${id}"]`);
      expect(node?.dataset.state).toBe('open');
      expect(node?.disabled).toBe(false);
    });
    expect(host?.querySelectorAll('[data-state="locked"]')).not.toHaveLength(0);
    expect(host?.querySelector('[aria-label="1막 지도"]')).toBeTruthy();
  });
});
