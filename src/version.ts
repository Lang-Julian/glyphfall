import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Reads the version from package.json so it can never drift from the release. */
export function version(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of ['../package.json', '../../package.json', '../../../package.json']) {
    try {
      const raw = readFileSync(join(here, candidate), 'utf8');
      const pkg = JSON.parse(raw) as { name?: string; version?: string };
      if (pkg.name === 'glyphfall' && pkg.version) return pkg.version;
    } catch {
      // try the next candidate
    }
  }
  return '0.0.0';
}
