import { describe, expect, it } from 'vitest';

import { battleReducer } from '../src/game/battle';
import { createInitialGameState, gameReducer, type GameState } from '../src/game/GameProvider';
import { createBoard } from '../src/game/go';
import type { DeckState, StoneCard } from '../src/game/deck';
import type { BoardState, StoneKind } from '../src/game/types';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

function card(id: string, kind: StoneKind): StoneCard {
  return { id, kind, temporary: false };
}

function productBattle(
  activeKind: StoneKind,
  board: BoardState = createBoard(7),
  drawKinds: readonly StoneKind[] = ['STONE-001', 'STONE-003', 'STONE-005', 'STONE-004'],
): GameState {
  let state = createInitialGameState(DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'START_RUN' }, DRAFT_GAME_CONFIG);
  state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);
  const battle = state.battle!;
  const playerDeck: DeckState = {
    ...battle.decks.B,
    hand: [
      card('active-card', activeKind),
      card('hand-1', 'STONE-001'),
      card('hand-2', 'STONE-001'),
      card('hand-3', 'STONE-001'),
    ],
    drawPile: drawKinds.map((kind, index) => card(`draw-${index + 1}`, kind)),
    discardPile: [],
  };
  return gameReducer({
    ...state,
    battle: {
      ...battle,
      board,
      turn: 'B',
      phase: 'choose-card',
      decks: { ...battle.decks, B: playerDeck },
    },
  }, { type: 'SELECT_CARD', cardId: 'active-card' }, DRAFT_GAME_CONFIG);
}

function commit(state: GameState, point: number, config = DRAFT_GAME_CONFIG): GameState {
  return gameReducer(state, { type: 'CHOOSE_POINT', point }, config);
}

function captureBoard(capturedKind: StoneKind = 'STONE-001'): BoardState {
  const points = [...createBoard(7).points];
  points[1] = { color: 'W', kind: capturedKind, instanceId: 'capture-target' };
  points[2] = { color: 'B', kind: 'STONE-001', instanceId: 'wall-right' };
  points[8] = { color: 'B', kind: 'STONE-001', instanceId: 'wall-down' };
  return { size: 7, points };
}

