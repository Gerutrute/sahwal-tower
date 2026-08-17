import type { BoardSize, BoardState, Stone } from './types';

function assertBoardSize(size: number): asserts size is BoardSize {
  if (size !== 7 && size !== 9) {
    throw new RangeError(`unsupported board size: ${size}`);
  }
}

function assertPoint(size: BoardSize, point: number): void {
  if (!Number.isSafeInteger(point) || point < 0 || point >= size * size) {
    throw new RangeError(`point is outside the ${size}×${size} board: ${point}`);
  }
}

export function createBoard(size: BoardSize): BoardState {
  assertBoardSize(size);
  return { size, points: Array(size * size).fill(null) };
}

export function canonicalKoKey(board: BoardState): string {
  const colors = board.points
    .map((value) => value?.color ?? '.')
    .join('');
  return `${board.size}:${colors}`;
}

export function pointIndex(size: BoardSize, row: number, column: number): number {
  assertBoardSize(size);
  if (
    !Number.isSafeInteger(row)
    || !Number.isSafeInteger(column)
    || row < 0
    || column < 0
    || row >= size
    || column >= size
  ) {
    throw new RangeError(`coordinate is outside the ${size}×${size} board: ${row},${column}`);
  }
  return row * size + column;
}

export function pointRow(size: BoardSize, point: number): number {
  assertPoint(size, point);
  return Math.floor(point / size);
}

export function pointColumn(size: BoardSize, point: number): number {
  assertPoint(size, point);
  return point % size;
}

export function neighbors(size: BoardSize, point: number): number[] {
  const row = pointRow(size, point);
  const column = pointColumn(size, point);
  const result: number[] = [];

  if (row > 0) result.push(pointIndex(size, row - 1, column));
  if (column > 0) result.push(pointIndex(size, row, column - 1));
  if (column < size - 1) result.push(pointIndex(size, row, column + 1));
  if (row < size - 1) result.push(pointIndex(size, row + 1, column));

  return result;
}

function stoneAt(board: BoardState, point: number): Stone | null {
  return board.points[point] ?? null;
}

export function groupAt(board: BoardState, point: number): number[] {
  assertPoint(board.size, point);
  const origin = stoneAt(board, point);
  if (origin === null) return [];

  const seen = new Set<number>([point]);
  const queue = [point];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    for (const adjacent of neighbors(board.size, queue[cursor])) {
      const stone = stoneAt(board, adjacent);
      if (stone?.color === origin.color && !seen.has(adjacent)) {
        seen.add(adjacent);
        queue.push(adjacent);
      }
    }
  }

  return [...seen].sort((left, right) => left - right);
}

export function libertiesOf(board: BoardState, group: readonly number[]): number[] {
  const liberties = new Set<number>();
  for (const point of group) {
    for (const adjacent of neighbors(board.size, point)) {
      if (stoneAt(board, adjacent) === null) liberties.add(adjacent);
    }
  }
  return [...liberties].sort((left, right) => left - right);
}

export function libertiesAt(board: BoardState, point: number): number[] {
  return libertiesOf(board, groupAt(board, point));
}

export type IllegalMoveCode = 'occupied' | 'suicide' | 'ko';

export interface LegalPlay {
  readonly ok: true;
  readonly board: BoardState;
  readonly captured: readonly number[];
  readonly capturedCount: number;
  readonly koForbiddenKey: string;
}

export interface IllegalPlay {
  readonly ok: false;
  readonly code: IllegalMoveCode;
  readonly board: BoardState;
  readonly captured: readonly [];
  readonly capturedCount: 0;
  readonly koForbiddenKey: string | null;
}

export type PlayResult = LegalPlay | IllegalPlay;

function illegalPlay(
  board: BoardState,
  code: IllegalMoveCode,
  koForbiddenKey: string | null,
): IllegalPlay {
  return {
    ok: false,
    code,
    board,
    captured: [],
    capturedCount: 0,
    koForbiddenKey,
  };
}

