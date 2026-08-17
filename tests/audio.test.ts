import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioManager, DEFAULT_AUDIO_TUNING, equalPowerCurve, routeMusic } from '../src/audio';

class FakeParam {
  value = 1;
  calls: string[] = [];
  setValueAtTime(value: number) { this.value = value; this.calls.push(`set:${value}`); return this as unknown as AudioParam; }
  setValueCurveAtTime(values: Float32Array) { this.calls.push(`curve:${values[0]}:${values.at(-1)}`); return this as unknown as AudioParam; }
  cancelScheduledValues() { this.calls.push('cancel'); return this as unknown as AudioParam; }
}

class FakeGain {
  gain = new FakeParam();
  connect() { return this as unknown as AudioNode; }
  disconnect() { return undefined; }
}

class FakeSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect() { return this as unknown as AudioNode; }
  disconnect() { return undefined; }
  start() { return undefined; }
  stop() { return undefined; }
}

class FakeContext {
  currentTime = 10;
  state: AudioContextState = 'suspended';
  destination = {} as AudioDestinationNode;
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  decodeCount = 0;
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => undefined);
  createGain = () => { const gain = new FakeGain(); this.gains.push(gain); return gain as unknown as GainNode; };
  createBufferSource = () => { const source = new FakeSource(); this.sources.push(source); return source as unknown as AudioBufferSourceNode; };
  decodeAudioData = vi.fn(async () => { this.decodeCount += 1; return { duration: 12 } as AudioBuffer; });
}

const response = () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const managers: AudioManager[] = [];
afterEach(() => { managers.splice(0).forEach((manager) => manager.dispose()); vi.restoreAllMocks(); });

describe('게임 음악', () => {
  it('첫 gesture 전 context를 만들지 않는다', async () => {
    const createContext = vi.fn(() => new FakeContext() as unknown as AudioContext);
    const manager = new AudioManager({ createContext, fetcher: vi.fn(async () => response()), baseUrl: '/portal/' });
    managers.push(manager);
    manager.setRoute('battle');
    expect(createContext).not.toHaveBeenCalled();
    expect(manager.snapshot().unlocked).toBe(false);
    await manager.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('승인된 화면별 곡과 부활=boss를 매핑한다', () => {
    for (const route of ['title', 'map', 'reward', 'event', 'result', 'transition'] as const) expect(routeMusic(route)).toBe('overworld');
    expect(routeMusic('battle')).toBe('battle');
    expect(routeMusic('elite')).toBe('battle');
    expect(routeMusic('boss')).toBe('boss');
    expect(routeMusic('revival')).toBe('boss');
    expect(routeMusic('shop')).toBe('shop');
    expect(routeMusic('dojo')).toBe('shop');
  });

  it('현재 경로만 지연 로드하고 디코드 캐시는 최근 2곡만 유지한다', async () => {
    const context = new FakeContext();
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => response());
    const manager = new AudioManager({ createContext: () => context as unknown as AudioContext, fetcher, baseUrl: '/sub/' });
    managers.push(manager);
    expect(fetcher).not.toHaveBeenCalled();
    await manager.unlock();
    manager.setRoute('battle'); await tick();
    manager.setRoute('shop'); await tick();
    expect(manager.snapshot().cache).toHaveLength(2);
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('/sub/music/'))).toBe(true);
  });

  it('빠른 경로 변경은 이전 요청을 취소하고 최종 곡만 남긴다', async () => {
    const context = new FakeContext();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => { signals.push(init?.signal as AbortSignal); return response(); });
    const manager = new AudioManager({ createContext: () => context as unknown as AudioContext, fetcher });
    managers.push(manager);
    await manager.unlock();
    manager.setRoute('battle');
    manager.setRoute('shop');
    await tick();
    expect(signals.at(-2)?.aborted).toBe(true);
    expect(manager.snapshot().track).toBe('shop');
  });

  it('지도 복귀는 overworld 버퍼를 다시 디코드하지 않고 equal-power gain을 쓴다', async () => {
    const context = new FakeContext();
    const manager = new AudioManager({ createContext: () => context as unknown as AudioContext, fetcher: vi.fn(async () => response()) });
    managers.push(manager);
    await manager.unlock();
    await tick();
    manager.setRoute('shop'); await tick();
    manager.setRoute('map'); await tick();
    expect(context.decodeCount).toBe(2);
    expect(context.gains.flatMap(({ gain }) => gain.calls).some((call) => call.startsWith('curve:'))).toBe(true);
    expect(equalPowerCurve('in').at(-1)).toBeCloseTo(1);
    expect(equalPowerCurve('out').at(-1)).toBeCloseTo(0);
  });

  it('음소거와 볼륨 저장 실패 및 autoplay 실패가 게임을 막지 않는다', async () => {
    const errors: unknown[] = [];
    const audio = { src: '', loop: false, muted: false, volume: 1, paused: true, play: vi.fn(async () => { throw new Error('autoplay'); }), pause: vi.fn() } as unknown as HTMLAudioElement;
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(() => { throw new Error('quota'); }) };
    const manager = new AudioManager({ createAudio: () => audio, createContext: undefined, storage, onError: (error) => errors.push(error) });
    managers.push(manager);
    await expect(manager.unlock()).resolves.toBeUndefined();
    expect(() => manager.setMuted(true)).not.toThrow();
    expect(() => manager.setVolume(.4)).not.toThrow();
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(DEFAULT_AUDIO_TUNING.crossfadeSeconds).toBeGreaterThanOrEqual(.4);
    expect(DEFAULT_AUDIO_TUNING.crossfadeSeconds).toBeLessThanOrEqual(1.5);
  });
});