describe('제품 전투 특수 돌 배선', () => {
  it('척후석 확인 순서를 확정하면 실제 drawPile 순서가 결정적으로 바뀐다', () => {
    const placed = commit(productBattle('STONE-002'), 0);
    const inspection = placed.pendingInspection!;
    expect(inspection.kind).toBe('scout');
    if (inspection.kind !== 'scout') throw new Error('expected scout inspection');
    expect(inspection.inspected.map(({ id }) => id)).toEqual(
      placed.battle!.decks.B.drawPile.slice(0, 3).map(({ id }) => id),
    );
    const cancelled = gameReducer(placed, { type: 'CANCEL_INSPECTION' }, DRAFT_GAME_CONFIG);
    expect(cancelled.battle!.decks.B).toEqual(placed.battle!.decks.B);
    const taken = gameReducer(placed, { type: 'INSPECT_TAKE', cardId: inspection.inspected[0].id }, DRAFT_GAME_CONFIG);
    const returned = gameReducer(taken, { type: 'INSPECT_RETURN', cardId: taken.battle!.decks.B.hand[0].id }, DRAFT_GAME_CONFIG);
    const returnedInspection = returned.pendingInspection!;
    if (returnedInspection.kind !== 'scout') throw new Error('expected scout inspection');
    const reversed = [...returnedInspection.orderedIds].reverse();
    const reordered = gameReducer(returned, { type: 'REORDER_INSPECTION', orderedIds: reversed }, DRAFT_GAME_CONFIG);
    const confirmed = gameReducer(reordered, { type: 'CONFIRM_INSPECTION' }, DRAFT_GAME_CONFIG);

    expect(confirmed.pendingInspection).toBeNull();
    expect(confirmed.battle!.decks.B.drawPile.slice(0, reversed.length).map(({ id }) => id)).toEqual(reversed);
  });

  it('장군석 포획은 주입된 대국 상한 상태를 갱신하며 실제 런에 5냥을 지급한다', () => {
    const initial = productBattle('STONE-003', captureBoard());
    const next = commit(initial, 0);

    expect(next.run.currency).toBe(initial.run.currency + 5);
    expect(next.generalMoneyAwarded).toBe(5);
  });

  it('W 장군석도 포획 뒤 보충 드로우와 별도로 카드 1장을 더 뽑는다', () => {
    const initial = productBattle('STONE-001');
    const points = [...createBoard(7).points];
    points[1] = { color: 'B', kind: 'STONE-001', instanceId: 'enemy-capture-target' };
    points[2] = { color: 'W', kind: 'STONE-001', instanceId: 'enemy-wall-right' };
    points[8] = { color: 'W', kind: 'STONE-001', instanceId: 'enemy-wall-down' };
    const enemyGeneral = card('enemy-general', 'STONE-003');
    const battle = {
      ...initial.battle!,
      board: { size: 7 as const, points },
      turn: 'W' as const,
      phase: 'choose-point' as const,
      selectedCardId: enemyGeneral.id,
      decks: {
        ...initial.battle!.decks,
        W: {
          ...initial.battle!.decks.W,
          hand: [enemyGeneral, card('enemy-hand-1', 'STONE-001'), card('enemy-hand-2', 'STONE-001'), card('enemy-hand-3', 'STONE-001')],
          drawPile: [card('enemy-draw-1', 'STONE-001'), card('enemy-draw-2', 'STONE-005')],
          discardPile: [],
        },
      },
    };

    const next = battleReducer(battle, { type: 'PLAY_CARD', point: 0, rng: () => 0 });

    expect(next.decks.W.hand).toHaveLength(5);
    expect(next.decks.W.drawPile).toEqual([]);
    expect(next.log.at(-1)).toMatchObject({ type: 'effect', actor: 'W', cardId: enemyGeneral.id });
  });

  it('장군석으로 일시 초과한 손패는 다음 자기 착수에서 기본 한도로 자연 수렴한다', () => {
    const afterGeneral = commit(productBattle(
      'STONE-003',
      captureBoard(),
      ['STONE-001', 'STONE-005', 'STONE-002'],
    ), 0);
    expect(afterGeneral.battle!.decks.B.hand).toHaveLength(5);
    expect(afterGeneral.battle!.decks.B.handLimit).toBe(4);

    let battle = battleReducer(afterGeneral.battle!, { type: 'BEGIN_TURN' });
    battle = battleReducer(battle, { type: 'PASS' });
    battle = battleReducer(battle, { type: 'BEGIN_TURN' });
    battle = battleReducer(battle, { type: 'CONTINUE_TO_MOVE' });
    battle = battleReducer(battle, { type: 'SELECT_CARD', cardId: battle.decks.B.hand[0].id });
    battle = battleReducer(battle, { type: 'PLAY_CARD', point: 48, rng: () => 0 });

    expect(battle.decks.B.handLimit).toBe(4);
    expect(battle.decks.B.hand).toHaveLength(4);
  });

  it('기병석 드로우는 교환 대상을 만들고 수호석은 그룹 보호를 부여한다', () => {
    const cavalry = commit(productBattle(
      'STONE-001',
      captureBoard(),
      ['STONE-004', 'STONE-003', 'STONE-005'],
    ), 0);
    expect(cavalry.pendingInspection).toMatchObject({ kind: 'cavalry' });
    expect(cavalry.pendingInspection?.inspected.map(({ id }) => id)).toEqual(['draw-2', 'draw-3']);

    const guardianPoints = [...createBoard(7).points];
    guardianPoints[1] = { color: 'B', kind: 'STONE-001', instanceId: 'endangered-friend' };
    guardianPoints[2] = { color: 'W', kind: 'STONE-001', instanceId: 'block-right' };
    guardianPoints[8] = { color: 'W', kind: 'STONE-001', instanceId: 'block-down' };
    const guardian = commit(productBattle('STONE-005', { size: 7, points: guardianPoints }), 0);
    expect(guardian.pendingInspection).toBeNull();
    expect(guardian.battle?.protections).toHaveLength(1);
  });

  it('기병 교환을 원자 반영하고 여러 기병 진입은 FIFO로 처리한다', () => {
    const initial = commit(productBattle(
      'STONE-003',
      captureBoard(),
      ['STONE-004', 'STONE-004', 'STONE-003', 'STONE-005'],
    ), 0);
    expect(initial.pendingInspection).toMatchObject({ kind: 'cavalry' });
    expect(initial.queuedInspections).toHaveLength(1);
    const active = initial.pendingInspection!;
    if (active.kind !== 'cavalry') throw new Error('expected cavalry inspection');
    const taken = gameReducer(initial, { type: 'INSPECT_TAKE', cardId: active.inspected[0].id }, DRAFT_GAME_CONFIG);
    const returned = gameReducer(taken, { type: 'INSPECT_RETURN', cardId: taken.battle!.decks.B.hand[0].id }, DRAFT_GAME_CONFIG);
    const confirmed = gameReducer(returned, { type: 'CONFIRM_INSPECTION' }, DRAFT_GAME_CONFIG);
    const second = confirmed.pendingInspection!;
    expect(second).toMatchObject({ kind: 'cavalry' });
    expect(second.inspected.map(({ id }) => id)).toEqual(
      confirmed.battle!.decks.B.drawPile.slice(0, 2).map(({ id }) => id),
    );
    expect(confirmed.queuedInspections).toEqual([]);
    if (second.kind !== 'cavalry') throw new Error('expected second cavalry inspection');
    const secondTaken = gameReducer(confirmed, {
      type: 'INSPECT_TAKE', cardId: second.inspected[0].id,
    }, DRAFT_GAME_CONFIG);
    const secondReturned = gameReducer(secondTaken, {
      type: 'INSPECT_RETURN', cardId: secondTaken.battle!.decks.B.hand[0].id,
    }, DRAFT_GAME_CONFIG);
    const completed = gameReducer(secondReturned, { type: 'CONFIRM_INSPECTION' }, DRAFT_GAME_CONFIG);
    expect(completed.pendingInspection).toBeNull();
    expect(completed.invalidReason).toBe('');
    expect(completed.battle).toMatchObject({ turn: 'W', phase: 'turn-start' });
  });

  it('척후 교환 뒤 시작 덱에서 뽑힌 기병의 창을 현재 덱 기준으로 승격해 확정한다', () => {
    const initial = commit(productBattle(
      'STONE-002',
      captureBoard(),
      ['STONE-004', 'STONE-003', 'STONE-005', 'STONE-001'],
    ), 0);
    const scout = initial.pendingInspection!;
    expect(scout.kind).toBe('scout');
    expect(initial.queuedInspections).toHaveLength(1);
    expect(initial.queuedInspections[0]).toMatchObject({ kind: 'cavalry' });
    if (scout.kind !== 'scout') throw new Error('expected scout inspection');

    const scoutTaken = gameReducer(initial, {
      type: 'INSPECT_TAKE', cardId: scout.inspected[0].id,
    }, DRAFT_GAME_CONFIG);
    const scoutReturned = gameReducer(scoutTaken, {
      type: 'INSPECT_RETURN', cardId: 'hand-1',
    }, DRAFT_GAME_CONFIG);
    const afterScout = gameReducer(scoutReturned, { type: 'CONFIRM_INSPECTION' }, DRAFT_GAME_CONFIG);
    const cavalry = afterScout.pendingInspection!;
    expect(cavalry).toMatchObject({ kind: 'cavalry' });
    expect(cavalry.inspected.map(({ id }) => id)).toEqual(
      afterScout.battle!.decks.B.drawPile.slice(0, 2).map(({ id }) => id),
    );
    if (cavalry.kind !== 'cavalry') throw new Error('expected cavalry inspection');

    const cavalryTaken = gameReducer(afterScout, {
      type: 'INSPECT_TAKE', cardId: cavalry.inspected[0].id,
    }, DRAFT_GAME_CONFIG);
    const cavalryReturned = gameReducer(cavalryTaken, {
      type: 'INSPECT_RETURN', cardId: cavalryTaken.battle!.decks.B.hand[0].id,
    }, DRAFT_GAME_CONFIG);
    const completed = gameReducer(cavalryReturned, { type: 'CONFIRM_INSPECTION' }, DRAFT_GAME_CONFIG);
    expect(completed.pendingInspection).toBeNull();
    expect(completed.invalidReason).toBe('');
    expect(completed.battle).toMatchObject({ turn: 'W', phase: 'turn-start' });
  });

  it('대기 기병의 현재 확인 창이 0장이면 건너뛰고 연쇄 종료 시 턴을 끝낸다', () => {
    const initial = commit(productBattle(
      'STONE-003',
      captureBoard(),
      ['STONE-004', 'STONE-004', 'STONE-005'],
    ), 0);
    const active = initial.pendingInspection!;
    expect(active).toMatchObject({ kind: 'cavalry' });
    expect(initial.queuedInspections).toHaveLength(1);
    expect(active.inspected).toHaveLength(1);
    if (active.kind !== 'cavalry') throw new Error('expected cavalry inspection');

    const taken = gameReducer(initial, {
      type: 'INSPECT_TAKE', cardId: active.inspected[0].id,
    }, DRAFT_GAME_CONFIG);
    const returned = gameReducer(taken, {
      type: 'INSPECT_RETURN', cardId: taken.battle!.decks.B.hand[0].id,
    }, DRAFT_GAME_CONFIG);
    const completed = gameReducer(returned, { type: 'CONFIRM_INSPECTION' }, DRAFT_GAME_CONFIG);

    expect(completed.battle!.decks.B.drawPile).toEqual([]);
    expect(completed.pendingInspection).toBeNull();
    expect(completed.queuedInspections).toEqual([]);
    expect(completed.battle).toMatchObject({ turn: 'W', phase: 'turn-start' });
  });

  it('취소 뒤 승격도 현재 덱 창을 다시 만들고 모든 선택 필드를 초기화한다', () => {
    const initial = commit(productBattle(
      'STONE-003',
      captureBoard(),
      ['STONE-004', 'STONE-004', 'STONE-003', 'STONE-005'],
    ), 0);
    const queued = initial.queuedInspections[0];
    if (queued.kind !== 'cavalry') throw new Error('expected queued cavalry inspection');
    const withStagedQueue: GameState = {
      ...initial,
      queuedInspections: [{
        ...queued,
        takenCardId: queued.inspected[0].id,
        discardedCardId: initial.battle!.decks.B.hand[0].id,
      }],
    };

    const promoted = gameReducer(withStagedQueue, { type: 'CANCEL_INSPECTION' }, DRAFT_GAME_CONFIG);

    expect(promoted.battle!.decks.B).toBe(initial.battle!.decks.B);
    expect(promoted.pendingInspection).toMatchObject({
      kind: 'cavalry',
      takenCardId: null,
      discardedCardId: null,
    });
    expect(promoted.pendingInspection?.inspected.map(({ id }) => id)).toEqual(
      promoted.battle!.decks.B.drawPile.slice(0, 2).map(({ id }) => id),
    );
    const completed = gameReducer(promoted, { type: 'CANCEL_INSPECTION' }, DRAFT_GAME_CONFIG);
    expect(completed.pendingInspection).toBeNull();
    expect(completed.battle).toMatchObject({ turn: 'W', phase: 'turn-start' });
  });

  it('상대 희생석 포획은 상대의 실제 다음 턴 패 한도와 손패를 늘린다', () => {
    const initial = productBattle('STONE-001', captureBoard('STONE-006'));
    const before = initial.battle!.decks.W;
    const next = commit(initial, 0);

    expect(next.battle!.decks.W.handLimit).toBe(before.handLimit + 1);
    expect(next.battle!.decks.W.hand).toHaveLength(before.hand.length + 1);
    expect(next.battle!.decks.W.handLimitModifiers).toContainEqual({
      sourceId: 'capture-target',
      amount: 1,
      remainingTurns: 1,
    });
  });

  it('AI가 플레이어 희생석을 포획해도 플레이어의 다음 턴 패 한도가 늘어난다', () => {
    const points = [...createBoard(7).points];
    points[1] = { color: 'B', kind: 'STONE-006', instanceId: 'player-sacrifice' };
    points[2] = { color: 'W', kind: 'STONE-001', instanceId: 'enemy-wall-right' };
    points[8] = { color: 'W', kind: 'STONE-001', instanceId: 'enemy-wall-down' };
    const initial = productBattle('STONE-001');
    const battle = initial.battle!;
    const before = battle.decks.B;
    const enemyHand = [0, 1, 2, 3].map((index) => card(`enemy-${index}`, 'STONE-001'));
    const readyForAi: GameState = {
      ...initial,
      battle: {
        ...battle,
        board: { size: 7, points },
        turn: 'W',
        phase: 'choose-card',
        selectedCardId: null,
        decks: { ...battle.decks, W: { ...battle.decks.W, hand: enemyHand } },
      },
    };

    const next = gameReducer(readyForAi, { type: 'AI_TURN' }, DRAFT_GAME_CONFIG);

    expect(next.battle!.board.points[1]).toBeNull();
    expect(next.battle!.decks.B.handLimit).toBe(before.handLimit + 1);
    expect(next.battle!.decks.B.handLimitModifiers).toContainEqual({
      sourceId: 'player-sacrifice',
      amount: 1,
      remainingTurns: 1,
    });
  });

  it('제품 착수도 주입된 효과 큐 한도를 넘으면 판·카드·냥을 원자적으로 보존한다', () => {
    const config = {
      ...DRAFT_GAME_CONFIG,
      effectLimits: { ...DRAFT_GAME_CONFIG.effectLimits, maxResolvedEffects: 0 },
    };
    const initial = productBattle('STONE-002');
    const rejected = gameReducer(initial, { type: 'CHOOSE_POINT', point: 0 }, config);

    expect(rejected.invalidReason).toContain('안전 한도');
    expect(rejected.battle!.board).toBe(initial.battle!.board);
    expect(rejected.battle!.decks.B).toBe(initial.battle!.decks.B);
    expect(rejected.run.currency).toBe(initial.run.currency);
  });
});

