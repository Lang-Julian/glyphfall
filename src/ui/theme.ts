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
  | 'text' | 'dim' | 'faint' | 'invert'
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

const PALETTE: Record<ColorName, Swatch> = {
  text:      { rgb: [222, 220, 214], x256: 253, x16: '37' },
  dim:       { rgb: [150, 148, 143], x256: 245, x16: '90' },
  faint:     { rgb: [104, 102,  98], x256: 240, x16: '90' },
  invert:    { rgb: [ 18,  17,  16], x256: 233, x16: '30' },
  border:    { rgb: [122, 116, 105], x256: 244, x16: '37' },
  borderDim: { rgb: [ 78,  74,  68], x256: 238, x16: '90' },
  panel:     { rgb: [ 32,  31,  30], x256: 235, x16: '30' },
  shade:     { rgb: [ 58,  56,  53], x256: 238, x16: '90' },

  ember:     { rgb: [255, 122,  61], x256: 209, x16: '31' },
  frost:     { rgb: [104, 205, 255], x256:  81, x16: '36' },
  void:      { rgb: [178, 141, 255], x256: 141, x16: '35' },
  iron:      { rgb: [214, 208, 196], x256: 252, x16: '37' },
  prism:     { rgb: [255, 214, 102], x256: 221, x16: '33' },

  hp:        { rgb: [255,  95, 109], x256: 203, x16: '31' },
  hpLow:     { rgb: [255,  70,  70], x256: 196, x16: '91', bold: true },
  block:     { rgb: [127, 212, 255], x256: 117, x16: '36' },
  energy:    { rgb: [255, 209, 102], x256: 221, x16: '33' },
  gold:      { rgb: [255, 207,  92], x256: 220, x16: '33' },
  chain:     { rgb: [255, 169,  77], x256: 214, x16: '33', bold: true },

  good:      { rgb: [139, 226, 139], x256: 114, x16: '32' },
  bad:       { rgb: [255, 107, 107], x256: 203, x16: '31' },
  warn:      { rgb: [255, 180,  87], x256: 215, x16: '33' },
  accent:    { rgb: [255, 214, 102], x256: 221, x16: '33' },
  title:     { rgb: [255, 236, 200], x256: 230, x16: '97', bold: true },
};

export interface Theme {
  level: ColorLevel;
  unicode: boolean;
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

export function makeTheme(level: ColorLevel, unicode: boolean): Theme {
  const table = unicode ? UNI : ASCII;
  const fgCache = new Map<ColorName, string>();
  const bgCache = new Map<ColorName, string>();

  const encode = (name: ColorName, isBg: boolean): string => {
    if (level === 'none') return '';
    const sw = PALETTE[name];
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

  return {
    level,
    unicode,
    fg(name) {
      let v = fgCache.get(name);
      if (v === undefined) { v = encode(name, false); fgCache.set(name, v); }
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
