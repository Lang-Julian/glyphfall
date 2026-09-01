import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Screen } from '../src/ui/screen.js';
import { decode } from '../src/ui/term.js';
import { detectColorLevel, detectUnicode, makeTheme } from '../src/ui/theme.js';
import { truncate, wrap } from '../src/ui/draw.js';
import { banner } from '../src/views/banner.js';

/* ------------------------------------------------------------------ screen -- */

test('the first diff paints everything, the second paints nothing', () => {
  const s = new Screen(20, 4);
  s.clear();
  s.put(2, 1, 'hello');
  const first = s.diff();
  assert.ok(first.includes('hello'));

  s.clear();
  s.put(2, 1, 'hello');
  assert.equal(s.diff(), '', 'an identical frame writes nothing');
});

test('only the changed run is rewritten', () => {
  const s = new Screen(40, 3);
  s.clear();
  s.put(0, 0, 'the quick brown fox');
  s.diff();

  s.clear();
  s.put(0, 0, 'the quick BROWN fox');
  const out = s.diff();
  assert.ok(out.includes('BROWN'));
  assert.ok(!out.includes('the quick'), 'unchanged text is not resent');
});

test('writes are clipped to the screen, never wrapped', () => {
  const s = new Screen(10, 2);
  s.clear();
  s.put(6, 0, 'abcdefgh');
  const text = s.toText().split('\n');
  assert.equal(text[0], '      abcd');
  assert.equal(text[1], '', 'nothing bled onto the next line');
});

test('negative and off-screen coordinates are safe', () => {
  const s = new Screen(8, 2);
  s.clear();
  assert.doesNotThrow(() => {
    s.put(-5, 0, 'left');
    s.put(0, -1, 'above');
    s.put(0, 99, 'below');
    s.fill(-3, -3, 20, 20, '#');
    s.tint(-2, 0, 30, '1');
  });
});

test('nonsense dimensions are clamped rather than allocated', () => {
  const bad = new Screen(Number.NaN, Number.NaN);
  assert.equal(bad.width, 80);
  assert.equal(bad.height, 24);
  const huge = new Screen(1e9, 1e9);
  assert.ok(huge.width <= 1000 && huge.height <= 1000);
  assert.doesNotThrow(() => new Screen(0, -4));
});

test('resizing clears and forces a full repaint', () => {
  const s = new Screen(10, 2);
  s.put(0, 0, 'hi');
  s.diff();
  s.resize(20, 4);
  s.clear();
  s.put(0, 0, 'hi');
  assert.ok(s.diff().includes('hi'), 'the resized screen repaints');
});

