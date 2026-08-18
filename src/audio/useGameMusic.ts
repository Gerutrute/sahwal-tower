import { useEffect, useMemo, useState } from 'react';
import { AudioManager, type AudioTuning } from './AudioManager';
import { routeMusic, type MusicRoute } from './tracks';

export function useGameMusic(route: MusicRoute, tuning: AudioTuning) {
  const [version, refresh] = useState(0);
  const manager = useMemo(() => new AudioManager({
    tuning,
    onError: () => refresh((value) => value + 1),
    onStatusChange: () => refresh((value) => value + 1),
  }), [tuning]);

  useEffect(() => () => manager.dispose(), [manager]);
  useEffect(() => { manager.setRoute(route); }, [manager, route]);
  useEffect(() => {
    const onVisibility = () => manager.handleVisibility(document.visibilityState);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [manager]);

  return useMemo(() => ({
    track: routeMusic(route),
    snapshot: manager.snapshot(),
    unlock: async () => { await manager.unlock(); refresh((value) => value + 1); },
    resume: async () => { await manager.resume(); refresh((value) => value + 1); },
    setMuted: (muted: boolean) => { manager.setMuted(muted); refresh((value) => value + 1); },
    setVolume: (volume: number) => { manager.setVolume(volume); refresh((value) => value + 1); },
  }), [manager, route, version]);
}
