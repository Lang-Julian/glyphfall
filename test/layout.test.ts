import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PREVIEW_SCREENS, renderPreview } from '../src/ui/preview.js';

/**
 * Layout tests.
 *
 * Every screen is rendered headlessly at every size worth caring about and
 * checked for the three things that actually break a terminal UI: a line that
 * is too long, a character that is double-width, and text that survived into
 * ASCII mode when it should not have.
 */

const SIZES: readonly [number, number][] = [
  [78, 22],   // the documented minimum
  [80, 24],   // the classic
  [80, 30],
  [96, 28],
  [100, 30],
  [120, 40],
  [200, 50],  // absurdly wide
];

/**
 * Ranges that every terminal renders single-width: ASCII, Latin-1, General
 * Punctuation, Arrows, Mathematical Operators, Box Drawing, Block Elements and
 * Geometric Shapes. Anything outside them risks shearing the grid.
 */
function isSafeWidth(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return (
    (c >= 0x20 && c <= 0x7e) ||
    (c >= 0xa0 && c <= 0xff) ||
    (c >= 0x2010 && c <= 0x205e) ||
    (c >= 0x2190 && c <= 0x21ff) ||
    (c >= 0x2200 && c <= 0x22ff) ||
    (c >= 0x2500 && c <= 0x257f) ||
    (c >= 0x2580 && c <= 0x259f) ||
    (c >= 0x25a0 && c <= 0x25ff)
  );
}

test('no screen ever draws a line longer than the terminal', () => {
  for (const [width, height] of SIZES) {
    for (const screen of PREVIEW_SCREENS) {
      for (const line of renderPreview(screen, { width, height }).split('\n')) {
        assert.ok([...line].length <= width,
          `${screen} at ${width}x${height}: line of ${[...line].length} columns`);
      }
    }
  }
});

test('no screen ever draws more lines than the terminal has rows', () => {
  for (const [width, height] of SIZES) {
    for (const screen of PREVIEW_SCREENS) {
      const lines = renderPreview(screen, { width, height }).split('\n');
      assert.equal(lines.length, height, `${screen} at ${width}x${height}`);
    }
  }
});

test('every drawn character is single-width in every terminal', () => {
  const offenders = new Set<string>();
  for (const [width, height] of SIZES) {
    for (const screen of PREVIEW_SCREENS) {
      for (const ch of renderPreview(screen, { width, height })) {
        if (ch !== '\n' && !isSafeWidth(ch)) offenders.add(ch);
      }
    }
  }
  assert.deepEqual([...offenders], [],
    `these characters may render double-width: ${[...offenders].join(' ')}`);
});

test('ascii mode is genuinely ascii', () => {
  const offenders = new Set<string>();
  for (const [width, height] of SIZES) {
    for (const screen of PREVIEW_SCREENS) {
      for (const ch of renderPreview(screen, { width, height, ascii: true })) {
        if (ch !== '\n' && ch.charCodeAt(0) > 126) offenders.add(ch);
      }
    }
  }
  assert.deepEqual([...offenders], [], `not ascii: ${[...offenders].join(' ')}`);
});

test('every screen actually draws something at the minimum size', () => {
  for (const screen of PREVIEW_SCREENS) {
    const text = renderPreview(screen, { width: 78, height: 22 });
    const ink = text.replace(/\s/g, '').length;
    assert.ok(ink > 120, `${screen} rendered only ${ink} characters at 78x22`);
  }
});

test('the combat screen shows its load-bearing elements at every size', () => {
  for (const [width, height] of SIZES) {
    const text = renderPreview('combat', { width, height });
    assert.match(text, /CHAIN/, `chain meter missing at ${width}x${height}`);
    assert.match(text, /hp \d+\/\d+/, `player hp missing at ${width}x${height}`);
    assert.match(text, /incoming|nothing incoming/, `incoming damage missing at ${width}x${height}`);
    assert.match(text, /attacks \d+/, `enemy intent missing at ${width}x${height}`);
    assert.match(text, /Ward/, `hand missing at ${width}x${height}`);
  }
});

test('the map draws its legend and a reachable route at every size', () => {
  for (const [width, height] of SIZES) {
    const text = renderPreview('map', { width, height });
    assert.match(text, />.</, `no highlighted route at ${width}x${height}`);
    assert.match(text, /\(.\)/, `current position missing at ${width}x${height}`);
    assert.ok(/combat|rest site|treasure/.test(text), `no legend at ${width}x${height}`);
  }
});

test('colour output changes nothing about the layout', () => {
  for (const screen of PREVIEW_SCREENS) {
    const plain = renderPreview(screen, { width: 100, height: 30, colorLevel: 'none' });
    const colour = renderPreview(screen, { width: 100, height: 30, colorLevel: 'truecolor' });
    assert.equal(plain, colour, `${screen} layout shifted with colour on`);
  }
});
