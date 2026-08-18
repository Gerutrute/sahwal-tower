// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/App';
import { createInitialGameState } from '../src/game/GameProvider';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';
import { DRAFT_REWARD_CATALOG } from './fixtures/draft-run-config';

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function mount() {
  const base = createInitialGameState(DRAFT_GAME_CONFIG);
  const state = {
    ...base,
    screen: 'reward' as const,
    run: { ...base.run, pendingRewards: DRAFT_REWARD_CATALOG.candidates.slice(0, 3) },
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={state} />));
  return state;
}

describe('보상 상세 UI', () => {
  it('모바일 첫 탭은 상세만 펼친다', () => {
    const before = mount();
    const face = host?.querySelector<HTMLButtonElement>('.reward-face');
    act(() => face?.click());
    expect(face?.getAttribute('aria-expanded')).toBe('true');
    expect(host?.querySelector('[aria-label$="상세"]')).toBeTruthy();
    expect(host?.querySelector('[data-screen="reward"]')).toBeTruthy();
    expect(before.run.deck).toEqual(createInitialGameState(DRAFT_GAME_CONFIG).run.deck);
  });

  it('명시적 선택과 focus로만 보상 흐름을 진행한다', () => {
    mount();
    const faces = [...(host?.querySelectorAll<HTMLButtonElement>('.reward-face') ?? [])];
    act(() => faces[0]?.focus());
    const detail = host?.querySelector<HTMLElement>('[aria-label$="상세"]');
    expect(detail?.textContent).toMatch(/효과 요약.*발동 조건.*실제 효과.*전략.*추천 연계.*현재 보유/s);
    act(() => faces[1]?.focus());
    expect(faces[0]?.getAttribute('aria-expanded')).toBe('false');
    expect(faces[1]?.getAttribute('aria-expanded')).toBe('true');
    act(() => host?.querySelector<HTMLButtonElement>('.reward-select')?.click());
    expect(host?.querySelector('[data-screen="map"]')).toBeTruthy();
  });
});
