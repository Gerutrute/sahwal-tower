// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/App';
import type { StoneCard } from '../src/game/deck';
import { createInitialGameState, gameReducer, type GameState } from '../src/game/GameProvider';
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

function mount(state: GameState): void {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={state} />));
}

function battleWithEveryKind(): GameState {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);
  const hand: readonly StoneCard[] = Object.keys(DRAFT_GAME_CONFIG.enemyDeck.slice(0, 6))
    .map((_, index) => ({
      id: `clarity-${index + 1}`,
      kind: `STONE-00${index + 1}` as StoneCard['kind'],
      temporary: false,
    }));
  return {
    ...state,
    battle: {
      ...state.battle!,
      phase: 'choose-card',
      turn: 'B',
      decks: { ...state.battle!.decks, B: { ...state.battle!.decks.B, hand } },
    },
  };
}

describe('카드 명시성 UI', () => {
  it('내부 ID/trigger 없이 6종 클래스·문양과 선택 상세를 보여준다', () => {
    mount(battleWithEveryKind());
    const cards = [...(host?.querySelectorAll<HTMLButtonElement>('.hand .card') ?? [])];
    expect(new Set(cards.map(({ dataset }) => dataset.stoneClass)).size).toBe(6);
    expect(cards.every((card) => card.querySelector('.card-icon') !== null)).toBe(true);
    expect(host?.textContent).not.toMatch(/STONE-00|after-placement|capture-success|card-entered-hand|adjacent-endangered-group|captured-by-opponent-placement/);

    const scout = cards.find(({ textContent }) => textContent?.includes('척후석'));
    act(() => scout?.click());
    expect(host?.querySelector('[aria-label="선택 카드 상세"]')?.textContent).toMatch(/발동 조건.*전략/);
  });

  it('척후석 착수 뒤 병종명이 포함된 명시적 발동 상태를 표시한다', () => {
    mount(battleWithEveryKind());
    const scout = [...(host?.querySelectorAll<HTMLButtonElement>('.hand .card') ?? [])]
      .find(({ textContent }) => textContent?.includes('척후석'));
    act(() => scout?.click());
    const hit = host?.querySelector<SVGCircleElement>('[data-point="0"]');
    act(() => hit?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect([...host!.querySelectorAll('[role="status"]')].some(({ textContent }) => textContent?.includes('척후석'))).toBe(true);
  });

  it('보상 부적·유물을 원시 ID 대신 정의 이름으로 표시한다', () => {
    const base = createInitialGameState(DRAFT_GAME_CONFIG);
    const charm = DRAFT_REWARD_CATALOG.candidates.find(({ kind }) => kind === 'charm')!;
    const relic = DRAFT_REWARD_CATALOG.candidates.find(({ kind }) => kind === 'relic')!;
    mount({
      ...base,
      screen: 'reward',
      run: { ...base.run, pendingRewards: [charm, relic] },
    });

    expect(host?.textContent).toContain('수읽기 부적');
    expect(host?.textContent).toContain('장수의 호패');
    expect(host?.textContent).not.toMatch(/ITEM-|RELIC-/);
  });
});
