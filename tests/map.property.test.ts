import { describe, expect, it } from 'vitest';
import { enumerateMapPaths, generateActMap } from '../src/game/map';
import { createSeededRng } from '../src/game/rng';
import { DRAFT_MAP_WEIGHTS } from './fixtures/draft-run-config';

describe('런 지도', () => {
  it('1막은 5노드 뒤 보스다', () => {
    const map = generateActMap(1, DRAFT_MAP_WEIGHTS, createSeededRng('act-one-length'));

    expect(map.columns).toHaveLength(5);
    expect(map.boss.column).toBe(5);
  });

  it('모든 경로에 일반전 1~3개', () => {
    for (const act of [1, 2] as const) {
      for (let seed = 0; seed < 40; seed += 1) {
        const map = generateActMap(act, DRAFT_MAP_WEIGHTS, createSeededRng(`property-${act}-${seed}`));
        for (const path of enumerateMapPaths(map)) {
          const route = path.filter(({ type }) => type !== 'boss');
          const battles = route.filter(({ type }) => type === 'battle').length;
          const nonCombat = route.filter(({ type }) => !['battle', 'elite'].includes(type)).length;
          expect(route).toHaveLength(5);
          expect(battles).toBeGreaterThanOrEqual(1);
          expect(battles).toBeLessThanOrEqual(3);
          expect(nonCombat).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('연속 전투 제한과 경로당 정예 최대 1개를 생성 단계에서 지킨다', () => {
    const map = generateActMap(1, DRAFT_MAP_WEIGHTS, createSeededRng('combat-limits'));
    for (const path of enumerateMapPaths(map)) {
      const route = path.filter(({ type }) => type !== 'boss');
      let consecutive = 0;
      let maximumConsecutive = 0;
      route.forEach(({ type }) => {
        consecutive = type === 'battle' || type === 'elite' ? consecutive + 1 : 0;
        maximumConsecutive = Math.max(maximumConsecutive, consecutive);
      });
      expect(maximumConsecutive).toBeLessThanOrEqual(2);
      expect(route.filter(({ type }) => type === 'elite')).toHaveLength(route.some(({ type }) => type === 'elite') ? 1 : 0);
    }
  });

  it('같은 seed와 가중치는 같은 지도를 만들고 주입 가중치는 결과를 바꾼다', () => {
    const first = generateActMap(2, DRAFT_MAP_WEIGHTS, createSeededRng('deterministic-map'));
    const second = generateActMap(2, DRAFT_MAP_WEIGHTS, createSeededRng('deterministic-map'));
    const eventOnly = generateActMap(2, {
      nonCombat: { shop: 0, event: 1, dojo: 0, shrine: 0 },
      shopAccess: { minimumPaths: 0, maximumPerPath: 0 },
    }, createSeededRng('weighted-map'));
    const dojoOnly = generateActMap(2, {
      nonCombat: { shop: 0, event: 0, dojo: 1, shrine: 0 },
      shopAccess: { minimumPaths: 0, maximumPerPath: 0 },
    }, createSeededRng('weighted-map'));

    expect(first).toEqual(second);
    expect(eventOnly.columns.flat().filter(({ type }) => type === 'event').length).toBeGreaterThan(0);
    expect(dojoOnly.columns.flat().filter(({ type }) => type === 'dojo').length).toBeGreaterThan(0);
    expect(eventOnly).not.toEqual(dojoOnly);
  });

  it('승인된 사건과 적 ID만 배치하고 1막·2막 판 크기를 고정한다', () => {
    const first = generateActMap(1, DRAFT_MAP_WEIGHTS, createSeededRng('approved-one'));
    const second = generateActMap(2, DRAFT_MAP_WEIGHTS, createSeededRng('approved-two'));
    const eventIds = new Set(['EVENT-001', 'EVENT-002', 'EVENT-003']);
    const enemyIds = new Set(['ENEMY-001', 'ENEMY-002', 'ENEMY-003']);

    expect(first.boardSize).toBe(7);
    expect(second.boardSize).toBe(9);
    for (const map of [first, second]) {
      map.columns.flat().filter(({ type }) => type === 'event').forEach(({ eventId }) => expect(eventIds.has(eventId!)).toBe(true));
      [...map.columns.flat(), map.boss].filter(({ enemyId }) => enemyId !== undefined)
        .forEach(({ enemyId }) => expect(enemyIds.has(enemyId!)).toBe(true));
    }
  });
});
