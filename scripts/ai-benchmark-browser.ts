import {
  createAiBenchmarkFixtures,
  independentLegalCombinationCount,
  runDraftAiChoice,
} from '../tests/fixtures/ai-benchmark';
import type { BoardSize } from '../src/game/types';

interface SizeBenchmarkResult {
  readonly size: BoardSize;
  readonly sampleCount: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly expectedCandidateCount: number;
  readonly actualCandidateCount: number;
  readonly seeds: readonly string[];
}

export interface AiBenchmarkResult {
  readonly cpuThrottleRate: 4;
  readonly warmupPerFixture: 10;
  readonly measurementsPerFixture: 100;
  readonly results: readonly SizeBenchmarkResult[];
}

function percentile(sorted: readonly number[], ratio: number): number {
  return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0;
}

export function runAiBenchmark(): AiBenchmarkResult {
  const fixtures = createAiBenchmarkFixtures();
  const results = ([7, 9] as const).map((size) => {
    const selected = fixtures.filter((fixture) => fixture.size === size);
    const timings: number[] = [];
    let expectedCandidateCount = 0;
    let actualCandidateCount = 0;

    selected.forEach((fixture) => {
      for (let warmup = 0; warmup < 10; warmup += 1) {
        runDraftAiChoice(fixture.state, `${fixture.seed}-warmup-${warmup}`);
      }
      const expected = independentLegalCombinationCount(fixture.state);
      for (let sample = 0; sample < 100; sample += 1) {
        const started = performance.now();
        const choice = runDraftAiChoice(fixture.state, `${fixture.seed}-sample-${sample}`);
        timings.push(performance.now() - started);
        expectedCandidateCount += expected;
        actualCandidateCount += choice.evaluatedCount;
      }
    });

    const sorted = [...timings].sort((left, right) => left - right);
    return {
      size,
      sampleCount: timings.length,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      maxMs: sorted.at(-1) ?? 0,
      expectedCandidateCount,
      actualCandidateCount,
      seeds: selected.map((fixture) => fixture.seed),
    };
  });

  return {
    cpuThrottleRate: 4,
    warmupPerFixture: 10,
    measurementsPerFixture: 100,
    results,
  };
}
