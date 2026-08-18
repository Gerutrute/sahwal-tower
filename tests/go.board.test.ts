import { describe, expect, it } from 'vitest';
import { createBoard, groupAt, libertiesAt, neighbors, pointIndex } from '../src/game/go';
import type { BoardSize, BoardState, Stone, StoneColor } from '../src/game/types';

const stone = (color: StoneColor, instanceId: string): Stone => ({
  color,
  kind: 'STONE-001',
  instanceId,
});

const boardWith = (
  size: BoardSize,
  entries: readonly (readonly [number, Stone])[],
): BoardState => {
  const points: (Stone | null)[] = Array(size * size).fill(null);
  for (const [point, value] of entries) points[point] = value;
  return { size, points };
};

describe('동적 바둑판', () => {
  it('7×7과 9×9 판을 만든다', () => {
    const board7 = createBoard(7);
    const board9 = createBoard(9);

    expect(board7).toEqual({ size: 7, points: Array(49).fill(null) });
    expect(board9).toEqual({ size: 9, points: Array(81).fill(null) });
  });

  it.each([7, 9] as const)('%i 크기 판의 귀·변·중앙 이웃 수를 계산한다', (size) => {
    const middle = Math.floor(size / 2);

    expect(neighbors(size, pointIndex(size, 0, 0))).toHaveLength(2);
    expect(neighbors(size, pointIndex(size, 0, middle))).toHaveLength(3);
    expect(neighbors(size, pointIndex(size, middle, middle))).toHaveLength(4);
  });

  it('연결된 같은 색 돌의 그룹과 중복 없는 활로를 구한다', () => {
    const blackA = stone('B', 'black-a');
    const blackB = stone('B', 'black-b');
    const blackC = stone('B', 'black-c');
    const isolated = stone('B', 'isolated');
    const board = boardWith(7, [
      [pointIndex(7, 1, 1), blackA],
      [pointIndex(7, 1, 2), blackB],
      [pointIndex(7, 2, 2), blackC],
      [pointIndex(7, 6, 6), isolated],
    ]);

    expect(groupAt(board, pointIndex(7, 1, 1))).toEqual([
      pointIndex(7, 1, 1),
      pointIndex(7, 1, 2),
      pointIndex(7, 2, 2),
    ]);
    expect(libertiesAt(board, pointIndex(7, 1, 1))).toEqual([
      pointIndex(7, 0, 1),
      pointIndex(7, 0, 2),
      pointIndex(7, 1, 0),
      pointIndex(7, 1, 3),
      pointIndex(7, 2, 1),
      pointIndex(7, 2, 3),
      pointIndex(7, 3, 2),
    ]);
    expect(groupAt(board, pointIndex(7, 0, 0))).toEqual([]);
  });

  it('그룹과 활로 계산은 readonly 입력을 바꾸지 않는다', () => {
    const black = Object.freeze(stone('B', 'black'));
    const points = Array<Stone | null>(81).fill(null);
    points[pointIndex(9, 4, 4)] = black;
    const board = Object.freeze({ size: 9 as const, points: Object.freeze(points) });
    const before = structuredClone(board);

    expect(() => groupAt(board, pointIndex(9, 4, 4))).not.toThrow();
    expect(() => libertiesAt(board, pointIndex(9, 4, 4))).not.toThrow();
    expect(board).toEqual(before);
    expect(board.points[pointIndex(9, 4, 4)]).toBe(black);
  });
});
