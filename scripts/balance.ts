import { aiTurn, autoPlayerMove, newRun, playerMove, playerPass, startBattle, type FloorId } from '../src/engine';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function seeded(seed: number) { let value = seed >>> 0; return () => { value = (value * 1103515245 + 12345) >>> 0; return value / 4294967296; }; }
function duel(floor: FloorId, seed: number) {
  const random = seeded(seed); let state = startBattle(newRun(), floor); let moves = 0;
  while (state.status === 'playing' && moves < 400) {
    if (state.turn === 'B') { const p = autoPlayerMove(state, random); state = p === null ? playerPass(state) : playerMove(state, p); }
    else state = aiTurn(state, random);
    moves += 1;
  }
  if (state.status === 'playing') throw new Error(`${floor}층 ${seed}: 400수 안에 종료되지 않음`);
  return state.status === 'win';
}
const ranges: Record<FloorId, [number, number]> = { 1: [1, 1], 2: [.4, .6], 3: [.15, .3] };
const rows: Array<{ floor: FloorId; wins: number; rate: number; min: number; max: number; inRange: boolean }> = [];
for (const floor of [1, 2, 3] as const) {
  const wins = Array.from({ length: 12 }, (_, game) => duel(floor, floor * 1000 + game)).filter(Boolean).length;
  const rate = wins / 12; const [min, max] = ranges[floor];
  const inRange = rate >= min && rate <= max;
  rows.push({ floor, wins, rate, min, max, inRange });
  console.log(`${floor}층 | wins=${wins}/12 | rate=${(rate * 100).toFixed(1)}% | target=${(min * 100).toFixed(0)}~${(max * 100).toFixed(0)}% | in_range=${inRange}`);
}
const reportPath = resolve('logs/2026-08-15/prompt-20260815-015036-599aa1b4-sahwal-tower/balance-report.md');
writeFileSync(reportPath, [
  '# Balance Report', '',
  '| 층 | 승리/12 | 승률 | 목표 | in_range |',
  '|---|---:|---:|---:|---|',
  ...rows.map(({ floor, wins, rate, min, max, inRange }) => `| ${floor} | ${wins}/12 | ${(rate * 100).toFixed(1)}% | ${(min * 100).toFixed(0)}~${(max * 100).toFixed(0)}% | ${inRange} |`),
  '',
  '> 12회 결과는 측정·보고용이며 자동 튜닝이나 출시 판정의 근거가 아니다. 층 확정값은 인간 decision gate 없이 변경하지 않는다.',
  '',
].join('\n'), 'utf8');
console.log(`report=${reportPath}`);
