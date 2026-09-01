import { spawnSync } from 'node:child_process';

/**
 * Best-effort clipboard write.
 *
 * A run summary you cannot paste anywhere is a run summary nobody shares, and
 * asking a player to select text out of an alternate-screen buffer with a mouse
 * is not a plan. Every failure mode here is silent and harmless: the summary is
 * on screen regardless.
 */
const CANDIDATES: readonly (readonly [string, readonly string[]])[] =
  process.platform === 'darwin'
    ? [['pbcopy', []]]
    : process.platform === 'win32'
      ? [['clip', []]]
      : [
          ['wl-copy', []],
          ['xclip', ['-selection', 'clipboard']],
          ['xsel', ['--clipboard', '--input']],
        ];

export function copyToClipboard(text: string): boolean {
  for (const [command, args] of CANDIDATES) {
    try {
      const result = spawnSync(command, args, { input: text, timeout: 2000 });
      if (result.status === 0) return true;
    } catch {
      // Try the next one.
    }
  }
  return false;
}
