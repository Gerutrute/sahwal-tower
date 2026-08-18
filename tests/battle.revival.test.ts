import { describe, expect, it } from 'vitest';
import {
  createBattleState,
  performRevivalSpecialMove,
  resolveBattleOutcome,
  validateEnemyDefinition,
  type EnemyDefinition,
  type RevivalPriority,
  type RevivalScoreWeights,
} from '../src/game/battle';
import { canonicalKoKey, createBoard, tryPlay } from '../src/game/go';
import { createSeededRng } from '../src/game/rng';
import type { BoardState, Stone } from '../src/game/types';
import {
  DRAFT_BATTLE_DEFINITION,
  DRAFT_KOMI,
  DRAFT_ZERO_REVIVAL_WEIGHTS,
} from './fixtures/draft-battle-config';

const pointWeights = (point: number, value: number): number[] => {
  const weights = Array<number>(49).fill(0);
  weights[point] = value;
  return weights;
};

const weightsAt = (point: number, value: number): RevivalScoreWeights => ({
  ...DRAFT_ZERO_REVIVAL_WEIGHTS,
  pointWeights: pointWeights(point, value),
});

const enemyWith = (
  traitWeights: RevivalScoreWeights,
  moveWeights: RevivalScoreWeights,
  priority: RevivalPriority = 1,
  tieBreak: 'lowest-point' | 'seeded' = 'lowest-point',
): EnemyDefinition => ({
  id: 'DRAFT-INJECTED-ENEMY',
  revival: {
    trait: { id: 'DRAFT-INJECTED-TRAIT', scoreWeights: traitWeights },
    specialMoves: [{
      id: 'DRAFT-INJECTED-CARD',
      priority,
      stoneKind: 'STONE-006',
      scoreWeights: moveWeights,
      tieBreak,
    }],
    bossGauge: { id: 'BOSS-001', initial: 2, specialMoveDelta: 3 },
  },
});

const create = (
  enemy = DRAFT_BATTLE_DEFINITION,
  board: BoardState = createBoard(7),
  koForbiddenKey: string | null = null,
) => createBattleState({
  act: 1,
  board,
  playerDeck: ['STONE-001', 'STONE-002', 'STONE-003', 'STONE-004', 'STONE-005'],
  enemyDeck: ['STONE-006', 'STONE-005', 'STONE-004', 'STONE-003', 'STONE-002'],
  enemy,
  komi: DRAFT_KOMI,
  playerRelics: ['RELIC-PLAYER'],
  enemyRelics: ['RELIC-ENEMY'],
  koForbiddenKey,
  rng: createSeededRng('create-revival'),
  maxHandSize: 8,
});

const revive = (state = create()) => resolveBattleOutcome({
  ...state,
  phase: 'scoring' as const,
  consecutivePasses: 2,
  ending: true,
}, 'B', createSeededRng('revive'));

