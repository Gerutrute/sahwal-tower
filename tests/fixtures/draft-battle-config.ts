import type { EnemyDefinition, RevivalScoreWeights } from '../../src/game/battle';

const BOARD_POINTS = 49;

export const DRAFT_ZERO_REVIVAL_WEIGHTS: RevivalScoreWeights = {
  captured: 0,
  liberties: 0,
  adjacentFriendly: 0,
  adjacentOpponent: 0,
  pointWeights: Array(BOARD_POINTS).fill(0),
};

export const DRAFT_BATTLE_DEFINITION: EnemyDefinition = {
  id: 'DRAFT-ACT1-BOSS',
  revival: {
    trait: {
      id: 'DRAFT-REVIVAL-TRAIT',
      scoreWeights: DRAFT_ZERO_REVIVAL_WEIGHTS,
    },
    specialMoves: [{
      id: 'DRAFT-REVIVAL-CARD',
      priority: 1,
      stoneKind: 'STONE-006',
      scoreWeights: DRAFT_ZERO_REVIVAL_WEIGHTS,
      tieBreak: 'lowest-point',
    }],
    bossGauge: {
      id: 'BOSS-001',
      initial: 2,
      specialMoveDelta: 3,
    },
  },
};

export const DRAFT_KOMI = 0;
