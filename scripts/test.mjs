/**
 * Test runner.
 *
 * `node --test <dir>` is not portable across the versions this project
 * supports: Node 20 walks the directory, Node 22 treats the argument as a glob
 * pattern and fails to resolve a bare path. Collecting the files here and
 * passing them explicitly works identically on both, and on Windows, where the
 * shell does no globbing at all.
 */
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const testDir = join(root, 'dist-test', 'test');

async function collect(dir) {
  const found = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await collect(path)));
    else if (entry.name.endsWith('.test.js')) found.push(path);
  }
  return found.sort();
}

const files = await collect(testDir);
if (files.length === 0) {
  console.error(`no compiled tests found in ${relative(root, testDir)} — run the build first`);
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit', cwd: root });
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 1));
});
