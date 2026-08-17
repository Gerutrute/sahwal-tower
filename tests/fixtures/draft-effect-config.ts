import type { EffectLimits } from '../../src/game/effects';

export const DRAFT_EFFECT_LIMITS_FIXTURE: EffectLimits = {
  maxResolvedEffects: 16,
  maxQueueDepth: 4,
  maxGeneratedEffects: 8,
  maxEffectsPerSource: 4,
  maxHandSize: 8,
};

export const DRAFT_RESOLVED_LIMIT_FIXTURE: EffectLimits = {
  ...DRAFT_EFFECT_LIMITS_FIXTURE,
  maxResolvedEffects: 1,
};

export const DRAFT_GENERATED_LIMIT_FIXTURE: EffectLimits = {
  ...DRAFT_EFFECT_LIMITS_FIXTURE,
  maxGeneratedEffects: 1,
};

export const DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE = 7;
