import { describe, expect, it } from 'vitest';

import { DRAFT_REWARD_CATALOG } from './fixtures/draft-run-config';

const inventory = {
  deck: ['STONE-002', 'STONE-002', 'STONE-001'] as const,
  charms: ['ITEM-001', 'ITEM-001'] as const,
  relics: ['RELIC-001'] as const,
};

describe('보상 상세 설명', () => {
  it('보상 후보를 요약·조건·효과·전략·연계·보유량으로 서술한다', async () => {
    const module = await import('../src/game/rewards');
    expect(module).toHaveProperty('describeRewardCandidate');
    if (!('describeRewardCandidate' in module)) return;
    for (const kind of ['stone', 'charm', 'relic'] as const) {
      const candidate = DRAFT_REWARD_CATALOG.candidates.find((reward) => reward.kind === kind)!;
      const detail = module.describeRewardCandidate(candidate, inventory);
      for (const value of [detail.summary, detail.condition, detail.effect, detail.strategy, detail.synergy]) {
        expect(value).toMatch(/[가-힣]/);
      }
      expect(detail.ownedCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('종류별 현재 보유량을 계산하고 내부 식별자를 숨긴다', async () => {
    const { describeRewardCandidate } = await import('../src/game/rewards');
    const details = DRAFT_REWARD_CATALOG.candidates.map((candidate) => describeRewardCandidate(candidate, inventory));
    const scout = DRAFT_REWARD_CATALOG.candidates.findIndex((candidate) => candidate.kind === 'stone' && candidate.stoneKind === 'STONE-002');
    if (scout >= 0) expect(details[scout].ownedCount).toBe(2);
    details.forEach((detail) => {
      expect(Object.values(detail).join(' ')).not.toMatch(/STONE-|ITEM-|RELIC-|capture-threshold|pre-move/);
    });
  });
});
