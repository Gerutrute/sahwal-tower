// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { createInitialGameState, gameReducer, type GameState } from '../src/game/GameProvider';
import { canonicalKoKey, tryPlay } from '../src/game/go';
import type { StoneCard } from '../src/game/deck';
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

function click(text: string): void {
  const button = [...(host?.querySelectorAll('button') ?? [])]
    .find((candidate) => candidate.textContent?.includes(text));
  expect(button, `${text} 버튼`).toBeTruthy();
  act(() => button?.click());
}

function battleStateWithScout(): GameState {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);
  const battle = state.battle!;
  const scout: StoneCard = { id: 'ui-scout', kind: 'STONE-002', temporary: false };
  const hand = [scout, ...battle.decks.B.hand.slice(0, 3)];
  const drawPile: readonly StoneCard[] = [
    { id: 'ui-draw-normal', kind: 'STONE-001', temporary: false },
    { id: 'ui-draw-general', kind: 'STONE-003', temporary: false },
    { id: 'ui-draw-guardian', kind: 'STONE-005', temporary: false },
  ];
  return {
    ...state,
    battle: {
      ...battle,
      phase: 'choose-card',
      turn: 'B',
      decks: { ...battle.decks, B: { ...battle.decks.B, hand, drawPile } },
    },
  };
}

it('실제 10장 덱에서 손패 4장을 보여주고 병종명을 정확히 표시한다', () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} />));
  click('등반 시작');
  click('일반전');
  expect(host.querySelectorAll('.hand .card')).toHaveLength(4);
  expect(host.textContent).toContain('내 덱 10');
  expect(host.textContent).toContain('장군석');
  expect(host.textContent).not.toContain('STONE-003 수호석');
  expect(host.textContent).toContain('점유 흑 0 · 백 0 / 25');
});

it('tryPlay/resolveMove 검증 뒤 한 탭으로 카드 소비와 AI 선택을 수행한다', () => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} />));
  click('등반 시작');
  click('일반전');
  expect(host.textContent).not.toContain('착수로 진행');
  click('일반석');
  const hit = host.querySelector<SVGCircleElement>('[data-hit="0-0"]');
  act(() => hit?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(host.querySelectorAll('.stone-b')).toHaveLength(1);
  expect(host.textContent).toContain('버림 1');
  act(() => vi.runAllTimers());
  expect(host.querySelectorAll('.stone-w')).toHaveLength(1);
});

it('pre-move에서 부적과 유물을 구분해 표시하고 실제 사용·건너뛰기 동작을 제공한다', () => {
  let initial = createInitialGameState(DRAFT_GAME_CONFIG);
  initial = {
    ...initial,
    run: { ...initial.run, charms: ['ITEM-001'], relics: ['RELIC-001'] },
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={initial} />));

  click('등반 시작');
  click('일반전');
  expect(host.textContent).toContain('부적 1');
  expect(host.textContent).toContain('유물 1');
  expect(host.querySelector('[aria-label="부적"]')?.textContent).toContain('수읽기 부적');
  expect(host.querySelector('[aria-label="유물"]')?.textContent).toContain('낡은 바둑통');
  click('낡은 바둑통 사용');
  expect(host.querySelector<HTMLButtonElement>('[data-relic-id="RELIC-001"]')?.disabled).toBe(true);
  click('수읽기 부적 사용');
  expect(host.querySelector('[data-charm-id="ITEM-001"]')).toBeNull();
  click('착수로 진행');
  expect(host.querySelector<HTMLButtonElement>('.hand .card')?.disabled).toBe(false);
});

