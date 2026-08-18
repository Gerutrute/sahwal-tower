import { expect, it } from 'vitest';
import { createBoard } from '../src/game/go';
import { buildResultAnalysis } from '../src/game/GameProvider';

it('실제 계가 분해와 결정적인 복기 후보 1~3개를 만든다', () => {
  const analysis = buildResultAnalysis(createBoard(7), 0, [
    { id: '수 1', impact: 1, turn: 1 },
    { id: '수 2', impact: 4, turn: 2 },
    { id: '수 3', impact: -2, turn: 3 },
    { id: '수 4', impact: 3, turn: 4 },
  ], 'analysis-seed', { B: 0, W: 0 });
  expect(analysis.score.black.stones).toBe(0);
  expect(analysis.score.white.total).toBe(0);
  expect(analysis.criticalMoves.map(({ id }) => id)).toEqual(['수 2', '수 4', '수 3']);
  expect(analysis.criticalMoves).toHaveLength(3);
});
