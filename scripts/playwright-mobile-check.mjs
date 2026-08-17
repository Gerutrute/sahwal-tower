import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const outputDir = path.resolve('playwright-results');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const context = await browser.newContext({
  viewport: { width: 380, height: 800 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/127 Mobile Safari/537.36',
});
const page = await context.newPage();
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const badResponses = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(`${message.text()} — ${message.location().url || 'URL 없음'}`);
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('requestfailed', (request) => requestFailures.push(`${request.method()} ${request.url()} — ${request.failure()?.errorText}`));
page.on('response', (response) => {
  if (response.status() >= 400) badResponses.push(`${response.status()} ${response.url()}`);
});

const response = await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 30_000 });
if (!response || !response.ok()) throw new Error(`문서 응답 실패: ${response?.status() ?? '없음'}`);
await page.locator('#root').waitFor({ state: 'visible' });
await page.getByRole('heading', { name: '死活之塔' }).waitFor();
await page.getByRole('button', { name: '등반 시작' }).waitFor();

const initial = await page.evaluate(() => {
  const root = document.querySelector('#root');
  const bodyStyle = getComputedStyle(document.body);
  const rootStyle = root ? getComputedStyle(root) : null;
  const fullViewportElements = [...document.querySelectorAll('body *')].filter((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width >= innerWidth * 0.95 && rect.height >= innerHeight * 0.95 && style.position === 'fixed';
  }).map((element) => ({ tag: element.tagName, className: element.className, background: getComputedStyle(element).backgroundColor }));
  return {
    title: document.title,
    rootText: root?.textContent?.trim() ?? '',
    rootChildren: root?.children.length ?? 0,
    bodyBackground: bodyStyle.backgroundColor,
    rootBackground: rootStyle?.backgroundColor ?? null,
    innerWidth,
    innerHeight,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    fullViewportElements,
  };
});
if (!initial.rootText.includes('死活之塔') || initial.rootChildren === 0) throw new Error('초기 React 화면이 비어 있음');
if (initial.htmlScrollWidth > initial.innerWidth || initial.bodyScrollWidth > initial.innerWidth) throw new Error('초기 화면 가로 overflow');
await page.screenshot({ path: path.join(outputDir, 'mobile-title.png'), fullPage: true });

await page.getByRole('button', { name: '등반 시작' }).click();
await page.getByText(/1층 · 침입귀/).waitFor();
const board = page.locator('svg[viewBox="0 0 340 340"]');
await board.waitFor({ state: 'visible' });
await page.getByRole('button', { name: '한 수 쉼' }).waitFor();

const intersection = page.locator('svg [role="button"]:not([tabindex="-1"])').first();
await intersection.click();
await page.waitForTimeout(800);

const battle = await page.evaluate(() => ({
  text: document.querySelector('#root')?.textContent?.trim() ?? '',
  svgCount: document.querySelectorAll('svg[viewBox="0 0 340 340"]').length,
  intersections: document.querySelectorAll('svg [role="button"]').length,
  renderedCells: document.querySelectorAll('svg circle.hit, svg circle.rock, svg g.stone-pop').length,
  stones: document.querySelectorAll('svg circle.stone').length,
  status: document.querySelector('.status-line')?.textContent?.trim() ?? '',
  innerWidth,
  htmlScrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
}));
if (battle.svgCount !== 1 || battle.renderedCells !== 49) throw new Error('7×7 SVG 바둑판 렌더 실패');
if (battle.htmlScrollWidth > battle.innerWidth || battle.bodyScrollWidth > battle.innerWidth) throw new Error('전투 화면 가로 overflow');
await page.screenshot({ path: path.join(outputDir, 'mobile-battle.png'), fullPage: true });

const report = {
  checkedAt: new Date().toISOString(),
  baseURL,
  documentStatus: response.status(),
  initial,
  battle,
  consoleErrors,
  pageErrors,
  requestFailures,
  badResponses,
  screenshots: ['mobile-title.png', 'mobile-battle.png'],
  passed: consoleErrors.length === 0 && pageErrors.length === 0 && requestFailures.length === 0 && badResponses.length === 0,
};
await writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await browser.close();

if (!report.passed) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
