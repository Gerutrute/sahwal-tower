import { describe, expect, it } from 'vitest';

import {
  STONE_DEFINITIONS,
  createStoneEffectDefinition,
  resolveCavalryExchange,
  resolveGeneralCaptureEffect,
  resolveSacrificeEffects,
  resolveScoutExchange,
  startScoutInspection,
  startCavalryInspection,
} from '../src/game/content/stones';
import type { DeckState, StoneCard } from '../src/game/deck';
import type { Stone } from '../src/game/types';
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

describe('MVP 특수 돌', () => {
  it('척후석은 덱 위 3장을 확인해 1장을 가져오고 1장을 되돌린 뒤 순서를 정한다', async () => {
    const module = await import('../src/game/content/stones');
    expect(module).toHaveProperty('startScoutInspection');
    expect(module).toHaveProperty('resolveScoutExchange');
    if (!('startScoutInspection' in module) || !('resolveScoutExchange' in module)) return;
    const base = { ...deckWith(['a', 'b', 'c', 'd']), hand: [card('h')] };
    const inspected = module.startScoutInspection(base);
    expect(inspected.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    const result = module.resolveScoutExchange(base, inspected.map(({ id }) => id), {
      takenCardId: 'a', returnedCardId: 'h', orderedIds: ['b', 'c', 'h'],
    });
    expect(result.hand.map(({ id }) => id)).toEqual(['a']);
    expect(result.drawPile.map(({ id }) => id)).toEqual(['b', 'c', 'h', 'd']);
  });

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

  it('척후석 창은 더미 크기에 맞춰 줄고 잘못된 교환은 원자적으로 거부한다', () => {
    expect(startScoutInspection(deckWith(['a', 'b'])).map(({ id }) => id)).toEqual(['a', 'b']);
    expect(startScoutInspection(deckWith([]))).toEqual([]);
    const deck = { ...deckWith(['a', 'b', 'c']), hand: [card('h')] };
    const before = structuredClone(deck);
    expect(() => resolveScoutExchange(deck, ['a', 'b', 'c'], {
      takenCardId: 'missing', returnedCardId: 'h', orderedIds: ['a', 'b', 'c'],
    })).toThrow(RangeError);
    expect(() => resolveScoutExchange(deck, ['a', 'b', 'c'], {
      takenCardId: 'a', returnedCardId: 'missing', orderedIds: ['b', 'c', 'missing'],
    })).toThrow(RangeError);
    expect(() => resolveScoutExchange(deck, ['a', 'b', 'c'], {
      takenCardId: 'a', returnedCardId: 'h', orderedIds: ['b', 'c'],
    })).toThrow(RangeError);
    expect(deck).toEqual(before);
  });

  it('척후석에 임시 카드를 되돌리면 덱에 넣지 않고 소멸시킨다', () => {
    const temporary = { id: 'temp', kind: 'STONE-001' as const, temporary: true };
    const deck = { ...deckWith(['a', 'b', 'c']), hand: [temporary], temporaryCards: ['temp'] };
    const next = resolveScoutExchange(deck, ['a', 'b', 'c'], {
      takenCardId: 'a', returnedCardId: 'temp', orderedIds: ['b', 'c'],
    });
    expect(next.drawPile.map(({ id }) => id)).toEqual(['b', 'c']);
    expect(next.temporaryCards).toEqual([]);
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

  it('기병석은 직전 자기 포획 뒤 패에 들어올 때 위 2장만 보고 추가 착수하지 않는다', () => {
    const deck = deckWith(['a', 'b']);

    expect(startCavalryInspection(deck, false)).toEqual([]);
    expect(startCavalryInspection(deck, true).map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('기병석 교환은 위 2장 중 하나를 가져오고 손패 하나를 버린다', () => {
    const deck = { ...deckWith(['a', 'b', 'c']), hand: [card('h')] };
    expect(startCavalryInspection(deck, false)).toEqual([]);
    expect(startCavalryInspection(deck, true).map(({ id }) => id)).toEqual(['a', 'b']);
    const next = resolveCavalryExchange(deck, ['a', 'b'], { takenCardId: 'a', discardedCardId: 'h' });
    expect(next.hand.map(({ id }) => id)).toEqual(['a']);
    expect(next.drawPile.map(({ id }) => id)).toEqual(['b', 'c']);
    expect(next.discardPile.map(({ id }) => id)).toEqual(['h']);
    expect(() => resolveCavalryExchange(deck, ['a', 'b'], {
      takenCardId: 'missing', discardedCardId: 'h',
    })).toThrow(RangeError);
    expect(() => resolveCavalryExchange(deck, ['a', 'b'], {
      takenCardId: 'a', discardedCardId: 'missing',
    })).toThrow(RangeError);
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
