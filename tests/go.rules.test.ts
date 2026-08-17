import { describe, expect, it } from 'vitest';
import {
  canonicalKoKey,
  createRuleState,
  pass,
  passIfNoLegalMove,
  playTurn,
  pointIndex,
  tryPlay,
} from '../src/game/go';
import type { BoardSize, BoardState, Stone, StoneColor, StoneKind } from '../src/game/types';

const stone = (
  color: StoneColor,
  kind: StoneKind = 'STONE-001',
  instanceId = `${color}-${kind}`,
): Stone => ({ color, kind, instanceId });

const boardWith = (
  entries: readonly (readonly [number, Stone])[],
  size: BoardSize = 7,
): BoardState => {
  const points: (Stone | null)[] = Array(size * size).fill(null);
  for (const [point, value] of entries) points[point] = value;
  return { size, points };
};

const koShape = (kinds: readonly [StoneKind, StoneKind, StoneKind, StoneKind]): BoardState =>
  boardWith([
    [pointIndex(7, 0, 1), stone('W', kinds[0], 'ko-white')],
    [pointIndex(7, 1, 0), stone('W', kinds[1], 'support-white')],
    [pointIndex(7, 0, 2), stone('B', kinds[2], 'edge-black')],
    [pointIndex(7, 1, 1), stone('B', kinds[3], 'support-black')],
  ]);

describe('착수와 포획', () => {
  it('한 그룹을 포획하고 잡힌 수를 합산한다', () => {
    const board = boardWith([
      [pointIndex(7, 0, 0), stone('W')],
      [pointIndex(7, 1, 0), stone('B')],
    ]);
    const before = structuredClone(board);

    const result = tryPlay(board, pointIndex(7, 0, 1), stone('B', 'STONE-002'), null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.captured).toEqual([pointIndex(7, 0, 0)]);
    expect(result.capturedCount).toBe(1);
    expect(result.board.points[pointIndex(7, 0, 0)]).toBeNull();
    expect(board).toEqual(before);
  });

  it('서로 다른 여러 그룹을 한 착수로 동시에 포획한다', () => {
    const board = boardWith([
      [pointIndex(7, 0, 0), stone('W', 'STONE-002', 'left-white')],
      [pointIndex(7, 0, 2), stone('W', 'STONE-005', 'right-white')],
      [pointIndex(7, 1, 0), stone('B')],
      [pointIndex(7, 1, 2), stone('B')],
      [pointIndex(7, 0, 3), stone('B')],
    ]);

    const result = tryPlay(board, pointIndex(7, 0, 1), stone('B', 'STONE-003'), null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.captured).toEqual([
      pointIndex(7, 0, 0),
      pointIndex(7, 0, 2),
    ]);
    expect(result.capturedCount).toBe(2);
  });

  it.each(['STONE-001', 'STONE-006'] as const)('%s의 자충수는 허용하지 않는다', (kind) => {
    const board = boardWith([
      [pointIndex(7, 0, 1), stone('W')],
      [pointIndex(7, 1, 0), stone('W')],
      [pointIndex(7, 1, 2), stone('W')],
      [pointIndex(7, 2, 1), stone('W')],
    ]);

    const result = tryPlay(board, pointIndex(7, 1, 1), stone('B', kind), null);

    expect(result).toMatchObject({ ok: false, code: 'suicide', board });
  });

  it('불법 사유를 occupied 구조화 코드로 보고한다', () => {
    const board = boardWith([[pointIndex(7, 3, 3), stone('B')]]);

    expect(tryPlay(board, pointIndex(7, 3, 3), stone('W'), null)).toMatchObject({
      ok: false,
      code: 'occupied',
      board,
    });
  });
});

describe('단순패 규칙', () => {
  it('병종이 달라도 즉시 되따냄은 단순패다', () => {
    const original = koShape(['STONE-001', 'STONE-002', 'STONE-004', 'STONE-005']);
    const colorEquivalent = koShape(['STONE-006', 'STONE-003', 'STONE-002', 'STONE-001']);
    expect(canonicalKoKey(original)).toBe(canonicalKoKey(colorEquivalent));

    const capture = tryPlay(
      original,
      pointIndex(7, 0, 0),
      stone('B', 'STONE-003', 'capturing-general'),
      null,
    );
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;

    const recapture = tryPlay(
      capture.board,
      pointIndex(7, 0, 1),
      stone('W', 'STONE-006', 'recapturing-sacrifice'),
      capture.koForbiddenKey,
    );
    expect(recapture).toMatchObject({ ok: false, code: 'ko' });
  });

  it('패스로 단순패가 해제되어 이전 판면 반복을 허용한다', () => {
    const original = koShape(['STONE-001', 'STONE-001', 'STONE-001', 'STONE-001']);
    const capture = tryPlay(original, pointIndex(7, 0, 0), stone('B'), null);
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;

    const passed = pass(createRuleState(capture.board, 'W', capture.koForbiddenKey));
    const recapture = tryPlay(
      capture.board,
      pointIndex(7, 0, 1),
      stone('W', 'STONE-004'),
      passed.state.koForbiddenKey,
    );

    expect(passed.state.koForbiddenKey).toBeNull();
    expect(recapture.ok).toBe(true);
    if (recapture.ok) {
      expect(canonicalKoKey(recapture.board)).toBe(canonicalKoKey(original));
    }
  });
});

describe('패스', () => {
  it('자발적 패스는 카드 소비와 드로우 없이 턴만 넘긴다', () => {
    const board = boardWith([]);
    const result = pass(createRuleState(board, 'B', canonicalKoKey(board)));

    expect(result).toMatchObject({ consumedCard: false, drewCard: false, automatic: false });
    expect(result.state).toMatchObject({
      board,
      turn: 'W',
      koForbiddenKey: null,
      consecutivePasses: 1,
      phase: 'playing',
    });
    expect(result.state.board).toBe(board);
  });

  it('상대 착수는 연속 패스 수를 초기화한다', () => {
    const afterPass = pass(createRuleState(boardWith([]), 'B')).state;
    const result = playTurn(afterPass, pointIndex(7, 3, 3), stone('W'));

    expect(result.play.ok).toBe(true);
    expect(result.state.consecutivePasses).toBe(0);
    expect(result.state.turn).toBe('B');
  });

  it('합법 수가 없으면 자동 패스한다', () => {
    const fullBoard = boardWith(
      Array.from({ length: 49 }, (_, point) => [point, stone('B', 'STONE-001', `b-${point}`)] as const),
    );

    const result = passIfNoLegalMove(createRuleState(fullBoard, 'W'));

    expect(result).not.toBeNull();
    expect(result).toMatchObject({ automatic: true, consumedCard: false, drewCard: false });
    expect(result?.state.consecutivePasses).toBe(1);
  });
});
