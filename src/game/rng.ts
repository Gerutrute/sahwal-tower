export type RandomSource = () => number;
export type Seed = number | string;

const UINT32_RANGE = 0x1_0000_0000;

function hashSeed(seed: Seed): number {
  let hash = 0x811c9dc5;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: Seed): RandomSource {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function randomInt(rng: RandomSource, upperExclusive: number): number {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) {
    throw new RangeError('upperExclusive must be a positive safe integer');
  }
  return Math.floor(rng() * upperExclusive);
}

export function shuffle<T>(values: readonly T[], rng: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(rng, index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
