// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App';
import { createInitialGameState, gameReducer, type GameState } from '../src/game/GameProvider';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.useRealTimers();
});

function clickButton(text: string): void {
  const button = [...(host?.querySelectorAll('button') ?? [])]
    .find((candidate) => candidate.textContent?.includes(text) && !candidate.disabled);
  expect(button, `${text} 버튼`).toBeTruthy();
  act(() => button?.click());
}

function hit(point: number): void {
  const target = host?.querySelector<SVGCircleElement>(`[data-point="${point}"]`);
  expect(target, `${point} 교차점`).toBeTruthy();
  act(() => target?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function openedBattle(): GameState {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  return gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);
}

describe('교차점 1탭 확정', () => {
  it('카드 선택 뒤 한 번의 보드 클릭으로 돌과 버림 더미를 확정한다', () => {
    vi.useFakeTimers();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={openedBattle()} />));

    clickButton('일반석');
    hit(0);

    expect(host.querySelectorAll('.stone-b')).toHaveLength(1);
    expect(host.textContent).toContain('버림 1');
    expect(host.textContent).not.toContain('합법 수 미리보기');
  });

  it('점유 좌표 오류 뒤에도 다음 합법 좌표 한 번으로 정상 확정한다', () => {
    const state = openedBattle();
    const points = [...state.battle!.board.points];
    points[0] = { color: 'W', kind: 'STONE-001', instanceId: 'occupied' };
    const occupied = {
      ...state,
      battle: { ...state.battle!, board: { size: 7 as const, points } },
    };
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={occupied} />));

    clickButton('일반석');
    hit(0);
    expect(host.textContent).toContain('이미 돌이 놓인 자리입니다.');
    expect(host.querySelectorAll('.stone-b')).toHaveLength(0);

    hit(1);
    expect(host.querySelectorAll('.stone-b')).toHaveLength(1);
  });

  it('CHOOSE_POINT 한 번으로 moveNumber를 올리고 preview 상태를 남기지 않는다', () => {
    const state = openedBattle();
    const cardId = state.battle!.decks.B.hand[0].id;
    const selected = gameReducer(state, { type: 'SELECT_CARD', cardId }, DRAFT_GAME_CONFIG);
    const next = gameReducer(selected, { type: 'CHOOSE_POINT', point: 0 }, DRAFT_GAME_CONFIG);

    expect(next.battle?.moveNumber).toBe(1);
    expect('preview' in next).toBe(false);
  });
});
