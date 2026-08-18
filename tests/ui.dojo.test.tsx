import { expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from '../src/game/GameProvider';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

const FUNDED_CONFIG = {
  ...DRAFT_GAME_CONFIG,
  economy: { ...DRAFT_GAME_CONFIG.economy, startingCurrency: 200 },
};

it('복제는 선택 카드만 한 장 추가한다', () => {
  let state = createInitialGameState(FUNDED_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, FUNDED_CONFIG);
  state = gameReducer(state, { type: 'OPEN_DOJO' }, FUNDED_CONFIG);
  const selected = state.run.deck[2];
  state = gameReducer(state, { type: 'USE_DOJO', action: { type: 'duplicate', cardIndex: 2 } }, FUNDED_CONFIG);
  expect(state.run.deck).toHaveLength(11);
  expect(state.run.deck.at(-1)).toBe(selected);
  const currency = state.run.currency;
  state = gameReducer(state, { type: 'USE_DOJO', action: { type: 'duplicate', cardIndex: 2 } }, FUNDED_CONFIG);
  expect(state.run.deck).toHaveLength(11);
  expect(state.run.currency).toBe(currency);
});

it('제거·교환·복제 비용은 주입 config 값을 사용한다', () => {
  let state = createInitialGameState(FUNDED_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, FUNDED_CONFIG);
  state = gameReducer(state, { type: 'OPEN_DOJO' }, FUNDED_CONFIG);
  const before = state.run.currency;
  state = gameReducer(state, { type: 'USE_DOJO', action: { type: 'exchange', cardIndex: 0, replacement: 'STONE-006' } }, FUNDED_CONFIG);
  expect(state.run.currency).toBe(before - FUNDED_CONFIG.economy.dojoPrices.exchange);
  expect(state.run.deck[0]).toBe('STONE-006');
});
