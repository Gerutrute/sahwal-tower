import { describe, expect, it } from 'vitest';

import {
  createBoard,
  libertiesAt,
  resolveEffectQueue,
  resolveMove,
  summarizeCapture,
  tryPlay,
  type BoardState,
  type EffectDefinition,
  type Stone,
} from '../src/engine';
import {
  DRAFT_EFFECT_LIMITS_FIXTURE,
  DRAFT_GENERATED_LIMIT_FIXTURE,
  DRAFT_RESOLVED_LIMIT_FIXTURE,
} from './fixtures/draft-effect-config';

function effect(
  id: string,
  priority: EffectDefinition['priority'],
  overrides: Partial<EffectDefinition> = {},
): EffectDefinition {
  return {
    id,
    trigger: 'test-trigger',
    priority,
    sideRelation: 'active',
    sourceKind: 'stone',
    acquisitionOrder: 0,
    sourceId: id,
    perMoveLimit: 1,
    message: id,
    ...overrides,
  };
}

function boardWith(entries: readonly [number, Stone][]): BoardState {
  const board = createBoard(7);
  const points = [...board.points];
  entries.forEach(([point, stone]) => { points[point] = stone; });
  return { ...board, points };
}

function stone(color: Stone['color'], instanceId: string, kind: Stone['kind'] = 'STONE-001'): Stone {
  return { color, kind, instanceId };
}

describe('결정적 효과 큐', () => {
  it('동일 입력은 동일 로그를 낸다', () => {
    const input = [effect('effect-a', 8)];
    expect(resolveEffectQueue(input, DRAFT_EFFECT_LIMITS_FIXTURE).log).toEqual(
      resolveEffectQueue(input, DRAFT_EFFECT_LIMITS_FIXTURE).log,
    );

    const state = { log: [] as const, money: 0 };
    const preview = resolveMove(state, input, DRAFT_EFFECT_LIMITS_FIXTURE, { dryRun: true });
    const commit = resolveMove(state, input, DRAFT_EFFECT_LIMITS_FIXTURE, { dryRun: false });
    expect(preview.previewState).toEqual(commit.state);
    expect(preview.state).toBe(state);
    expect(commit.committed).toBe(true);
  });

  it('우선순위 1부터 10까지 차례로 처리한다', () => {
    const queue = ([10, 3, 8, 1, 6, 4, 9, 2, 7, 5] as const)
      .map((priority) => effect(`priority-${priority}`, priority));
    const result = resolveEffectQueue(queue, DRAFT_EFFECT_LIMITS_FIXTURE);

    expect(result.ok).toBe(true);
    expect(result.log.map((entry) => entry.type === 'effect' ? entry.priority : null)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('같은 우선순위에서 네 source bucket과 획득 순서 및 ID로 정렬한다', () => {
    const queue = [
      effect('opponent-relic', 5, { sideRelation: 'opponent', sourceKind: 'relic' }),
      effect('opponent-stone', 5, { sideRelation: 'opponent', sourceKind: 'stone' }),
      effect('active-relic', 5, { sideRelation: 'active', sourceKind: 'relic' }),
      effect('stone-z', 5, { acquisitionOrder: 2, sourceId: 'z' }),
      effect('stone-b', 5, { acquisitionOrder: 1, sourceId: 'b' }),
      effect('stone-a', 5, { acquisitionOrder: 1, sourceId: 'a' }),
    ];
    const result = resolveEffectQueue(queue, DRAFT_EFFECT_LIMITS_FIXTURE);

    expect(result.log.map((entry) => entry.type === 'effect' ? entry.effectId : null)).toEqual([
      'stone-a',
      'stone-b',
      'stone-z',
      'active-relic',
      'opponent-stone',
      'opponent-relic',
    ]);
  });

  it('동시 다중 포획은 전부 제거한 뒤 하나의 사건으로 요약한다', () => {
    const before = boardWith([
      [1, stone('W', 'sacrifice-a', 'STONE-006')],
      [7, stone('W', 'sacrifice-b', 'STONE-006')],
      [2, stone('B', 'wall-2')],
      [8, stone('B', 'wall-8')],
      [14, stone('B', 'wall-14')],
    ]);
    const play = tryPlay(before, 0, stone('B', 'active'), null);
    expect(play.ok).toBe(true);
    if (!play.ok) return;

    const capture = summarizeCapture(before, play);
    expect(capture.capturedStones.map(({ stone: captured }) => captured.instanceId)).toEqual([
      'sacrifice-a',
      'sacrifice-b',
    ]);
    expect(capture.capturedCount).toBe(2);
    expect(capture.captureEventCount).toBe(1);
    expect(capture.board.points[1]).toBeNull();
    expect(capture.board.points[7]).toBeNull();
    expect(libertiesAt(capture.board, 0)).toEqual([1, 7]);
  });

  it('직접 자기 재발동과 같은 유물의 중복 발동을 막는다', () => {
    const self = effect('self', 8, {
      perMoveLimit: 4,
      generatedEffects: [effect('self', 8, { perMoveLimit: 4 })],
    });
    const relics = [
      effect('relic-first', 8, { sourceKind: 'relic', sourceId: 'relic-x' }),
      effect('relic-second', 8, { sourceKind: 'relic', sourceId: 'relic-x' }),
    ];

    expect(resolveEffectQueue([self], DRAFT_EFFECT_LIMITS_FIXTURE).log).toHaveLength(1);
    expect(resolveEffectQueue(relics, DRAFT_EFFECT_LIMITS_FIXTURE).log).toHaveLength(1);
  });

  it('서로 다른 주입 상한 초과를 원자적으로 거부한다', () => {
    const stableState = {
      board: createBoard(7),
      cards: ['card-a'] as const,
      money: 9,
      log: [] as const,
    };
    const resolvedFailure = resolveMove(
      stableState,
      [effect('one', 1), effect('two', 2)],
      DRAFT_RESOLVED_LIMIT_FIXTURE,
      { dryRun: false },
    );
    const generatedFailure = resolveMove(
      stableState,
      [effect('generator', 1, {
        generatedEffects: [effect('child-a', 2), effect('child-b', 2)],
      })],
      DRAFT_GENERATED_LIMIT_FIXTURE,
      { dryRun: false },
    );

    expect(resolvedFailure).toMatchObject({ ok: false, committed: false, code: 'EFFECT_LIMIT_EXCEEDED' });
    expect(resolvedFailure.state).toBe(stableState);
    expect(resolvedFailure.log[0]).toMatchObject({
      code: 'EFFECT_LIMIT_EXCEEDED',
      limit: 'maxResolvedEffects',
    });
    expect(resolvedFailure.log[0]?.message).toMatch(/[가-힣]/);
    expect(generatedFailure.state).toBe(stableState);
    expect(generatedFailure.log[0]).toMatchObject({ limit: 'maxGeneratedEffects' });
  });
});
