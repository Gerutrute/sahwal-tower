// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AudioControls } from '../src/components/AudioControls';

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function renderMusic(playback: 'idle' | 'pending' | 'web-audio' | 'fallback' | 'error') {
  const unlock = vi.fn(async () => undefined);
  const music = {
    track: 'overworld',
    snapshot: {
      unlocked: playback !== 'idle',
      route: 'map',
      track: 'overworld',
      cache: [],
      muted: false,
      volume: 1,
      generation: 0,
      playback,
      lastError: playback === 'error' ? 'offline' : null,
    },
    unlock,
    resume: vi.fn(async () => undefined),
    setMuted: vi.fn(),
    setVolume: vi.fn(),
  };
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<AudioControls music={music as never} />));
  return { music, unlock };
}

describe('음악 재생 상태 UI', () => {
  it('오류 상태에서 재시도 버튼으로 unlock을 다시 호출한다', () => {
    const { unlock } = renderMusic('error');
    const retry = [...host!.querySelectorAll('button')]
      .find(({ textContent }) => textContent?.includes('음악 다시 시도'));
    expect(retry).toBeTruthy();
    act(() => retry?.click());
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('기존 트랙 라벨과 음소거 토글을 유지한다', () => {
    const { music } = renderMusic('web-audio');
    expect(host?.textContent).toContain('여정 음악');
    const mute = host?.querySelector<HTMLButtonElement>('[aria-label="음악 끄기"]');
    act(() => mute?.click());
    expect(music.setMuted).toHaveBeenCalledWith(true);
  });
});
