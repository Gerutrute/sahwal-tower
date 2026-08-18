import { describe, expect, it } from 'vitest';

import { chooseBattleAiMove, enumerateLegalAiMoves } from '../src/game/ai';
import { captureNegatedBy } from '../src/game/battle';
import type { StoneCard } from '../src/game/deck';
import { candidatePlacementTriggersEffect } from '../src/game/content/stones';
import { createBoard } from '../src/game/go';
import { createSeededRng } from '../src/game/rng';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

const normal: StoneCard = { id: 'normal', kind: 'STONE-001', temporary: false };
const scout: StoneCard = { id: 'scout', kind: 'STONE-002', temporary: false };

describe('AI 병종 효과 가중치', () => {
  it('병종별 주입 가중치로 직접 효과를 평가한다', () => {
    expect(DRAFT_GAME_CONFIG).toHaveProperty('aiEffectWeights');
    const weights = 'aiEffectWeights' in DRAFT_GAME_CONFIG ? DRAFT_GAME_CONFIG.aiEffectWeights : null;
    expect(weights && Object.keys(weights).sort()).toEqual([
      'STONE-001', 'STONE-002', 'STONE-003', 'STONE-004', 'STONE-005', 'STONE-006',
    ]);
    const board = createBoard(7);
    const choice = chooseBattleAiMove(
      { board, color: 'W', hand: [normal, scout], koForbiddenKey: null },
      (candidate) => candidatePlacementTriggersEffect(board, candidate.point, 'W', candidate.card.kind, 0)
        ? (weights?.[candidate.card.kind] ?? 0) : 0,
      () => 0,
    );
    expect(choice.move?.card.kind).toBe('STONE-002');
  });

  it('포획 수가 같으면 양수 효과 가중치로 척후석을 선택한다', () => {
    const board = createBoard(7);
    const search = { board, color: 'W' as const, hand: [normal, scout], koForbiddenKey: null };
    const choice = chooseBattleAiMove(search, (candidate) => (
      candidate.captured.length * 10
      + (candidatePlacementTriggersEffect(
        board,
        candidate.point,
        'W',
        candidate.card.kind,
        candidate.captured.length,
      ) ? 2 : 0)
    ), createSeededRng('effect-positive'));

    expect(choice.move?.card.kind).toBe('STONE-002');
  });

  it('효과 가중치 0이면 기존 포획 평가와 같은 첫 동률 후보를 유지한다', () => {
    const board = createBoard(7);
    const search = { board, color: 'W' as const, hand: [normal, scout], koForbiddenKey: null };
    const noEffect = chooseBattleAiMove(search, (candidate) => candidate.captured.length * 10,
      () => 0);
    const injectedZero = chooseBattleAiMove(search, (candidate) => (
      candidate.captured.length * 10
      + (candidatePlacementTriggersEffect(
        board,
        candidate.point,
        'W',
        candidate.card.kind,
        candidate.captured.length,
      ) ? 0 : 0)
    ), () => 0);

    expect(injectedZero.move).toMatchObject({
      card: noEffect.move?.card,
      point: noEffect.move?.point,
      score: noEffect.move?.score,
    });
  });

  it('장군·수호 발동 조건과 비배치 효과 병종을 정확히 예측한다', () => {
    const board = createBoard(7);
    expect(candidatePlacementTriggersEffect(board, 0, 'B', 'STONE-003', 0)).toBe(false);
    expect(candidatePlacementTriggersEffect(board, 0, 'B', 'STONE-003', 1)).toBe(true);
    expect(candidatePlacementTriggersEffect(board, 0, 'B', 'STONE-002', 0)).toBe(true);

    const points = [...board.points];
    points[1] = { color: 'B', kind: 'STONE-001', instanceId: 'friend' };
    points[2] = { color: 'W', kind: 'STONE-001', instanceId: 'block-right' };
    points[8] = { color: 'W', kind: 'STONE-001', instanceId: 'block-down' };
    expect(candidatePlacementTriggersEffect({ size: 7, points }, 0, 'B', 'STONE-005', 0)).toBe(true);
    for (const kind of ['STONE-001', 'STONE-004', 'STONE-006'] as const) {
      expect(candidatePlacementTriggersEffect(board, 0, 'B', kind, 0)).toBe(false);
    }
  });

  it('보호 그룹 포획 후보는 유효 포획과 장군 효과를 0으로 평가한다', () => {
    const base = createBoard(7);
    const points = [...base.points];
    points[1] = { color: 'B', kind: 'STONE-001', instanceId: 'protected-friend' };
    points[2] = { color: 'W', kind: 'STONE-001', instanceId: 'right' };
    points[8] = { color: 'W', kind: 'STONE-001', instanceId: 'down' };
    const board = { size: 7 as const, points };
    const general = { id: 'general', kind: 'STONE-003' as const, temporary: false };
    const candidate = enumerateLegalAiMoves({ board, color: 'W', hand: [general], koForbiddenKey: null })
      .find(({ point }) => point === 0)!;
    const protections = [{ id: 'shield', color: 'B' as const, memberInstanceIds: ['protected-friend'], grantedAtMove: 1 }];
    const effective = captureNegatedBy(board, candidate.captured, protections, 'W') === null
      ? candidate.captured.length : 0;
    expect(candidate.captured).toEqual([1]);
    expect(effective).toBe(0);
    expect(candidatePlacementTriggersEffect(board, candidate.point, 'W', general.kind, effective)).toBe(false);
  });
});
