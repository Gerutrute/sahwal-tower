import { describe, expect, it } from 'vitest';

import {
  STONE_DEFINITIONS,
  createBoard,
  createStoneEffectDefinition,
  resolveCavalryEffect,
  resolveGeneralCaptureEffect,
  resolveGuardianEffect,
  resolveSacrificeEffects,
  resolveScoutEffect,
  type BoardState,
  type DeckState,
  type Stone,
  type StoneCard,
} from '../src/engine';
import { DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE } from './fixtures/draft-effect-config';

function card(id: string): StoneCard {
  return { id, kind: 'STONE-001', temporary: false };
}

function deckWith(drawIds: readonly string[]): DeckState {
  return {
    drawPile: drawIds.map(card),
    hand: [],
    discardPile: [],
    temporaryCards: [],
    baseHandLimit: 4,
    handLimit: 4,
    handLimitModifiers: [],
    nextCardId: drawIds.length + 1,
  };
}

function stone(color: Stone['color'], instanceId: string, kind: Stone['kind']): Stone {
  return { color, instanceId, kind };
}

function boardWith(entries: readonly [number, Stone][]): BoardState {
  const board = createBoard(7);
  const points = [...board.points];
  entries.forEach(([point, placed]) => { points[point] = placed; });
  return { ...board, points };
}

describe('MVP 특수 돌', () => {
  it('STONE-001부터 STONE-006까지 data-driven으로 정의한다', () => {
    expect(Object.keys(STONE_DEFINITIONS)).toEqual([
      'STONE-001', 'STONE-002', 'STONE-003', 'STONE-004', 'STONE-005', 'STONE-006',
    ]);
    expect(STONE_DEFINITIONS['STONE-001'].effect).toBeNull();
    expect(STONE_DEFINITIONS['STONE-006'].effect).toMatchObject({
      trigger: 'captured-by-opponent-placement',
      priority: 4,
    });
    expect(createStoneEffectDefinition('STONE-002', {
      sideRelation: 'active',
      acquisitionOrder: 3,
      sourceId: 'scout-instance',
    })).toMatchObject({
      sourceKind: 'stone',
      sideRelation: 'active',
      acquisitionOrder: 3,
      sourceId: 'scout-instance',
      perMoveLimit: 1,
    });
  });

  it('척후석은 위 2장만 보고 원하는 순서로 한 번 재정렬한다', () => {
    const deck = deckWith(['a', 'b', 'c']);
    const first = resolveScoutEffect(deck, ['b', 'a'], []);
    const repeated = resolveScoutEffect(first.deck, ['a', 'b'], first.triggeredSources);

    expect(first.inspected.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(first.deck.drawPile.map(({ id }) => id)).toEqual(['b', 'a', 'c']);
    expect(repeated.triggered).toBe(false);
    expect(repeated.deck).toBe(first.deck);
  });

  it('장군석은 포획 사건당 5냥을 한 번만 받고 주입 상한을 넘지 않는다', () => {
    const first = resolveGeneralCaptureEffect({
      money: 0,
      generalMoneyAwarded: 0,
      generalMoneyCap: DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE,
      sourceId: 'general-a',
      capturedCount: 4,
      triggeredSources: [],
    });
    const repeated = resolveGeneralCaptureEffect({
      ...first,
      generalMoneyCap: DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE,
      sourceId: 'general-a',
      capturedCount: 2,
    });
    const capped = resolveGeneralCaptureEffect({
      ...repeated,
      generalMoneyCap: DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE,
      sourceId: 'general-b',
      capturedCount: 1,
    });

    expect(first.awarded).toBe(5);
    expect(repeated.awarded).toBe(0);
    expect(capped.awarded).toBe(2);
    expect(capped.money).toBe(DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE);
    expect(capped.generalMoneyAwarded).toBe(DRAFT_GENERAL_CAPTURE_MONEY_CAP_FIXTURE);
  });

  it('기병석은 직전 자기 포획 뒤 패에 들어올 때 위 1장만 보고 추가 착수하지 않는다', () => {
    const deck = deckWith(['a', 'b']);

    expect(resolveCavalryEffect(deck, false)).toMatchObject({ triggered: false, extraMoves: 0 });
    const triggered = resolveCavalryEffect(deck, true);
    expect(triggered.inspected.map(({ id }) => id)).toEqual(['a']);
    expect(triggered.extraMoves).toBe(0);
    expect(triggered.deck).toBe(deck);
  });

  it('수호석은 활로가 2 이하인 기존 아군 그룹 옆에서 위 2장을 본다', () => {
    const endangered = boardWith([
      [1, stone('B', 'friend', 'STONE-001')],
      [2, stone('W', 'block-2', 'STONE-001')],
    ]);
    const safe = createBoard(7);

    expect(resolveGuardianEffect(endangered, 0, 'B', deckWith(['a', 'b', 'c'])).inspected)
      .toHaveLength(2);
    expect(resolveGuardianEffect(safe, 0, 'B', deckWith(['a', 'b'])).triggered).toBe(false);
  });

  it('희생석은 상대 착수의 동시 포획마다 중첩하고 자발 제거에는 발동하지 않는다', () => {
    const captured = [
      stone('W', 'sacrifice-a', 'STONE-006'),
      stone('W', 'normal', 'STONE-001'),
      stone('W', 'sacrifice-b', 'STONE-006'),
    ];

    expect(resolveSacrificeEffects(captured, 'opponent-placement').map(({ amount }) => amount))
      .toEqual([1, 1]);
    expect(resolveSacrificeEffects(captured, 'suicide')).toEqual([]);
    expect(resolveSacrificeEffects(captured, 'voluntary-effect')).toEqual([]);
  });
});
