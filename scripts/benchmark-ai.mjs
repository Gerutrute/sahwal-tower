import { chromium } from '@playwright/test';
import { createServer } from 'vite';

async function main() {
  let server;
  let browser;
  let context;
  let cdp;
  try {
    server = await createServer({
      configFile: false,
      root: process.cwd(),
      logLevel: 'error',
      server: { host: '127.0.0.1', port: 0 },
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (address === null || address === undefined || typeof address === 'string') {
      throw new Error('temporary Vite server did not expose a TCP port');
    }

    browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
    context = await browser.newContext();
    const page = await context.newPage();
    cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`http://127.0.0.1:${address.port}/scripts/ai-benchmark.html`, {
      waitUntil: 'domcontentloaded',
    });
    const result = await page.evaluate(async () => {
      const benchmark = await import('/scripts/ai-benchmark-browser.ts');
      return benchmark.runAiBenchmark();
    });

    console.log(JSON.stringify(result));
    const invalidCandidateCount = result.results.some(
      (entry) => entry.actualCandidateCount !== entry.expectedCandidateCount,
    );
    const seven = result.results.find((entry) => entry.size === 7);
    const nine = result.results.find((entry) => entry.size === 9);
    if (invalidCandidateCount || seven === undefined || nine === undefined
      || seven.p95Ms > 100 || nine.p95Ms > 200) {
      process.exitCode = 1;
    }
  } finally {
    if (cdp !== undefined) await cdp.detach().catch(() => undefined);
    if (context !== undefined) await context.close().catch(() => undefined);
    if (browser !== undefined) await browser.close().catch(() => undefined);
    if (server !== undefined) await server.close().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
