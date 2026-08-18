export type MusicTrack = 'overworld' | 'battle' | 'boss' | 'shop';
export type MusicRoute =
  | 'title' | 'map' | 'reward' | 'event' | 'result' | 'transition'
  | 'battle' | 'elite' | 'boss' | 'revival'
  | 'shop' | 'dojo';

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

export function musicAssetUrl(baseUrl: string, track: MusicTrack): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalized}music/${TRACK_FILES[track]}`;
}
