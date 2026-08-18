import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { preview as startVitePreview } from 'vite';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('playwright-results');
await mkdir(outputDir, { recursive: true });

const emptyWeights = Array(49).fill(0);
const draftGameConfig = {
  seed: 'mobile-draft-seed',
  komiBySize: { 7: -100, 9: -100 },
  economy: {
    startingCurrency: 200,
    battleRewards: { normal: 40, elite: 75, boss: 100 },
    captureRewardPerStone: 5,
    captureRewardCap: 15,
    shopPrices: { commonStone: 60, rareStone: 110, charm: 35, relic: 140 },
    removalBasePrice: 50,
    removalPriceIncrement: 25,
    dojoPrices: { remove: 50, exchange: 35, duplicate: 75 },
    dojoMinimumDeckSize: 1,
    freeDojoVisitsBeforeAct2: 1,
  },
  mapWeights: {
    nonCombat: { shop: 25, event: 30, dojo: 25, shrine: 20 },
    shopAccess: { minimumPaths: 1, maximumPerPath: 1 },
  },
  effectLimits: {
    maxResolvedEffects: 16,
    maxQueueDepth: 4,
    maxGeneratedEffects: 8,
    maxEffectsPerSource: 4,
    maxHandSize: 8,
  },
  generalCaptureMoneyCap: 15,
  enemyDeck: ['STONE-001', 'STONE-001', 'STONE-001', 'STONE-001', 'STONE-001', 'STONE-001', 'STONE-002', 'STONE-003', 'STONE-004', 'STONE-005'],
  bossByAct: {
    1: {
      id: 'MOBILE-ACT1-BOSS',
      revival: {
        trait: { id: 'MOBILE-REVIVAL', scoreWeights: { captured: 0, liberties: 0, adjacentFriendly: 0, adjacentOpponent: 0, pointWeights: emptyWeights } },
        specialMoves: [{ id: 'MOBILE-REVIVAL-MOVE', priority: 1, stoneKind: 'STONE-006', scoreWeights: { captured: 0, liberties: 0, adjacentFriendly: 0, adjacentOpponent: 0, pointWeights: emptyWeights }, tieBreak: 'lowest-point' }],
      },
    },
    2: { id: 'MOBILE-ACT2-BOSS' },
  },
  rewards: {
    candidates: [
      { id: 'mobile-general', kind: 'stone', stoneKind: 'STONE-003', name: '장군석', style: '공격' },
      { id: 'mobile-guardian', kind: 'stone', stoneKind: 'STONE-005', name: '수호석', style: '안정' },
      { id: 'mobile-charm', kind: 'charm', charmId: 'ITEM-001', name: '수읽기 부적', style: '확장' },
      { id: 'mobile-relic', kind: 'relic', relicId: 'RELIC-002', name: '장수의 호패', style: '포획' },
    ],
  },
  shop: {
    stones: [
      { id: 'STONE-001', rarity: 'common' },
      { id: 'STONE-002', rarity: 'common' },
      { id: 'STONE-003', rarity: 'rare' },
    ],
    charms: ['ITEM-001', 'ITEM-002'],
    relics: ['RELIC-001'],
  },
  eventCurrencyReward: 20,
  aiCaptureWeight: 10,
  aiEffectWeights: {
    'STONE-001': 0,
    'STONE-002': 2,
    'STONE-003': 4,
    'STONE-004': 0,
    'STONE-005': 3,
    'STONE-006': 0,
  },
  aiPassScoreThreshold: 1,
  analysisCaptureWeight: 10,
  analysisEffectWeight: 1,
  // HDD-013 pending: composition-boundary draft for automated mobile checks only.
  audioTuning: {
    crossfadeSeconds: 0.6,
    overlapSeconds: 0.5,
    masterGain: 0.7,
    trackGains: { overworld: 0.8, battle: 0.7, boss: 0.65, shop: 0.75 },
  },
};

function browserOptions() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`PLAYWRIGHT_CHROMIUM_EXECUTABLE을 찾을 수 없음: ${explicit}`);
    return { executablePath: explicit };
  }
  const managed = chromium.executablePath();
  if (existsSync(managed)) return { executablePath: managed };
  const windowsCandidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  const installed = windowsCandidates.find(existsSync);
  return installed ? { executablePath: installed } : {};
}