it('척후석 착수 후 실제 덱 위 카드로 재정렬 패널을 열고 취소·확정한다', () => {
  vi.useFakeTimers();
  const mountScout = () => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={battleStateWithScout()} />));
    click('척후석');
    const hit = host.querySelector<SVGCircleElement>('[data-hit="0-0"]');
    act(() => hit?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  };

  mountScout();
  const panel = host?.querySelector('[aria-label="척후 정찰"]');
  expect(panel?.textContent).toContain('장군석');
  expect(panel?.textContent).toContain('수호석');
  expect([...(host?.querySelectorAll<HTMLButtonElement>('.hand .card') ?? [])].every(({ disabled }) => disabled)).toBe(true);
  expect([...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .find(({ textContent }) => textContent?.includes('패스'))?.disabled).toBe(true);
  expect([...(host?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .find(({ textContent }) => textContent?.includes('기권'))?.disabled).toBe(true);
  click('취소');
  expect(document.querySelector('[aria-label="척후 정찰"]')).toBeNull();

  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
  mountScout();
  act(() => document.querySelector<HTMLButtonElement>('[data-inspect-card-id="ui-draw-general"]')?.click());
  const returnCard = document.querySelector<HTMLButtonElement>('[data-inspect-card-id]');
  act(() => returnCard?.click());
  click('위로');
  click('확정');
  expect(document.querySelector('[aria-label="척후 정찰"]')).toBeNull();
});

it('기권은 run 패배 결과 경로로 이어진다', () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} />));
  click('등반 시작');
  click('일반전');
  click('기권');
  expect(host.querySelector('[data-screen="result"]')).toBeTruthy();
  expect(host.textContent).toContain('런 패배');
});

it('포획 확정과 점유·자충수·단순패 사유를 엔진 판정 그대로 노출한다', () => {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);
  const selectedCard = state.battle!.decks.B.hand[0];
  state = gameReducer(state, { type: 'SELECT_CARD', cardId: selectedCard.id }, DRAFT_GAME_CONFIG);
  const selectedState = state;

  const capturePoints = [...state.battle!.board.points];
  capturePoints[1] = { color: 'W', kind: 'STONE-001', instanceId: 'white-target' };
  capturePoints[2] = { color: 'B', kind: 'STONE-001', instanceId: 'black-right' };
  capturePoints[8] = { color: 'B', kind: 'STONE-001', instanceId: 'black-down' };
  state = { ...state, battle: { ...state.battle!, board: { size: 7, points: capturePoints } } };
  state = gameReducer(state, { type: 'CHOOSE_POINT', point: 0 }, DRAFT_GAME_CONFIG);
  expect(state.captures.B).toBe(1);

  const occupied = [...selectedState.battle!.board.points];
  occupied[0] = { color: 'W', kind: 'STONE-001', instanceId: 'occupied' };
  state = { ...selectedState, battle: { ...selectedState.battle!, board: { size: 7, points: occupied } } };
  state = gameReducer(state, { type: 'CHOOSE_POINT', point: 0 }, DRAFT_GAME_CONFIG);
  expect(state.invalidReason).toContain('이미 돌');

  const suicide = Array(49).fill(null);
  suicide[1] = { color: 'W', kind: 'STONE-001', instanceId: 'white-right' };
  suicide[7] = { color: 'W', kind: 'STONE-001', instanceId: 'white-down' };
  state = { ...selectedState, battle: { ...selectedState.battle!, board: { size: 7, points: suicide }, koForbiddenKey: null } };
  state = gameReducer(state, { type: 'CHOOSE_POINT', point: 0 }, DRAFT_GAME_CONFIG);
  expect(state.invalidReason).toContain('자충수');

  const empty = { size: 7 as const, points: Array(49).fill(null) };
  const koProbe = tryPlay(empty, 0, { color: 'B', kind: selectedCard.kind, instanceId: 'ko-probe' }, null);
  expect(koProbe.ok).toBe(true);
  state = { ...selectedState, battle: { ...selectedState.battle!, board: empty, koForbiddenKey: canonicalKoKey(koProbe.board) } };
  state = gameReducer(state, { type: 'CHOOSE_POINT', point: 0 }, DRAFT_GAME_CONFIG);
  expect(state.invalidReason).toContain('단순패');
});

it('수호 중인 그룹의 교차점에 보호 마커를 표시한다', () => {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);
  const battle = state.battle!;
  const points = [...battle.board.points];
  points[0] = { color: 'B', kind: 'STONE-005', instanceId: 'protected-stone' };
  state = {
    ...state,
    battle: {
      ...battle,
      board: { ...battle.board, points },
      protections: [{ id: 'shield', color: 'B', memberInstanceIds: ['protected-stone'], grantedAtMove: 1 }],
    },
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} initialState={state} />));
  expect(host.querySelector('[data-protected="0"]')).toBeTruthy();
});
