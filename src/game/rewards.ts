import { randomInt } from './rng';
import type { RandomSource, Seed } from './rng';
import { createSeededRng } from './rng';
import type { StoneKind } from './types';
import type { CharmId } from './content/charms';
import type { RelicId } from './content/relics';

export type RewardCandidate =
  | { readonly id: string; readonly kind: 'stone'; readonly stoneKind: StoneKind; readonly name: string; readonly style: string }
  | { readonly id: string; readonly kind: 'charm'; readonly charmId: CharmId; readonly name: string; readonly style: string }
  | { readonly id: string; readonly kind: 'relic'; readonly relicId: RelicId; readonly name: string; readonly style: string };

export interface RewardCatalog {
  readonly candidates: readonly RewardCandidate[];
}

function pickOne<T>(values: readonly T[], rng: RandomSource): T {
  if (values.length === 0) throw new RangeError('cannot pick from an empty reward pool');
  return values[randomInt(rng, values.length)];
}

export function generateRewardCandidates(
  catalog: RewardCatalog,
  currentStyle: string,
  rng: RandomSource,
): readonly [RewardCandidate, RewardCandidate, RewardCandidate] {
  const unique = [...new Map(catalog.candidates.map((candidate) => [candidate.id, candidate])).values()];
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
