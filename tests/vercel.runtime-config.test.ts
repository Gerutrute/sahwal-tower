import { describe, expect, it } from 'vitest';
import {
  injectRuntimeConfigScript,
  renderRuntimeConfigJs,
  validateGameConfigText,
} from '../scripts/vercel-runtime-config.mjs';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

describe('Vercel runtime config', () => {
  it('값이 없으면 RUNTIME_CONFIG_MISSING으로 실패한다', () => {
    expect(validateGameConfigText(undefined)).toEqual({ ok: false, code: 'RUNTIME_CONFIG_MISSING' });
    expect(validateGameConfigText('   ')).toEqual({ ok: false, code: 'RUNTIME_CONFIG_MISSING' });
  });

  it('잘못된 JSON은 원문을 노출하지 않고 RUNTIME_CONFIG_INVALID_JSON으로 실패한다', () => {
    const marker = 'LEAKCHECK-RUNTIME-CONFIG';
    const result = validateGameConfigText(`{"seed":${marker}`);

    expect(result).toEqual({ ok: false, code: 'RUNTIME_CONFIG_INVALID_JSON' });
    expect(JSON.stringify(result)).not.toContain(marker);
  });

  it('객체와 필수 최상위 필드를 필드 경로만으로 검증한다', () => {
    expect(validateGameConfigText('[]')).toEqual({
      ok: false,
      code: 'RUNTIME_CONFIG_SCHEMA_INVALID',
      fields: ['$'],
    });

    const marker = 'LEAKCHECK-SCHEMA-VALUE';
    const result = validateGameConfigText(JSON.stringify({ seed: marker }));
    expect(result).toMatchObject({ ok: false, code: 'RUNTIME_CONFIG_SCHEMA_INVALID' });
    expect(result.fields).toContain('audioTuning');
    expect(JSON.stringify(result)).not.toContain(marker);
  });

  it('komiBySize의 7·9 유한 수치를 검증한다', () => {
    const config = structuredClone(DRAFT_GAME_CONFIG) as unknown as {
      komiBySize: Record<7 | 9, number>;
    };
    config.komiBySize[7] = Number.POSITIVE_INFINITY;

    expect(validateGameConfigText(JSON.stringify(config))).toEqual({
      ok: false,
      code: 'RUNTIME_CONFIG_SCHEMA_INVALID',
      fields: ['komiBySize.7'],
    });
  });

  it('aiEffectWeights의 여섯 병종이 정확히 일치해야 한다', () => {
    const config = structuredClone(DRAFT_GAME_CONFIG) as unknown as Record<string, unknown>;
    const weights = config.aiEffectWeights as Record<string, number>;
    delete weights['STONE-006'];
    weights['STONE-007'] = 1;

    expect(validateGameConfigText(JSON.stringify(config))).toEqual({
      ok: false,
      code: 'RUNTIME_CONFIG_SCHEMA_INVALID',
      fields: ['aiEffectWeights'],
    });
  });

  it('enemyDeck은 비어 있지 않아야 한다', () => {
    const config = { ...structuredClone(DRAFT_GAME_CONFIG), enemyDeck: [] };

    expect(validateGameConfigText(JSON.stringify(config))).toEqual({
      ok: false,
      code: 'RUNTIME_CONFIG_SCHEMA_INVALID',
      fields: ['enemyDeck'],
    });
  });

  it('draft fixture의 얕은 스키마는 통과한다', () => {
    expect(validateGameConfigText(JSON.stringify(DRAFT_GAME_CONFIG))).toEqual({
      ok: true,
      config: DRAFT_GAME_CONFIG,
    });
  });

  it.each([
    ['preview', true],
    ['production', false],
  ] as const)('%s 대상 전역 두 종류를 직렬화한다', (target, playtest) => {
    const runtimeJs = renderRuntimeConfigJs(DRAFT_GAME_CONFIG, target);
    const runtimeWindow: Record<string, unknown> = {};
    Function('window', runtimeJs)(runtimeWindow);

    expect(runtimeWindow.__ROGOLIKE_GAME_CONFIG__).toEqual(DRAFT_GAME_CONFIG);
    expect(runtimeWindow.__ROGOLIKE_DEPLOY_META__).toEqual({ target, playtest });
    expect(Object.isFrozen(runtimeWindow.__ROGOLIKE_DEPLOY_META__)).toBe(true);
  });

  it('runtime-config 로더를 head 끝 직전에 정확히 한 번 주입한다', () => {
    const html = '<html><head><title>x</title><script type="module" src="./main.js"></script></head><body></body></html>';
    const injected = injectRuntimeConfigScript(html);
    const tag = '<script src="./runtime-config.js"></script>';

    expect(injected.split(tag)).toHaveLength(2);
    expect(injected).toContain(`${tag}</head>`);
    expect(injected.indexOf(tag)).toBeLessThan(injected.indexOf('<script type="module"'));
    expect(injected.indexOf('<script type="module"')).toBeGreaterThan(injected.indexOf('<body>'));
    expect(() => injectRuntimeConfigScript(injected)).toThrow('RUNTIME_CONFIG_SCRIPT_ALREADY_INJECTED');
    expect(() => injectRuntimeConfigScript('<main></main>')).toThrow('RUNTIME_CONFIG_HEAD_MISSING');
  });
});
