import { describe, expect, it } from 'vitest';
import { simulateKomiPairs } from '../src/game/telemetry';

describe('현재 바둑 엔진 seeded simulation', () => {
  it('같은 입력은 동일한 색 반전 쌍 결과를 낸다', () => {
    const input = {
      seed: 'repeatable-sim', boardSize: 7 as const, komi: 3.5, pairCount: 2, maxMoves: 98,
      target: { minimumBlackWinRate: 0.35, maximumBlackWinRate: 0.65 },
    };
    expect(simulateKomiPairs(input)).toEqual(simulateKomiPairs(input));
  });
});
