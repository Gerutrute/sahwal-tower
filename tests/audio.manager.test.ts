import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioManager, equalPowerCurve, type AudioTuning } from '../src/audio/AudioManager';

const DRAFT_AUDIO_TUNING: AudioTuning = {
  crossfadeSeconds: 0.6,
  overlapSeconds: 0.5,
  masterGain: 0.7,
  trackGains: { overworld: 0.8, battle: 0.7, boss: 0.65, shop: 0.75 },
};

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
  startCalls = 0;
  connect() { return this as unknown as AudioNode; }
  disconnect() { return undefined; }
  start() { this.startCalls += 1; return undefined; }
  stop() { return undefined; }
}

class FakeContext {
  currentTime = 10;
  state = 'suspended' as AudioContextState | 'interrupted';
  destination = {} as AudioDestinationNode;
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  decodeCount = 0;
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => undefined);
  createGain = () => { const gain = new FakeGain(); this.gains.push(gain); return gain as unknown as GainNode; };
  createBufferSource = () => {
    const source = new FakeSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  };
  decodeAudioData = vi.fn(async () => { this.decodeCount += 1; return { duration: 12 } as AudioBuffer; });
}

const response = () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const managers: AudioManager[] = [];

afterEach(() => {
  managers.splice(0).forEach((manager) => manager.dispose());
  vi.restoreAllMocks();
});

