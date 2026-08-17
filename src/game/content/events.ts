import type { ContentBehaviorContract } from './contracts';

export type EventId = 'EVENT-001' | 'EVENT-002' | 'EVENT-003';

export interface EventChoiceDefinition {
  readonly id: string;
  readonly result: string;
}

export interface EventDefinition {
  readonly id: EventId;
  readonly name: string;
  readonly choices: readonly EventChoiceDefinition[];
  readonly behavior: ContentBehaviorContract;
}

export const EVENT_DEFINITIONS: Readonly<Record<EventId, EventDefinition>> = {
  'EVENT-001': { id: 'EVENT-001', name: '산속의 노승', choices: [{ id: 'duel', result: 'mini-battle' }, { id: 'lesson', result: 'upgrade-card' }, { id: 'leave', result: 'none' }], behavior: { condition: 'event-node', timing: 'on-enter', target: 'run-state', duration: 'choice-resolution', stacking: 'none', activationLimit: 'once-per-node', passBehavior: 'leave-choice-is-no-change', endBehavior: 'resolve-and-close' } },
  'EVENT-002': { id: 'EVENT-002', name: '깨진 바둑돌', choices: [{ id: 'take', result: 'gain-card' }, { id: 'break', result: 'risk-relic-or-hand' }, { id: 'leave', result: 'none' }], behavior: { condition: 'event-node', timing: 'on-enter', target: 'run-state', duration: 'choice-resolution', stacking: 'none', activationLimit: 'once-per-node', passBehavior: 'leave-choice-is-no-change', endBehavior: 'resolve-and-close' } },
  'EVENT-003': { id: 'EVENT-003', name: '오래된 기보', choices: [{ id: 'study', result: 'reveal-boss-style' }, { id: 'copy', result: 'gain-scout-or-charm' }, { id: 'sell', result: 'gain-currency' }], behavior: { condition: 'event-node', timing: 'on-enter', target: 'run-state', duration: 'choice-resolution', stacking: 'none', activationLimit: 'once-per-node', passBehavior: 'no-pass-choice', endBehavior: 'resolve-and-close' } },
};

export const EVENT_IDS = Object.freeze(Object.keys(EVENT_DEFINITIONS) as EventId[]);
