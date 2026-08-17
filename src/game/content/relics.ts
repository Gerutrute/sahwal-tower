import type { ContentBehaviorContract } from './contracts';

export type RelicId =
  | 'RELIC-001'
  | 'RELIC-002'
  | 'RELIC-003'
  | 'RELIC-005'
  | 'RELIC-007'
  | 'RELIC-009'
  | 'RELIC-010'
  | 'RELIC-013';

export interface RelicDefinition {
  readonly id: RelicId;
  readonly name: string;
  readonly style: string;
  readonly behavior: ContentBehaviorContract;
}

export const RELIC_DEFINITIONS: Readonly<Record<RelicId, RelicDefinition>> = {
  'RELIC-001': { id: 'RELIC-001', name: '낡은 바둑통', style: '안정', behavior: { condition: '대국 시작', timing: 'opening-hand', target: 'player-deck', duration: 'battle-start', stacking: 'none', activationLimit: 'once-per-battle', passBehavior: 'unaffected', endBehavior: 'reset' } },
  'RELIC-002': { id: 'RELIC-002', name: '장수의 호패', style: '포획', behavior: { condition: 'capture-threshold', timing: 'after-capture', target: 'run-currency', duration: 'battle', stacking: 'unique-source', activationLimit: 'injected-battle-cap', passBehavior: 'no-progress', endBehavior: 'reset-counter' } },
  'RELIC-003': { id: 'RELIC-003', name: '빈 바둑통', style: '압축', behavior: { condition: 'deck-size-threshold', timing: 'before-inspection', target: 'inspection-count', duration: 'run', stacking: 'none', activationLimit: 'each-inspection', passBehavior: 'unaffected', endBehavior: 'persist' } },
  'RELIC-005': { id: 'RELIC-005', name: '현무의 등껑질', style: '대마', behavior: { condition: 'friendly-group-threshold', timing: 'before-inspection', target: 'inspection-count', duration: 'while-condition-holds', stacking: 'none', activationLimit: 'each-inspection', passBehavior: 're-evaluate', endBehavior: 'persist' } },
  'RELIC-007': { id: 'RELIC-007', name: '순장자의 혼', style: '희생', behavior: { condition: 'friendly-special-stone-captured', timing: 'after-capture', target: 'next-draw', duration: 'next-draw', stacking: 'unique-source', activationLimit: 'once-per-source-per-move', passBehavior: 'preserve-pending', endBehavior: 'clear-pending' } },
  'RELIC-009': { id: 'RELIC-009', name: '푸른 실타래', style: '연결', behavior: { condition: 'connect-distinct-friendly-groups', timing: 'after-placement', target: 'player-deck', duration: 'move', stacking: 'unique-source', activationLimit: 'once-per-move', passBehavior: 'does-not-trigger', endBehavior: 'persist' } },
  'RELIC-010': { id: 'RELIC-010', name: '부러진 자', style: '활로', behavior: { condition: 'rescue-endangered-group', timing: 'after-placement', target: 'player-hand', duration: 'move', stacking: 'unique-source', activationLimit: 'once-per-move', passBehavior: 'does-not-trigger', endBehavior: 'persist' } },
  'RELIC-013': { id: 'RELIC-013', name: '상인의 주판', style: '경제', behavior: { condition: 'cheapest-shop-offer', timing: 'shop-open', target: 'one-shop-offer', duration: 'shop-visit', stacking: 'none', activationLimit: 'once-per-shop', passBehavior: 'unaffected', endBehavior: 'persist' } },
};

export const RELIC_IDS = Object.freeze(Object.keys(RELIC_DEFINITIONS) as RelicId[]);
