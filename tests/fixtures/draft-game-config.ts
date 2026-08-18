import type { GameConfig } from '../../src/game/GameProvider';
import { DRAFT_BATTLE_DEFINITION, DRAFT_KOMI } from './draft-battle-config';
import { DRAFT_EFFECT_LIMITS_FIXTURE, DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE } from './draft-effect-config';
import {
  DRAFT_ECONOMY_CONFIG,
  DRAFT_MAP_WEIGHTS,
  DRAFT_REWARD_CATALOG,
  DRAFT_SHOP_CATALOG,
} from './draft-run-config';

export const DRAFT_GAME_CONFIG: GameConfig = {
  seed: 'draft-ui-seed',
  komiBySize: { 7: DRAFT_KOMI, 9: DRAFT_KOMI },
  economy: DRAFT_ECONOMY_CONFIG,
  mapWeights: DRAFT_MAP_WEIGHTS,
  effectLimits: DRAFT_EFFECT_LIMITS_FIXTURE,
  generalCaptureMoneyCap: DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE,
  enemyDeck: [
    'STONE-001', 'STONE-001', 'STONE-001', 'STONE-001', 'STONE-001',
    'STONE-001', 'STONE-002', 'STONE-003', 'STONE-004', 'STONE-005',
  ],
  bossByAct: { 1: DRAFT_BATTLE_DEFINITION, 2: { id: 'DRAFT-ACT2-BOSS' } },
  rewards: DRAFT_REWARD_CATALOG,
  shop: DRAFT_SHOP_CATALOG,
  eventCurrencyReward: 20,
  aiCaptureWeight: 10,
  aiEffectWeights: {
    'STONE-001': 0,
    'STONE-002': 2,
    'STONE-003': 4,
    'STONE-004': 0,
    'STONE-005': 3,
    'STONE-006': 0,
  },
  aiPassScoreThreshold: -1,
  analysisCaptureWeight: 10,
  analysisEffectWeight: 1,
  // HDD-013 pending: test-only draft values until device listening approval.
  audioTuning: {
    crossfadeSeconds: 0.6,
    overlapSeconds: 0.5,
    masterGain: 0.7,
    trackGains: { overworld: 0.8, battle: 0.7, boss: 0.65, shop: 0.75 },
  },
};
