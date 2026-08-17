export type MusicTrack = 'overworld' | 'battle' | 'boss' | 'shop';
export type MusicRoute =
  | 'title' | 'map' | 'reward' | 'event' | 'result' | 'transition'
  | 'battle' | 'elite' | 'boss' | 'revival'
  | 'shop' | 'dojo';

export interface AudioTuning {
  readonly crossfadeSeconds: number;
  readonly overlapSeconds: number;
  readonly masterGain: number;
  readonly trackGains: Readonly<Record<MusicTrack, number>>;
}

export const DEFAULT_AUDIO_TUNING: AudioTuning = {
  crossfadeSeconds: 0.8,
  overlapSeconds: 1.2,
  masterGain: 0.62,
  trackGains: { overworld: 0.82, battle: 0.72, boss: 0.68, shop: 0.8 },
};

export const TRACK_FILES: Readonly<Record<MusicTrack, string>> = {
  overworld: 'overworld.mp3',
  battle: 'battletheme.mp3',
  boss: 'bosstheme.mp3',
  shop: 'shoptheme.mp3',
};

export function routeMusic(route: MusicRoute): MusicTrack {
  if (route === 'battle' || route === 'elite') return 'battle';
  if (route === 'boss' || route === 'revival') return 'boss';
  if (route === 'shop' || route === 'dojo') return 'shop';
  return 'overworld';
}

