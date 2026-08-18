import { shuffle } from './rng';
import type { RandomSource } from './rng';
import type { StoneKind } from './types';
import type { CharmId } from './content/charms';
import type { RelicId } from './content/relics';

export interface EconomyConfig {
  readonly startingCurrency: number;
  readonly battleRewards: {
    readonly normal: number;
    readonly elite: number;
    readonly boss: number;
  };
  readonly captureRewardPerStone: number;
  readonly captureRewardCap: number;
  readonly shopPrices: {
    readonly commonStone: number;
    readonly rareStone: number;
    readonly charm: number;
    readonly relic: number;
  };
  readonly removalBasePrice: number;
  readonly removalPriceIncrement: number;
  readonly dojoPrices: {
    readonly remove: number;
    readonly exchange: number;
    readonly duplicate: number;
  };
  readonly dojoMinimumDeckSize: number;
  readonly freeDojoVisitsBeforeAct2: number;
}

export interface InventoryState {
  readonly currency: number;
  readonly deck: readonly StoneKind[];
  readonly charms: readonly CharmId[];
  readonly relics: readonly RelicId[];
  readonly removalCount: number;
}

export interface ShopCatalog {
  readonly stones: readonly { readonly id: StoneKind; readonly rarity: 'common' | 'rare' }[];
  readonly charms: readonly CharmId[];
  readonly relics: readonly RelicId[];
}

export type ShopOffer =
  | { readonly id: string; readonly kind: 'stone'; readonly productId: StoneKind; readonly price: number }
  | { readonly id: string; readonly kind: 'charm'; readonly productId: CharmId; readonly price: number }
  | { readonly id: string; readonly kind: 'relic'; readonly productId: RelicId; readonly price: number };

export interface ShopState {
  readonly offers: readonly ShopOffer[];
  readonly soldOfferIds: readonly string[];
  readonly removalUsed: boolean;
}

