/**
 * A double-buffered cell screen.
 *
 * Every frame is composed into a grid of (character, SGR style) cells and then
 * diffed against the previous frame. Only the runs that actually changed are
 * written, and the style is only re-emitted when it differs from the last cell
 * written. That is what keeps a full-screen redraw at 30fps from flickering or
 * saturating a slow SSH link.
 */

export interface Cell {
  ch: string;
  st: string;
}

const BLANK: Cell = { ch: ' ', st: '' };

const MAX_DIM = 1000;

function clampDim(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(MAX_DIM, Math.floor(value)));
}

export class Screen {
  width: number;
  height: number;
  /**
   * Optional per-character rewrite applied to everything written.
   *
   * This is how `--ascii` is guaranteed complete: rather than trusting thirty
   * call sites to remember to degrade a glyph, every character funnels through
   * one place on its way into the buffer.
   */
  private sanitize: ((ch: string) => string) | null = null;
  private front: Cell[];
  private back: Cell[];
  private dirtyAll = true;

  constructor(width: number, height: number) {
    // A terminal can report undefined or absurd dimensions (detached tty, a
    // resize race). Clamp rather than allocate a nonsense buffer.
    this.width = clampDim(width, 80);
    this.height = clampDim(height, 24);
    this.front = new Array(this.width * this.height).fill(BLANK);
    this.back = new Array(this.width * this.height).fill(BLANK);
  }

  resize(width: number, height: number): void {
    const w = clampDim(width, this.width);
    const h = clampDim(height, this.height);
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.front = new Array(this.width * this.height).fill(BLANK);
    this.back = new Array(this.width * this.height).fill(BLANK);
    this.dirtyAll = true;
  }

  /** Installs the character rewrite used by ASCII mode. */
  setSanitizer(fn: ((ch: string) => string) | null): void {
    this.sanitize = fn;
    this.dirtyAll = true;
  }

  clear(style = ''): void {
    const cell: Cell = style ? { ch: ' ', st: style } : BLANK;
    this.back.fill(cell);
  }

  /** Writes `text` at (x, y), clipped to the screen. Returns the x after it. */
  put(x: number, y: number, text: string, style = ''): number {
    if (y < 0 || y >= this.height) return x;
    const out = this.sanitize ? [...text].map(this.sanitize).join('') : text;
    let cx = x;
    for (const ch of out) {
      if (cx >= this.width) break;
      if (cx >= 0) this.back[y * this.width + cx] = { ch, st: style };
      cx++;
    }
    return cx;
  }

  /** Writes text right-aligned so it ends at `xEnd` (exclusive). */
  putRight(xEnd: number, y: number, text: string, style = ''): void {
    this.put(xEnd - this.measure(text), y, text, style);
  }

  putCenter(x: number, w: number, y: number, text: string, style = ''): void {
    const len = this.measure(text);
    this.put(x + Math.max(0, Math.floor((w - len) / 2)), y, text, style);
  }

  /** Columns `text` will occupy once sanitised. */
  measure(text: string): number {
    if (!this.sanitize) return [...text].length;
    return [...text].reduce((n, ch) => n + [...this.sanitize!(ch)].length, 0);
  }

  fill(x: number, y: number, w: number, h: number, ch: string, style = ''): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const px = x + i, py = y + j;
        if (px < 0 || px >= this.width || py < 0 || py >= this.height) continue;
        this.back[py * this.width + px] = { ch, st: style };
      }
    }
  }

  /** Overlays a style onto existing characters — used for selection highlights. */
  tint(x: number, y: number, w: number, style: string): void {
    if (y < 0 || y >= this.height) return;
    for (let i = 0; i < w; i++) {
      const px = x + i;
      if (px < 0 || px >= this.width) continue;
      const cur = this.back[y * this.width + px] ?? BLANK;
      this.back[y * this.width + px] = { ch: cur.ch, st: style };
    }
  }

  /**
   * Emits the minimal escape sequence to turn the previous frame into this one.
   * Returns '' when nothing changed, so the caller can skip the write entirely.
   */
  diff(): string {
    let out = '';
    let lastStyle: string | null = null;
    let cursorX = -1;
    let cursorY = -1;

    for (let y = 0; y < this.height; y++) {
      let x = 0;
      while (x < this.width) {
        const i = y * this.width + x;
        const b = this.back[i] ?? BLANK;
        const f = this.front[i] ?? BLANK;
        if (!this.dirtyAll && b.ch === f.ch && b.st === f.st) { x++; continue; }

        // Collect a run of changed cells; short unchanged gaps are cheaper to
        // rewrite than to jump over.
        let end = x;
        let gap = 0;
        while (end < this.width && gap <= 3) {
          const j = y * this.width + end;
          const bb = this.back[j] ?? BLANK;
          const ff = this.front[j] ?? BLANK;
          if (!this.dirtyAll && bb.ch === ff.ch && bb.st === ff.st) gap++;
          else gap = 0;
          end++;
        }
        end -= gap;

        if (cursorY !== y || cursorX !== x) {
          out += `\x1b[${y + 1};${x + 1}H`;
          cursorY = y;
          cursorX = x;
        }
        for (let k = x; k < end; k++) {
          const c = this.back[y * this.width + k] ?? BLANK;
          if (c.st !== lastStyle) {
            out += c.st ? `\x1b[0;${c.st}m` : '\x1b[0m';
            lastStyle = c.st;
          }
          out += c.ch;
          cursorX++;
        }
        x = end;
      }
    }

    if (out.length > 0) out += '\x1b[0m';
    this.front = this.back.slice();
    this.dirtyAll = false;
    return out;
  }

  /** Forces the next diff to repaint everything (after a resize or a suspend). */
  invalidate(): void {
    this.dirtyAll = true;
  }

  /** Plain-text snapshot — used by the golden-frame tests. */
  toText(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.height; y++) {
      let line = '';
      for (let x = 0; x < this.width; x++) line += (this.back[y * this.width + x] ?? BLANK).ch;
      lines.push(line.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }
}
