import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PREVIEW_SCREENS, renderPreviewScreen } from '../src/ui/preview.js';
import type { Appearance } from '../src/ui/theme.js';

/**
 * Contrast tests.
 *
 * The first version of this game was unreadable on a light terminal: the
 * palette assumed a dark background and inherited whatever the terminal was
 * set to, so near-white text landed on white. The fix was structural — every
 * foreground carries the game's own background with it — and these tests keep
 * it that way.
 */

type Rgb = [number, number, number];

function parse(style: string): { fg: Rgb | null; bg: Rgb | null } {
  const parts = style.split(';');
  let fg: Rgb | null = null;
  let bg: Rgb | null = null;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '38' && parts[i + 1] === '2') {
      fg = [Number(parts[i + 2]), Number(parts[i + 3]), Number(parts[i + 4])];
      i += 4;
    } else if (parts[i] === '48' && parts[i + 1] === '2') {
      bg = [Number(parts[i + 2]), Number(parts[i + 3]), Number(parts[i + 4])];
      i += 4;
    }
  }
  return { fg, bg };
}

function luminance([r, g, b]: Rgb): number {
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const APPEARANCES: Appearance[] = ['dark', 'light'];
/** Letters and digits must be comfortably readable. */
const TEXT_MIN = 4.5;
/** Rules, gauge troughs and other furniture may recede, but not vanish. */
const DECORATION_MIN = 2.0;

test('every painted cell carries the game\'s own background', () => {
  for (const appearance of APPEARANCES) {
    for (const name of PREVIEW_SCREENS) {
      const screen = renderPreviewScreen(name, {
        width: 100, height: 30, colorLevel: 'truecolor', appearance,
      });
      const lines = screen.toText().split('\n');
      for (let y = 0; y < screen.height; y++) {
        for (let x = 0; x < screen.width; x++) {
          const ch = lines[y]?.[x];
          if (!ch || ch === ' ') continue;
          const { bg } = parse(screen.styleAt(x, y));
          assert.ok(bg, `${appearance}/${name} at ${x},${y}: "${ch}" has no background`);
        }
      }
    }
  }
});

test('text is readable in both appearances', () => {
  for (const appearance of APPEARANCES) {
    for (const name of PREVIEW_SCREENS) {
      const screen = renderPreviewScreen(name, {
        width: 100, height: 30, colorLevel: 'truecolor', appearance,
      });
      const lines = screen.toText().split('\n');
      for (let y = 0; y < screen.height; y++) {
        for (let x = 0; x < screen.width; x++) {
          const ch = lines[y]?.[x];
          if (!ch || ch === ' ') continue;
          const { fg, bg } = parse(screen.styleAt(x, y));
          if (!fg || !bg) continue;
          const ratio = contrast(fg, bg);
          const min = /[A-Za-z0-9]/.test(ch) ? TEXT_MIN : DECORATION_MIN;
          assert.ok(ratio >= min,
            `${appearance}/${name} at ${x},${y}: "${ch}" contrast ${ratio.toFixed(2)} < ${min}`);
        }
      }
    }
  }
});

test('the two appearances really are light and dark', () => {
  const dark = renderPreviewScreen('combat', { colorLevel: 'truecolor', appearance: 'dark' });
  const light = renderPreviewScreen('combat', { colorLevel: 'truecolor', appearance: 'light' });
  const bgOf = (s: typeof dark): number => luminance(parse(s.styleAt(40, 10)).bg ?? [0, 0, 0]);
  assert.ok(bgOf(dark) < 0.1, 'the dark background should be dark');
  assert.ok(bgOf(light) > 0.6, 'the light background should be light');
});

test('monochrome mode emits no colour at all', () => {
  // Bold and reverse still carry meaning without colour; only colour is gone.
  const screen = renderPreviewScreen('combat', { colorLevel: 'none' });
  for (let y = 0; y < screen.height; y++) {
    for (let x = 0; x < screen.width; x++) {
      const style = screen.styleAt(x, y);
      assert.ok(!style.includes('38;'), `stray foreground at ${x},${y}: ${style}`);
      assert.ok(!style.includes('48;'), `stray background at ${x},${y}: ${style}`);
    }
  }
});
