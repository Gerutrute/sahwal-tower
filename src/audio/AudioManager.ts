import { musicAssetUrl, routeMusic, type MusicRoute, type MusicTrack } from './tracks';

export interface AudioTuning {
  readonly crossfadeSeconds: number;
  readonly overlapSeconds: number;
  readonly masterGain: number;
  readonly trackGains: Readonly<Record<MusicTrack, number>>;
}

export interface AudioManagerOptions {
  readonly tuning: AudioTuning;
  readonly createContext?: (() => AudioContext) | null;
  readonly createAudio?: (() => HTMLAudioElement) | null;
  readonly fetcher?: typeof fetch;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly baseUrl?: string;
  readonly onError?: (error: unknown) => void;
  readonly onStatusChange?: () => void;
}

export type AudioPlaybackState = 'idle' | 'pending' | 'web-audio' | 'fallback' | 'error';

export interface AudioSnapshot {
  readonly unlocked: boolean;
  readonly route: MusicRoute;
  readonly track: MusicTrack;
  readonly cache: readonly MusicTrack[];
  readonly muted: boolean;
  readonly volume: number;
  readonly generation: number;
  readonly playback: AudioPlaybackState;
  readonly lastError: string | null;
}

interface ActiveTrack {
  readonly track: MusicTrack;
  readonly gain: GainNode;
  readonly buffer: AudioBuffer;
  readonly sources: Set<AudioBufferSourceNode>;
  startedAt: number;
  offset: number;
  loopTimer: number | null;
  stopped: boolean;
}

const STORAGE_MUTE = 'rogolike.audio.muted';
const STORAGE_VOLUME = 'rogolike.audio.volume';

