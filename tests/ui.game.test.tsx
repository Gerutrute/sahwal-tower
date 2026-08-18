// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { createInitialGameState, gameReducer, type GameConfig, type GameState } from '../src/game/GameProvider';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
  vi.useRealTimers();
});

function renderApp(config: GameConfig = DRAFT_GAME_CONFIG, initialState?: GameState): HTMLDivElement {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={config} initialState={initialState} />));
  return host;
}

function clickButton(name: string): void {
  const button = [...document.querySelectorAll('button')]
    .find((candidate) => candidate.textContent?.includes(name)) as HTMLButtonElement | undefined;
  expect(button, `${name} 버튼`).toBeTruthy();
  act(() => button?.click());
}

describe('RoGolike 통합 게임 UI', () => {
  it('RoGolike 타이틀과 실제 경로 상태를 표시하고 무제한 시설 진입을 숨긴다', () => {
    const view = renderApp();
    expect(document.title).toBe('RoGolike');
    clickButton('등반 시작');
    for (const name of ['일반전', '정예전', '보스전', '사건', '상점']) expect(view.textContent).toContain(name);
    expect(view.querySelectorAll('[data-state="open"]')).toHaveLength(2);
    expect(view.querySelector('[aria-label="여정 시설"]')).toBeNull();
  });

  it('1막은 7×7, 보스 승리 후 2막은 9×9 판을 쓴다', () => {
    let act2 = createInitialGameState(DRAFT_GAME_CONFIG);
    act2 = gameReducer(act2, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
    act2 = gameReducer(act2, { type: 'RESOLVE_BATTLE_FOR_ENGINE', battle: 'boss', resolution: 'win', capturedStones: 0 }, DRAFT_GAME_CONFIG);
    act2 = gameReducer(act2, { type: 'OPEN_BATTLE', battle: 'boss' }, DRAFT_GAME_CONFIG);
    const view = renderApp(DRAFT_GAME_CONFIG, act2);
    expect(view.textContent).toContain('제 2막 문지기');
    expect(view.querySelectorAll('.hit')).toHaveLength(81);
  });

  it('카드 선택 전 착수를 막고 카드 선택 뒤 한 좌표 입력으로 확정한다', () => {
    const view = renderApp();
    clickButton('등반 시작');
    clickButton('일반전');
    const first = view.querySelector<SVGCircleElement>('[data-hit="0-0"]')!;
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.textContent).toContain('놓을 카드를 먼저 선택하세요.');
    clickButton('일반석');
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(view.querySelectorAll('.stone-b')).toHaveLength(1);
    expect(view.textContent).toContain('착수했습니다.');
  });

  it('실제 덱·버림·부적·패스·포획·효과 기록을 표시한다', () => {
    let elite = createInitialGameState(DRAFT_GAME_CONFIG);
    elite = gameReducer(elite, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
    elite = gameReducer(elite, { type: 'OPEN_BATTLE', battle: 'elite' }, DRAFT_GAME_CONFIG);
    const view = renderApp(DRAFT_GAME_CONFIG, elite);
    expect(view.querySelector('[aria-label="상대 정보"]')?.textContent).toContain('공격 기풍');
    expect(view.querySelectorAll('.hand .card')).toHaveLength(4);
    for (const text of ['내 덱 10', '버림 0', '부적 0', '연속 패스 0', '포획 0', '효과 기록']) expect(view.textContent).toContain(text);
  });

  it('AI 연속 패스 계가의 첫 승리로 부활하고 이후 기권은 최종 패배로 처리한다', () => {
    vi.useFakeTimers();
    const passingConfig = {
      ...DRAFT_GAME_CONFIG,
      komiBySize: { 7: -100, 9: -100 },
      aiPassScoreThreshold: 1,
    };
    let boss = createInitialGameState(passingConfig);
    boss = gameReducer(boss, { type: 'START_RUN' }, passingConfig);
    boss = gameReducer(boss, { type: 'OPEN_BATTLE', battle: 'boss' }, passingConfig);
    const view = renderApp(passingConfig, boss);
    clickButton('패스');
    act(() => vi.runAllTimers());
    expect(view.textContent).toContain('부활 2단계');
    expect(view.textContent).toContain('부활 전용 착수를 수행했습니다.');
    clickButton('기권');
    expect(view.querySelector('[data-screen="result"]')).toBeTruthy();
    expect(view.textContent).toContain('런 패배');
  });

  it('AI 예약은 화면 이탈 뒤 실행되지 않는다', () => {
    vi.useFakeTimers();
    const view = renderApp();
    clickButton('등반 시작');
    clickButton('일반전');
    clickButton('일반석');
    const first = view.querySelector<SVGCircleElement>('[data-hit="0-0"]')!;
    act(() => first.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    clickButton('지도로 물러나기');
    const before = view.textContent;
    act(() => vi.runAllTimers());
    expect(view.textContent).toBe(before);
  });
});
