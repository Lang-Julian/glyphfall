import { EventEmitter } from 'node:events';
import type { ReadStream, WriteStream } from 'node:tty';

/**
 * Terminal plumbing: raw mode, the alternate screen, and key decoding.
 *
 * The contract this module keeps is simple and non-negotiable: whatever
 * happens — clean exit, Ctrl-C, an uncaught throw, SIGTERM — the terminal is
 * handed back exactly as it was found. A game that leaves your shell without a
 * cursor is a broken game.
 */

export interface Key {
  /** Normalised name: 'up', 'enter', 'escape', 'a', '1', 'ctrl-c', … */
  name: string;
  /** The literal character, when the key produced one. */
  ch: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface TerminalOptions {
  input?: ReadStream;
  output?: WriteStream;
}

const ENTER_ALT = '\x1b[?1049h';
const EXIT_ALT = '\x1b[?1049l';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR = '\x1b[2J\x1b[H';

export class Terminal extends EventEmitter {
  readonly input: ReadStream;
  readonly output: WriteStream;
  private active = false;
  private cleanupBound = false;
  private onDataBound = (buf: Buffer) => this.handleData(buf);
  private onResizeBound = () => this.emit('resize', this.size());
  private onEndBound = () => this.emit('end');

  constructor(o: TerminalOptions = {}) {
    super();
    this.input = o.input ?? (process.stdin as ReadStream);
    this.output = o.output ?? (process.stdout as WriteStream);
  }

  get isTTY(): boolean {
    return Boolean(this.input.isTTY && this.output.isTTY);
  }

  /**
   * The terminal's size, with sane fallbacks.
   *
   * A pty can report 0 columns (`script`, some CI runners, a detached
   * session). Taking that literally renders a one-cell screen, so anything
   * non-positive falls back to the classic 80x24.
   */
  size(): { width: number; height: number } {
    const columns = this.output.columns;
    const rows = this.output.rows;
    return {
      width: Number.isFinite(columns) && (columns ?? 0) > 0 ? (columns as number) : 80,
      height: Number.isFinite(rows) && (rows ?? 0) > 0 ? (rows as number) : 24,
    };
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    if (this.input.isTTY) this.input.setRawMode(true);
    this.input.resume();
    this.input.on('data', this.onDataBound);
    // Without this the process hangs forever when stdin closes — piped input,
    // a detached session, a terminal that went away.
    this.input.once('end', this.onEndBound);
    this.input.once('close', this.onEndBound);
    this.output.on('resize', this.onResizeBound);
    this.write(ENTER_ALT + HIDE_CURSOR + CLEAR);
    this.installCleanup();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.input.off('data', this.onDataBound);
    this.input.off('end', this.onEndBound);
    this.input.off('close', this.onEndBound);
    this.output.off('resize', this.onResizeBound);
    if (this.input.isTTY) this.input.setRawMode(false);
    this.input.pause();
    this.write('\x1b[0m' + SHOW_CURSOR + EXIT_ALT);
  }

  write(s: string): void {
    if (s.length > 0) this.output.write(s);
  }

  /** Sets the window/tab title where the terminal supports it. */
  setTitle(title: string): void {
    this.write(`\x1b]0;${title}\x07`);
  }

  private installCleanup(): void {
    if (this.cleanupBound) return;
    this.cleanupBound = true;
    const restore = () => this.stop();
    process.once('exit', restore);
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
      process.once(sig, () => { restore(); process.exit(sig === 'SIGINT' ? 130 : 143); });
    }
    process.once('uncaughtException', (err) => {
      restore();
      console.error(err);
      process.exit(1);
    });
  }

  private handleData(buf: Buffer): void {
    for (const key of decode(buf.toString('utf8'))) this.emit('key', key);
  }
}

/* ----------------------------------------------------------------- decoding -- */

const CSI_NAMES: Record<string, string> = {
  A: 'up', B: 'down', C: 'right', D: 'left',
  H: 'home', F: 'end', Z: 'shift-tab',
  '5~': 'pageup', '6~': 'pagedown', '3~': 'delete',
  '1~': 'home', '4~': 'end', '2~': 'insert',
};

const CTRL_NAMES: Record<number, string> = {
  3: 'ctrl-c', 4: 'ctrl-d', 8: 'backspace', 9: 'tab', 10: 'enter', 12: 'ctrl-l',
  13: 'enter', 18: 'ctrl-r', 21: 'ctrl-u', 26: 'ctrl-z', 27: 'escape', 127: 'backspace',
};

/** Splits a raw chunk into individual keys. Handles pasted / repeated input. */
export function decode(chunk: string): Key[] {
  const keys: Key[] = [];
  let i = 0;
  while (i < chunk.length) {
    const c = chunk[i]!;

    if (c === '\x1b') {
      const rest = chunk.slice(i);
      const csi = /^\x1b\[([0-9;]*)([A-Za-z~])/.exec(rest);
      if (csi) {
        const params = csi[1] ?? '';
        const final = csi[2]!;
        const name = CSI_NAMES[final] ?? CSI_NAMES[`${params}${final}`] ?? `csi-${params}${final}`;
        const mod = Number(params.split(';')[1] ?? '1') - 1;
        keys.push({ name, ch: '', ctrl: (mod & 4) !== 0, shift: (mod & 1) !== 0, alt: (mod & 2) !== 0 });
        i += csi[0].length;
        continue;
      }
      const ss3 = /^\x1bO([A-Za-z])/.exec(rest);
      if (ss3) {
        const name = CSI_NAMES[ss3[1]!] ?? `f-${ss3[1]}`;
        keys.push({ name, ch: '', ctrl: false, shift: false, alt: false });
        i += ss3[0].length;
        continue;
      }
      // Alt-<char>
      if (i + 1 < chunk.length && chunk[i + 1] !== '\x1b') {
        const ch = chunk[i + 1]!;
        keys.push({ name: `alt-${ch.toLowerCase()}`, ch, ctrl: false, shift: false, alt: true });
        i += 2;
        continue;
      }
      keys.push({ name: 'escape', ch: '', ctrl: false, shift: false, alt: false });
      i += 1;
      continue;
    }

    const code = c.charCodeAt(0);
    if (code < 32 || code === 127) {
      const name = CTRL_NAMES[code] ?? `ctrl-${String.fromCharCode(code + 96)}`;
      keys.push({ name, ch: '', ctrl: name.startsWith('ctrl-'), shift: false, alt: false });
      i += 1;
      continue;
    }
    if (c === ' ') {
      keys.push({ name: 'space', ch: ' ', ctrl: false, shift: false, alt: false });
      i += 1;
      continue;
    }

    keys.push({
      name: c.toLowerCase(), ch: c, ctrl: false,
      shift: c !== c.toLowerCase(), alt: false,
    });
    i += 1;
  }
  return keys;
}
