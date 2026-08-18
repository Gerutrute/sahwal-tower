import { describe, expect, it } from 'vitest';
import { routeMusic } from '../src/audio/tracks';

describe('화면 음악 라우팅', () => {
  it('승인된 화면별 곡과 부활 2단계를 매핑한다', () => {
    for (const route of ['title', 'map', 'reward', 'event', 'result', 'transition'] as const) expect(routeMusic(route)).toBe('overworld');
    for (const route of ['battle', 'elite'] as const) expect(routeMusic(route)).toBe('battle');
    for (const route of ['boss', 'revival'] as const) expect(routeMusic(route)).toBe('boss');
    for (const route of ['shop', 'dojo'] as const) expect(routeMusic(route)).toBe('shop');
  });
});
