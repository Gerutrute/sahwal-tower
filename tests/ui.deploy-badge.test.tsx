// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it } from 'vitest';
import { App, type DeployMeta } from '../src/App';
import { DRAFT_GAME_CONFIG } from './fixtures/draft-game-config';

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLDivElement | null = null;

function renderApp(deployMeta?: DeployMeta) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<App config={DRAFT_GAME_CONFIG} deployMeta={deployMeta} />));
  return host;
}

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

it('preview 배포 메타는 플레이테스트 라벨을 표시한다', () => {
  const rendered = renderApp({ target: 'preview', playtest: true });
  const badge = rendered.querySelector('[data-deploy-note="playtest"]');

  expect(badge?.getAttribute('role')).toBe('note');
  expect(badge?.textContent?.trim()).toBe('개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다');
});

it('production 또는 메타 부재에는 플레이테스트 라벨이 없다', () => {
  let rendered = renderApp({ target: 'production', playtest: false });
  expect(rendered.querySelectorAll('[data-deploy-note="playtest"]')).toHaveLength(0);

  act(() => root?.unmount());
  rendered.remove();
  root = null;
  host = null;
  rendered = renderApp();
  expect(rendered.querySelectorAll('[data-deploy-note="playtest"]')).toHaveLength(0);
});

it('플레이테스트 라벨은 등반 시작 뒤 지도 화면에도 유지된다', () => {
  const rendered = renderApp({ target: 'preview', playtest: true });
  const start = [...rendered.querySelectorAll('button')].find((button) => button.textContent === '등반 시작');

  act(() => start?.click());
  expect(rendered.querySelector('[data-screen="map"]')).toBeTruthy();
  expect(rendered.querySelectorAll('[data-deploy-note="playtest"]')).toHaveLength(1);
});
