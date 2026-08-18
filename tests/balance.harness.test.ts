import { describe, expect, it } from 'vitest';
import { simulateKomiPairs } from '../src/game/telemetry';

describe('seeded komi balance harness', () => {
  for (const boardSize of [7, 9] as const) {
    it(`${boardSize}×${boardSize} 색 반전 쌍이 seed/sample/Wilson/target을 산출한다`, () => {
      const report = simulateKomiPairs({
        seed: `balance-${boardSize}`,
        boardSize,
        komi: boardSize === 7 ? 4.5 : 6.5,
        pairCount: 3,
        maxMoves: boardSize * boardSize * 2,
        target: { minimumBlackWinRate: 0.4, maximumBlackWinRate: 0.6 },
      });
      expect(report.seed).toBe(`balance-${boardSize}`);
      expect(report.sampleCount).toBe(6);
      expect(report.pairs).toHaveLength(3);
      expect(report.pairs.every((pair) => pair.games[0].agents.B === pair.games[1].agents.W)).toBe(true);
      expect(report.blackWinRate + report.whiteWinRate + report.drawRate).toBeCloseTo(1);
      expect(report.blackWinWilson95.low).toBeGreaterThanOrEqual(0);
      expect(report.blackWinWilson95.high).toBeLessThanOrEqual(1);
      expect(report.target).toEqual({ minimumBlackWinRate: 0.4, maximumBlackWinRate: 0.6 });
      expect(Number.isFinite(report.meanBlackMargin)).toBe(true);
    });
  }
});
