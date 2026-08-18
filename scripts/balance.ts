import { simulateKomiPairs, type KomiSimulationInput } from '../src/game/telemetry';
import type { BoardSize } from '../src/game/types';

function option(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`required option missing: --${name}`);
  return value;
}

function numeric(name: string): number {
  const value = Number(option(name));
  if (!Number.isFinite(value)) throw new Error(`--${name} must be finite`);
  return value;
}

const boardSize = numeric('size');
if (boardSize !== 7 && boardSize !== 9) throw new Error('--size must be 7 or 9');
const input: KomiSimulationInput = {
  seed: option('seed'),
  boardSize: boardSize as BoardSize,
  komi: numeric('komi'),
  pairCount: numeric('pairs'),
  maxMoves: numeric('max-moves'),
  target: {
    minimumBlackWinRate: numeric('target-min'),
    maximumBlackWinRate: numeric('target-max'),
  },
};

const report = simulateKomiPairs(input);
console.log(JSON.stringify(report, null, 2));
