import type { App, View } from '../ui/app.js';
import { drawBottomBar, drawTopBar } from '../ui/app.js';
import { CARD_H_FULL, CARD_W, box, cardLine, drawCard, truncate, wrap } from '../ui/draw.js';
import { BOLD, sgr, type ColorName } from '../ui/theme.js';
import { cardDef, cardName, describeCard } from '../content/cards.js';
import type { Card } from '../core/types.js';
import type { Key } from '../ui/term.js';

/** Reusable widget-views: a vertical menu, a card chooser and a card browser. */

/* -------------------------------------------------------------------- menu -- */

export interface MenuItem {
  label: string;
  detail?: string;
  hint?: string;
  disabled?: boolean;
  color?: ColorName;
  onSelect(app: App): void;
}

export interface MenuOptions {
  id: string;
  title: string;
  subtitle?: string;
  body?: readonly string[];
  items: readonly MenuItem[];
  hints?: readonly (readonly [string, string])[];
  onCancel?(app: App): void;
  chrome?: boolean;
  overlay?: boolean;
}

export function createMenu(o: MenuOptions): View {
  let cursor = o.items.findIndex((i) => !i.disabled);
  if (cursor < 0) cursor = 0;

  const move = (delta: number) => {
    for (let step = 0; step < o.items.length; step++) {
      cursor = (cursor + delta + o.items.length) % o.items.length;
      if (!o.items[cursor]?.disabled) return;
    }
  };

  return {
    id: o.id,
    overlay: o.overlay,
    render(app) {
      const { screen: s, theme: t } = app;
      if (o.chrome !== false) drawTopBar(app);

      const bodyLines = o.body ?? [];
      const innerW = Math.min(74, s.width - 6);
      const h = 4 + bodyLines.length + o.items.length * 2 + (o.subtitle ? 2 : 0);
      const x = Math.floor((s.width - innerW) / 2);
      const y = Math.max(2, Math.floor((s.height - h) / 2));

      box(s, t, x, y, innerW, h, { title: o.title, fill: true, color: 'border' });
      let cy = y + 1;
      if (o.subtitle) {
        s.putCenter(x + 1, innerW - 2, cy, truncate(o.subtitle, innerW - 4), t.fg('dim'));
        cy += 2;
      }
      for (const line of bodyLines) {
        s.put(x + 3, cy++, truncate(line, innerW - 6), t.fg('dim'));
      }
      cy += 1;

      o.items.forEach((item, i) => {
        const active = i === cursor;
        const style = item.disabled
          ? t.fg('faint')
          : active ? sgr(t.fg('title'), BOLD) : t.fg('text');
        const marker = active ? `${t.glyph('arrow')} ` : '  ';
        s.put(x + 3, cy, marker, sgr(t.fg('accent'), BOLD));
        s.put(x + 5, cy, truncate(item.label, innerW - 10), style);
        if (item.hint) s.putRight(x + innerW - 3, cy, item.hint, t.fg('faint'));
        cy++;
        if (item.detail) {
          s.put(x + 5, cy, truncate(item.detail, innerW - 8),
            active && !item.disabled ? t.fg('dim') : t.fg('faint'));
        }
        cy++;
      });

      drawBottomBar(app, o.hints ?? [
        ['↑↓', 'move'], ['enter', 'select'], ...(o.onCancel ? [['esc', 'back'] as const] : []),
      ]);
    },
    onKey(app, key) {
      switch (key.name) {
        case 'up': case 'k': move(-1); break;
        case 'down': case 'j': move(1); break;
        case 'enter': case 'space': case 'l': case 'right': {
          const item = o.items[cursor];
          if (item && !item.disabled) item.onSelect(app);
          break;
        }
        case 'escape': case 'q': case 'h': case 'left':
          o.onCancel?.(app);
          break;
        default: {
          const n = Number(key.name);
          if (Number.isInteger(n) && n >= 1 && n <= o.items.length) {
            const item = o.items[n - 1];
            if (item && !item.disabled) { cursor = n - 1; item.onSelect(app); }
          }
        }
      }
    },
  };
}

/* ------------------------------------------------------------- card picker -- */

export interface CardPickerOptions {
  id: string;
  title: string;
  prompt?: string;
  cards: readonly Card[];
  /** Label for the "take nothing" option; omit to make a pick mandatory. */
  skipLabel?: string;
  onPick(app: App, card: Card | null): void;
  hints?: readonly (readonly [string, string])[];
}

