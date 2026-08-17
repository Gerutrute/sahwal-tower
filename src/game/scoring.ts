import { neighbors } from './go';
import type { BoardState, StoneColor } from './types';

export interface ColorAreaScore {
  readonly stones: number;
  readonly territory: number;
  readonly total: number;
}

export interface AreaScore {
  readonly black: ColorAreaScore;
  readonly white: ColorAreaScore;
  readonly neutral: number;
  readonly komi: number;
  readonly winner: StoneColor | 'draw';
  readonly margin: number;
}

export function scoreArea(board: BoardState, komi: number): AreaScore {
  if (!Number.isFinite(komi)) throw new RangeError('komi must be finite');

  let blackStones = 0;
  let whiteStones = 0;
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let neutral = 0;
  const visited = new Set<number>();

  for (let point = 0; point < board.points.length; point += 1) {
    const value = board.points[point];
    if (value?.color === 'B') {
      blackStones += 1;
      continue;
    }
    if (value?.color === 'W') {
      whiteStones += 1;
      continue;
    }
    if (visited.has(point)) continue;

    const region: number[] = [];
    const boundary = new Set<StoneColor>();
    const queue = [point];
    visited.add(point);
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      region.push(current);
      for (const adjacent of neighbors(board.size, current)) {
        const adjacentStone = board.points[adjacent];
        if (adjacentStone === null) {
          if (!visited.has(adjacent)) {
            visited.add(adjacent);
            queue.push(adjacent);
          }
        } else {
          boundary.add(adjacentStone.color);
        }
      }
    }

    if (boundary.size === 1 && boundary.has('B')) blackTerritory += region.length;
    else if (boundary.size === 1 && boundary.has('W')) whiteTerritory += region.length;
    else neutral += region.length;
  }

  const blackTotal = blackStones + blackTerritory;
  const whiteTotal = whiteStones + whiteTerritory + komi;
  return {
    black: { stones: blackStones, territory: blackTerritory, total: blackTotal },
    white: { stones: whiteStones, territory: whiteTerritory, total: whiteTotal },
    neutral,
    komi,
    winner: blackTotal === whiteTotal ? 'draw' : blackTotal > whiteTotal ? 'B' : 'W',
    margin: Math.abs(blackTotal - whiteTotal),
  };
}