async function playSinglePlacement(page, coordinate) {
  const normal = page.locator('.hand .card:enabled').filter({ hasText: '일반석' }).first();
  if (await normal.count()) await normal.click();
  else await page.locator('.hand .card:enabled').first().click();
  const hit = coordinate === undefined
    ? page.locator('.hit[aria-label$=", 착수"]').first()
    : page.locator(`[data-hit="${coordinate}"]`);
  await hit.click();
  await page.waitForTimeout(470);
}

let rewardInteractionChecked = false;
async function finishOrdinaryBattle(page) {
  await playSinglePlacement(page);
  await page.getByRole('button', { name: '패스' }).click();
  await page.getByRole('heading', { name: '전리품을 고르세요' }).waitFor();
  if (!rewardInteractionChecked) {
    const face = page.locator('.reward-face').first();
    await face.click();
    if (await page.locator('[data-screen="reward"]').count() !== 1) throw new Error('보상 첫 tap이 즉시 선택을 확정함');
    if (await face.getAttribute('aria-expanded') !== 'true') throw new Error('보상 첫 tap 뒤 상세가 열리지 않음');
    const detail = page.locator('.reward-detail').first();
    await detail.waitFor();
    if (await detail.locator('dt').count() !== 6) throw new Error('보상 상세 6요소가 모두 표시되지 않음');
    await detail.getByRole('button', { name: '이 보상을 선택' }).click();
    rewardInteractionChecked = true;
  } else {
    await page.getByRole('button', { name: '보상을 받지 않는다' }).click();
  }
  await page.locator('[data-screen="map"]').waitFor();
}

async function visitOpenNode(page) {
  const open = page.locator('[data-state="open"]').first();
  await open.click();
  const screen = await page.locator('[data-screen]').getAttribute('data-screen');
  if (screen === 'battle') {
    await finishOrdinaryBattle(page);
  } else if (screen === 'shop' || screen === 'dojo') {
    if (screen === 'shop' && !(await page.locator('body').innerText()).includes('상점 음악')) {
      throw new Error('상점 음악 라우팅 실패');
    }
    await page.getByRole('button', { name: '지도로 돌아가기' }).click();
  } else if (screen === 'event') {
    await page.getByRole('button', { name: '조용히 떠난다' }).click();
  }
  await page.locator('[data-screen="map"]').waitFor();
}

async function reachBoss(page) {
  const boss = page.locator('[data-node-id$="-boss"]');
  for (let step = 0; step < 6 && await boss.getAttribute('data-state') !== 'open'; step += 1) {
    await visitOpenNode(page);
  }
  if (await boss.getAttribute('data-state') !== 'open') throw new Error('경로 완주 후에도 보스가 열리지 않음');
  await boss.click();
}

async function assertMapLayout(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    nodes: [...document.querySelectorAll('.map-node')].map((node) => {
      const rect = node.getBoundingClientRect();
      return { id: node.dataset.nodeId, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }),
  }));
  if (metrics.viewport !== 380 || metrics.html > 380 || metrics.body > 380) {
    throw new Error(`${label} 380px 지도 가로 스크롤 발생`);
  }
  for (let left = 0; left < metrics.nodes.length; left += 1) {
    for (let right = left + 1; right < metrics.nodes.length; right += 1) {
      const a = metrics.nodes[left];
      const b = metrics.nodes[right];
      const overlap = a.left < b.right - .1 && a.right > b.left + .1
        && a.top < b.bottom - .1 && a.bottom > b.top + .1;
      if (overlap) throw new Error(`${label} 지도 노드 겹침: ${a.id}, ${b.id}`);
    }
  }
  return metrics;
}

let previewServer;
let browser;
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const badResponses = [];

