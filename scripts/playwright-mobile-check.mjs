import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('playwright-results');
await mkdir(outputDir, { recursive: true });

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

const browser = await chromium.launch({ headless: true, ...browserOptions() });
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const badResponses = [];

try {
  const context = await browser.newContext({
    viewport: { width: 380, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36',
  });
  await context.addInitScript(() => {
    window.__audioAudit = { contexts: 0, plays: 0 };
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
    if (NativeAudioContext) {
      class AuditedAudioContext extends NativeAudioContext {
        constructor(...args) { super(...args); window.__audioAudit.contexts += 1; }
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
  if (!(await page.locator('body').innerText()).includes('여정 음악')) throw new Error('지도 음악 라우팅 실패');

  await page.getByRole('button', { name: /일반전/ }).click();
  await page.locator('[data-board-size="7"]').waitFor();
  if (await page.locator('.hit').count() !== 49) throw new Error('7×7 좌표 수 불일치');
  for (const coordinate of ['0-0', '0-6', '6-0', '6-6']) {
    await page.getByRole('button', { name: /일반석/ }).click();
    const hit = page.locator(`[data-hit="${coordinate}"]`);
    await hit.click();
    await hit.click();
    await page.waitForTimeout(470);
  }
  if (await page.locator('.stone-b').count() !== 4) throw new Error('7×7 네 귀 실제 탭 실패');
  await page.getByRole('button', { name: '지도로 물러나기' }).click();

  await page.getByRole('button', { name: /상점/ }).click();
  if (!(await page.locator('body').innerText()).includes('상점 음악')) throw new Error('상점 음악 라우팅 실패');
  if ((await page.locator('body').innerText()).includes('새로고침')) throw new Error('금지된 상점 새로고침이 있음');
  await page.getByRole('button', { name: '지도로 돌아가기' }).click();
  await page.getByRole('button', { name: /보스전/ }).click();
  await page.locator('[data-board-size="9"]').waitFor();
  if (!(await page.locator('body').innerText()).includes('보스 음악')) throw new Error('보스 음악 라우팅 실패');
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
  for (const coordinate of ['0-0', '0-8', '8-0', '8-8']) {
    await page.getByRole('button', { name: /일반석/ }).click();
    const hit = page.locator(`[data-hit="${coordinate}"]`);
    await hit.click();
    await hit.click();
    await page.waitForTimeout(470);
  }
  if (await page.locator('.stone-b').count() !== 4) throw new Error('9×9 네 귀 실제 탭 실패');
  const battleMetrics = await page.evaluate(() => ({ width: innerWidth, html: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  if (battleMetrics.html > battleMetrics.width || battleMetrics.body > battleMetrics.width) throw new Error('전투 화면 가로 스크롤 발생');
  await page.screenshot({ path: path.join(outputDir, 'mobile-boss.png'), fullPage: true });

  await page.getByRole('button', { name: '패스' }).click();
  if (!(await page.locator('body').innerText()).includes('부활 2단계')) throw new Error('부활 단계 표시 실패');
  await page.getByRole('button', { name: '패스' }).click();
  await page.getByRole('heading', { name: '두 막을 완주했습니다' }).waitFor();
  const candidates = await page.locator('.effect-panel li').count();
  if (candidates < 1 || candidates > 3) throw new Error(`복기 후보 수 불일치: ${candidates}`);

  const report = {
    checkedAt: new Date().toISOString(),
    baseURL,
    viewport: { width: 380, height: 844 },
    initial,
    battleMetrics,
    hitTargetCount: hitRects.length,
    decisiveMoveCount: candidates,
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
  await browser.close();
}
