import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  injectRuntimeConfigScript,
  renderRuntimeConfigJs,
  RUNTIME_CONFIG_SCRIPT_TAG,
  validateGameConfigText,
} from './vercel-runtime-config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const indexPath = resolve(dist, 'index.html');
const runtimeConfigPath = resolve(dist, 'runtime-config.js');

function assertDistPath(filePath) {
  if (dirname(filePath) !== dist || dirname(dist) !== resolve(root) || basename(dist) !== 'dist') {
    throw new Error('RUNTIME_CONFIG_OUTPUT_PATH_INVALID');
  }
}

function reportFailure(result) {
  const suffix = result.fields?.length ? ` ${result.fields.join(',')}` : '';
  console.error(`${result.code}${suffix}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) {
    console.error('RUNTIME_CONFIG_BUILD_COMMAND_FAILED');
    return false;
  }
  return result.status === 0;
}

async function main() {
  const sourceText = process.env.ROGOLIKE_GAME_CONFIG_JSON;
  const validation = validateGameConfigText(sourceText);
  if (!validation.ok) {
    reportFailure(validation);
    return false;
  }

  console.log('[vercel-build] validate boot');
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  if (!run(npxCommand, ['vite-node', 'scripts/vercel-validate-boot.ts'], { env: process.env })) {
    return false;
  }

  console.log('[vercel-build] local build');
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if (!run(npmCommand, ['run', 'build'])) {
    return false;
  }

  try {
    assertDistPath(indexPath);
    assertDistPath(runtimeConfigPath);
    if (!existsSync(indexPath)) throw new Error('RUNTIME_CONFIG_INDEX_MISSING');

    const target = process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
    const runtimeJs = renderRuntimeConfigJs(validation.config, target);
    const html = await readFile(indexPath, 'utf8');
    const injectedHtml = injectRuntimeConfigScript(html);
    const tagCount = injectedHtml.split(RUNTIME_CONFIG_SCRIPT_TAG).length - 1;
    const tagIndex = injectedHtml.indexOf(RUNTIME_CONFIG_SCRIPT_TAG);
    const firstModuleIndex = injectedHtml.indexOf('<script type="module"');
    if (tagCount !== 1 || tagIndex === -1 || firstModuleIndex === -1 || tagIndex >= firstModuleIndex) {
      throw new Error('RUNTIME_CONFIG_INJECTION_INVALID');
    }

    await writeFile(runtimeConfigPath, runtimeJs, 'utf8');
    await writeFile(indexPath, injectedHtml, 'utf8');
    if (!existsSync(runtimeConfigPath)) throw new Error('RUNTIME_CONFIG_OUTPUT_MISSING');

    console.log(`[vercel-build] runtime config ${Buffer.byteLength(runtimeJs)} bytes`);
    console.log('RUNTIME_CONFIG_OK');
    return true;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'RUNTIME_CONFIG_BUILD_FAILED');
    return false;
  }
}

if (!await main()) process.exitCode = 1;
