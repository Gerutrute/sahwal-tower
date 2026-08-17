import { describe, expect, it } from 'vitest';
import {
  createDojoVisit,
  generateShop,
  purchaseShopOffer,
  removalPrice,
  removeShopCard,
  useDojo,
  type InventoryState,
} from '../src/game/economy';
import { CHARM_DEFINITIONS, CHARM_IDS } from '../src/game/content/charms';
import { ENEMY_DEFINITIONS, ENEMY_IDS } from '../src/game/content/enemies';
import { EVENT_DEFINITIONS, EVENT_IDS } from '../src/game/content/events';
import { RELIC_DEFINITIONS, RELIC_IDS } from '../src/game/content/relics';
import { createSeededRng } from '../src/game/rng';
import {
  DRAFT_ECONOMY_CONFIG,
  DRAFT_SHOP_CATALOG,
} from './fixtures/draft-run-config';

const inventory = (overrides: Partial<InventoryState> = {}): InventoryState => ({
  currency: 1_000,
  deck: ['STONE-001', 'STONE-002', 'STONE-003'],
  charms: [],
  relics: [],
  removalCount: 0,
  ...overrides,
});

describe('상점 경제', () => {
  it('돌 3·부적 2·유물 1과 제거 1회를 분리하고 새로고침을 제공하지 않는다', () => {
    const shop = generateShop(DRAFT_SHOP_CATALOG, DRAFT_ECONOMY_CONFIG, createSeededRng('shop'));
    expect(shop.offers.filter(({ kind }) => kind === 'stone')).toHaveLength(3);
    expect(shop.offers.filter(({ kind }) => kind === 'charm')).toHaveLength(2);
    expect(shop.offers.filter(({ kind }) => kind === 'relic')).toHaveLength(1);
    expect(shop.removalUsed).toBe(false);
    expect('refresh' in shop).toBe(false);
  });

  it('제거가는 주입된 base+이전횟수×increment이고 상점당 1회이며 덱 0장을 허용한다', () => {
    expect(removalPrice(DRAFT_ECONOMY_CONFIG, 0)).toBe(50);
    expect(removalPrice(DRAFT_ECONOMY_CONFIG, 2)).toBe(100);
    const shop = generateShop(DRAFT_SHOP_CATALOG, DRAFT_ECONOMY_CONFIG, createSeededRng('remove'));
    const first = removeShopCard(inventory({ deck: ['STONE-001'] }), shop, 0, DRAFT_ECONOMY_CONFIG);
    const repeated = removeShopCard(first.inventory, first.shop, 0, DRAFT_ECONOMY_CONFIG);
    expect(first.purchased).toBe(true);
    expect(first.inventory.deck).toEqual([]);
    expect(first.inventory.currency).toBe(950);
    expect(repeated.purchased).toBe(false);
  });

  it('부적은 최대 2개이며 선택한 한 슬롯만 교체한다', () => {
    const shop = generateShop(DRAFT_SHOP_CATALOG, DRAFT_ECONOMY_CONFIG, createSeededRng('charm-shop'));
    const charm = shop.offers.find(({ kind }) => kind === 'charm')!;
    const full = inventory({ charms: ['ITEM-003', 'ITEM-004'] });
    const blocked = purchaseShopOffer(full, shop, charm.id);
    const bought = purchaseShopOffer(full, shop, charm.id, 0);
    expect(blocked.purchased).toBe(false);
    expect(bought.purchased).toBe(true);
    expect(bought.inventory.charms).toEqual([charm.productId, 'ITEM-004']);
  });

  it('EconomyConfig 주입값이 시작 냥과 가격 결과를 바꾼다', () => {
    const alternate = {
      ...DRAFT_ECONOMY_CONFIG,
      shopPrices: { ...DRAFT_ECONOMY_CONFIG.shopPrices, charm: 7 },
      removalBasePrice: 3,
      removalPriceIncrement: 2,
    };
    const first = generateShop(DRAFT_SHOP_CATALOG, DRAFT_ECONOMY_CONFIG, createSeededRng('config'));
    const second = generateShop(DRAFT_SHOP_CATALOG, alternate, createSeededRng('config'));
    expect(first.offers.find(({ kind }) => kind === 'charm')?.price).toBe(35);
    expect(second.offers.find(({ kind }) => kind === 'charm')?.price).toBe(7);
    expect(removalPrice(alternate, 2)).toBe(7);
  });

  it('구매·제거는 잔액이 부족하면 거절하고 냥을 음수로 만들지 않는다', () => {
    const shop = generateShop(DRAFT_SHOP_CATALOG, DRAFT_ECONOMY_CONFIG, createSeededRng('no-negative'));
    const poor = inventory({ currency: 0 });
    for (const offer of shop.offers) {
      expect(purchaseShopOffer(poor, shop, offer.id).inventory.currency).toBe(0);
    }
    expect(removeShopCard(poor, shop, 0, DRAFT_ECONOMY_CONFIG).inventory.currency).toBe(0);
  });

  it('같은 상품을 두 번 누르면 이중 결제하지 않는다', () => {
    const shop = generateShop(DRAFT_SHOP_CATALOG, DRAFT_ECONOMY_CONFIG, createSeededRng('double-click'));
    const offer = shop.offers.find(({ kind }) => kind === 'stone')!;
    const first = purchaseShopOffer(inventory(), shop, offer.id);
    const second = purchaseShopOffer(first.inventory, first.shop, offer.id);
    expect(first.purchased).toBe(true);
    expect(second.purchased).toBe(false);
    expect(second.inventory.currency).toBe(first.inventory.currency);
  });
});

