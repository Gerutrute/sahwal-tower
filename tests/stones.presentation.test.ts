import { describe, expect, it } from 'vitest';

import { STONE_DEFINITIONS } from '../src/game/content/stones';

describe('병종 카드 표시 계약', () => {
  it('6개 병종 모두 한국어 요약·조건·전략을 제공한다', () => {
    const definitions = Object.values(STONE_DEFINITIONS);
    expect(definitions).toHaveLength(6);
    for (const definition of definitions) {
      for (const value of [definition.ui.summary, definition.ui.condition, definition.ui.effect, definition.ui.strategy, definition.ui.synergy]) {
        expect(value).toMatch(/[가-힣]/);
        expect(value).not.toMatch(/STONE-|after-placement|capture-success|card-entered-hand|adjacent-endangered-group|captured-by-opponent-placement/);
      }
    }
  });

  it('병종별 클래스와 문양이 모두 서로 다르다', () => {
    const ui = Object.values(STONE_DEFINITIONS).map(({ ui: value }) => value);
    expect(new Set(ui.map(({ classKey }) => classKey)).size).toBe(6);
    expect(new Set(ui.map(({ icon }) => icon)).size).toBe(6);
  });

  it('승인된 효과 수치를 요약에 명시한다', () => {
    expect(STONE_DEFINITIONS['STONE-002'].ui.summary).toContain('3장');
    expect(STONE_DEFINITIONS['STONE-003'].ui.summary).toContain('5냥');
    expect(STONE_DEFINITIONS['STONE-003'].ui.summary).toContain('1장');
    expect(STONE_DEFINITIONS['STONE-004'].ui.summary).toContain('2장');
    expect(STONE_DEFINITIONS['STONE-004'].ui.summary).toContain('맨 아래');
    expect(STONE_DEFINITIONS['STONE-005'].ui.condition).toContain('활로 2');
    expect(STONE_DEFINITIONS['STONE-005'].ui.summary).toContain('무효');
    expect(STONE_DEFINITIONS['STONE-006'].ui.summary).toContain('패 한도');
    expect(STONE_DEFINITIONS['STONE-006'].ui.summary).toContain('1장');
  });
});
