/**
 * Colour and glyph policy.
 *
 * Terminals are not browsers: colour depth, unicode coverage and even the
 * concept of a background colour all vary. So every colour is declared once as
 * a semantic name and then degraded — truecolor → 256 → 16 → none — and every
 * glyph has an ASCII twin behind `--ascii`.
 *
 * Only characters that are unambiguously single-width are used: Box Drawing,
 * Block Elements, Geometric Shapes, Arrows, Math Operators, Latin-1. No
 * pictographs, because a double-width glyph shears the entire layout.
 */

export type ColorLevel = 'truecolor' | 'ansi256' | 'ansi16' | 'none';

export type ColorName =
  | 'base' | 'text' | 'dim' | 'faint' | 'invert'
  | 'border' | 'borderDim' | 'panel' | 'shade'
  | 'ember' | 'frost' | 'void' | 'iron' | 'prism'
  | 'hp' | 'hpLow' | 'block' | 'energy' | 'gold' | 'chain'
  | 'good' | 'bad' | 'warn' | 'accent' | 'title';

interface Swatch {
  rgb: [number, number, number];
  x256: number;
  x16: string; // SGR param
  bold?: boolean;
}

/**
 * Two palettes, because a terminal's own background is not knowable and half of
 * them are light. The game paints its own background either way — see
 * `Theme.fg`, which bakes the base colour into every foreground — so text can
 * never end up white-on-white no matter what the terminal is set to.
 */
export type Appearance = 'dark' | 'light';

const DARK: Record<ColorName, Swatch> = {
  base:      { rgb: [ 20,  19,  16], x256: 234, x16: '40' },
  text:      { rgb: [235, 231, 220], x256: 255, x16: '97' },
  dim:       { rgb: [173, 167, 156], x256: 249, x16: '37' },
  faint:     { rgb: [146, 140, 130], x256: 245, x16: '90' },
  invert:    { rgb: [ 20,  19,  16], x256: 234, x16: '30' },
  border:    { rgb: [143, 137, 125], x256: 246, x16: '37' },
  borderDim: { rgb: [112, 107,  98], x256: 242, x16: '90' },
  panel:     { rgb: [ 33,  31,  27], x256: 235, x16: '40' },
  shade:     { rgb: [ 92,  88,  80], x256: 240, x16: '100' },

  ember:     { rgb: [255, 138,  79], x256: 209, x16: '91' },
  frost:     { rgb: [122, 210, 255], x256:  81, x16: '96' },
  void:      { rgb: [190, 158, 255], x256: 141, x16: '95' },
  iron:      { rgb: [222, 216, 203], x256: 253, x16: '97' },
  prism:     { rgb: [255, 220, 120], x256: 221, x16: '93' },

  hp:        { rgb: [255, 112, 122], x256: 203, x16: '91' },
  hpLow:     { rgb: [255,  86,  86], x256: 196, x16: '91', bold: true },
  block:     { rgb: [138, 216, 255], x256: 117, x16: '96' },
  energy:    { rgb: [255, 214, 112], x256: 221, x16: '93' },
  gold:      { rgb: [255, 212, 105], x256: 220, x16: '93' },
  chain:     { rgb: [255, 176,  92], x256: 214, x16: '93', bold: true },

  good:      { rgb: [143, 231, 143], x256: 114, x16: '92' },
  bad:       { rgb: [255, 118, 118], x256: 203, x16: '91' },
  warn:      { rgb: [255, 187, 100], x256: 215, x16: '93' },
  accent:    { rgb: [255, 220, 120], x256: 221, x16: '93' },
  title:     { rgb: [255, 245, 225], x256: 231, x16: '97', bold: true },
};

const LIGHT: Record<ColorName, Swatch> = {
  base:      { rgb: [252, 249, 242], x256: 255, x16: '47' },
  text:      { rgb: [ 32,  30,  26], x256: 235, x16: '30' },
  dim:       { rgb: [ 88,  83,  74], x256: 240, x16: '30' },
  faint:     { rgb: [110, 104,  94], x256: 242, x16: '90' },
  invert:    { rgb: [252, 249, 242], x256: 255, x16: '97' },
  border:    { rgb: [107, 101,  92], x256: 242, x16: '30' },
  borderDim: { rgb: [163, 156, 144], x256: 247, x16: '90' },
  panel:     { rgb: [244, 239, 229], x256: 254, x16: '47' },
  shade:     { rgb: [185, 177, 162], x256: 249, x16: '47' },

  ember:     { rgb: [176,  60,  16], x256: 130, x16: '31' },
  frost:     { rgb: [ 12,  98, 140], x256:  24, x16: '34' },
  void:      { rgb: [ 96,  50, 168], x256:  55, x16: '35' },
  iron:      { rgb: [ 92,  85,  72], x256: 240, x16: '30' },
  prism:     { rgb: [133,  86,   4], x256:  94, x16: '33' },

  hp:        { rgb: [176,  38,  38], x256: 124, x16: '31' },
  hpLow:     { rgb: [200,  20,  20], x256: 160, x16: '31', bold: true },
  block:     { rgb: [ 20, 104, 148], x256:  25, x16: '34' },
  energy:    { rgb: [133,  86,   4], x256:  94, x16: '33' },
  gold:      { rgb: [133,  86,   4], x256:  94, x16: '33' },
  chain:     { rgb: [178,  70,  10], x256: 130, x16: '31', bold: true },

  good:      { rgb: [ 30, 110,  50], x256:  28, x16: '32' },
  bad:       { rgb: [176,  32,  32], x256: 124, x16: '31' },
  warn:      { rgb: [130,  72,   4], x256:  94, x16: '33' },
  accent:    { rgb: [133,  86,   4], x256:  94, x16: '33' },
  title:     { rgb: [ 18,  16,  13], x256: 233, x16: '30', bold: true },
};

