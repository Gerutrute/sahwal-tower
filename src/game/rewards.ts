import { randomInt } from './rng';
import type { RandomSource, Seed } from './rng';
import { createSeededRng } from './rng';
import type { StoneKind } from './types';
import type { CharmId } from './content/charms';
import type { RelicId } from './content/relics';
import { STONE_DEFINITIONS } from './content/stones';
import { CHARM_DEFINITIONS } from './content/charms';
import { RELIC_DEFINITIONS } from './content/relics';
import type { InventoryState } from './economy';

export type RewardCandidate =
  | { readonly id: string; readonly kind: 'stone'; readonly stoneKind: StoneKind; readonly name: string; readonly style: string }
  | { readonly id: string; readonly kind: 'charm'; readonly charmId: CharmId; readonly name: string; readonly style: string }
  | { readonly id: string; readonly kind: 'relic'; readonly relicId: RelicId; readonly name: string; readonly style: string };

export interface RewardCatalog {
  readonly candidates: readonly RewardCandidate[];
}

export interface RewardDetail {
  readonly name: string;
  readonly kindLabel: '특수 돌' | '부적' | '유물';
  readonly summary: string;
  readonly condition: string;
  readonly effect: string;
  readonly strategy: string;
  readonly synergy: string;
  readonly ownedCount: number;
}

export function describeRewardCandidate(
  candidate: RewardCandidate,
  inventory: Pick<InventoryState, 'deck' | 'charms' | 'relics'>,
): RewardDetail {
  if (candidate.kind === 'stone') {
    const definition = STONE_DEFINITIONS[candidate.stoneKind];
    return {
      name: definition.name,
      kindLabel: '특수 돌',
      ...definition.ui,
      ownedCount: inventory.deck.filter((kind) => kind === candidate.stoneKind).length,
    };
  }
  if (candidate.kind === 'charm') {
    const definition = CHARM_DEFINITIONS[candidate.charmId];
    return {
      name: definition.name,
      kindLabel: '부적',
      ...definition.ui,
      ownedCount: inventory.charms.filter((id) => id === candidate.charmId).length,
    };
  }
  const definition = RELIC_DEFINITIONS[candidate.relicId];
  return {
    name: definition.name,
    kindLabel: '유물',
    ...definition.ui,
    ownedCount: inventory.relics.includes(candidate.relicId) ? 1 : 0,
  };
}

function pickOne<T>(values: readonly T[], rng: RandomSource): T {
  if (values.length === 0) throw new RangeError('cannot pick from an empty reward pool');
  return values[randomInt(rng, values.length)];
}

export function generateRewardCandidates(
  catalog: RewardCatalog,
  currentStyle: string,
  rng: RandomSource,
  isCandidateUnlocked: (candidateId: string) => boolean = () => true,
): readonly [RewardCandidate, RewardCandidate, RewardCandidate] {
  const unique = [...new Map(catalog.candidates
    .filter((candidate) => isCandidateUnlocked(candidate.id))
    .map((candidate) => [candidate.id, candidate])).values()];
  const related = unique.filter((candidate) => candidate.style === currentStyle);
  const expansion = unique.filter((candidate) => candidate.style !== currentStyle);
  if (unique.length < 3 || related.length === 0 || expansion.length === 0) {
    throw new RangeError('reward catalog needs three unique candidates, including related and expansion styles');
  }
  const first = pickOne(related, rng);
  const second = pickOne(expansion.filter((candidate) => candidate.id !== first.id), rng);
  const remaining = unique.filter((candidate) => candidate.id !== first.id && candidate.id !== second.id);
  const third = pickOne(remaining, rng);
  return [first, second, third];
}

export interface MoveImpactRecord {
  readonly id: string;
  readonly impact: number;
  readonly turn: number;
}

export function decisiveMoveCandidates(
  records: readonly MoveImpactRecord[],
  seed: Seed,
): readonly MoveImpactRecord[] {
  if (records.length === 0) return [];
  const rng = createSeededRng(seed);
  return records
    .map((record, order) => ({ record, order, tie: rng() }))
    .sort((left, right) => Math.abs(right.record.impact) - Math.abs(left.record.impact)
      || left.tie - right.tie
      || left.record.turn - right.record.turn
      || left.order - right.order)
    .slice(0, Math.min(3, records.length))
    .map(({ record }) => record);
}
