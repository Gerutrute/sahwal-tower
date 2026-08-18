import { describe, expect, it } from 'vitest';
import { createUnlockState, filterUnlocked, unlockPredicate, unlockReducer } from '../src/game/unlocks';
import { generateRewardCandidates } from '../src/game/rewards';
import { createSeededRng } from '../src/game/rng';

describe('결정적 해금 reducer', () => {
  it('잠긴 ID는 후보에서 제외된다', () => {
    const state = createUnlockState(['STONE-001', 'ITEM-001']);
    const candidates = [{ id: 'STONE-001' }, { id: 'STONE-002' }, { id: 'ITEM-001' }];
    expect(filterUnlocked(candidates, state, ({ id }) => id)).toEqual([{ id: 'STONE-001' }, { id: 'ITEM-001' }]);
    const rewards = generateRewardCandidates({ candidates: [
      { id: 'STONE-001', kind: 'stone', stoneKind: 'STONE-001', name: 'normal', style: 'base' },
      { id: 'ITEM-001', kind: 'charm', charmId: 'ITEM-001', name: 'charm', style: 'other' },
      { id: 'RELIC-001', kind: 'relic', relicId: 'RELIC-001', name: 'relic', style: 'other' },
      { id: 'STONE-002', kind: 'stone', stoneKind: 'STONE-002', name: 'locked', style: 'base' },
    ] }, 'base', createSeededRng('unlock-filter'), unlockPredicate(createUnlockState(['STONE-001', 'ITEM-001', 'RELIC-001'])));
    expect(rewards.map(({ id }) => id)).not.toContain('STONE-002');
  });

  it('해금 ID 집합만 중복 없이 결정적으로 갱신한다', () => {
    const initial = createUnlockState(['STONE-001']);
    const once = unlockReducer(initial, { type: 'UNLOCK', id: 'STONE-003' });
    const twice = unlockReducer(once, { type: 'UNLOCK', id: 'STONE-003' });
    expect(twice).toEqual(once);
    expect(Object.keys(twice)).toEqual(['unlockedIds']);
  });
});
