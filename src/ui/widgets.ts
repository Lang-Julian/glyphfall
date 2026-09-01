import { Screen } from './screen.js';
import { BOLD, sgr, type ColorName, type Theme } from './theme.js';
import { box, truncate, wrap } from './draw.js';

/**
 * Composite widgets shared between screens.
 *
 * Every screen used to compute its own centred box, its own two-column stat
 * grid and its own cursor list, which meant six near-identical blocks drifting
 * apart one fix at a time. These are the three shapes that actually recur.
 */

export interface PanelBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** First writable row inside the border. */
  top: number;
  /** First writable column inside the border. */
  left: number;
  /** Last writable row inside the border, inclusive. */
  bottom: number;
  /** Writable width inside the border. */
  inner: number;
}

/**
 * Draws a box centred horizontally, sized to the content it is given rather
 * than to the window, and returns the coordinates to write inside it.
 */
export function panel(
  s: Screen, t: Theme, o: {
    width: number;
    height: number;
    title?: string;
    /** Row to start at; centred vertically when omitted. */
    y?: number;
    color?: ColorName;
  },
): PanelBox {
  const width = Math.min(o.width, s.width - 4);
  const height = Math.min(o.height, s.height - 2);
  const x = Math.max(0, Math.floor((s.width - width) / 2));
  const y = o.y ?? Math.max(1, Math.floor((s.height - height) / 2));
  box(s, t, x, y, width, height, { title: o.title, fill: true, color: o.color });
  return {
    x, y, width, height,
    top: y + 1, left: x + 2, bottom: y + height - 2, inner: width - 4,
  };
}

/**
 * Label/value pairs laid out in columns. Values are right-of-label rather than
 * right-aligned to the edge, so a long value truncates instead of colliding.
 */
export function statGrid(
  s: Screen, t: Theme, o: {
    x: number; y: number; width: number; maxRows: number;
    rows: readonly (readonly [string, string])[];
    columns?: number;
    labelWidth?: number;
  },
): number {
  const columns = o.columns ?? 2;
  const colWidth = Math.floor(o.width / columns);
  const labelWidth = o.labelWidth ?? Math.min(17, colWidth - 6);
  const rowsUsed = Math.ceil(o.rows.length / columns);

  o.rows.forEach(([label, value], i) => {
    const row = Math.floor(i / columns);
    if (row >= o.maxRows) return;
    const cx = o.x + (i % columns) * colWidth;
    const cy = o.y + row;
    s.put(cx, cy, truncate(label, labelWidth - 1), t.fg('dim'));
    s.put(cx + labelWidth, cy, truncate(value, colWidth - labelWidth - 1), sgr(t.fg('text'), BOLD));
  });
  return Math.min(rowsUsed, o.maxRows);
}

export interface ListRow {
  /** Main text. */
  text: string;
  /** Right-aligned trailing text, such as a price. */
  trailing?: string;
  style?: string;
  trailingStyle?: string;
  disabled?: boolean;
}

/**
 * A cursor list with a scroll window. Returns the scroll offset it settled on,
 * which the caller keeps so the window does not jump between frames.
 */
export function cursorList(
  s: Screen, t: Theme, o: {
    x: number; y: number; width: number; rows: number;
    items: readonly ListRow[];
    cursor: number;
    scroll: number;
  },
): number {
  let scroll = o.scroll;
  if (o.cursor < scroll) scroll = o.cursor;
  if (o.cursor >= scroll + o.rows) scroll = o.cursor - o.rows + 1;
  scroll = Math.max(0, Math.min(scroll, Math.max(0, o.items.length - o.rows)));

  for (let i = 0; i < o.rows; i++) {
    const index = scroll + i;
    const item = o.items[index];
    if (!item) break;
    const active = index === o.cursor;
    const y = o.y + i;
    s.put(o.x, y, active ? t.glyph('arrow') : ' ', sgr(t.fg('accent'), BOLD));
    const trailingRoom = item.trailing ? item.trailing.length + 2 : 0;
    s.put(o.x + 2, y, truncate(item.text, o.width - 2 - trailingRoom),
      item.disabled ? t.fg('faint') : active ? sgr(t.fg('title'), BOLD) : (item.style ?? t.fg('text')));
    if (item.trailing) {
      s.putRight(o.x + o.width, y, item.trailing, item.trailingStyle ?? t.fg('dim'));
    }
  }

  if (o.items.length > o.rows) {
    s.putRight(o.x + o.width, o.y + o.rows - 1 + 1, `${o.cursor + 1}/${o.items.length}`, t.fg('faint'));
  }
  return scroll;
}

/** Paragraph text inside a panel, clipped to the rows available. */
export function paragraph(
  s: Screen, t: Theme, x: number, y: number, width: number, maxRows: number,
  text: string, style?: string,
): number {
  const lines = wrap(text, width).slice(0, maxRows);
  lines.forEach((line, i) => s.put(x, y + i, line, style ?? t.fg('dim')));
  return lines.length;
}
