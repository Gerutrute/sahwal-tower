import { createBoard, tryPlay } from './go';
import { createSeededRng, randomInt, type Seed } from './rng';
import { scoreArea } from './scoring';
import type { BoardSize, StoneColor, StoneKind } from './types';

export interface TelemetryMoveInput {
  readonly thinkingMs: number;
  readonly stoneKind: StoneKind | null;
  readonly effectTriggered: boolean;
  readonly passed: boolean;
  readonly captured: number;
}

export interface RunTelemetryInput {
  readonly seed: Seed;
  readonly boardSize: BoardSize;
  readonly won: boolean;
  readonly deckSize: number;
  readonly deadStoneCandidates: number;
  readonly moves: readonly TelemetryMoveInput[];
}

export interface RunTelemetry {
  readonly schemaVersion: 1;
  readonly runFingerprint: string;
  readonly boardSize: BoardSize;
  readonly won: boolean;
  readonly blackWin: 0 | 1;
  readonly blackWinByBoardSize: Readonly<Partial<Record<BoardSize, 0 | 1>>>;
  readonly deckSize: number;
  readonly deadStoneCandidates: number;
  readonly moveCount: number;
  readonly totalThinkingMs: number;
  readonly passCount: number;
  readonly captureCount: number;
  readonly normalStoneSelections: number;
  readonly effectTriggers: number;
  readonly stoneSelections: Readonly<Partial<Record<StoneKind, number>>>;
}

