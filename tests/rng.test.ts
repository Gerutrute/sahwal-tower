import { describe, expect, it } from 'vitest';
import { createSeededRng, shuffle } from '../src/game/rng';

const take = (rng: () => number, count: number): number[] =>
  Array.from({ length: count }, () => rng());

describe('결정적 RNG', () => {
  it('동일 seed는 동일 수열을 낸다', () => {
    expect(take(createSeededRng('same-seed'), 12)).toEqual(
      take(createSeededRng('same-seed'), 12),
    );
  });

  it('다른 seed는 다른 수열을 낸다', () => {
    expect(take(createSeededRng('seed-a'), 12)).not.toEqual(
      take(createSeededRng('seed-b'), 12),
    );
  });

  it('셔플은 seed로 재현되며 입력을 바꾸지 않는다', () => {
    const cards = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f']);

    const first = shuffle(cards, createSeededRng(42));
    const second = shuffle(cards, createSeededRng(42));

    expect(first).toEqual(second);
    expect(first).not.toEqual(cards);
    expect(cards).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});