export function tryPlay(
  board: BoardState,
  point: number,
  stone: Stone,
  koForbiddenKey: string | null,
): PlayResult {
  assertPoint(board.size, point);
  if (stoneAt(board, point) !== null) {
    return illegalPlay(board, 'occupied', koForbiddenKey);
  }

  const nextPoints = [...board.points];
  nextPoints[point] = stone;
  const nextBoard: BoardState = { size: board.size, points: nextPoints };
  const captured = new Set<number>();
  const checked = new Set<number>();

  for (const adjacent of neighbors(board.size, point)) {
    const adjacentStone = stoneAt(nextBoard, adjacent);
    if (adjacentStone === null || adjacentStone.color === stone.color || checked.has(adjacent)) {
      continue;
    }
    const group = groupAt(nextBoard, adjacent);
    group.forEach((member) => checked.add(member));
    if (libertiesOf(nextBoard, group).length === 0) {
      group.forEach((member) => captured.add(member));
    }
  }

  captured.forEach((member) => {
    nextPoints[member] = null;
  });

  if (libertiesAt(nextBoard, point).length === 0) {
    return illegalPlay(board, 'suicide', koForbiddenKey);
  }

  const nextKey = canonicalKoKey(nextBoard);
  if (koForbiddenKey !== null && nextKey === koForbiddenKey) {
    return illegalPlay(board, 'ko', koForbiddenKey);
  }

  return {
    ok: true,
    board: nextBoard,
    captured: [...captured].sort((left, right) => left - right),
    capturedCount: captured.size,
    koForbiddenKey: canonicalKoKey(board),
  };
}

export type RulePhase = 'playing' | 'scoring';

export interface RuleState {
  readonly board: BoardState;
  readonly turn: Stone['color'];
  readonly koForbiddenKey: string | null;
  readonly consecutivePasses: number;
  readonly phase: RulePhase;
}

export function createRuleState(
  board: BoardState,
  turn: Stone['color'],
  koForbiddenKey: string | null = null,
): RuleState {
  return {
    board,
    turn,
    koForbiddenKey,
    consecutivePasses: 0,
    phase: 'playing',
  };
}

export interface PassResult {
  readonly state: RuleState;
  readonly consumedCard: false;
  readonly drewCard: false;
  readonly automatic: boolean;
}

export function pass(state: RuleState, automatic = false): PassResult {
  const consecutivePasses = state.consecutivePasses + 1;
  return {
    state: {
      ...state,
      turn: state.turn === 'B' ? 'W' : 'B',
      koForbiddenKey: null,
      consecutivePasses,
      phase: consecutivePasses >= 2 ? 'scoring' : 'playing',
    },
    consumedCard: false,
    drewCard: false,
    automatic,
  };
}

export interface TurnPlayResult {
  readonly state: RuleState;
  readonly play: PlayResult;
}

export function playTurn(state: RuleState, point: number, stone: Stone): TurnPlayResult {
  const play = tryPlay(state.board, point, stone, state.koForbiddenKey);
  if (!play.ok) return { state, play };

  return {
    state: {
      board: play.board,
      turn: state.turn === 'B' ? 'W' : 'B',
      koForbiddenKey: play.koForbiddenKey,
      consecutivePasses: 0,
      phase: 'playing',
    },
    play,
  };
}

export function legalPlayPoints(
  board: BoardState,
  color: Stone['color'],
  koForbiddenKey: string | null,
): number[] {
  const result: number[] = [];
  for (let point = 0; point < board.points.length; point += 1) {
    const probe: Stone = {
      color,
      kind: 'STONE-001',
      instanceId: `legal-probe-${point}`,
    };
    if (tryPlay(board, point, probe, koForbiddenKey).ok) result.push(point);
  }
  return result;
}

export function passIfNoLegalMove(state: RuleState): PassResult | null {
  return legalPlayPoints(state.board, state.turn, state.koForbiddenKey).length === 0
    ? pass(state, true)
    : null;
}
