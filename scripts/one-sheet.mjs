/**
 * Regenerates the promotional one-sheet.
 *
 * The screenshot on the slide is not a transcription — hand-copying ASCII art
 * duplicates lines and drifts the moment the game changes. It is generated from
 * the same framebuffer the game draws to, reading the exact colour of every
 * cell, so the picture cannot say something the game does not.
 *
 *   node scripts/one-sheet.mjs          # rewrite docs/one-sheet.html
 *   node scripts/one-sheet.mjs --png    # ...and re-render docs/one-sheet.png
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderPreviewScreen } from '../dist/ui/preview.js';
import { CARDS, CHARACTERS, ENCOUNTERS, EVENTS, RELICS } from '../dist/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const htmlPath = new URL('../docs/one-sheet.html', import.meta.url);

const WIDTH = 78;
const HEIGHT = 24;
/** Rows of the combat frame to show: the fight, the status bar and the hand. */
const FROM_ROW = 2;
const TO_ROW = 23;

const escape = (ch) =>
  ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch;

const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/**
 * The colours of a cell. Background matters as much as foreground: the game
 * writes enemy names and key captions as inverted text, so dropping the
 * background renders them near-black on near-black — invisible.
 */
function colours(style) {
  const parts = style.split(';');
  let fg = null;
  let bg = null;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === '38' && parts[i + 1] === '2') {
      fg = hex(+parts[i + 2], +parts[i + 3], +parts[i + 4]);
      i += 4;
    } else if (parts[i] === '48' && parts[i + 1] === '2') {
      bg = hex(+parts[i + 2], +parts[i + 3], +parts[i + 4]);
      i += 4;
    }
  }
  return { fg, bg };
}

/** The page's own ground; painting it per cell would bloat the markup. */
const GROUND = '#141310';

/** Whether a cell is bold, which the game uses to mean "this number matters". */
const isBold = (style) => style.split(';').includes('1');

function renderShot() {
  const screen = renderPreviewScreen('combat', {
    width: WIDTH, height: HEIGHT, colorLevel: 'truecolor', appearance: 'dark',
  });
  const lines = screen.toText().split('\n');
  const out = [];

  for (let y = FROM_ROW; y <= TO_ROW; y++) {
    const line = lines[y] ?? '';
    let html = '';
    let openKey = null;
    for (let x = 0; x < line.length; x++) {
      const style = screen.styleAt(x, y);
      const { fg, bg } = colours(style);
      const bold = isBold(style);
      const painted = bg && bg !== GROUND ? bg : null;
      const key = `${fg ?? ''}|${painted ?? ''}|${bold}`;
      if (key !== openKey) {
        if (openKey !== null) html += '</span>';
        const css = [
          fg ? `color:${fg}` : '',
          painted ? `background:${painted}` : '',
          bold ? 'font-weight:700' : '',
        ].filter(Boolean).join(';');
        html += `<span style="${css}">`;
        openKey = key;
      }
      html += escape(line[x]);
    }
    if (openKey !== null) html += '</span>';
    out.push(html);
  }
  return out.join('\n');
}

/** Every number on the slide, read from the content tables rather than typed. */
function census() {
  return {
    characters: CHARACTERS.length,
    bosses: ENCOUNTERS.filter((e) => e.tier === 'boss').length,
    cards: CARDS.filter((c) => c.rarity !== 'special').length,
    relics: RELICS.length,
    encounters: ENCOUNTERS.length,
    events: EVENTS.length,
  };
}

const between = (source, marker, replacement) => {
  const open = `<!-- ${marker}:start -->`;
  const close = `<!-- ${marker}:end -->`;
  const a = source.indexOf(open);
  const b = source.indexOf(close);
  if (a < 0 || b < 0) throw new Error(`missing ${marker} markers in one-sheet.html`);
  return source.slice(0, a + open.length) + '\n' + replacement + '\n' + source.slice(b);
};

let html = readFileSync(htmlPath, 'utf8');
html = between(html, 'shot', renderShot());

const counts = census();
for (const [key, value] of Object.entries(counts)) {
  html = html.replace(
    new RegExp(`(<b data-census="${key}">)\\d+(</b>)`),
    `$1${value}$2`,
  );
}
writeFileSync(htmlPath, html);
console.log(`one-sheet.html updated — ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);

if (process.argv.includes('--png')) {
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const target = fileURLToPath(new URL('../docs/one-sheet.png', import.meta.url));
  execFileSync(chrome, [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=2', '--window-size=1600,900',
    `--screenshot=${target}`, `file://${fileURLToPath(htmlPath)}`,
  ], { cwd: root, stdio: 'ignore' });
  console.log('one-sheet.png re-rendered at 3200x1800');
}
