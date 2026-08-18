import { expect, it } from 'vitest';
import {
  createInitialGameState,
  gameReducer,
} from '../src/game/GameProvider';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

const FUNDED_CONFIG = {
  ...DRAFT_GAME_CONFIG,
  economy: { ...DRAFT_GAME_CONFIG.economy, startingCurrency: 500 },
};

it('보상·상점·사건은 run 상태를 한 번만 갱신한다', () => {
  let state = createInitialGameState(FUNDED_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, FUNDED_CONFIG);
  state = gameReducer(state, { type: 'RESOLVE_BATTLE_FOR_ENGINE', battle: 'normal', resolution: 'win', capturedStones: 0 }, FUNDED_CONFIG);
  expect(state.screen).toBe('reward');
  const reward = state.run.pendingRewards?.[0];
  expect(reward).toBeTruthy();
  state = gameReducer(state, { type: 'CHOOSE_REWARD', candidateId: reward!.id }, FUNDED_CONFIG);
  expect(state.run.selectedRewardId).toBe(reward!.id);
  state = gameReducer(state, { type: 'OPEN_SHOP' }, FUNDED_CONFIG);
  const offer = state.shop?.offers[0];
  expect(offer).toBeTruthy();
  state = gameReducer(state, { type: 'BUY_OFFER', offerId: offer!.id }, FUNDED_CONFIG);
  const afterFirst = state.run.currency;
  state = gameReducer(state, { type: 'BUY_OFFER', offerId: offer!.id }, FUNDED_CONFIG);
  expect(state.run.currency).toBe(afterFirst);
  state = gameReducer(state, { type: 'OPEN_EVENT' }, FUNDED_CONFIG);
  state = gameReducer(state, { type: 'CHOOSE_EVENT', choice: 'currency' }, FUNDED_CONFIG);
  expect(state.run.currency).toBe(afterFirst + FUNDED_CONFIG.eventCurrencyReward);
});

it('1막 보스 승리는 2막 9×9 지도, 2막 보스 승리는 최종 결과로 간다', () => {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'RESOLVE_BATTLE_FOR_ENGINE', battle: 'boss', resolution: 'win', capturedStones: 0 }, DRAFT_GAME_CONFIG);
  expect(state.run.act).toBe(2);
  expect(state.run.boardSize).toBe(9);
  expect(state.map.act).toBe(2);
  state = gameReducer(state, { type: 'RESOLVE_BATTLE_FOR_ENGINE', battle: 'boss', resolution: 'win', capturedStones: 0 }, DRAFT_GAME_CONFIG);
  expect(state.run.status).toBe('won');
  expect(state.screen).toBe('result');
});