describe('제품 pre-move 자원 상태', () => {
  it('명시적 사용·건너뛰기 전까지 멈추고 부적 소비와 유물 사용 상태를 분리한다', () => {
    let state = createInitialGameState(DRAFT_GAME_CONFIG);
    state = {
      ...state,
      run: { ...state.run, charms: ['ITEM-001'], relics: ['RELIC-001'] },
    };
    state = gameReducer(state, { type: 'OPEN_BATTLE', battle: 'normal' }, DRAFT_GAME_CONFIG);

    expect(state.battle).toMatchObject({ phase: 'pre-move' });
    expect(state.battle!.charms.B).toEqual(['ITEM-001']);
    state = gameReducer(state, { type: 'USE_RELIC', relicId: 'RELIC-001' }, DRAFT_GAME_CONFIG);
    expect(state.battle!.usedRelicsThisTurn).toEqual(['RELIC-001']);
    state = gameReducer(state, { type: 'USE_CHARM', charmId: 'ITEM-001' }, DRAFT_GAME_CONFIG);
    expect(state.run.charms).toEqual([]);
    expect(state.battle!.charms.B).toEqual([]);
    state = gameReducer(state, { type: 'CONTINUE_TO_MOVE' }, DRAFT_GAME_CONFIG);
    expect(state.battle!.phase).toBe('choose-card');
  });
});
