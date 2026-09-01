import { STATUSES, STATUS_ORDER } from '../content/statuses.js';
import { cardDef, cardName, describeCard } from '../content/cards.js';
import type { Card, Combatant, StatusId, Suit } from '../core/types.js';
import { Screen } from './screen.js';
import { BOLD, DIM, REVERSE, SUIT_COLOR, SUIT_GLYPH, sgr, type ColorName, type Theme } from './theme.js';

/** Shared widgets. Nothing here knows what a game is; it draws boxes. */

export interface BoxOptions {
  title?: string;
  color?: ColorName;
  titleColor?: ColorName;
  /** Paints the interior, so panels sit above the background. */
  fill?: boolean;
  dashed?: boolean;
}

export function box(
  s: Screen, t: Theme, x: number, y: number, w: number, h: number, o: BoxOptions = {},
): void {
  if (w < 2 || h < 2) return;
  const col = t.fg(o.color ?? 'border');
  const g = t.glyph.bind(t);
  const hLine = g('h').repeat(Math.max(0, w - 2));

  if (o.fill) s.fill(x + 1, y + 1, w - 2, h - 2, ' ', t.bg('panel'));

  s.put(x, y, g('tl') + hLine + g('tr'), col);
  for (let i = 1; i < h - 1; i++) {
    s.put(x, y + i, g('v'), col);
    s.put(x + w - 1, y + i, g('v'), col);
  }
  s.put(x, y + h - 1, g('bl') + hLine + g('br'), col);

  if (o.title) {
    const label = ` ${o.title} `;
    s.put(x + 2, y, label, sgr(t.fg(o.titleColor ?? 'title'), BOLD));
  }
}

/**
 * A horizontal meter with its numbers *beside* the bar rather than inside it.
 *
 * Overlaying the label on the fill looks good in truecolour and turns to mush
 * under `--no-color`, where the inverted text is indistinguishable from the
 * blocks around it. Returns the x just past whatever was drawn.
 */
export function gauge(
  s: Screen, t: Theme, x: number, y: number, w: number,
  value: number, max: number, color: ColorName, label?: string,
): number {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const filled = Math.max(value > 0 ? 1 : 0, Math.round(frac * w));
  const g = t.glyph.bind(t);
  s.put(x, y, g('full').repeat(filled), t.fg(color));
  s.put(x + filled, y, g('shade-l').repeat(Math.max(0, w - filled)), t.fg('shade'));
  if (!label) return x + w;
  return s.put(x + w + 1, y, label, sgr(t.fg(color), BOLD));
}