function hashSeed(seed: Seed): string {
  const text = String(seed);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and non-negative`);
  return value;
}

export function collectRunTelemetry(input: RunTelemetryInput): RunTelemetry {
  const stoneSelections: Partial<Record<StoneKind, number>> = {};
  let totalThinkingMs = 0;
  let passCount = 0;
  let captureCount = 0;
  let normalStoneSelections = 0;
  let effectTriggers = 0;
  let moveCount = 0;
  for (const move of input.moves) {
    totalThinkingMs += nonNegative(move.thinkingMs, 'thinkingMs');
    captureCount += nonNegative(move.captured, 'captured');
    if (move.passed) passCount += 1;
    else moveCount += 1;
    if (move.effectTriggered) effectTriggers += 1;
    if (move.stoneKind !== null) {
      stoneSelections[move.stoneKind] = (stoneSelections[move.stoneKind] ?? 0) + 1;
      if (move.stoneKind === 'STONE-001') normalStoneSelections += 1;
    }
  }
  return {
    schemaVersion: 1,
    runFingerprint: hashSeed(input.seed),
    boardSize: input.boardSize,
    won: input.won,
    blackWin: input.won ? 1 : 0,
    blackWinByBoardSize: { [input.boardSize]: input.won ? 1 : 0 },
    deckSize: nonNegative(input.deckSize, 'deckSize'),
    deadStoneCandidates: nonNegative(input.deadStoneCandidates, 'deadStoneCandidates'),
    moveCount,
    totalThinkingMs,
    passCount,
    captureCount,
    normalStoneSelections,
    effectTriggers,
    stoneSelections,
  };
}

export interface WilsonInterval { readonly low: number; readonly high: number }

export function wilson95(successes: number, samples: number): WilsonInterval {
  if (!Number.isSafeInteger(successes) || !Number.isSafeInteger(samples)
    || successes < 0 || samples <= 0 || successes > samples) {
    throw new RangeError('Wilson interval needs integer successes within a positive sample');
  }
  const z = 1.959963984540054;
  const probability = successes / samples;
  const denominator = 1 + z * z / samples;
  const center = (probability + z * z / (2 * samples)) / denominator;
  const spread = z * Math.sqrt((probability * (1 - probability) + z * z / (4 * samples)) / samples) / denominator;
  return { low: Math.max(0, center - spread), high: Math.min(1, center + spread) };
}

export interface SimulationTarget {
  readonly minimumBlackWinRate: number;
  readonly maximumBlackWinRate: number;
}

export interface KomiSimulationInput {
  readonly seed: Seed;
  readonly boardSize: BoardSize;
  readonly komi: number;
  readonly pairCount: number;
  readonly maxMoves: number;
  readonly target: SimulationTarget;
}

export interface SimulatedGame {
  readonly pairIndex: number;
  readonly swapped: boolean;
  readonly agents: Readonly<Record<StoneColor, 'agent-a' | 'agent-b'>>;
  readonly winner: StoneColor | 'draw';
  readonly blackMargin: number;
  readonly moves: number;
}

export interface SimulationPair {
  readonly pairIndex: number;
  readonly games: readonly [SimulatedGame, SimulatedGame];
}

export interface KomiSimulationReport {
  readonly seed: Seed;
  readonly boardSize: BoardSize;
  readonly komi: number;
  readonly pairCount: number;
  readonly sampleCount: number;
  readonly meanBlackMargin: number;
  readonly blackWinRate: number;
  readonly whiteWinRate: number;
  readonly drawRate: number;
  readonly blackWinWilson95: WilsonInterval;
  readonly target: SimulationTarget;
  readonly targetMet: boolean;
  readonly pairs: readonly SimulationPair[];
}

function playSimulatedGame(input: KomiSimulationInput, pairIndex: number, swapped: boolean): SimulatedGame {
  const agents: Readonly<Record<StoneColor, 'agent-a' | 'agent-b'>> = swapped
    ? { B: 'agent-b', W: 'agent-a' }
    : { B: 'agent-a', W: 'agent-b' };
  const randomByAgent = {
    'agent-a': createSeededRng(`${String(input.seed)}:${pairIndex}:agent-a`),
    'agent-b': createSeededRng(`${String(input.seed)}:${pairIndex}:agent-b`),
  } as const;
  let board = createBoard(input.boardSize);
  let color: StoneColor = 'B';
  let forbidden: string | null = null;
  let passes = 0;
  let moves = 0;
  while (passes < 2 && moves < input.maxMoves) {
    const legal: number[] = [];
    for (let point = 0; point < board.points.length; point += 1) {
      const probe = tryPlay(board, point, { color, kind: 'STONE-001', instanceId: `sim-probe-${moves}-${point}` }, forbidden);
      if (probe.ok) legal.push(point);
    }
    if (legal.length === 0) {
      passes += 1;
      forbidden = null;
    } else {
      const rng = randomByAgent[agents[color]];
      const point = legal[randomInt(rng, legal.length)];
      const play = tryPlay(board, point, { color, kind: 'STONE-001', instanceId: `sim-${moves}` }, forbidden);
      if (!play.ok) throw new Error('selected simulation move became illegal');
      board = play.board;
      forbidden = play.koForbiddenKey;
      passes = 0;
    }
    color = color === 'B' ? 'W' : 'B';
    moves += 1;
  }
  const score = scoreArea(board, input.komi);
  return {
    pairIndex,
    swapped,
    agents,
    winner: score.winner,
    blackMargin: score.black.total - score.white.total,
    moves,
  };
}

function validateSimulationInput(input: KomiSimulationInput): void {
  if (!Number.isFinite(input.komi)) throw new RangeError('komi must be injected as a finite number');
  if (!Number.isSafeInteger(input.pairCount) || input.pairCount < 1) throw new RangeError('pairCount must be positive');
  if (!Number.isSafeInteger(input.maxMoves) || input.maxMoves < 2) throw new RangeError('maxMoves must be at least two');
  const { minimumBlackWinRate, maximumBlackWinRate } = input.target;
  if (minimumBlackWinRate < 0 || maximumBlackWinRate > 1 || minimumBlackWinRate > maximumBlackWinRate) {
    throw new RangeError('simulation target must be an ordered rate interval');
  }
}

export function simulateKomiPairs(input: KomiSimulationInput): KomiSimulationReport {
  validateSimulationInput(input);
  const pairs = Array.from({ length: input.pairCount }, (_, pairIndex): SimulationPair => ({
    pairIndex,
    games: [playSimulatedGame(input, pairIndex, false), playSimulatedGame(input, pairIndex, true)],
  }));
  const games = pairs.flatMap(({ games }) => games);
  const blackWins = games.filter(({ winner }) => winner === 'B').length;
  const whiteWins = games.filter(({ winner }) => winner === 'W').length;
  const draws = games.length - blackWins - whiteWins;
  const blackWinRate = blackWins / games.length;
  return {
    seed: input.seed,
    boardSize: input.boardSize,
    komi: input.komi,
    pairCount: input.pairCount,
    sampleCount: games.length,
    meanBlackMargin: games.reduce((sum, game) => sum + game.blackMargin, 0) / games.length,
    blackWinRate,
    whiteWinRate: whiteWins / games.length,
    drawRate: draws / games.length,
    blackWinWilson95: wilson95(blackWins, games.length),
    target: input.target,
    targetMet: blackWinRate >= input.target.minimumBlackWinRate && blackWinRate <= input.target.maximumBlackWinRate,
    pairs,
  };
}
