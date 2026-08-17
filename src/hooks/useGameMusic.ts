import { useEffect, useMemo, useState } from 'react';
import { AudioManager, routeMusic, type MusicRoute } from '../audio';

const sharedAudio = new AudioManager();

export function useGameMusic(route: MusicRoute, manager: AudioManager = sharedAudio) {
  const [version, refresh] = useState(0);
  useEffect(() => { manager.setRoute(route); }, [manager, route]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') manager.suspendForHidden();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [manager]);

  return useMemo(() => ({
    track: routeMusic(route),
    snapshot: manager.snapshot(),
    unlock: () => { const result = manager.unlock(); refresh((value) => value + 1); return result; },
    resume: () => { const result = manager.resume(); refresh((value) => value + 1); return result; },
    setMuted: (muted: boolean) => { manager.setMuted(muted); refresh((value) => value + 1); },
    setVolume: (volume: number) => { manager.setVolume(volume); refresh((value) => value + 1); },
  }), [manager, route, version]);
}
