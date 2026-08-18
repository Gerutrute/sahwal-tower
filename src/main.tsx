import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App, type DeployMeta } from './App';
import type { GameConfig } from './game/GameProvider';
import './styles.css';

declare global {
  interface Window {
    __ROGOLIKE_GAME_CONFIG__?: GameConfig;
    __ROGOLIKE_DEPLOY_META__?: DeployMeta;
  }
}

const config = window.__ROGOLIKE_GAME_CONFIG__;
const deployMeta = window.__ROGOLIKE_DEPLOY_META__;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{config
    ? <App config={config} deployMeta={deployMeta} />
    : <main className="screen configuration-required" role="alert">
        <h1>RoGolike</h1>
        <p>승인된 GameConfig가 필요합니다. 제품 빌드는 미승인 수치 기본값을 제공하지 않습니다.</p>
      </main>}</StrictMode>,
);