try {
  if (process.env.BASE_URL === undefined) {
    previewServer = await startVitePreview({
      root: process.cwd(),
      logLevel: 'error',
      preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    });
  }
  browser = await chromium.launch({ headless: true, ...browserOptions() });
  const context = await browser.newContext({
    viewport: { width: 380, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36',
  });
  await context.addInitScript(() => {
    window.__audioAudit = { contexts: 0, plays: 0, starts: 0 };
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (NativeAudioContext) {
      class AuditedAudioContext extends NativeAudioContext {
        constructor(...args) { super(...args); window.__audioAudit.contexts += 1; }
        createBufferSource() {
          const source = super.createBufferSource();
          const nativeStart = source.start.bind(source);
          source.start = (...args) => {
            window.__audioAudit.starts += 1;
            return nativeStart(...args);
          };
          return source;
        }
      }
      window.AudioContext = AuditedAudioContext;
      window.webkitAudioContext = AuditedAudioContext;
    }
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function auditedPlay(...args) {
      window.__audioAudit.plays += 1;
      return nativePlay.apply(this, args);
    };
  });
  await context.addInitScript((config) => {
    window.__ROGOLIKE_GAME_CONFIG__ = config;
  }, draftGameConfig);
  const page = await context.newPage();
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', (response) => { if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`); });

  const response = await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30_000 });
  if (!response?.ok()) throw new Error(`문서 응답 실패: ${response?.status() ?? '없음'}`);
  await page.getByRole('heading', { name: 'RoGolike', exact: true }).waitFor();
  const initial = await page.evaluate(() => ({
    title: document.title,
    text: document.body.innerText,
    innerWidth,
    innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    audio: window.__audioAudit,
  }));
  if (initial.title !== 'RoGolike') throw new Error(`문서 제목 불일치: ${initial.title}`);
  if (/\uC0AC\uD65C\uC758 \uD0D1|\u6B7B\u6D3B\u4E4B\u5854/.test(initial.text)) throw new Error('구형 표시명이 화면에 남아 있음');
  if (initial.innerWidth !== 380 || initial.innerHeight !== 844 || initial.scrollWidth > 380) throw new Error('380×844 초기 화면 규격 실패');
  if (initial.audio.contexts !== 0 || initial.audio.plays !== 0) throw new Error('첫 gesture 전에 오디오를 시작함');
  await page.screenshot({ path: path.join(outputDir, 'mobile-title.png'), fullPage: true });

  for (const file of ['overworld.mp3', 'battletheme.mp3', 'bosstheme.mp3', 'shoptheme.mp3']) {
    const url = new URL(`music/${file}`, baseURL).toString();
    const asset = await context.request.get(url);
    if (!asset.ok()) throw new Error(`${file} 응답 실패: ${asset.status()}`);
  }

  await page.getByRole('button', { name: '등반 시작' }).click();
  await page.getByRole('navigation', { name: '1막 지도' }).waitFor();
  const mapMetrics = await assertMapLayout(page, '막 시작');
  if (await page.locator('.map-edge').count() !== 18) throw new Error('지도 실제 연결선 수가 18개가 아님');
  if (Object.keys(draftGameConfig.aiEffectWeights).sort().join(',') !== 'STONE-001,STONE-002,STONE-003,STONE-004,STONE-005,STONE-006') {
    throw new Error('모바일 draft config의 병종별 AI 가중치 shape 불일치');
  }
  if (!(await page.locator('body').innerText()).includes('여정 음악')) throw new Error('지도 음악 라우팅 실패');
  await page.waitForFunction(() => window.__audioAudit.starts + window.__audioAudit.plays > 0);
  const postGestureAudio = await page.evaluate(() => ({ ...window.__audioAudit }));
  if (postGestureAudio.starts < 1 && postGestureAudio.plays < 1) throw new Error('첫 gesture 뒤 실제 재생 신호가 없음');

  const lockedBoss = page.locator('[data-node-id$="-boss"]');
  if (await lockedBoss.getAttribute('data-state') !== 'locked') throw new Error('막 시작 시 보스가 잠기지 않음');
  await lockedBoss.evaluate((button) => button.click());
  if (await page.locator('[data-screen="map"]').count() !== 1) throw new Error('잠긴 노드 클릭이 화면을 전환함');

  await page.locator('[data-state="open"]').first().click();
  await page.locator('[data-board-size="7"]').waitFor();
  if (await page.locator('.hit').count() !== 49) throw new Error('7×7 좌표 수 불일치');
  const board7Widths = {};
  for (const width of [380, 430]) {
    await page.setViewportSize({ width, height: 844 });
    board7Widths[width] = await page.evaluate(() => ({
      viewport: innerWidth,
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    if (board7Widths[width].html > width || board7Widths[width].body > width) {
      throw new Error(`7×7 ${width}px 화면 가로 스크롤 발생`);
    }
  }
  await page.setViewportSize({ width: 380, height: 844 });
  await finishOrdinaryBattle(page);
  if (await page.locator('[data-state="current"]').count() !== 1) throw new Error('첫 완료 뒤 현재 노드가 정확히 1개가 아님');
  await assertMapLayout(page, '첫 완료 뒤');
  await reachBoss(page);
  await page.locator('[data-board-size="7"]').waitFor();
  if (!(await page.locator('body').innerText()).includes('보스 음악')) throw new Error('보스 음악 라우팅 실패');
  await playSinglePlacement(page, '0-0');
  await page.getByRole('button', { name: '패스' }).click();
  await page.getByText('부활 2단계', { exact: false }).waitFor();
  if (!(await page.locator('body').innerText()).includes('보스 음악')) throw new Error('1막 첫 승리 뒤 bosstheme 유지 실패');
  await playSinglePlacement(page, '6-6');
  await page.getByRole('button', { name: '패스' }).click();
  await page.getByRole('navigation', { name: '2막 지도' }).waitFor();
  if (!(await page.locator('body').innerText()).includes('제 2막 · 9×9')) throw new Error('2막 9×9 전환 실패');
  await page.locator('[data-state="open"]').first().click();
  await page.locator('[data-board-size="9"]').waitFor();
  const hitRects = await page.locator('.hit').evaluateAll((hits) => hits.map((hit) => {
    const rect = hit.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  }));
  if (hitRects.length !== 81) throw new Error('9×9 좌표 수 불일치');
  if (hitRects.some(({ width, height }) => Math.abs(width - 42) > .15 || Math.abs(height - 42) > .15)) throw new Error('9×9 터치 타깃이 42×42가 아님');
  for (let left = 0; left < hitRects.length; left += 1) {
    for (let right = left + 1; right < hitRects.length; right += 1) {
      const a = hitRects[left];
      const b = hitRects[right];
      const overlap = a.left < b.right - .1 && a.right > b.left + .1 && a.top < b.bottom - .1 && a.bottom > b.top + .1;
      if (overlap) throw new Error(`9×9 타깃 겹침: ${left}, ${right}`);
    }
  }
  const board9Widths = {};
  for (const width of [380, 430]) {
    await page.setViewportSize({ width, height: 844 });
    board9Widths[width] = await page.evaluate(() => ({
      viewport: innerWidth,
      html: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    if (board9Widths[width].html > width || board9Widths[width].body > width) {
      throw new Error(`9×9 ${width}px 화면 가로 스크롤 발생`);
    }
  }
  await page.setViewportSize({ width: 380, height: 844 });
  const battleMetrics = board9Widths[380];
  await finishOrdinaryBattle(page);
  await reachBoss(page);
  await page.locator('[data-board-size="9"]').waitFor();
  await page.screenshot({ path: path.join(outputDir, 'mobile-boss.png'), fullPage: true });

  await playSinglePlacement(page);
  await page.getByRole('button', { name: '패스' }).click();
  await page.getByRole('heading', { name: '두 막을 완주했습니다' }).waitFor();
  const candidates = await page.locator('.effect-panel li').count();
  if (candidates < 1 || candidates > 3) throw new Error(`복기 후보 수 불일치: ${candidates}`);

  const report = {
    checkedAt: new Date().toISOString(),
    baseURL,
    viewport: { width: 380, height: 844 },
    initial,
    postGestureAudio,
    battleMetrics,
    boardWidths: { board7: board7Widths, board9: board9Widths },
    mapMetrics,
    hitTargetCount: hitRects.length,
    decisiveMoveCount: candidates,
    mapEdgeCount: 18,
    rewardTapFirstExpanded: rewardInteractionChecked,
    aiEffectKinds: Object.keys(draftGameConfig.aiEffectWeights).sort(),
    consoleErrors,
    pageErrors,
    requestFailures,
    badResponses,
    screenshots: ['mobile-title.png', 'mobile-boss.png'],
    passed: consoleErrors.length === 0 && pageErrors.length === 0 && requestFailures.length === 0 && badResponses.length === 0,
  };
  await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (!report.passed) throw new Error(JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (browser !== undefined) await browser.close();
  if (previewServer !== undefined) {
    await new Promise((resolve, reject) => previewServer.httpServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  }
}