function validateTuning(tuning: AudioTuning | undefined): asserts tuning is AudioTuning {
  if (tuning === undefined) throw new TypeError('AudioTuning must be injected');
  const values = [
    tuning.crossfadeSeconds,
    tuning.overlapSeconds,
    tuning.masterGain,
    ...Object.values(tuning.trackGains),
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('AudioTuning values must be finite non-negative numbers');
  }
  if (tuning.crossfadeSeconds < 0.4 || tuning.crossfadeSeconds > 1.5) {
    throw new RangeError('AudioTuning crossfadeSeconds must be between 0.4 and 1.5');
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function scheduleTimeout(callback: () => void, delayMs: number): number {
  return globalThis.setTimeout(callback, delayMs) as unknown as number;
}

function cancelTimeout(timer: number): void {
  globalThis.clearTimeout(timer);
}

export function equalPowerCurve(direction: 'in' | 'out', samples = 24): Float32Array {
  if (!Number.isSafeInteger(samples) || samples < 2) throw new RangeError('curve samples must be at least two');
  return Float32Array.from({ length: samples }, (_, index) => {
    const progress = index / (samples - 1);
    return direction === 'in'
      ? Math.sin(progress * Math.PI * 0.5)
      : Math.cos(progress * Math.PI * 0.5);
  });
}

function scaledCurve(curve: Float32Array, gain: number): Float32Array {
  return Float32Array.from(curve, (value) => value * gain);
}

export class AudioManager {
  private readonly tuning: AudioTuning;
  private readonly createContext: (() => AudioContext) | null;
  private readonly createAudio: (() => HTMLAudioElement) | null;
  private readonly fetcher: typeof fetch;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  private readonly baseUrl: string;
  private readonly onError: (error: unknown) => void;
  private readonly onStatusChange: () => void;
  private readonly cache = new Map<MusicTrack, AudioBuffer>();
  private readonly positions = new Map<MusicTrack, number>();
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active: ActiveTrack | null = null;
  private fallback: HTMLAudioElement | null = null;
  private aborter: AbortController | null = null;
  private route: MusicRoute = 'title';
  private generation = 0;
  private unlocked = false;
  private muted = false;
  private volume = 1;
  private playback: AudioPlaybackState = 'idle';
  private lastError: string | null = null;

  constructor(options: AudioManagerOptions) {
    validateTuning(options?.tuning);
    this.tuning = options.tuning;
    const Context = typeof window === 'undefined' ? undefined : window.AudioContext;
    this.createContext = options.createContext === null
      ? null
      : options.createContext ?? (Context === undefined ? null : () => new Context());
    this.createAudio = options.createAudio === null
      ? null
      : options.createAudio ?? (typeof Audio === 'undefined' ? null : () => new Audio());
    this.fetcher = options.fetcher ?? fetch;
    this.storage = options.storage === null
      ? null
      : options.storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
    this.baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
    this.onError = options.onError ?? (() => undefined);
    this.onStatusChange = options.onStatusChange ?? (() => undefined);
    this.readPreferences();
  }

  snapshot(): AudioSnapshot {
    return {
      unlocked: this.unlocked,
      route: this.route,
      track: routeMusic(this.route),
      cache: [...this.cache.keys()],
      muted: this.muted,
      volume: this.volume,
      generation: this.generation,
      playback: this.playback,
      lastError: this.lastError,
    };
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.playback !== 'error') return this.resume();
      this.setPlayback('pending', null);
      const track = routeMusic(this.route);
      if (this.context !== null && this.master !== null) {
        await this.switchWebAudio(track, ++this.generation);
      } else {
        await this.switchFallback(track, new Error('WebAudio를 사용할 수 없습니다.'));
      }
      return;
    }
    this.unlocked = true;
    this.setPlayback('pending', null);
    if (this.createContext === null) {
      await this.switchFallback(routeMusic(this.route), new Error('WebAudio를 사용할 수 없습니다.'));
      return;
    }
    try {
      this.context = this.createContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applyMasterGain();
      void this.context.resume().catch((error) => this.reportError(error));
      await this.switchWebAudio(routeMusic(this.route), ++this.generation);
    } catch (error) {
      this.reportError(error);
      this.context = null;
      this.master = null;
      await this.switchFallback(routeMusic(this.route), error);
    }
  }

  setRoute(route: MusicRoute): void {
    const previous = routeMusic(this.route);
    const next = routeMusic(route);
    this.route = route;
    if (!this.unlocked || previous === next) return;
    const token = ++this.generation;
    this.aborter?.abort();
    if (this.context !== null) void this.switchWebAudio(next, token);
    else void this.switchFallback(next, new Error('WebAudio를 사용할 수 없습니다.'));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.writePreference(STORAGE_MUTE, String(muted));
    this.applyMasterGain();
    if (this.fallback !== null) this.fallback.muted = muted;
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.writePreference(STORAGE_VOLUME, String(this.volume));
    this.applyMasterGain();
    if (this.fallback !== null) this.fallback.volume = this.volume;
  }

  async resume(): Promise<void> {
    if (!this.unlocked || this.muted) return;
    if (this.context !== null && (this.context.state === 'suspended' || (this.context.state as string) === 'interrupted')) {
      await this.context.resume().catch(this.onError);
    }
    if (this.fallback?.paused) await this.fallback.play().catch(this.onError);
  }

  suspend(): void {
    void this.context?.suspend().catch(this.onError);
    this.fallback?.pause();
  }

  handleVisibility(visibility: DocumentVisibilityState): void {
    if (visibility === 'hidden') this.suspend();
    else void this.resume();
  }

  dispose(): void {
    this.generation += 1;
    this.aborter?.abort();
    this.stopTrack(this.active, 0);
    this.active = null;
    this.fallback?.pause();
    this.fallback = null;
    void this.context?.close().catch(this.onError);
    this.context = null;
    this.master = null;
    this.cache.clear();
    this.positions.clear();
  }

  private readPreferences(): void {
    try {
      this.muted = this.storage?.getItem(STORAGE_MUTE) === 'true';
      const value = this.storage?.getItem(STORAGE_VOLUME);
      if (value !== null && value !== undefined) {
        const stored = Number(value);
        if (Number.isFinite(stored) && stored >= 0 && stored <= 1) this.volume = stored;
      }
    } catch (error) {
      this.onError(error);
    }
  }

  private writePreference(key: string, value: string): void {
    try { this.storage?.setItem(key, value); } catch (error) { this.onError(error); }
  }

  private applyMasterGain(): void {
    if (this.master !== null) this.master.gain.value = this.muted ? 0 : this.volume * this.tuning.masterGain;
  }

  private reportError(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error);
    this.onError(error);
    this.onStatusChange();
  }

  private setPlayback(playback: AudioPlaybackState, lastError = this.lastError): void {
    const changed = playback !== this.playback || lastError !== this.lastError;
    this.playback = playback;
    this.lastError = lastError;
    if (changed) this.onStatusChange();
  }

  private async switchWebAudio(track: MusicTrack, token: number): Promise<void> {
    const context = this.context;
    const master = this.master;
    if (context === null || master === null) return;
    const controller = new AbortController();
    this.aborter = controller;
    try {
      const buffer = await this.load(track, controller.signal);
      if (controller.signal.aborted || token !== this.generation || routeMusic(this.route) !== track) return;
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueCurveAtTime(scaledCurve(equalPowerCurve('in'), this.tuning.trackGains[track]), now, this.tuning.crossfadeSeconds);
      gain.gain.setValueAtTime(this.tuning.trackGains[track], now + this.tuning.crossfadeSeconds);
      gain.connect(master);
      const next: ActiveTrack = {
        track,
        gain,
        buffer,
        sources: new Set(),
        startedAt: now,
        offset: this.positions.get(track) ?? 0,
        loopTimer: null,
        stopped: false,
      };
      const previous = this.active;
      this.active = next;
      this.scheduleSegment(next, now, next.offset, token);
      if (previous !== null) {
        this.rememberPosition(previous, now);
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(this.tuning.trackGains[previous.track], now);
        previous.gain.gain.setValueCurveAtTime(scaledCurve(equalPowerCurve('out'), this.tuning.trackGains[previous.track]), now, this.tuning.crossfadeSeconds);
        this.stopTrack(previous, this.tuning.crossfadeSeconds);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.reportError(error);
      await this.switchFallback(track, error);
    }
  }

  private async load(track: MusicTrack, signal: AbortSignal): Promise<AudioBuffer> {
    const cached = this.cache.get(track);
    if (cached !== undefined) {
      this.cache.delete(track);
      this.cache.set(track, cached);
      return cached;
    }
    const response = await this.fetcher(musicAssetUrl(this.baseUrl, track), { signal });
    if (!response.ok) throw new Error(`music asset failed: ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    const buffer = await this.context!.decodeAudioData(bytes.slice(0));
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    this.cache.set(track, buffer);
    while (this.cache.size > 2) {
      const oldest = this.cache.keys().next().value as MusicTrack | undefined;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return buffer;
  }

  private scheduleSegment(active: ActiveTrack, when: number, offset: number, token: number): void {
    const context = this.context;
    if (context === null || active.stopped || token !== this.generation) return;
    const remaining = Math.max(0.1, active.buffer.duration - offset);
    const overlap = Math.min(this.tuning.overlapSeconds, remaining / 2);
    const layer = context.createGain();
    layer.gain.setValueAtTime(offset === 0 ? 0 : 1, when);
    if (offset === 0 && overlap > 0) layer.gain.setValueCurveAtTime(equalPowerCurve('in'), when, overlap);
    if (overlap > 0) layer.gain.setValueCurveAtTime(equalPowerCurve('out'), when + remaining - overlap, overlap);
    layer.connect(active.gain);
    const source = context.createBufferSource();
    source.buffer = active.buffer;
    source.connect(layer);
    source.start(when, offset);
    this.setPlayback('web-audio', null);
    source.stop(when + remaining);
    active.sources.add(source);
    source.onended = () => active.sources.delete(source);
    const nextAt = when + remaining - overlap;
    const waitMs = Math.max(0, (nextAt - context.currentTime - 0.1) * 1000);
    active.loopTimer = scheduleTimeout(() => this.scheduleSegment(active, nextAt, 0, token), waitMs);
  }

  private rememberPosition(active: ActiveTrack, now: number): void {
    const elapsed = Math.max(0, now - active.startedAt);
    this.positions.set(active.track, (active.offset + elapsed) % active.buffer.duration);
  }

  private stopTrack(active: ActiveTrack | null, delaySeconds: number): void {
    if (active === null || active.stopped) return;
    active.stopped = true;
    if (active.loopTimer !== null) cancelTimeout(active.loopTimer);
    const stop = () => {
      for (const source of active.sources) {
        try { source.stop(); } catch { /* source already stopped */ }
        source.disconnect();
      }
      active.sources.clear();
      active.gain.disconnect();
    };
    if (delaySeconds === 0) stop();
    else scheduleTimeout(stop, delaySeconds * 1000);
  }

  private async switchFallback(track: MusicTrack, cause?: unknown): Promise<void> {
    if (this.createAudio === null) {
      const error = cause ?? new Error('fallback audio를 사용할 수 없습니다.');
      if (this.lastError === null) this.reportError(error);
      this.setPlayback('error', this.lastError ?? String(error));
      return;
    }
    const audio = this.fallback ?? this.createAudio();
    this.fallback?.pause();
    this.fallback = audio;
    audio.src = musicAssetUrl(this.baseUrl, track);
    audio.loop = true;
    audio.muted = this.muted;
    audio.volume = this.volume;
    try {
      await audio.play();
      this.setPlayback('fallback', null);
    } catch (error) {
      this.reportError(error);
      this.setPlayback('error', this.lastError);
    }
  }
}