export function equalPowerCurve(direction: 'in' | 'out', samples = 24): Float32Array {
  return Float32Array.from({ length: samples }, (_, index) => {
    const progress = index / (samples - 1);
    return direction === 'in'
      ? Math.sin(progress * Math.PI * 0.5)
      : Math.cos(progress * Math.PI * 0.5);
  });
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

interface AudioManagerOptions {
  readonly createContext?: () => AudioContext;
  readonly createAudio?: () => HTMLAudioElement;
  readonly fetcher?: typeof fetch;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'>;
  readonly baseUrl?: string;
  readonly tuning?: AudioTuning;
  readonly onError?: (error: unknown) => void;
}

interface AudioSnapshot {
  readonly unlocked: boolean;
  readonly route: MusicRoute;
  readonly track: MusicTrack;
  readonly cache: readonly MusicTrack[];
  readonly muted: boolean;
  readonly volume: number;
  readonly generation: number;
}

const STORAGE_MUTE = 'rogolike.audio.muted';
const STORAGE_VOLUME = 'rogolike.audio.volume';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function scaledCurve(curve: Float32Array, gain: number): Float32Array {
  return Float32Array.from(curve, (value) => value * gain);
}

function joinedAssetUrl(baseUrl: string, file: string): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalized}music/${file}`;
}

export class AudioManager {
  private readonly createContext: (() => AudioContext) | undefined;
  private readonly createAudio: (() => HTMLAudioElement) | undefined;
  private readonly fetcher: typeof fetch;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  private readonly baseUrl: string;
  private readonly tuning: AudioTuning;
  private readonly onError: (error: unknown) => void;
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

  constructor(options: AudioManagerOptions = {}) {
    const AudioContextConstructor = typeof window === 'undefined'
      ? undefined
      : window.AudioContext;
    this.createContext = options.createContext
      ?? (AudioContextConstructor ? () => new AudioContextConstructor() : undefined);
    this.createAudio = options.createAudio
      ?? (typeof Audio === 'undefined' ? undefined : () => new Audio());
    this.fetcher = options.fetcher ?? fetch;
    this.storage = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    this.baseUrl = options.baseUrl ?? import.meta.env.BASE_URL;
    this.tuning = options.tuning ?? DEFAULT_AUDIO_TUNING;
    this.onError = options.onError ?? (() => undefined);
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
    };
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      await this.resume();
      return;
    }
    this.unlocked = true;
    if (this.createContext) {
      try {
        this.context = this.createContext();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.applyMasterGain();
        await this.context.resume().catch(this.onError);
        await this.switchWebAudio(routeMusic(this.route), ++this.generation);
      } catch (error) {
        this.onError(error);
        this.context = null;
        this.master = null;
        await this.switchFallback(routeMusic(this.route));
      }
      return;
    }
    await this.switchFallback(routeMusic(this.route));
  }

  setRoute(route: MusicRoute): void {
    const previousTrack = routeMusic(this.route);
    const nextTrack = routeMusic(route);
    this.route = route;
    if (!this.unlocked || previousTrack === nextTrack) return;
    const token = ++this.generation;
    this.aborter?.abort();
    if (this.context) void this.switchWebAudio(nextTrack, token);
    else void this.switchFallback(nextTrack);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.writePreference(STORAGE_MUTE, String(muted));
    this.applyMasterGain();
    if (this.fallback) this.fallback.muted = muted;
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume, 0, 1);
    this.writePreference(STORAGE_VOLUME, String(this.volume));
    this.applyMasterGain();
    if (this.fallback) this.fallback.volume = this.volume;
  }

  async resume(): Promise<void> {
    if (!this.unlocked || this.muted) return;
    const context = this.context;
    if (context && (context.state === 'suspended' || (context.state as string) === 'interrupted')) {
      await context.resume().catch(this.onError);
    }
    if (this.fallback?.paused) {
      const playResult = this.fallback.play();
      if (playResult) await playResult.catch(this.onError);
    }
  }

  suspendForHidden(): void {
    if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') return;
    void this.context?.suspend().catch(this.onError);
    this.fallback?.pause();
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
  }

  private readPreferences(): void {
    try {
      this.muted = this.storage?.getItem(STORAGE_MUTE) === 'true';
      const stored = Number(this.storage?.getItem(STORAGE_VOLUME));
      if (Number.isFinite(stored) && stored >= 0 && stored <= 1) this.volume = stored;
    } catch (error) {
      this.onError(error);
    }
  }

  private writePreference(key: string, value: string): void {
    try { this.storage?.setItem(key, value); } catch (error) { this.onError(error); }
  }

  private applyMasterGain(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * this.tuning.masterGain;
  }

  private async switchWebAudio(track: MusicTrack, token: number): Promise<void> {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const controller = new AbortController();
    this.aborter = controller;
    try {
      const buffer = await this.load(track, controller.signal);
      if (controller.signal.aborted || token !== this.generation || routeMusic(this.route) !== track) return;
      const now = context.currentTime;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueCurveAtTime(
        scaledCurve(equalPowerCurve('in'), this.tuning.trackGains[track]),
        now,
        this.tuning.crossfadeSeconds,
      );
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
      if (previous) {
        this.rememberPosition(previous, now);
        previous.gain.gain.cancelScheduledValues(now);
        previous.gain.gain.setValueAtTime(this.tuning.trackGains[previous.track], now);
        previous.gain.gain.setValueCurveAtTime(
          scaledCurve(equalPowerCurve('out'), this.tuning.trackGains[previous.track]),
          now,
          this.tuning.crossfadeSeconds,
        );
        this.stopTrack(previous, this.tuning.crossfadeSeconds);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) this.onError(error);
    }
  }

  private async load(track: MusicTrack, signal: AbortSignal): Promise<AudioBuffer> {
    const cached = this.cache.get(track);
    if (cached) {
      this.cache.delete(track);
      this.cache.set(track, cached);
      return cached;
    }
    const response = await this.fetcher(joinedAssetUrl(this.baseUrl, TRACK_FILES[track]), { signal });
    if (!response.ok) throw new Error(`음악 파일 응답 실패: ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
    const buffer = await this.context!.decodeAudioData(bytes.slice(0));
    if (signal.aborted) throw new DOMException('취소됨', 'AbortError');
    this.cache.set(track, buffer);
    while (this.cache.size > 2) {
      const oldest = this.cache.keys().next().value as MusicTrack | undefined;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
    return buffer;
  }

  private scheduleSegment(active: ActiveTrack, when: number, offset: number, token: number): void {
    const context = this.context;
    if (!context || active.stopped || token !== this.generation) return;
    const remaining = Math.max(0.1, active.buffer.duration - offset);
    const overlap = Math.min(this.tuning.overlapSeconds, remaining / 2);
    const layerGain = context.createGain();
    layerGain.gain.setValueAtTime(offset === 0 ? 0 : 1, when);
    if (offset === 0) layerGain.gain.setValueCurveAtTime(equalPowerCurve('in'), when, overlap);
    layerGain.gain.setValueCurveAtTime(equalPowerCurve('out'), when + remaining - overlap, overlap);
    layerGain.connect(active.gain);
    const source = context.createBufferSource();
    source.buffer = active.buffer;
    source.connect(layerGain);
    source.start(when, offset);
    source.stop(when + remaining);
    active.sources.add(source);
    source.onended = () => active.sources.delete(source);
    const nextAt = when + remaining - overlap;
    const waitMs = Math.max(0, (nextAt - context.currentTime - 0.1) * 1000);
    active.loopTimer = window.setTimeout(() => this.scheduleSegment(active, nextAt, 0, token), waitMs);
  }

  private rememberPosition(active: ActiveTrack, now: number): void {
    const elapsed = Math.max(0, now - active.startedAt);
    this.positions.set(active.track, (active.offset + elapsed) % active.buffer.duration);
  }

  private stopTrack(active: ActiveTrack | null, delaySeconds: number): void {
    if (!active || active.stopped) return;
    active.stopped = true;
    if (active.loopTimer !== null) window.clearTimeout(active.loopTimer);
    const stop = () => {
      for (const source of active.sources) {
        try { source.stop(); } catch { /* already stopped */ }
        source.disconnect();
      }
      active.sources.clear();
      active.gain.disconnect();
    };
    if (delaySeconds <= 0) stop();
    else window.setTimeout(stop, delaySeconds * 1000);
  }

  private async switchFallback(track: MusicTrack): Promise<void> {
    if (!this.createAudio) return;
    const audio = this.fallback ?? this.createAudio();
    if (this.fallback) this.fallback.pause();
    this.fallback = audio;
    audio.src = joinedAssetUrl(this.baseUrl, TRACK_FILES[track]);
    audio.loop = true;
    audio.muted = this.muted;
    audio.volume = this.volume;
    const playResult = audio.play();
    if (playResult) await playResult.catch(this.onError);
  }
}
