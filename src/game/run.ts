import { validateEconomyConfig, type EconomyConfig, type InventoryState } from './economy';
import type { RewardCandidate } from './rewards';
import type { StoneKind } from './types';
import type { CharmId } from './content/charms';
import type { RelicId } from './content/relics';

export type RunStatus = 'active' | 'won' | 'lost';
export type BattleNodeKind = 'normal' | 'elite' | 'boss';
export type BattleResolution = 'win' | 'loss' | 'resign';

export interface RunState extends InventoryState {
  readonly act: 1 | 2;
  readonly boardSize: 7 | 9;
  readonly status: RunStatus;
  readonly completedNodes: number;
  readonly pendingRewards: readonly RewardCandidate[] | null;
  readonly pendingCharm: CharmId | null;
  readonly selectedRewardId: string | null;
  readonly freeDojoVisits: number;
}

export interface CreateRunInput {
  readonly deck: readonly StoneKind[];
  readonly economy: EconomyConfig;
  readonly relics?: readonly RelicId[];
  readonly charms?: readonly CharmId[];
}

export type RunAction =
  | { readonly type: 'BATTLE_RESOLVED'; readonly resolution: BattleResolution; readonly battle: BattleNodeKind; readonly capturedStones: number }
  | { readonly type: 'OFFER_REWARDS'; readonly candidates: readonly RewardCandidate[] }
  | { readonly type: 'CHOOSE_REWARD'; readonly candidateId: string }
  | { readonly type: 'DECLINE_REWARDS' }
  | { readonly type: 'REPLACE_CHARM'; readonly index: number };

export function createRunState(input: CreateRunInput): RunState {
  validateEconomyConfig(input.economy);
  return {
    act: 1,
    boardSize: 7,
    status: 'active',
    completedNodes: 0,
    currency: input.economy.startingCurrency,
    deck: [...input.deck],
    relics: [...(input.relics ?? [])],
    charms: [...(input.charms ?? [])].slice(0, 2),
    removalCount: 0,
    pendingRewards: null,
    pendingCharm: null,
    selectedRewardId: null,
    freeDojoVisits: 0,
  };
}

function rewardForBattle(config: EconomyConfig, battle: BattleNodeKind, capturedStones: number): number {
  const base = config.battleRewards[battle];
  const captured = Math.min(config.captureRewardCap, Math.max(0, capturedStones) * config.captureRewardPerStone);
  return base + captured;
}

function resolveBattle(state: RunState, action: Extract<RunAction, { readonly type: 'BATTLE_RESOLVED' }>, config: EconomyConfig): RunState {
  if (state.status !== 'active') return state;
  if (action.resolution !== 'win') return { ...state, status: 'lost', pendingRewards: null, pendingCharm: null };
  const currency = state.currency + rewardForBattle(config, action.battle, action.capturedStones);
  if (action.battle !== 'boss') {
    return { ...state, currency, completedNodes: state.completedNodes + 1 };
  }
  if (state.act === 1) {
    return {
      ...state,
      act: 2,
      boardSize: 9,
      currency,
      completedNodes: 0,
      freeDojoVisits: state.freeDojoVisits + config.freeDojoVisitsBeforeAct2,
    };
  }
  return { ...state, currency, status: 'won' };
}

function chooseReward(state: RunState, candidateId: string): RunState {
  if (state.pendingRewards === null || state.pendingCharm !== null) return state;
  const candidate = state.pendingRewards.find((reward) => reward.id === candidateId);
  if (candidate === undefined) return state;
  if (candidate.kind === 'stone') {
    return { ...state, deck: [...state.deck, candidate.stoneKind], pendingRewards: null, selectedRewardId: candidate.id };
  }
  if (candidate.kind === 'relic') {
    return {
      ...state,
      relics: state.relics.includes(candidate.relicId) ? state.relics : [...state.relics, candidate.relicId],
      pendingRewards: null,
      selectedRewardId: candidate.id,
    };
  }
  if (state.charms.length < 2) {
    return { ...state, charms: [...state.charms, candidate.charmId], pendingRewards: null, selectedRewardId: candidate.id };
  }
  return {
    ...state,
    pendingRewards: null,
    pendingCharm: candidate.charmId,
    selectedRewardId: candidate.id,
  };
}

export function runReducer(state: RunState, action: RunAction, config: EconomyConfig): RunState {
  validateEconomyConfig(config);
  switch (action.type) {
    case 'BATTLE_RESOLVED':
      return resolveBattle(state, action, config);
    case 'OFFER_REWARDS':
      return state.status === 'active' && state.pendingRewards === null && state.pendingCharm === null
        && action.candidates.length === 3 && new Set(action.candidates.map(({ id }) => id)).size === 3
        ? { ...state, pendingRewards: [...action.candidates], selectedRewardId: null }
        : state;
    case 'CHOOSE_REWARD':
      return chooseReward(state, action.candidateId);
    case 'DECLINE_REWARDS':
      return state.pendingRewards === null ? state : { ...state, pendingRewards: null, selectedRewardId: null };
    case 'REPLACE_CHARM': {
      if (state.pendingCharm === null || !Number.isSafeInteger(action.index)
        || action.index < 0 || action.index >= state.charms.length) return state;
      const charms = [...state.charms];
      charms[action.index] = state.pendingCharm;
      return { ...state, charms, pendingCharm: null };
    }
  }
}