describe('1막 2단계 부활', () => {
  it('보상을 보류하고 전투 자산과 판 위 병종을 보존한 채 종료 상태를 초기화한다', () => {
    const points = [...createBoard(7).points];
    points[7] = { color: 'B', kind: 'STONE-003', instanceId: 'general-on-board' };
    points[8] = { color: 'W', kind: 'STONE-005', instanceId: 'guardian-on-board' };
    const initial = create(DRAFT_BATTLE_DEFINITION, { size: 7, points });
    const playerDiscard = initial.decks.B.hand[0];
    const enemyDiscard = initial.decks.W.hand[0];
    const marked = {
      ...initial,
      decks: {
        B: {
          ...initial.decks.B,
          hand: initial.decks.B.hand.slice(1),
          discardPile: [playerDiscard],
        },
        W: {
          ...initial.decks.W,
          hand: initial.decks.W.hand.slice(1),
          discardPile: [enemyDiscard],
        },
      },
      phase: 'scoring' as const,
      consecutivePasses: 2,
      ending: true,
    };

    const next = resolveBattleOutcome(marked, 'B', createSeededRng('first-player-win'));

    expect(next.phase).toBe('revival-special-move');
    expect(next.rewardStatus).toBe('withheld');
    expect(next.board).toBe(marked.board);
    expect(next.decks.B).toBe(marked.decks.B);
    expect(next.decks.W).toBe(marked.decks.W);
    expect(next.decks.B.hand).toBe(marked.decks.B.hand);
    expect(next.decks.W.hand).toBe(marked.decks.W.hand);
    expect(next.decks.B.drawPile).toBe(marked.decks.B.drawPile);
    expect(next.decks.W.drawPile).toBe(marked.decks.W.drawPile);
    expect(next.decks.B.discardPile).toBe(marked.decks.B.discardPile);
    expect(next.decks.W.discardPile).toBe(marked.decks.W.discardPile);
    expect(next.relics).toBe(marked.relics);
    expect(next.board.points.map((stone) => stone?.kind ?? null))
      .toEqual(marked.board.points.map((stone) => stone?.kind ?? null));
    expect(next.ending).toBe(false);
    expect(next.consecutivePasses).toBe(0);
    expect(next.revivalStage).toBe(2);
    expect(next.enemyTraits).toContain('DRAFT-REVIVAL-TRAIT');
  });

  it('1단계 플레이어 패배는 부활을 발동하지 않고 즉시 런을 끝낸다', () => {
    const next = resolveBattleOutcome(create(), 'W', createSeededRng('first-player-loss'));

    expect(next).toMatchObject({
      phase: 'result',
      outcome: 'run-loss',
      rewardStatus: 'withheld',
      revivalStage: 1,
    });
  });

  it('전용 착수는 손패를 쓰거나 보충 드로우하지 않고 주입된 병종·우선순위·게이지를 쓴다', () => {
    const state = revive();
    const beforePlayerDeck = structuredClone(state.decks.B);
    const beforeEnemyDeck = structuredClone(state.decks.W);

    const next = performRevivalSpecialMove(state, createSeededRng('special'));
    const move = next.log.at(-1);

    expect(next.turn).toBe('B');
    expect(next.phase).toBe('turn-start');
    expect(next.decks.B).toEqual(beforePlayerDeck);
    expect(next.decks.W).toEqual(beforeEnemyDeck);
    expect(move).toMatchObject({
      type: 'move',
      actor: 'W',
      sourceId: 'DRAFT-REVIVAL-CARD',
      priority: 1,
    });
    expect(next.board.points[move?.point ?? -1]).toMatchObject({ color: 'W', kind: 'STONE-006' });
    expect(next.board.points.filter(Boolean)).toHaveLength(state.board.points.filter(Boolean).length + 1);
    expect(next.bossGauges['BOSS-001']).toBe(5);
  });

  it('전용 착수는 자충수와 단순패를 후보에서 제외한다', () => {
    const points = [...createBoard(7).points];
    for (const point of [1, 7, 9, 15]) {
      points[point] = { color: 'B', kind: 'STONE-001', instanceId: `surround-${point}` };
    }
    const board: BoardState = { size: 7, points };
    const probe: Stone = { color: 'W', kind: 'STONE-006', instanceId: 'ko-probe' };
    const koPlay = tryPlay(board, 48, probe, null);
    expect(koPlay.ok).toBe(true);
    if (!koPlay.ok) return;
    const weighted = enemyWith(
      DRAFT_ZERO_REVIVAL_WEIGHTS,
      {
        ...DRAFT_ZERO_REVIVAL_WEIGHTS,
        pointWeights: pointWeights(8, 10_000).map((value, point) => point === 48 ? 20_000 : value),
      },
    );
    const state = revive(create(weighted, board, canonicalKoKey(koPlay.board)));

    const next = performRevivalSpecialMove(state, createSeededRng('legal-only'));
    const chosen = next.log.at(-1)?.point;

    expect(chosen).not.toBe(48);
    expect(chosen).not.toBe(8);
    expect(chosen).toBeTypeOf('number');
  });

  it('우선순위 1~8을 허용하고 가장 앞선 전용 정의를 먼저 실행한다', () => {
    for (const priority of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      expect(() => validateEnemyDefinition(enemyWith(
        DRAFT_ZERO_REVIVAL_WEIGHTS,
        DRAFT_ZERO_REVIVAL_WEIGHTS,
        priority,
      ), 49)).not.toThrow();
    }

    const enemy: EnemyDefinition = {
      id: 'DRAFT-PRIORITY-ENEMY',
      revival: {
        trait: { id: 'DRAFT-TRAIT', scoreWeights: DRAFT_ZERO_REVIVAL_WEIGHTS },
        specialMoves: [
          { id: 'LATE', priority: 8, stoneKind: 'STONE-005', scoreWeights: weightsAt(8, 100), tieBreak: 'lowest-point' },
          { id: 'EARLY', priority: 1, stoneKind: 'STONE-002', scoreWeights: weightsAt(9, 100), tieBreak: 'lowest-point' },
        ],
      },
    };
    const next = performRevivalSpecialMove(revive(create(enemy)), createSeededRng('priority'));
    expect(next.log.at(-1)).toMatchObject({ sourceId: 'EARLY', priority: 1, point: 9 });
    expect(next.board.points[9]?.kind).toBe('STONE-002');
  });

  it('후보가 없으면 자동 패스를 기록하고 플레이어 턴으로 넘긴다', () => {
    const points: Stone[] = Array.from({ length: 49 }, (_, point) => ({
      color: 'B',
      kind: 'STONE-001',
      instanceId: `blocked-${point}`,
    }));
    const state = revive(create(DRAFT_BATTLE_DEFINITION, { size: 7, points }));

    const next = performRevivalSpecialMove(state, createSeededRng('no-candidate'));

    expect(next.board).toBe(state.board);
    expect(next.turn).toBe('B');
    expect(next.phase).toBe('turn-start');
    expect(next.consecutivePasses).toBe(1);
    expect(next.log.at(-1)).toMatchObject({ type: 'pass', actor: 'W', automatic: true });
  });

  it('부활 전용 턴 완료는 정상·보호 무효화·자동 패스 모두 W 임시 패 한도를 만료한다', () => {
    const withTemporaryEnemyLimit = (state: ReturnType<typeof revive>) => ({
      ...state,
      decks: {
        ...state.decks,
        W: {
          ...state.decks.W,
          handLimit: state.decks.W.baseHandLimit + 1,
          handLimitModifiers: [{ sourceId: 'revival-limit', amount: 1, remainingTurns: 1 }],
        },
      },
    });
    const expectExpired = (state: ReturnType<typeof revive>) => {
      expect(state.decks.W.handLimit).toBe(state.decks.W.baseHandLimit);
      expect(state.decks.W.handLimitModifiers).toEqual([]);
    };

    const successful = performRevivalSpecialMove(
      withTemporaryEnemyLimit(revive()),
      createSeededRng('temporary-limit-success'),
    );
    expectExpired(successful);

    const protectedPoints = [...createBoard(7).points];
    protectedPoints[1] = { color: 'B', kind: 'STONE-001', instanceId: 'protected-target' };
    protectedPoints[2] = { color: 'W', kind: 'STONE-001', instanceId: 'capture-right' };
    protectedPoints[8] = { color: 'W', kind: 'STONE-001', instanceId: 'capture-down' };
    const captureAtZero = enemyWith(DRAFT_ZERO_REVIVAL_WEIGHTS, weightsAt(0, 10_000));
    const protectedRevival = withTemporaryEnemyLimit(revive(create(
      captureAtZero,
      { size: 7, points: protectedPoints },
    )));
    const negated = performRevivalSpecialMove({
      ...protectedRevival,
      protections: [{
        id: 'revival-protection',
        color: 'B',
        memberInstanceIds: ['protected-target'],
        grantedAtMove: 1,
      }],
    }, createSeededRng('temporary-limit-negated'));
    expect(negated.protections).toEqual([]);
    expectExpired(negated);

    const blockedPoints: Stone[] = Array.from({ length: 49 }, (_, point) => ({
      color: 'B',
      kind: 'STONE-001',
      instanceId: `temporary-limit-blocked-${point}`,
    }));
    const automaticPass = performRevivalSpecialMove(withTemporaryEnemyLimit(revive(create(
      DRAFT_BATTLE_DEFINITION,
      { size: 7, points: blockedPoints },
    ))), createSeededRng('temporary-limit-pass'));
    expect(automaticPass.log.at(-1)).toMatchObject({ type: 'pass', actor: 'W', automatic: true });
    expectExpired(automaticPass);
  });

  it('2단계 패배는 즉시 런 종료, 승리는 스테이지 최종 승리다', () => {
    const stageTwo = revive();
    const lost = resolveBattleOutcome(stageTwo, 'W', createSeededRng('lost-again'));
    const won = resolveBattleOutcome(stageTwo, 'B', createSeededRng('won'));

    expect(lost).toMatchObject({ phase: 'result', outcome: 'run-loss', rewardStatus: 'withheld' });
    expect(won).toMatchObject({ phase: 'result', outcome: 'stage-win', rewardStatus: 'available' });
  });

  it('주입된 특성 가중치·전용 착수 가중치·동률 규칙이 행동을 바꾼다', () => {
    const traitBiased = enemyWith(weightsAt(4, 100), DRAFT_ZERO_REVIVAL_WEIGHTS);
    const moveBiased = enemyWith(DRAFT_ZERO_REVIVAL_WEIGHTS, weightsAt(5, 100));
    const seeded = enemyWith(DRAFT_ZERO_REVIVAL_WEIGHTS, DRAFT_ZERO_REVIVAL_WEIGHTS, 1, 'seeded');

    const traitMove = performRevivalSpecialMove(revive(create(traitBiased)), createSeededRng('inject'));
    const specialMove = performRevivalSpecialMove(revive(create(moveBiased)), createSeededRng('inject'));
    const tieA = performRevivalSpecialMove(revive(create(seeded)), createSeededRng('tie'));
    const tieB = performRevivalSpecialMove(revive(create(seeded)), createSeededRng('tie'));

    expect(traitMove.log.at(-1)?.point).toBe(4);
    expect(specialMove.log.at(-1)?.point).toBe(5);
    expect(tieA.log.at(-1)?.point).toBe(tieB.log.at(-1)?.point);
  });
});