function validateMoney(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a non-negative integer`);
}

export function validateEconomyConfig(config: EconomyConfig): void {
  [
    config.startingCurrency,
    config.battleRewards.normal,
    config.battleRewards.elite,
    config.battleRewards.boss,
    config.captureRewardPerStone,
    config.captureRewardCap,
    config.shopPrices.commonStone,
    config.shopPrices.rareStone,
    config.shopPrices.charm,
    config.shopPrices.relic,
    config.removalBasePrice,
    config.removalPriceIncrement,
    config.dojoPrices.remove,
    config.dojoPrices.exchange,
    config.dojoPrices.duplicate,
    config.dojoMinimumDeckSize,
    config.freeDojoVisitsBeforeAct2,
  ].forEach((value, index) => validateMoney(value, `economy value ${index}`));
}

export function removalPrice(config: EconomyConfig, previousRemovals: number): number {
  validateEconomyConfig(config);
  validateMoney(previousRemovals, 'previous removals');
  return config.removalBasePrice + previousRemovals * config.removalPriceIncrement;
}

export function generateShop(
  catalog: ShopCatalog,
  config: EconomyConfig,
  rng: RandomSource,
  isProductUnlocked: (productId: StoneKind | CharmId | RelicId) => boolean = () => true,
): ShopState {
  validateEconomyConfig(config);
  const availableStones = catalog.stones.filter(({ id }) => isProductUnlocked(id));
  const availableCharms = catalog.charms.filter(isProductUnlocked);
  const availableRelics = catalog.relics.filter(isProductUnlocked);
  if (new Set(availableStones.map(({ id }) => id)).size < 3
    || new Set(availableCharms).size < 2
    || new Set(availableRelics).size < 1) {
    throw new RangeError('shop catalog does not contain enough unique products');
  }
  const stones = shuffle([...new Map(availableStones.map((stone) => [stone.id, stone])).values()], rng).slice(0, 3);
  const charms = shuffle([...new Set(availableCharms)], rng).slice(0, 2);
  const relics = shuffle([...new Set(availableRelics)], rng).slice(0, 1);
  return {
    offers: [
      ...stones.map<ShopOffer>((stone, index) => ({
        id: `stone-${index}`,
        kind: 'stone',
        productId: stone.id,
        price: stone.rarity === 'common' ? config.shopPrices.commonStone : config.shopPrices.rareStone,
      })),
      ...charms.map<ShopOffer>((charm, index) => ({ id: `charm-${index}`, kind: 'charm', productId: charm, price: config.shopPrices.charm })),
      ...relics.map<ShopOffer>((relic, index) => ({ id: `relic-${index}`, kind: 'relic', productId: relic, price: config.shopPrices.relic })),
    ],
    soldOfferIds: [],
    removalUsed: false,
  };
}

export interface PurchaseResult {
  readonly inventory: InventoryState;
  readonly shop: ShopState;
  readonly purchased: boolean;
}

export function purchaseShopOffer(
  inventory: InventoryState,
  shop: ShopState,
  offerId: string,
  replaceCharmIndex?: number,
): PurchaseResult {
  const offer = shop.offers.find((candidate) => candidate.id === offerId);
  if (offer === undefined || shop.soldOfferIds.includes(offerId) || inventory.currency < offer.price) {
    return { inventory, shop, purchased: false };
  }
  let next: InventoryState;
  if (offer.kind === 'stone') {
    next = { ...inventory, deck: [...inventory.deck, offer.productId] };
  } else if (offer.kind === 'relic') {
    if (inventory.relics.includes(offer.productId)) return { inventory, shop, purchased: false };
    next = { ...inventory, relics: [...inventory.relics, offer.productId] };
  } else if (inventory.charms.length < 2) {
    next = { ...inventory, charms: [...inventory.charms, offer.productId] };
  } else {
    if (replaceCharmIndex === undefined || !Number.isSafeInteger(replaceCharmIndex)
      || replaceCharmIndex < 0 || replaceCharmIndex >= inventory.charms.length) {
      return { inventory, shop, purchased: false };
    }
    const charms = [...inventory.charms];
    charms[replaceCharmIndex] = offer.productId;
    next = { ...inventory, charms };
  }
  next = { ...next, currency: next.currency - offer.price };
  return {
    inventory: next,
    shop: { ...shop, soldOfferIds: [...shop.soldOfferIds, offerId] },
    purchased: true,
  };
}

export function removeShopCard(
  inventory: InventoryState,
  shop: ShopState,
  cardIndex: number,
  config: EconomyConfig,
): PurchaseResult {
  const price = removalPrice(config, inventory.removalCount);
  if (shop.removalUsed || !Number.isSafeInteger(cardIndex) || cardIndex < 0
    || cardIndex >= inventory.deck.length || inventory.currency < price) {
    return { inventory, shop, purchased: false };
  }
  return {
    inventory: {
      ...inventory,
      currency: inventory.currency - price,
      deck: inventory.deck.filter((_, index) => index !== cardIndex),
      removalCount: inventory.removalCount + 1,
    },
    shop: { ...shop, removalUsed: true },
    purchased: true,
  };
}

export interface DojoVisitState {
  readonly used: boolean;
  readonly free: boolean;
}

export type DojoAction =
  | { readonly type: 'remove'; readonly cardIndex: number }
  | { readonly type: 'exchange'; readonly cardIndex: number; readonly replacement: StoneKind }
  | { readonly type: 'duplicate'; readonly cardIndex: number };

export interface DojoResult {
  readonly inventory: InventoryState;
  readonly visit: DojoVisitState;
  readonly applied: boolean;
}

export function createDojoVisit(free = false): DojoVisitState {
  return { used: false, free };
}

export function useDojo(
  inventory: InventoryState,
  visit: DojoVisitState,
  action: DojoAction,
  config: EconomyConfig,
): DojoResult {
  validateEconomyConfig(config);
  if (visit.used || !Number.isSafeInteger(action.cardIndex) || action.cardIndex < 0
    || action.cardIndex >= inventory.deck.length
    || (action.type === 'remove' && inventory.deck.length <= config.dojoMinimumDeckSize)) {
    return { inventory, visit, applied: false };
  }
  const price = visit.free ? 0 : config.dojoPrices[action.type];
  if (inventory.currency < price) return { inventory, visit, applied: false };
  let deck: readonly StoneKind[];
  if (action.type === 'remove') deck = inventory.deck.filter((_, index) => index !== action.cardIndex);
  else if (action.type === 'exchange') deck = inventory.deck.map((kind, index) => index === action.cardIndex ? action.replacement : kind);
  else deck = [...inventory.deck, inventory.deck[action.cardIndex]];
  return {
    inventory: { ...inventory, currency: inventory.currency - price, deck },
    visit: { ...visit, used: true },
    applied: true,
  };
}
