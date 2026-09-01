import { MAX_DRAUGHTS, draughtDef } from '../content/draughts.js';
import { relicDef } from '../content/relics.js';
import { addCard, addDraught, addRelic, buildShop, removeCard, type ShopItem } from '../game/run.js';
import type { App, View } from '../ui/app.js';
import { drawBottomBar, drawTopBar } from '../ui/app.js';
import { box, cardLine, wrap } from '../ui/draw.js';
import { cursorList } from '../ui/widgets.js';
import type { Theme } from '../ui/theme.js';
import { BOLD, sgr } from '../ui/theme.js';
import { createCardList } from './common.js';

/**
 * The shop.
 *
 * Deliberately includes card *removal* as a purchasable line item, because the
 * strongest purchase in a deckbuilder is usually a subtraction, and hiding that
 * behind a separate screen makes players forget it exists.
 */
function itemGlyph(t: Theme, item: ShopItem): string {
  switch (item.kind) {
    case 'relic': return t.icon(relicDef(item.id).glyph);
    case 'draught': return t.icon(draughtDef(item.id).glyph);
    case 'removal': return '-';
    default: return t.glyph('star');
  }
}

export function createShopView(onLeave: (app: App) => void): View {
  let items: ShopItem[] | null = null;
  let cursor = 0;

  const ensure = (app: App): ShopItem[] => {
    if (!items && app.run) items = buildShop(app.run, app.rng);
    return items ?? [];
  };

  const buy = (app: App, item: ShopItem): void => {
    const run = app.run;
    if (!run || item.sold) return;
    if (run.gold < item.price) { app.toast('Not enough gold.'); return; }

    switch (item.kind) {
      case 'card': {
        if (!item.card) return;
        run.gold -= item.price;
        addCard(run, item.card);
        item.sold = true;
        app.toast(`Bought ${item.name}.`);
        break;
      }
      case 'relic': {
        run.gold -= item.price;
        addRelic(run, item.id);
        item.sold = true;
        app.toast(`Bought ${relicDef(item.id).name}.`);
        break;
      }
      case 'draught': {
        if (run.draughts.length >= MAX_DRAUGHTS) { app.toast('No draught slots left.'); return; }
        run.gold -= item.price;
        addDraught(run, item.id);
        item.sold = true;
        app.toast(`Bought ${draughtDef(item.id).name}.`);
        break;
      }
      case 'removal': {
        if (run.deck.length <= 4) { app.toast('Your deck is already bare.'); return; }
        app.push(createCardList({
          id: 'remove',
          title: 'Strike a card',
          prompt: 'Choose the card to remove from your deck for good.',
          cards: run.deck,
          actionLabel: 'remove',
          onPick: (a, card) => {
            const r = a.run;
            if (!r) return;
            r.gold -= item.price;
            removeCard(r, card.uid);
            r.removalCost += 25;
            item.sold = true;
            a.pop();
            a.toast('Struck from the deck.');
          },
          onCancel: (a) => a.pop(),
        }));
        break;
      }
    }
    app.autosave();
  };

  return {
    id: 'shop',
    render(app) {
      const run = app.run;
      if (!run) return;
      const list = ensure(app);
      const { screen: s, theme: t } = app;
      cursor = Math.max(0, Math.min(list.length - 1, cursor));

      drawTopBar(app);

      // The panel is sized to its stock, not to the window.
      const w = Math.min(76, s.width - 4);
      const x = Math.floor((s.width - w) / 2);
      const detailLines = wrap(list[cursor]?.detail ?? '', w - 4).slice(0, 2);
      const h = Math.min(s.height - 4, 6 + list.length + detailLines.length);
      const y = Math.max(2, Math.floor((s.height - h) / 2));

      box(s, t, x, y, w, h, { title: 'The Landing Shop', fill: true });
      s.put(x + 2, y + 1, 'She sells what the floor above no longer needs.', t.fg('faint'));

      const listTop = y + 3;
      cursorList(s, t, {
        x: x + 2, y: listTop, width: w - 5, rows: list.length, cursor, scroll: 0,
        items: list.map((item) => {
          const afford = run.gold >= item.price && !item.sold;
          const label = item.kind === 'card' && item.card
            ? cardLine(t, item.card, w - 22).text
            : `${itemGlyph(t, item)} ${item.name}`;
          return {
            text: item.sold ? `${label}   sold` : label,
            trailing: `${t.glyph('coin')} ${item.price}`,
            trailingStyle: sgr(t.fg(item.sold ? 'faint' : afford ? 'gold' : 'bad'), BOLD),
            disabled: item.sold,
          };
        }),
      });

      const ruleY = y + h - detailLines.length - 2;
      s.put(x + 1, ruleY, t.glyph('h').repeat(w - 2), t.fg('borderDim'));
      detailLines.forEach((line, i) => s.put(x + 2, ruleY + 1 + i, line, t.fg('dim')));
      s.putRight(x + w - 3, ruleY, ` you have ${t.glyph('coin')} ${run.gold} `,
        sgr(t.fg('gold'), BOLD));

      drawBottomBar(app, [['↑↓', 'browse'], ['↵', 'buy'], ['c', 'deck'], ['esc', 'leave']]);
    },

    onKey(app, key) {
      const list = ensure(app);
      switch (key.name) {
        case 'up': case 'k': cursor = Math.max(0, cursor - 1); break;
        case 'down': case 'j': cursor = Math.min(list.length - 1, cursor + 1); break;
        case 'enter': case 'space': {
          const item = list[cursor];
          if (item) buy(app, item);
          break;
        }
        case 'c': {
          const run = app.run;
          if (run) app.push(createCardList({ id: 'deck', title: 'Your deck', cards: run.deck, onCancel: (a) => a.pop() }));
          break;
        }
        case 'escape': case 'q': onLeave(app); break;
      }
    },
  };
}
