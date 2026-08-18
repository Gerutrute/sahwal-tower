import type { ReturnTypeOfUseGameMusic } from './audio-control-types';

export function AudioControls({ music }: { readonly music: ReturnTypeOfUseGameMusic }) {
  const label = music.track === 'overworld' ? '여정 음악'
    : music.track === 'battle' ? '전투 음악'
      : music.track === 'boss' ? '보스 음악' : '상점 음악';
  return <div className="audio-controls" aria-label="음악 설정">
    <span aria-live="polite">{label}</span>
    <button
      aria-label={music.snapshot.muted ? '음악 켜기' : '음악 끄기'}
      onClick={() => { if (!music.snapshot.unlocked) void music.unlock(); else music.setMuted(!music.snapshot.muted); }}
    >{music.snapshot.muted ? '음악 켜기' : '음악 끄기'}</button>
    {music.snapshot.playback === 'error' && <button onClick={() => void music.unlock()}>음악 다시 시도</button>}
  </div>;
}