describe('AudioManager', () => {
  it('resume promise가 미해결이어도 fetch와 BufferSource.start를 진행한다', async () => {
    const context = new FakeContext();
    context.resume = vi.fn(() => new Promise<void>(() => undefined));
    const fetcher = vi.fn(async () => response());
    const manager = new AudioManager({
      tuning: DRAFT_AUDIO_TUNING,
      createContext: () => context as unknown as AudioContext,
      fetcher,
    });
    managers.push(manager);

    void manager.unlock();
    await tick();

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(context.sources.reduce((sum, source) => sum + source.startCalls, 0)).toBeGreaterThanOrEqual(1);
  });

  it('WebAudio fetch 실패 시 fallback 재생과 상태를 노출한다', async () => {
    const context = new FakeContext();
    const audio = { src: '', loop: false, muted: false, volume: 1, paused: true, play: vi.fn(async () => undefined), pause: vi.fn() } as unknown as HTMLAudioElement;
    const errors: unknown[] = [];
    const manager = new AudioManager({
      tuning: DRAFT_AUDIO_TUNING,
      createContext: () => context as unknown as AudioContext,
      createAudio: () => audio,
      fetcher: vi.fn(async () => { throw new Error('network'); }),
      onError: (error) => errors.push(error),
    });
    managers.push(manager);

    await manager.unlock();

    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(manager.snapshot().playback).toBe('fallback');
    expect(errors.length).toBeGreaterThanOrEqual(1);
  });

  it('정상 WebAudio 시작을 상태로 노출한다', async () => {
    const manager = new AudioManager({
      tuning: DRAFT_AUDIO_TUNING,
      createContext: () => new FakeContext() as unknown as AudioContext,
      fetcher: vi.fn(async () => response()),
    });
    managers.push(manager);
    await manager.unlock();
    expect(manager.snapshot().playback).toBe('web-audio');
  });

  it('WebAudio와 fallback이 모두 실패하면 오류와 원인을 노출한다', async () => {
    const manager = new AudioManager({
      tuning: DRAFT_AUDIO_TUNING,
      createContext: () => new FakeContext() as unknown as AudioContext,
      createAudio: null,
      fetcher: vi.fn(async () => { throw new Error('offline'); }),
    });
    managers.push(manager);
    await manager.unlock();
    expect(manager.snapshot().playback).toBe('error');
    expect(manager.snapshot().lastError).toContain('offline');
  });

  it('오류 상태에서 unlock 재시도는 현재 트랙을 다시 로드한다', async () => {
    const fetcher = vi.fn(async () => { throw new Error('offline'); });
    const manager = new AudioManager({
      tuning: DRAFT_AUDIO_TUNING,
      createContext: () => new FakeContext() as unknown as AudioContext,
      createAudio: null,
      fetcher,
    });
    managers.push(manager);
    await manager.unlock();
    await manager.unlock();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('첫 gesture 전 context를 만들지 않는다', async () => {
    const createContext = vi.fn(() => new FakeContext() as unknown as AudioContext);
    const manager = new AudioManager({ tuning: DRAFT_AUDIO_TUNING, createContext, fetcher: vi.fn(async () => response()), baseUrl: '/portal/' });
    managers.push(manager);
    manager.setRoute('battle');
    expect(createContext).not.toHaveBeenCalled();
    expect(manager.snapshot().unlocked).toBe(false);
    await manager.unlock();
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('AudioTuning 누락을 제품 기본값으로 보완하지 않는다', () => {
    expect(() => new AudioManager({} as never)).toThrow(/AudioTuning/);
  });

  it('현재 경로만 lazy fetch하고 decode LRU를 두 곡으로 제한한다', async () => {
    const context = new FakeContext();
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => response());
    const manager = new AudioManager({ tuning: DRAFT_AUDIO_TUNING, createContext: () => context as unknown as AudioContext, fetcher, baseUrl: '/sub/' });
    managers.push(manager);
    expect(fetcher).not.toHaveBeenCalled();
    await manager.unlock();
    manager.setRoute('battle'); await tick();
    manager.setRoute('shop'); await tick();
    expect(manager.snapshot().cache).toHaveLength(2);
    expect(fetcher.mock.calls.every(([url]) => String(url).startsWith('/sub/music/'))).toBe(true);
  });

  it('빠른 경로 변경의 stale 요청을 취소하고 주입 crossfade를 쓴다', async () => {
    const context = new FakeContext();
    const signals: AbortSignal[] = [];
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal as AbortSignal);
      return response();
    });
    const manager = new AudioManager({ tuning: DRAFT_AUDIO_TUNING, createContext: () => context as unknown as AudioContext, fetcher });
    managers.push(manager);
    await manager.unlock();
    manager.setRoute('battle');
    manager.setRoute('shop');
    await tick();
    expect(signals.at(-2)?.aborted).toBe(true);
    expect(manager.snapshot().track).toBe('shop');
    expect(context.gains.flatMap(({ gain }) => gain.calls).some((call) => call.startsWith('curve:'))).toBe(true);
    expect(equalPowerCurve('in').at(-1)).toBeCloseTo(1);
  });

  it('동일 track overlay는 재시작하지 않고 지도 왕복 buffer 위치를 재사용한다', async () => {
    const context = new FakeContext();
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => response());
    const manager = new AudioManager({ tuning: DRAFT_AUDIO_TUNING, createContext: () => context as unknown as AudioContext, fetcher });
    managers.push(manager);
    await manager.unlock();
    const initialGeneration = manager.snapshot().generation;
    manager.setRoute('map');
    manager.setRoute('reward');
    expect(manager.snapshot().generation).toBe(initialGeneration);
    manager.setRoute('shop'); await tick();
    manager.setRoute('map'); await tick();
    expect(context.decodeCount).toBe(2);
  });

  it('visibility와 interrupted context 뒤 설정에 따라 재개한다', async () => {
    const context = new FakeContext();
    const manager = new AudioManager({ tuning: DRAFT_AUDIO_TUNING, createContext: () => context as unknown as AudioContext, fetcher: vi.fn(async () => response()) });
    managers.push(manager);
    await manager.unlock();
    context.state = 'interrupted';
    await manager.resume();
    expect(context.resume).toHaveBeenCalledTimes(2);
    manager.setMuted(true);
    context.state = 'suspended';
    await manager.resume();
    expect(context.resume).toHaveBeenCalledTimes(2);
  });

  it('BASE_URL과 HTMLAudio fallback의 loop mute pause를 지킨다', async () => {
    const audio = { src: '', loop: false, muted: false, volume: 1, paused: true, play: vi.fn(async () => undefined), pause: vi.fn() } as unknown as HTMLAudioElement;
    const manager = new AudioManager({ tuning: DRAFT_AUDIO_TUNING, createContext: null, createAudio: () => audio, baseUrl: '/nested/app/' });
    managers.push(manager);
    manager.setRoute('boss');
    await manager.unlock();
    expect(audio.src).toBe('/nested/app/music/bosstheme.mp3');
    expect(audio.loop).toBe(true);
    manager.setMuted(true);
    expect(audio.muted).toBe(true);
    manager.suspend();
    expect(audio.pause).toHaveBeenCalled();
  });

  it('asset decode storage autoplay 실패를 비치명적으로 보고한다', async () => {
    const errors: unknown[] = [];
    const audio = { src: '', loop: false, muted: false, volume: 1, paused: true, play: vi.fn(async () => { throw new Error('autoplay'); }), pause: vi.fn() } as unknown as HTMLAudioElement;
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(() => { throw new Error('quota'); }) };
    const manager = new AudioManager({ tuning: DRAFT_AUDIO_TUNING, createContext: null, createAudio: () => audio, storage, onError: (error) => errors.push(error) });
    managers.push(manager);
    await expect(manager.unlock()).resolves.toBeUndefined();
    expect(() => manager.setMuted(true)).not.toThrow();
    expect(() => manager.setVolume(0.4)).not.toThrow();
    const missing = new AudioManager({
      tuning: DRAFT_AUDIO_TUNING,
      createContext: () => new FakeContext() as unknown as AudioContext,
      fetcher: vi.fn(async () => ({ ok: false, status: 404 } as Response)),
      onError: (error) => errors.push(error),
    });
    managers.push(missing);
    await expect(missing.unlock()).resolves.toBeUndefined();
    const decodeContext = new FakeContext();
    decodeContext.decodeAudioData = vi.fn(async () => { throw new Error('decode'); });
    const undecodable = new AudioManager({
      tuning: DRAFT_AUDIO_TUNING,
      createContext: () => decodeContext as unknown as AudioContext,
      fetcher: vi.fn(async () => response()),
      onError: (error) => errors.push(error),
    });
    managers.push(undecodable);
    await expect(undecodable.unlock()).resolves.toBeUndefined();
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });
});
