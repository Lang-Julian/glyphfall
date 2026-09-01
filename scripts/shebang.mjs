// Prepends the node shebang to the built CLI and makes it executable.
// Kept out of the source so `tsc` never has to see a non-TS first line.
import { chmod, readFile, writeFile } from 'node:fs/promises';

const entry = new URL('../dist/cli.js', import.meta.url);
const src = await readFile(entry, 'utf8');
if (!src.startsWith('#!')) await writeFile(entry, `#!/usr/bin/env node\n${src}`);
await chmod(entry, 0o755);
