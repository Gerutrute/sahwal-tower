import { describe, expect, it } from 'vitest';
import { validateBootFromText } from '../scripts/vercel-validate-boot';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

describe('Vercel boot validation', () => {
  it('draft fixture 구성으로 게임 상태를 부팅한다', () => {
    const result = validateBootFromText(JSON.stringify(DRAFT_GAME_CONFIG));

    expect(result).toEqual({ ok: true });
  });

  it('빈 enemyDeck은 얕은 검증에서 RUNTIME_CONFIG_SCHEMA_INVALID로 실패한다', () => {
    const config = { ...structuredClone(DRAFT_GAME_CONFIG), enemyDeck: [] };

    expect(validateBootFromText(JSON.stringify(config))).toEqual({
      ok: false,
      code: 'RUNTIME_CONFIG_SCHEMA_INVALID',
      fields: ['enemyDeck'],
    });
  });

  it('얕은 검증을 통과한 유효하지 않은 수치는 부팅 단계에서 실패한다', () => {
    const config = structuredClone(DRAFT_GAME_CONFIG) as unknown as {
      audioTuning: { masterGain: number | null };
    };
    config.audioTuning.masterGain = null;

    expect(validateBootFromText(JSON.stringify(config))).toEqual({
      ok: false,
      code: 'RUNTIME_CONFIG_BOOT_FAILED',
      message: 'GameConfig numeric values must be finite',
    });
  });
});
