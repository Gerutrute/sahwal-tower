import { describe, expect, it } from 'vitest';
import { createRunState, runReducer } from '../src/game/run';
import { generateRewardCandidates, decisiveMoveCandidates } from '../src/game/rewards';
import { createSeededRng } from '../src/game/rng';
import {
  DRAFT_ECONOMY_CONFIG,
  DRAFT_REWARD_CATALOG,
} from './fixtures/draft-run-config';

const create = () => createRunState({
  deck: ['STONE-001', 'STONE-002'],
  relics: ['RELIC-001'],
  economy: DRAFT_ECONOMY_CONFIG,
});

describe('런 진행', () => {
  it('1막 보스 승리 후 9×9 2막으로 확장하고 덱·유물을 유지한다', () => {
    const initial = create();
    const next = runReducer(initial, {
      type: 'BATTLE_RESOLVED', resolution: 'win', battle: 'boss', capturedStones: 0,
    }, DRAFT_ECONOMY_CONFIG);

    expect(next).toMatchObject({ act: 2, boardSize: 9, status: 'active', completedNodes: 0 });
    expect(next.deck).toBe(initial.deck);
    expect(next.relics).toBe(initial.relics);
    expect(next.freeDojoVisits).toBe(DRAFT_ECONOMY_CONFIG.freeDojoVisitsBeforeAct2);
  });

  it('2막 보스 승리로 MVP를 종료한다', () => {
    const actTwo = { ...create(), act: 2 as const, boardSize: 9 as const };
    const next = runReducer(actTwo, {
      type: 'BATTLE_RESOLVED', resolution: 'win', battle: 'boss', capturedStones: 0,
    }, DRAFT_ECONOMY_CONFIG);
    expect(next.status).toBe('won');
  });

  it('전투 보상과 포획 추가 냥은 주입 config와 대국당 상한을 따른다', () => {
    const next = runReducer(create(), {
      type: 'BATTLE_RESOLVED', resolution: 'win', battle: 'normal', capturedStones: 99,
    }, DRAFT_ECONOMY_CONFIG);
    expect(next.currency).toBe(
      DRAFT_ECONOMY_CONFIG.startingCurrency
      + DRAFT_ECONOMY_CONFIG.battleRewards.normal
      + DRAFT_ECONOMY_CONFIG.captureRewardCap,
    );
  });

  it('보상은 3후보 무중복·현재 기풍 1+·확장 1+이며 하나만 선택한다', () => {
    const offered = generateRewardCandidates(DRAFT_REWARD_CATALOG, '공격', createSeededRng('reward'));
    expect(offered).toHaveLength(3);
    expect(new Set(offered.map(({ id }) => id)).size).toBe(3);
    expect(offered.some(({ style }) => style === '공격')).toBe(true);
    expect(offered.some(({ style }) => style !== '공격')).toBe(true);

    const screen = runReducer(create(), { type: 'OFFER_REWARDS', candidates: offered }, DRAFT_ECONOMY_CONFIG);
    const chosen = runReducer(screen, { type: 'CHOOSE_REWARD', candidateId: offered[0].id }, DRAFT_ECONOMY_CONFIG);
    const duplicate = runReducer(chosen, { type: 'CHOOSE_REWARD', candidateId: offered[1].id }, DRAFT_ECONOMY_CONFIG);
    expect(chosen.selectedRewardId).toBe(offered[0].id);
    expect(duplicate).toBe(chosen);
  });

  it('유물은 선택 즉시 적용하고 보상 전체 거절은 무보상이다', () => {
    const relic = DRAFT_REWARD_CATALOG.candidates.find(({ kind }) => kind === 'relic')!;
    const filler = DRAFT_REWARD_CATALOG.candidates.filter(({ id }) => id !== relic.id).slice(0, 2);
    const offered = [relic, ...filler];
    const screen = runReducer(create(), { type: 'OFFER_REWARDS', candidates: offered }, DRAFT_ECONOMY_CONFIG);
    const chosen = runReducer(screen, { type: 'CHOOSE_REWARD', candidateId: relic.id }, DRAFT_ECONOMY_CONFIG);
    expect(chosen.relics).toContain('RELIC-002');
    expect(chosen.pendingRewards).toBeNull();

    const empty = create();
    const declined = runReducer(
      runReducer(empty, { type: 'OFFER_REWARDS', candidates: offered }, DRAFT_ECONOMY_CONFIG),
      { type: 'DECLINE_REWARDS' },
      DRAFT_ECONOMY_CONFIG,
    );
    expect(declined.deck).toBe(empty.deck);
    expect(declined.relics).toBe(empty.relics);
    expect(declined.charms).toBe(empty.charms);
  });

  it('부적 2개 보유 중 새 부적은 지정한 한 칸만 교체한다', () => {
    const initial = { ...create(), charms: ['ITEM-002', 'ITEM-003'] as const };
    const charm = DRAFT_REWARD_CATALOG.candidates.find(({ kind }) => kind === 'charm')!;
    const filler = DRAFT_REWARD_CATALOG.candidates.filter(({ id }) => id !== charm.id).slice(0, 2);
    const offered = [charm, ...filler];
    const selected = runReducer(
      runReducer(initial, { type: 'OFFER_REWARDS', candidates: offered }, DRAFT_ECONOMY_CONFIG),
      { type: 'CHOOSE_REWARD', candidateId: charm.id },
      DRAFT_ECONOMY_CONFIG,
    );
    const replaced = runReducer(selected, { type: 'REPLACE_CHARM', index: 1 }, DRAFT_ECONOMY_CONFIG);
    expect(selected.pendingCharm).toBe('ITEM-001');
    expect(replaced.charms).toEqual(['ITEM-002', 'ITEM-001']);
    expect(replaced.pendingCharm).toBeNull();
  });

  it.each(['loss', 'resign'] as const)('%s는 모드와 관계없이 런을 즉시 종료한다', (resolution) => {
    for (const battle of ['normal', 'elite', 'boss'] as const) {
      expect(runReducer(create(), {
        type: 'BATTLE_RESOLVED', resolution, battle, capturedStones: 0,
      }, DRAFT_ECONOMY_CONFIG).status).toBe('lost');
    }
  });

  it('결정적 착수 후보는 같은 기록·seed에서 1~3개로 고정된다', () => {
    const records = Array.from({ length: 6 }, (_, turn) => ({ id: `move-${turn}`, turn, impact: turn % 2 ? -turn : turn }));
    const first = decisiveMoveCandidates(records, 'decisive');
    const second = decisiveMoveCandidates(records, 'decisive');
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first.length).toBeLessThanOrEqual(3);
  });
});
