import { describe, expect, it } from 'vitest';
import {
  createRuleState,
  pass,
  passIfNoLegalMove,
} from '../src/game/go';
import { scoreArea } from '../src/game/scoring';
import type { BoardState, Stone, StoneColor } from '../src/game/types';

const stone = (color: StoneColor, instanceId: string): Stone => ({
  color,
  kind: 'STONE-001',
  instanceId,
});

const filledBoard = (color: StoneColor): BoardState => ({
  size: 7,
  points: Array.from({ length: 49 }, (_, point) => stone(color, `${color}-${point}`)),
});

describe('계가 전이', () => {
  it('양측의 연속 패스 뒤 계가로 전이한다', () => {
    const first = pass(createRuleState({ size: 7, points: Array(49).fill(null) }, 'B'));
    const second = pass(first.state);

    expect(first.state.phase).toBe('playing');
    expect(second.state).toMatchObject({ consecutivePasses: 2, phase: 'scoring' });
  });

  it('양측 자동 패스도 계가로 전이한다', () => {
    const board = filledBoard('B');
    const first = passIfNoLegalMove(createRuleState(board, 'W'));
    expect(first).not.toBeNull();
    const second = passIfNoLegalMove(first!.state);

    expect(first?.automatic).toBe(true);
    expect(second?.automatic).toBe(true);
    expect(second?.state.phase).toBe('scoring');
  });
});

describe('면적 계가', () => {
  it('단색 경계의 빈 영역은 그 색의 영역이다', () => {
    const blackBoard = filledBoard('B');
    const blackPoints = [...blackBoard.points];
    blackPoints[24] = null;

    const whiteBoard = filledBoard('W');
    const whitePoints = [...whiteBoard.points];
    whitePoints[24] = null;

    expect(scoreArea({ size: 7, points: blackPoints }, 0)).toMatchObject({
      black: { stones: 48, territory: 1, total: 49 },
      white: { stones: 0, territory: 0, total: 0 },
      neutral: 0,
    });
    expect(scoreArea({ size: 7, points: whitePoints }, 0)).toMatchObject({
      black: { stones: 0, territory: 0, total: 0 },
      white: { stones: 48, territory: 1, total: 49 },
      neutral: 0,
    });
  });

  it('혼합 경계의 빈 영역은 중립이다', () => {
    const board = filledBoard('B');
    const points = [...board.points];
    points[24] = null;
    points[17] = stone('W', 'white-boundary');

    expect(scoreArea({ size: 7, points }, 0)).toMatchObject({
      black: { stones: 47, territory: 0, total: 47 },
      white: { stones: 1, territory: 0, total: 1 },
      neutral: 1,
    });
  });

  it('사활을 추론하지 않고 잔존 돌을 모두 살아 있는 돌로 센다', () => {
    const board = filledBoard('B');
    const points = [...board.points];
    points[24] = stone('W', 'surrounded-white');

    expect(scoreArea({ size: 7, points }, 0)).toMatchObject({
      black: { stones: 48, territory: 0, total: 48 },
      white: { stones: 1, territory: 0, total: 1 },
    });
  });

  it('흑은 돌과 영역, 백은 돌과 영역과 필수 komi를 합산한다', () => {
    const board: BoardState = { size: 7, points: Array(49).fill(null) };

    expect(scoreArea.length).toBe(2);
    expect(scoreArea(board, 0.5)).toMatchObject({
      black: { stones: 0, territory: 0, total: 0 },
      white: { stones: 0, territory: 0, total: 0.5 },
      komi: 0.5,
      winner: 'W',
      margin: 0.5,
    });
  });
});