test('style changes are emitted only when they change', () => {
  const s = new Screen(20, 1);
  s.clear();
  s.put(0, 0, 'aaa', '31');
  s.put(3, 0, 'bbb', '31');
  const out = s.diff();
  const styleCount = (out.match(/\x1b\[0;31m/g) ?? []).length;
  assert.equal(styleCount, 1, 'the run shares one escape');
});

/* ------------------------------------------------------------------- input -- */

test('arrow keys decode', () => {
  assert.deepEqual(decode('\x1b[A').map((k) => k.name), ['up']);
  assert.deepEqual(decode('\x1b[B').map((k) => k.name), ['down']);
  assert.deepEqual(decode('\x1b[C').map((k) => k.name), ['right']);
  assert.deepEqual(decode('\x1b[D').map((k) => k.name), ['left']);
  assert.deepEqual(decode('\x1bOA').map((k) => k.name), ['up'], 'application cursor mode');
});

test('control keys decode', () => {
  assert.equal(decode('\x03')[0]?.name, 'ctrl-c');
  assert.equal(decode('\r')[0]?.name, 'enter');
  assert.equal(decode('\n')[0]?.name, 'enter');
  assert.equal(decode('\t')[0]?.name, 'tab');
  assert.equal(decode('\x7f')[0]?.name, 'backspace');
  assert.equal(decode('\x1b')[0]?.name, 'escape');
  assert.equal(decode(' ')[0]?.name, 'space');
});

test('printable keys keep their character and report shift', () => {
  const [lower] = decode('a');
  assert.equal(lower?.name, 'a');
  assert.equal(lower?.ch, 'a');
  assert.equal(lower?.shift, false);
  const [upper] = decode('A');
  assert.equal(upper?.name, 'a');
  assert.equal(upper?.ch, 'A');
  assert.equal(upper?.shift, true);
});

test('a chunk containing several keys splits correctly', () => {
  assert.deepEqual(decode('12\x1b[Ae').map((k) => k.name), ['1', '2', 'up', 'e']);
});

test('page and home keys decode', () => {
  assert.equal(decode('\x1b[5~')[0]?.name, 'pageup');
  assert.equal(decode('\x1b[6~')[0]?.name, 'pagedown');
  assert.equal(decode('\x1b[H')[0]?.name, 'home');
});

/* ------------------------------------------------------------------- theme -- */

test('colour level degrades from the environment', () => {
  assert.equal(detectColorLevel({ NO_COLOR: '1' }), 'none');
  assert.equal(detectColorLevel({ TERM: 'dumb' }), 'none');
  assert.equal(detectColorLevel({ COLORTERM: 'truecolor', TERM: 'xterm' }), 'truecolor');
  assert.equal(detectColorLevel({ TERM: 'xterm-256color' }), 'ansi256');
  assert.equal(detectColorLevel({ TERM: 'xterm' }), 'ansi16');
  assert.equal(detectColorLevel({ FORCE_COLOR: '0', COLORTERM: 'truecolor' }), 'none');
});

test('no-colour themes emit no escape parameters at all', () => {
  const theme = makeTheme('none', true);
  assert.equal(theme.fg('ember'), '');
  assert.equal(theme.bg('panel'), '');
});

test('each colour level produces the right escape shape', () => {
  // Every foreground carries the base background with it, so the game paints
  // its own surface instead of inheriting the terminal's.
  assert.match(makeTheme('truecolor', true).fg('ember'), /^38;2;\d+;\d+;\d+;48;2;\d+;\d+;\d+$/);
  assert.match(makeTheme('ansi256', true).fg('ember'), /^38;5;\d+;48;5;\d+$/);
  assert.match(makeTheme('ansi16', true).fg('ember'), /^\d+;\d+$/);
  assert.match(makeTheme('truecolor', true).bg('panel'), /^48;2;\d+;\d+;\d+$/);
});

test('the light and dark palettes differ where it matters', () => {
  const dark = makeTheme('truecolor', true, 'dark');
  const light = makeTheme('truecolor', true, 'light');
  assert.notEqual(dark.fg('text'), light.fg('text'));
  assert.notEqual(dark.bg('base'), light.bg('base'));
  assert.equal(dark.appearance, 'dark');
  assert.equal(light.appearance, 'light');
});

test('ascii mode never emits a non-ascii glyph', () => {
  const theme = makeTheme('none', false);
  const keys = ['tl', 'tr', 'bl', 'br', 'h', 'v', 'full', 'suit-ember', 'suit-prism', 'arrow'] as const;
  for (const key of keys) {
    for (const ch of theme.glyph(key)) {
      assert.ok(ch.charCodeAt(0) < 128, `${key} produced ${ch}`);
    }
  }
});

test('unicode detection prefers an explicit UTF-8 locale', () => {
  assert.equal(detectUnicode({ LANG: 'en_US.UTF-8' }), true);
  assert.equal(detectUnicode({ LC_ALL: 'de_DE.utf8' }), true);
});

/* ------------------------------------------------------------------ layout -- */

test('wrap never exceeds the width and keeps every word', () => {
  const text = 'Deal 3 damage twice, then draw a card if your chain is 3 or more.';
  for (const width of [8, 12, 20, 40]) {
    const lines = wrap(text, width);
    for (const line of lines) assert.ok(line.length <= width, `"${line}" > ${width}`);
    assert.equal(lines.join(' ').replace(/\s+/g, ' ').trim(), text.replace(/\s+/g, ' ').trim());
  }
});

test('wrap splits a word longer than the line rather than overflowing', () => {
  const lines = wrap('supercalifragilistic', 6);
  for (const line of lines) assert.ok(line.length <= 6);
});

test('truncate fits and marks the cut', () => {
  assert.equal(truncate('abcdef', 10), 'abcdef');
  assert.equal(truncate('abcdef', 4), 'abc…');
  assert.equal(truncate('abcdef', 1).length, 1);
});

test('the banner fits or refuses', () => {
  const wide = banner('GLYPHFALL', 100, true);
  assert.ok(wide);
  assert.equal(wide.length, 5);
  const widths = new Set(wide.map((l) => l.length));
  assert.equal(widths.size, 1, 'all banner rows are the same width');
  assert.equal(banner('GLYPHFALL', 20, true), null, 'refuses rather than overflowing');
  const ascii = banner('GLYPHFALL', 100, false)!;
  for (const line of ascii) {
    for (const ch of line) assert.ok(ch.charCodeAt(0) < 128);
  }
});

/* ------------------------------------------------------------ key repeat -- */

test('holding a key produces a burst the app has to recognise', () => {
  // A terminal sends auto-repeat as ordinary keypresses, often several in one
  // chunk. The decoder must report each of them; suppression is the app's job.
  const burst = decode('eeeee');
  assert.equal(burst.length, 5);
  assert.ok(burst.every((k) => k.name === 'e'));
});
