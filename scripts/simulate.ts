import { simulateKomiPairs, type KomiSimulationInput } from '../src/game/telemetry';
import type { BoardSize } from '../src/game/types';

function read(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`required option missing: --${name}`);
  return value;
}

function number(name: string): number {
  const value = Number(read(name));
  if (!Number.isFinite(value)) throw new Error(`--${name} must be finite`);
  return value;
}

const boardSize = number('size');
if (boardSize !== 7 && boardSize !== 9) throw new Error('--size must be 7 or 9');
const input: KomiSimulationInput = {
  seed: read('seed'),
  boardSize: boardSize as BoardSize,
  komi: number('komi'),
  pairCount: number('pairs'),
  maxMoves: number('max-moves'),
  target: {
    minimumBlackWinRate: number('target-min'),
    maximumBlackWinRate: number('target-max'),
  },
};
console.log(JSON.stringify(simulateKomiPairs(input), null, 2));
