import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const criteriaPath = process.argv[2] ?? process.env.AC_PATH;
if (!criteriaPath) {
  throw new Error('usage: node scripts/check-ac-mapping.mjs <acceptance-criteria.md>');
}
const criteria = readFileSync(criteriaPath, 'utf8');
const commands = [...new Set([...criteria.matchAll(/`(npx vitest run tests\/[^`]+)`/g)].map((match) => match[1]))];
const failures = [];
for (const command of commands) {
  const result = spawnSync(command, { shell: true, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '');
  const passed = output.match(/Tests\s+(\d+) passed/);
  if (result.status !== 0 || !passed || Number(passed[1]) < 1) failures.push({ command, status: result.status, output: output.slice(-1200) });
}
console.log(`AC vitest mappings: ${commands.length - failures.length}/${commands.length} executed with at least one passing test`);
if (failures.length) {
  for (const failure of failures) console.error(`\nFAIL ${failure.command}\n${failure.output}`);
  process.exitCode = 1;
}
