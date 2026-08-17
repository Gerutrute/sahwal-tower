import type { ContentBehaviorContract } from './contracts';

export type CharmId = 'ITEM-001' | 'ITEM-002' | 'ITEM-003' | 'ITEM-004' | 'ITEM-005';

export interface CharmDefinition {
  readonly id: CharmId;
  readonly name: string;
  readonly style: string;
  readonly behavior: ContentBehaviorContract;
}

export const CHARM_DEFINITIONS: Readonly<Record<CharmId, CharmDefinition>> = {
  'ITEM-001': { id: 'ITEM-001', name: '수읽기 부적', style: '안정', behavior: { condition: 'pre-move', timing: 'before-card-selection', target: 'hand-and-deck-top', duration: 'immediate', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'not-a-pass', endBehavior: 'discard-unused-at-run-end' } },
  'ITEM-002': { id: 'ITEM-002', name: '환석부', style: '확장', behavior: { condition: 'pre-move', timing: 'before-card-selection', target: 'one-hand-card-and-deck-top', duration: 'immediate', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'not-a-pass', endBehavior: 'discard-unused-at-run-end' } },
  'ITEM-003': { id: 'ITEM-003', name: '귀환부', style: '순환', behavior: { condition: 'pre-move', timing: 'before-card-selection', target: 'one-hand-card-and-deck-bottom', duration: 'immediate', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'not-a-pass', endBehavior: 'discard-unused-at-run-end' } },
  'ITEM-004': { id: 'ITEM-004', name: '금전부', style: '경제', behavior: { condition: 'capture-threshold', timing: 'after-capture', target: 'run-currency', duration: 'battle', stacking: 'none', activationLimit: 'once-per-battle', passBehavior: 'no-progress', endBehavior: 'expire' } },
  'ITEM-005': { id: 'ITEM-005', name: '정심부', style: '활로', behavior: { condition: 'pre-move', timing: 'before-placement', target: 'move-preview', duration: 'turn', stacking: 'replace', activationLimit: 'consumed-on-use', passBehavior: 'expires-on-pass', endBehavior: 'expire' } },
};

export const CHARM_IDS = Object.freeze(Object.keys(CHARM_DEFINITIONS) as CharmId[]);
