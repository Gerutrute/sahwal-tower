import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const outputDir = path.resolve(root, 'playwright-results');
const baseURL = 'http://127.0.0.1:4174/';
const sentinel = process.env.VERCEL_CHECK_SENTINEL ?? randomUUID().replaceAll('-', '');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runCaptured(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

function browserOptions() {
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (explicit) {
    if (!existsSync(explicit)) throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE_NOT_FOUND');
    return { executablePath: explicit };
  }
  const managed = chromium.executablePath();
  if (existsSync(managed)) return { executablePath: managed };
  const installed = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ].find(existsSync);
  return installed ? { executablePath: installed } : {};
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {
      // The preview process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('VERCEL_PREVIEW_NOT_READY');
}

async function stopPreview(child) {
  if (child === undefined || child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

let previewProcess;
let browser;

try {
  await mkdir(outputDir, { recursive: true });

  const exported = runCaptured(npxCommand, ['vite-node', 'scripts/vercel-export-draft-config.ts']);
  if (exported.status !== 0) throw new Error('VERCEL_DRAFT_EXPORT_FAILED');
  const config = JSON.parse(exported.stdout);
  config.seed = `vercel-check-${sentinel}`;
  const configText = JSON.stringify(config);

  const build = runCaptured(npmCommand, ['run', 'build:vercel'], {
    env: {
      ...process.env,
      ROGOLIKE_GAME_CONFIG_JSON: configText,
      VERCEL_ENV: 'preview',
    },
  });
  const buildLog = `${build.stdout ?? ''}${build.stderr ?? ''}`;
  await writeFile(path.join(outputDir, 'vercel-build.log'), buildLog, 'utf8');
  if (buildLog.includes(sentinel)) throw new Error('VERCEL_BUILD_LOG_SECRET_LEAK');
  if (build.status !== 0) throw new Error('VERCEL_BUILD_FAILED');

  const runtimePath = path.resolve(root, 'dist', 'runtime-config.js');
  const indexPath = path.resolve(root, 'dist', 'index.html');
  if (!existsSync(runtimePath) || !existsSync(indexPath)) throw new Error('VERCEL_RUNTIME_ASSET_MISSING');
  const runtimeJs = await readFile(runtimePath, 'utf8');
  const indexHtml = await readFile(indexPath, 'utf8');
  if (!runtimeJs.includes(sentinel)) throw new Error('VERCEL_RUNTIME_SENTINEL_MISSING');
  const loaderTag = '<script src="./runtime-config.js"></script>';
  const loaderIndex = indexHtml.indexOf(loaderTag);
  const firstModuleIndex = indexHtml.indexOf('<script type="module"');
  if (indexHtml.split(loaderTag).length - 1 !== 1
    || !indexHtml.includes(`${loaderTag}</head>`)
    || loaderIndex === -1
    || firstModuleIndex === -1
    || loaderIndex >= firstModuleIndex) {
    throw new Error('VERCEL_RUNTIME_LOADER_COUNT_INVALID');
  }

  previewProcess = spawn(npxCommand, ['vite', 'preview', '--host', '127.0.0.1', '--port', '4174', '--strictPort'], {
    cwd: root,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  await waitForPreview();

  browser = await chromium.launch({ headless: true, ...browserOptions() });
  const context = await browser.newContext({ viewport: { width: 380, height: 844 } });
  const page = await context.newPage();
  const errors = { console: 0, page: 0, request: 0, response: 0 };
  let runtimeConfigStatus = 0;
  page.on('console', (message) => { if (message.type() === 'error') errors.console += 1; });
  page.on('pageerror', () => { errors.page += 1; });
  page.on('requestfailed', () => { errors.request += 1; });
  page.on('response', (response) => {
    if (response.url().endsWith('/runtime-config.js')) runtimeConfigStatus = response.status();
    if (response.status() >= 400) errors.response += 1;
  });

  const documentResponse = await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30_000 });
  const documentStatus = documentResponse?.status() ?? 0;
  const heading = page.getByRole('heading', { name: 'RoGolike', exact: true });
  const start = page.getByRole('button', { name: '등반 시작' });
  const badge = page.locator('[data-deploy-note="playtest"]');
  await heading.waitFor();
  await start.waitFor();
  await badge.waitFor();

  const badgeText = (await badge.textContent())?.trim() ?? '';
  const headingVisible = await heading.isVisible();
  const startVisible = await start.isVisible();
  const badgeVisible = await badge.isVisible();
  const scrollWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  await start.click();
  await page.locator('[data-screen="map"]').waitFor();
  const mapVisible = await page.locator('[data-screen="map"]').isVisible();
  await page.screenshot({ path: path.join(outputDir, 'vercel-preview-380.png'), fullPage: true });

  const report = {
    checkedAt: new Date().toISOString(),
    viewport: { width: 380, height: 844 },
    documentStatus,
    headingVisible,
    startVisible,
    badgeVisible,
    badgeTextMatched: badgeText === '개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다',
    scrollWidth,
    runtimeConfigStatus,
    mapVisible,
    errors,
    screenshot: 'vercel-preview-380.png',
  };
  const passed = documentStatus === 200
    && report.headingVisible
    && report.startVisible
    && report.badgeVisible
    && report.badgeTextMatched
    && scrollWidth <= 380
    && runtimeConfigStatus === 200
    && mapVisible
    && Object.values(errors).every((count) => count === 0);
  const reportText = `${JSON.stringify({ ...report, passed }, null, 2)}\n`;
  if (reportText.includes(sentinel) || reportText.includes(configText)) throw new Error('VERCEL_REPORT_SECRET_LEAK');
  await writeFile(path.join(outputDir, 'vercel-report.json'), reportText, 'utf8');
  if (!passed) throw new Error('VERCEL_PREVIEW_ASSERTION_FAILED');

  console.log('VERCEL_PREVIEW_CHECK_OK');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'VERCEL_PREVIEW_CHECK_FAILED');
  process.exitCode = 1;
} finally {
  if (browser !== undefined) await browser.close().catch(() => undefined);
  await stopPreview(previewProcess);
  const cleanup = runCaptured(process.execPath, ['scripts/clean-dist.mjs'], { shell: false });
  if (cleanup.status !== 0) {
    console.error('VERCEL_PREVIEW_CLEANUP_FAILED');
    process.exitCode = 1;
  }
}