describe('도장', () => {
  it.each([
    [{ type: 'remove', cardIndex: 0 } as const, ['STONE-002', 'STONE-003']],
    [{ type: 'exchange', cardIndex: 0, replacement: 'STONE-006' } as const, ['STONE-006', 'STONE-002', 'STONE-003']],
    [{ type: 'duplicate', cardIndex: 0 } as const, ['STONE-001', 'STONE-002', 'STONE-003', 'STONE-001']],
  ])('제거·교환·복제는 방문당 한 번만 성공한다', (action, expectedDeck) => {
    const first = useDojo(inventory(), createDojoVisit(), action, DRAFT_ECONOMY_CONFIG);
    const repeated = useDojo(first.inventory, first.visit, action, DRAFT_ECONOMY_CONFIG);
    expect(first.applied).toBe(true);
    expect(first.inventory.deck).toEqual(expectedDeck);
    expect(repeated.applied).toBe(false);
    expect(repeated.inventory).toBe(first.inventory);
  });

  it('도장 제거는 주입된 최소 덱 크기와 잔액을 지킨다', () => {
    const minimum = inventory({ deck: ['STONE-001'], currency: 1_000 });
    const poor = inventory({ currency: 0 });
    expect(useDojo(minimum, createDojoVisit(), { type: 'remove', cardIndex: 0 }, DRAFT_ECONOMY_CONFIG).applied).toBe(false);
    expect(useDojo(poor, createDojoVisit(), { type: 'duplicate', cardIndex: 0 }, DRAFT_ECONOMY_CONFIG).inventory.currency).toBe(0);
  });
});

describe('승인 콘텐츠 계약', () => {
  it('정확한 유물·부적·적·사건 ID 집합만 정의한다', () => {
    expect(RELIC_IDS).toEqual(['RELIC-001', 'RELIC-002', 'RELIC-003', 'RELIC-005', 'RELIC-007', 'RELIC-009', 'RELIC-010', 'RELIC-013']);
    expect(CHARM_IDS).toEqual(['ITEM-001', 'ITEM-002', 'ITEM-003', 'ITEM-004', 'ITEM-005']);
    expect(ENEMY_IDS).toEqual(['ENEMY-001', 'ENEMY-002', 'ENEMY-003']);
    expect(EVENT_IDS).toEqual(['EVENT-001', 'EVENT-002', 'EVENT-003']);
  });

  it.each([
    ...Object.values(RELIC_DEFINITIONS),
    ...Object.values(CHARM_DEFINITIONS),
    ...Object.values(ENEMY_DEFINITIONS),
    ...Object.values(EVENT_DEFINITIONS),
  ])('$id의 발동 조건·시점·대상·지속·중첩·횟수·패스·종료 계약이 완전하다', ({ behavior }) => {
    expect(behavior.condition).not.toBe('');
    expect(behavior.timing).not.toBe('');
    expect(behavior.target).not.toBe('');
    expect(behavior.duration).not.toBe('');
    expect(['none', 'unique-source', 'replace']).toContain(behavior.stacking);
    expect(behavior.activationLimit).not.toBe('');
    expect(behavior.passBehavior).not.toBe('');
    expect(behavior.endBehavior).not.toBe('');
  });

  it.each(Object.values(EVENT_DEFINITIONS))('$id는 선택을 한 번만 결정하는 사건이다', (event) => {
    expect(event.choices).toHaveLength(3);
    expect(new Set(event.choices.map(({ id }) => id)).size).toBe(3);
    expect(event.behavior.activationLimit).toBe('once-per-node');
  });
});