/** Horizontal card chooser — used for combat rewards and event card grants. */
export function createCardPicker(o: CardPickerOptions): View {
  let cursor = 0;
  const count = o.cards.length;

  return {
    id: o.id,
    render(app) {
      const { screen: s, theme: t } = app;
      drawTopBar(app);

      s.putCenter(0, s.width, 2, o.title, sgr(t.fg('title'), BOLD));
      if (o.prompt) s.putCenter(0, s.width, 3, o.prompt, t.fg('dim'));

      const totalW = count * (CARD_W + 2) - 2;
      const startX = Math.max(1, Math.floor((s.width - totalW) / 2));
      const cardY = 5;

      o.cards.forEach((card, i) => {
        drawCard(s, t, startX + i * (CARD_W + 2), cardY, CARD_H_FULL, card, {
          selected: i === cursor,
          hotkey: String(i + 1),
        });
      });

      // The card itself clips at 14 columns; this panel never does.
      const focus = o.cards[cursor];
      if (focus) {
        const d = cardDef(focus.defId);
        const detailY = cardY + CARD_H_FULL + 1;
        const w = Math.min(64, s.width - 6);
        const x = Math.floor((s.width - w) / 2);
        const body = wrap(describeCard(focus), w - 4).slice(0, 3);
        const flavour = d.flavour ? wrap(`"${d.flavour}"`, w - 4).slice(0, 2) : [];
        const h = 3 + body.length + (flavour.length > 0 ? flavour.length + 1 : 0);
        box(s, t, x, detailY, w, h, { color: 'borderDim', fill: true });
        s.put(x + 2, detailY + 1, cardName(focus), sgr(t.fg('title'), BOLD));
        s.putRight(x + w - 2, detailY + 1,
          `${d.suit} ${t.glyph('bullet')} ${d.type} ${t.glyph('bullet')} ${d.rarity}`, t.fg('dim'));
        body.forEach((line, i) => s.put(x + 2, detailY + 2 + i, line, t.fg('text')));
        flavour.forEach((line, i) =>
          s.put(x + 2, detailY + 3 + body.length + i, truncate(line, w - 4), t.fg('faint')));
      }

      if (o.skipLabel) {
        s.putCenter(0, s.width, s.height - 3, `[s] ${o.skipLabel}`, t.fg('dim'));
      }

      drawBottomBar(app, o.hints ?? [
        ['←→', 'choose'], ['enter', 'take'], ...(o.skipLabel ? [['s', 'skip'] as const] : []),
      ]);
    },
    onKey(app, key) {
      switch (key.name) {
        case 'left': case 'h': cursor = (cursor - 1 + count) % count; break;
        case 'right': case 'l': cursor = (cursor + 1) % count; break;
        case 'enter': case 'space': {
          const card = o.cards[cursor];
          if (card) o.onPick(app, card);
          break;
        }
        case 's': case 'escape':
          if (o.skipLabel) o.onPick(app, null);
          break;
        default: {
          const n = Number(key.name);
          if (Number.isInteger(n) && n >= 1 && n <= count) {
            cursor = n - 1;
            const card = o.cards[cursor];
            if (card) o.onPick(app, card);
          }
        }
      }
    },
  };
}

/* --------------------------------------------------------------- card list -- */

export interface CardListOptions {
  id: string;
  title: string;
  prompt?: string;
  cards: readonly Card[];
  /** Omit to make the list read-only. */
  onPick?(app: App, card: Card): void;
  onCancel(app: App): void;
  actionLabel?: string;
  overlay?: boolean;
}

/** Vertical, scrollable deck browser — also the picker for removal and upgrades. */
export function createCardList(o: CardListOptions): View {
  let cursor = 0;
  let scroll = 0;

  const sorted = [...o.cards].sort((a, b) => {
    const da = cardDef(a.defId), db = cardDef(b.defId);
    return da.suit.localeCompare(db.suit) || da.cost - db.cost || da.name.localeCompare(db.name);
  });

  return {
    id: o.id,
    overlay: o.overlay,
    render(app) {
      const { screen: s, theme: t } = app;
      drawTopBar(app);

      const w = Math.min(74, s.width - 4);
      const x = Math.floor((s.width - w) / 2);
      const y = 2;
      const h = s.height - 4;
      const rows = h - 4;

      box(s, t, x, y, w, h, { title: `${o.title} (${sorted.length})`, fill: true });
      if (o.prompt) s.put(x + 2, y + 1, truncate(o.prompt, w - 4), t.fg('dim'));

      if (cursor < scroll) scroll = cursor;
      if (cursor >= scroll + rows) scroll = cursor - rows + 1;

      for (let i = 0; i < rows; i++) {
        const idx = scroll + i;
        const card = sorted[idx];
        if (!card) break;
        const line = cardLine(t, card, w - 6);
        const active = idx === cursor;
        s.put(x + 2, y + 3 + i, active ? t.glyph('arrow') : ' ', sgr(t.fg('accent'), BOLD));
        s.put(x + 4, y + 3 + i, line.text, active ? sgr(t.fg('title'), BOLD) : line.style);
      }

      if (sorted.length > rows) {
        s.putRight(x + w - 2, y + h - 2, `${cursor + 1}/${sorted.length}`, t.fg('faint'));
      }

      drawBottomBar(app, [
        ['↑↓', 'move'],
        ...(o.onPick ? [[ 'enter', o.actionLabel ?? 'choose'] as const] : []),
        ['esc', 'back'],
      ]);
    },
    onKey(app, key) {
      switch (key.name) {
        case 'up': case 'k': cursor = Math.max(0, cursor - 1); break;
        case 'down': case 'j': cursor = Math.min(sorted.length - 1, cursor + 1); break;
        case 'pageup': cursor = Math.max(0, cursor - 10); break;
        case 'pagedown': cursor = Math.min(sorted.length - 1, cursor + 10); break;
        case 'home': cursor = 0; break;
        case 'end': cursor = sorted.length - 1; break;
        case 'enter': case 'space': {
          const card = sorted[cursor];
          if (card && o.onPick) o.onPick(app, card);
          break;
        }
        case 'escape': case 'q':
          o.onCancel(app);
          break;
      }
    },
  };
}

/* ----------------------------------------------------------------- confirm -- */

export function createConfirm(
  title: string, body: readonly string[], onYes: (app: App) => void, onNo?: (app: App) => void,
): View {
  return createMenu({
    id: 'confirm',
    title,
    body,
    overlay: true,
    items: [
      { label: 'Yes', onSelect: (app) => { app.pop(); onYes(app); } },
      { label: 'No', onSelect: (app) => { app.pop(); onNo?.(app); } },
    ],
    onCancel: (app) => { app.pop(); onNo?.(app); },
  });
}

/** Silences the unused-import lint while keeping the type import meaningful. */
export type { Key };