const PALETTES: Record<Appearance, Record<ColorName, Swatch>> = { dark: DARK, light: LIGHT };

export interface Theme {
  level: ColorLevel;
  unicode: boolean;
  appearance: Appearance;
  /** SGR parameter string for a foreground colour, e.g. `38;2;255;122;61`. */
  fg(name: ColorName): string;
  /** SGR parameter string for a background colour. */
  bg(name: ColorName): string;
  glyph(key: GlyphKey): string;
  /**
   * Degrades a literal glyph that lives in a content table (a relic sigil, a
   * draught mark, a map node) to ASCII when unicode is off. Content files can
   * then use one readable character each without every table needing a
   * parallel ASCII column.
   */
  icon(ch: string): string;
}

export const BOLD = '1';
export const DIM = '2';
export const ITALIC = '3';
export const UNDERLINE = '4';
export const REVERSE = '7';

export type GlyphKey =
  | 'tl' | 'tr' | 'bl' | 'br' | 'h' | 'v'
  | 'tee-l' | 'tee-r' | 'tee-t' | 'tee-b' | 'cross'
  | 'full' | 'shade-l' | 'shade-m' | 'shade-h'
  | 'suit-ember' | 'suit-frost' | 'suit-void' | 'suit-iron' | 'suit-prism'
  | 'bullet' | 'arrow' | 'up' | 'down' | 'chain' | 'heart' | 'shield'
  | 'bolt' | 'coin' | 'star' | 'sel-l' | 'sel-r' | 'ellipsis' | 'dash';

/**
 * Only characters that are single-width in every terminal: Latin-1, General
 * Punctuation, Arrows, Mathematical Operators, Box Drawing, Block Elements and
 * Geometric Shapes. Deliberately no pictographs — U+26xx/U+27xx characters
 * such as U+26D3 CHAINS or U+2699 GEAR are rendered double-width by some
 * terminals, which would shear the entire grid one column to the right.
 */
const UNI: Record<GlyphKey, string> = {
  tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│',
  'tee-l': '├', 'tee-r': '┤', 'tee-t': '┬', 'tee-b': '┴', cross: '┼',
  full: '█', 'shade-l': '░', 'shade-m': '▒', 'shade-h': '▓',
  'suit-ember': '◆', 'suit-frost': '▲', 'suit-void': '●', 'suit-iron': '■', 'suit-prism': '◉',
  bullet: '·', arrow: '→', up: '↑', down: '↓', chain: '»', heart: '♥', shield: '⊕',
  bolt: '◇', coin: '¤', star: '»', 'sel-l': '▌', 'sel-r': '▐', ellipsis: '…', dash: '─',
};

const ASCII: Record<GlyphKey, string> = {
  tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|',
  'tee-l': '+', 'tee-r': '+', 'tee-t': '+', 'tee-b': '+', cross: '+',
  full: '#', 'shade-l': '.', 'shade-m': ':', 'shade-h': '=',
  'suit-ember': 'E', 'suit-frost': 'F', 'suit-void': 'V', 'suit-iron': 'I', 'suit-prism': 'P',
  bullet: '.', arrow: '>', up: '^', down: 'v', chain: '+', heart: '*', shield: '+',
  bolt: 'o', coin: '$', star: '>', 'sel-l': '>', 'sel-r': '<', ellipsis: '...', dash: '-',
};

export function detectColorLevel(env: NodeJS.ProcessEnv = process.env): ColorLevel {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'none';
  if (env.TERM === 'dumb') return 'none';
  const force = env.FORCE_COLOR;
  if (force === '0') return 'none';
  if (force === '1') return 'ansi16';
  if (force === '2') return 'ansi256';
  if (force === '3') return 'truecolor';
  const ct = (env.COLORTERM ?? '').toLowerCase();
  if (ct.includes('truecolor') || ct.includes('24bit')) return 'truecolor';
  const term = env.TERM ?? '';
  if (/-(direct|truecolor)/.test(term)) return 'truecolor';
  if (env.TERM_PROGRAM === 'iTerm.app' || env.TERM_PROGRAM === 'WezTerm' ||
      env.TERM_PROGRAM === 'ghostty' || env.TERM_PROGRAM === 'vscode') return 'truecolor';
  if (/256color/.test(term)) return 'ansi256';
  if (term === '' || term === 'unknown') return 'none';
  return 'ansi16';
}

