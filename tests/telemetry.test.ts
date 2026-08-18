import { describe, expect, it } from 'vitest';
import { collectRunTelemetry, type RunTelemetryInput } from '../src/game/telemetry';

const run: RunTelemetryInput = {
  seed: 'anonymous-seed',
  boardSize: 7,
  won: true,
  deckSize: 10,
  deadStoneCandidates: 2,
  moves: [
    { thinkingMs: 1200, stoneKind: 'STONE-001', effectTriggered: false, passed: false, captured: 1 },
    { thinkingMs: 800, stoneKind: 'STONE-003', effectTriggered: true, passed: false, captured: 0 },
    { thinkingMs: 500, stoneKind: null, effectTriggered: false, passed: true, captured: 0 },
  ],
};

describe('익명 로컬 telemetry', () => {
  it('동일 run은 동일 익명 지표를 낸다', () => {
    expect(collectRunTelemetry(run)).toEqual(collectRunTelemetry(structuredClone(run)));
    expect(JSON.stringify(collectRunTelemetry(run))).not.toMatch(/name|email|ip|userId/i);
  });

  it('착수·고민·병종·효과·일반석·패스·포획·승패·덱·판·사석 지표를 낸다', () => {
    const metrics = collectRunTelemetry(run);
    expect(metrics).toMatchObject({
      moveCount: 2,
      totalThinkingMs: 2500,
      passCount: 1,
      captureCount: 1,
      won: true,
      blackWin: 1,
      blackWinByBoardSize: { 7: 1 },
      deckSize: 10,
      boardSize: 7,
      deadStoneCandidates: 2,
      normalStoneSelections: 1,
      effectTriggers: 1,
    });
    expect(metrics.stoneSelections).toEqual({ 'STONE-001': 1, 'STONE-003': 1 });
  });
});
