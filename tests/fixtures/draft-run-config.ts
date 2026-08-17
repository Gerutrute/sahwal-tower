import type { EconomyConfig, ShopCatalog } from '../../src/game/economy';
import type { MapWeights } from '../../src/game/map';
import type { RewardCatalog } from '../../src/game/rewards';

export const DRAFT_MAP_WEIGHTS: MapWeights = {
  nonCombat: { shop: 25, event: 30, dojo: 25, shrine: 20 },
  shopAccess: { minimumPaths: 1, maximumPerPath: 1 },
};

export const DRAFT_ECONOMY_CONFIG: EconomyConfig = {
  startingCurrency: 30,
  battleRewards: { normal: 40, elite: 75, boss: 100 },
  captureRewardPerStone: 5,
  captureRewardCap: 15,
  shopPrices: { commonStone: 60, rareStone: 110, charm: 35, relic: 140 },
  removalBasePrice: 50,
  removalPriceIncrement: 25,
  dojoPrices: { remove: 50, exchange: 35, duplicate: 75 },
  dojoMinimumDeckSize: 1,
  freeDojoVisitsBeforeAct2: 1,
};

export const DRAFT_SHOP_CATALOG: ShopCatalog = {
  stones: [
    { id: 'STONE-001', rarity: 'common' },
    { id: 'STONE-002', rarity: 'common' },
    { id: 'STONE-003', rarity: 'rare' },
    { id: 'STONE-004', rarity: 'rare' },
    { id: 'STONE-005', rarity: 'common' },
    { id: 'STONE-006', rarity: 'rare' },
  ],
  charms: ['ITEM-001', 'ITEM-002', 'ITEM-003', 'ITEM-004', 'ITEM-005'],
  relics: ['RELIC-001', 'RELIC-002', 'RELIC-003', 'RELIC-005', 'RELIC-007', 'RELIC-009', 'RELIC-010', 'RELIC-013'],
};

export const DRAFT_REWARD_CATALOG: RewardCatalog = {
  candidates: [
    { id: 'reward-general', kind: 'stone', stoneKind: 'STONE-003', name: '장군석', style: '공격' },
    { id: 'reward-cavalry', kind: 'stone', stoneKind: 'STONE-004', name: '기병석', style: '공격' },
    { id: 'reward-guardian', kind: 'stone', stoneKind: 'STONE-005', name: '수호석', style: '대마' },
    { id: 'reward-charm', kind: 'charm', charmId: 'ITEM-001', name: '수읽기 부적', style: '안정' },
    { id: 'reward-relic', kind: 'relic', relicId: 'RELIC-002', name: '장수의 호패', style: '포획' },
  ],
};