/**
 * Guesses whether the terminal is light or dark.
 *
 * `COLORFGBG` is the only widely-set signal (rxvt, konsole, some others); its
 * last field is the background colour index. When it says nothing, dark is the
 * safer default — the game paints its own background either way, so a wrong
 * guess costs taste, not legibility.
 */
export function detectAppearance(env: NodeJS.ProcessEnv = process.env): Appearance {
  const raw = env.COLORFGBG;
  if (!raw) return 'dark';
  const background = raw.split(';').pop()?.trim();
  if (background === undefined) return 'dark';
  const n = Number(background);
  if (!Number.isFinite(n)) return 'dark';
  return n >= 7 && n !== 8 ? 'light' : 'dark';
}

export function detectUnicode(env: NodeJS.ProcessEnv = process.env): boolean {
  const locale = `${env.LC_ALL ?? ''}${env.LC_CTYPE ?? ''}${env.LANG ?? ''}`.toLowerCase();
  if (locale.includes('utf-8') || locale.includes('utf8')) return true;
  // Modern macOS terminals are UTF-8 even when the locale vars are unset.
  return process.platform === 'darwin' || env.TERM_PROGRAM !== undefined;
}

/** ASCII stand-ins for the glyphs used in content tables. */
const ICON_FALLBACK: Record<string, string> = {
  '∞': '8', '△': '^', '◇': 'o', '≡': '=', '¤': '$', '↑': '^', '±': '~',
  '◎': '@', '○': 'O', '∗': '*', '◈': 'X', '⊗': '%', '⊙': '@', '◉': 'P',
  '◆': 'E', '▲': 'F', '●': 'V', '■': 'I', '≫': '>', '×': 'x', '+': '+',
  '†': 'x', '‡': 'E', '∩': 'R', 'Ø': 'B', '?': '?', '$': '$',
  // Punctuation that ends up inside UI strings rather than glyph lookups.
  '←': '<', '→': '>', '↓': 'v', '↵': '=', '…': '..', '·': '.',
  '‹': '<', '›': '>', '—': '-', '’': "'", '“': '"', '”': '"',
};

export function makeTheme(
  level: ColorLevel, unicode: boolean, appearance: Appearance = 'dark',
): Theme {
  const table = unicode ? UNI : ASCII;
  const palette = PALETTES[appearance];
  const fgCache = new Map<ColorName, string>();
  const bgCache = new Map<ColorName, string>();

  const encode = (name: ColorName, isBg: boolean): string => {
    if (level === 'none') return '';
    const sw = palette[name];
    const bold = !isBg && sw.bold ? ';1' : '';
    switch (level) {
      case 'truecolor': {
        const [r, g, b] = sw.rgb;
        return `${isBg ? 48 : 38};2;${r};${g};${b}${bold}`;
      }
      case 'ansi256':
        return `${isBg ? 48 : 38};5;${sw.x256}${bold}`;
      case 'ansi16': {
        const base = Number(sw.x16);
        const shifted = isBg ? (base >= 90 ? base - 90 + 100 : base + 10) : base;
        return `${shifted}${bold}`;
      }
    }
  };

  // Every foreground carries the base background with it. That is what makes
  // the game legible on a white terminal: it never inherits the terminal's own
  // background, so text can never come out white-on-white.
  const baseBg = encode('base', true);

  return {
    level,
    unicode,
    appearance,
    fg(name) {
      let v = fgCache.get(name);
      if (v === undefined) {
        const own = encode(name, false);
        v = own && baseBg ? `${own};${baseBg}` : own;
        fgCache.set(name, v);
      }
      return v;
    },
    bg(name) {
      let v = bgCache.get(name);
      if (v === undefined) { v = encode(name, true); bgCache.set(name, v); }
      return v;
    },
    glyph(key) { return table[key]; },
    icon(ch) {
      if (unicode) return ch;
      return [...ch].map((c) => (c.charCodeAt(0) < 128 ? c : ICON_FALLBACK[c] ?? '*')).join('');
    },
  };
}

/** Joins SGR params, dropping empties so `--no-color` produces a bare string. */
export function sgr(...parts: (string | undefined | false)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(';');
}

export const SUIT_COLOR = {
  ember: 'ember', frost: 'frost', void: 'void', iron: 'iron', prism: 'prism',
} as const satisfies Record<string, ColorName>;

export const SUIT_GLYPH = {
  ember: 'suit-ember', frost: 'suit-frost', void: 'suit-void',
  iron: 'suit-iron', prism: 'suit-prism',
} as const satisfies Record<string, GlyphKey>;
