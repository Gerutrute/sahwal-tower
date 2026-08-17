import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, dirname, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
if (dirname(dist) !== resolve(root) || basename(dist) !== 'dist') {
  throw new Error(`Refusing to clean unexpected path: ${dist}`);
}
await rm(dist, { recursive: true, force: true });
