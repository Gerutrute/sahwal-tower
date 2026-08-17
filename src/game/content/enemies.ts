import type { StoneKind } from '../types';
import type { ContentBehaviorContract } from './contracts';

export type EnemyId = 'ENEMY-001' | 'ENEMY-002' | 'ENEMY-003';

export interface RunEnemyDefinition {
  readonly id: EnemyId;
  readonly name: string;
  readonly style: string;
  readonly preferredStones: readonly StoneKind[];
  readonly behavior: ContentBehaviorContract;
}

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyId, RunEnemyDefinition>> = {
  'ENEMY-001': { id: 'ENEMY-001', name: '성급한 검사', style: '공격', preferredStones: ['STONE-003', 'STONE-004'], behavior: { condition: 'battle-node', timing: 'encounter-start', target: 'enemy-ai', duration: 'battle', stacking: 'none', activationLimit: 'one-enemy-per-battle', passBehavior: 'normal-pass', endBehavior: 'clear-battle-state' } },
  'ENEMY-002': { id: 'ENEMY-002', name: '산사의 노승', style: '두터움', preferredStones: ['STONE-005', 'STONE-001'], behavior: { condition: 'battle-node', timing: 'encounter-start', target: 'enemy-ai', duration: 'battle', stacking: 'none', activationLimit: 'one-enemy-per-battle', passBehavior: 'normal-pass', endBehavior: 'clear-battle-state' } },
  'ENEMY-003': { id: 'ENEMY-003', name: '떠돌이 도박사', style: '변칙', preferredStones: ['STONE-006', 'STONE-002'], behavior: { condition: 'battle-node', timing: 'encounter-start', target: 'enemy-ai', duration: 'battle', stacking: 'none', activationLimit: 'one-enemy-per-battle', passBehavior: 'normal-pass', endBehavior: 'clear-battle-state' } },
};

export const ENEMY_IDS = Object.freeze(Object.keys(ENEMY_DEFINITIONS) as EnemyId[]);