/** Word wrap that never splits a word it can avoid splitting. */
export function wrap(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line.length === 0) {
        line = word;
      } else if (line.length + 1 + word.length <= width) {
        line += ` ${word}`;
      } else {
        out.push(line);
        line = word;
      }
      while (line.length > width) {
        out.push(line.slice(0, width));
        line = line.slice(width);
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Whether the process is drawing in ASCII mode.
 *
 * A single process draws with one theme for its whole life, so this is set once
 * at start-up rather than threaded through every `truncate` call site.
 */
let asciiMode = false;
export function setAsciiMode(value: boolean): void {
  asciiMode = value;
}

export function truncate(text: string, width: number, ellipsis = asciiMode ? '..' : '…'): string {
  const chars = [...text];
  if (chars.length <= width) return text;
  if (width <= 1) return chars.slice(0, Math.max(0, width)).join('');
  return chars.slice(0, width - 1).join('') + ellipsis;
}

/* ------------------------------------------------------------------- cards -- */

/**
 * Card geometry.
 *
 * 14 columns is the narrowest a card can be and still fit "Deal 5 damage" on
 * one line, and five of them still fit an 80-column terminal. The name always
 * occupies exactly two rows so the rule under it lines up across the whole
 * hand — ragged rules read as a rendering bug.
 */
export const CARD_W = 14;
export const CARD_H_FULL = 9;
export const CARD_H_MID = 8;
export const CARD_H_SMALL = 6;


export interface CardRenderOptions {
  selected?: boolean;
  playable?: boolean;
  /** Dims and marks a card the player cannot afford or cannot play. */
  reason?: string;
  /** Index hint drawn in the corner, usually the 1-9 hotkey. */
  hotkey?: string;
  /** Highlights the card as chain-continuing. */
  chains?: boolean;
}

export function suitColor(suit: Suit): ColorName {
  return SUIT_COLOR[suit];
}

export function drawCard(
  s: Screen, t: Theme, x: number, y: number, h: number, card: Card, o: CardRenderOptions = {},
): void {
  const d = cardDef(card.defId);
  const w = CARD_W;
  const accent = o.playable === false ? 'faint' : suitColor(d.suit);
  const border: ColorName = o.selected ? 'title' : o.playable === false ? 'borderDim' : accent;

  box(s, t, x, y, w, h, { color: border, fill: true });

  // Header: cost on the left, suit on the right, chain marker between them.
  const costStyle = o.playable === false ? t.fg('faint') : sgr(t.fg('energy'), BOLD);
  s.put(x + 1, y + 1, d.unplayable ? '-' : String(d.cost), costStyle);
  s.put(x + w - 2, y + 1, t.glyph(SUIT_GLYPH[d.suit]), t.fg(accent));
  if (o.chains) s.put(x + w - 3, y + 1, t.glyph('chain'), sgr(t.fg('chain'), BOLD));

  // Two name rows when there is room, one when there is not. Every card in a
  // hand shares a height, so the rules still line up across the row.
  const nameRows = h >= 8 ? 2 : 1;
  const nameLines = wrap(cardName(card), w - 2).slice(0, nameRows);
  nameLines.forEach((line, i) => {
    s.putCenter(x + 1, w - 2, y + 2 + i, truncate(line, w - 2),
      sgr(t.fg(o.playable === false ? 'dim' : 'text'), BOLD));
  });

  // The rule sits at a fixed row so every card in the hand agrees.
  const ruleY = y + 2 + nameRows;
  const hasRule = h >= 9;
  if (hasRule) s.put(x + 1, ruleY, t.glyph('h').repeat(w - 2), t.fg('borderDim'));

  const bodyTop = ruleY + (hasRule ? 1 : 0);
  const bodyRows = Math.max(0, y + h - 1 - bodyTop);
  const text = wrap(describeCard(card), w - 2);
  const bodyStyle = t.fg(o.playable === false ? 'faint' : 'dim');
  for (let i = 0; i < bodyRows; i++) {
    const line = text[i];
    if (line === undefined) break;
    // The last visible row ends in an ellipsis when the text continues; the
    // full text is always on the detail row and under the inspect key.
    const clipped = i === bodyRows - 1 && text.length > bodyRows;
    const shown = clipped
      ? `${line.slice(0, w - 3).trimEnd()}${t.glyph('ellipsis')}`
      : line;
    s.put(x + 1, bodyTop + i, shown, bodyStyle);
  }

  // The hotkey rides the bottom rule so it reads as part of the frame.
  if (o.hotkey) {
    s.putCenter(x, w, y + h - 1, ` ${o.hotkey} `,
      sgr(t.fg(o.selected ? 'title' : 'dim'), BOLD));
  }
  if (o.selected) {
    s.put(x - 1, y + Math.floor(h / 2), t.glyph('sel-l'), sgr(t.fg('title'), BOLD));
    s.put(x + w, y + Math.floor(h / 2), t.glyph('sel-r'), sgr(t.fg('title'), BOLD));
  }
}

/** One-line summary used in lists (deck view, shops, rewards). */
export function cardLine(t: Theme, card: Card, width: number): { text: string; style: string } {
  const d = cardDef(card.defId);
  const glyph = t.glyph(SUIT_GLYPH[d.suit]);
  const head = `${glyph} ${d.unplayable ? '-' : d.cost}  ${cardName(card)}`;
  const pad = Math.max(1, 24 - [...head].length);
  return {
    text: truncate(`${head}${' '.repeat(pad)}${describeCard(card)}`, width),
    style: t.fg(suitColor(d.suit)),
  };
}

/* ---------------------------------------------------------------- statuses -- */

export function statusLine(t: Theme, c: Combatant): { text: string; style: string }[] {
  const out: { text: string; style: string }[] = [];
  for (const id of STATUS_ORDER) {
    const n = c.statuses[id] ?? 0;
    if (n === 0) continue;
    const def = STATUSES[id as StatusId];
    out.push({ text: `${def.glyph} ${n}`, style: t.fg(def.good ? 'good' : 'bad') });
  }
  return out;
}

export function putStatuses(
  s: Screen, t: Theme, x: number, y: number, w: number, c: Combatant,
): void {
  let cx = x;
  for (const part of statusLine(t, c)) {
    if (cx + [...part.text].length + 1 > x + w) break;
    cx = s.put(cx, y, part.text, part.style);
    cx = s.put(cx, y, ' ');
  }
}

/* ------------------------------------------------------------------- chain -- */

/** The chain meter. This is the most important number on screen, so it gets
 *  the widest, brightest widget in the layout. */
export function drawChain(
  s: Screen, t: Theme, x: number, y: number, chain: number, max: number, lastSuit: Suit | null,
): number {
  let cx = s.put(x, y, 'CHAIN ', sgr(t.fg(chain > 0 ? 'chain' : 'faint'), BOLD));
  const g = t.glyph.bind(t);
  for (let i = 0; i < max; i++) {
    const on = i < chain;
    cx = s.put(cx, y, on ? g('full') : g('shade-l'),
      on ? sgr(t.fg('chain'), BOLD) : t.fg('shade'));
  }
  cx = s.put(cx, y, ` ${chain > 0 ? `+${chain}` : ' 0'}`, sgr(t.fg(chain > 0 ? 'chain' : 'faint'), BOLD));
  if (lastSuit) {
    cx = s.put(cx, y, `  ${t.glyph(SUIT_GLYPH[lastSuit])}`, t.fg(suitColor(lastSuit)));
  }
  return cx;
}

/* -------------------------------------------------------------------- misc -- */

export function keyHint(
  s: Screen, t: Theme, x: number, y: number, pairs: readonly (readonly [string, string])[],
): void {
  let cx = x;
  for (const [rawKey, label] of pairs) {
    // Key captions contain arrows; degrade them like any other content glyph.
    const key = t.icon(rawKey);
    if (cx + key.length + label.length + 3 > s.width) break;
    // High-contrast chip: base-coloured text on the accent, never on a shade
    // barely distinguishable from it.
    cx = s.put(cx, y, ` ${key} `, sgr(t.fg('invert'), t.bg('accent'), BOLD));
    cx = s.put(cx, y, ` ${label}`, t.fg('dim'));
    cx = s.put(cx, y, '  ');
  }
}

export function centreLines(
  s: Screen, t: Theme, y: number, lines: readonly string[], style: string,
): void {
  lines.forEach((line, i) => s.putCenter(0, s.width, y + i, line, style));
}

export function highlightRow(s: Screen, t: Theme, x: number, y: number, w: number): void {
  s.tint(x, y, w, sgr(t.fg('title'), t.bg('shade'), BOLD));
}

export const REV = REVERSE;
export const B = BOLD;
export const D = DIM;
