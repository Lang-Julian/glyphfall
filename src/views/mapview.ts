import { NODE_GLYPH, NODE_LABEL, NODE_SHORT, type MapNode } from '../game/map.js';
import { options } from '../game/run.js';
import type { App, View } from '../ui/app.js';
import { drawBottomBar, drawTopBar } from '../ui/app.js';
import { box, truncate } from '../ui/draw.js';
import { BOLD, sgr, type ColorName } from '../ui/theme.js';
import { relicDef } from '../content/relics.js';
import { draughtDef } from '../content/draughts.js';
import { createCardList, createMenu } from './common.js';

/**
 * The act map.
 *
 * Drawn bottom-up, the way you climb it: row 0 at the bottom, the boss at the
 * top, connectors between. Only the nodes you can actually reach are lit, which
 * turns the map from decoration into the strategic decision it should be.
 */

const NODE_COLOR: Record<string, ColorName> = {
  combat: 'text', elite: 'warn', event: 'void', shop: 'gold',
  rest: 'good', treasure: 'prism', boss: 'bad',
};

export interface MapViewOptions {
  onEnter(app: App, node: MapNode): void;
}

export function createMapView(o: MapViewOptions): View {
  let cursor = 0;

  return {
    id: 'map',
    onFocus(app) {
      cursor = 0;
      app.autosave();
    },

    render(app) {
      const run = app.run;
      if (!run) return;
      const { screen: s, theme: t } = app;
      const map = run.map;
      const avail = options(run);
      cursor = Math.max(0, Math.min(avail.length - 1, cursor));

      drawTopBar(app);

      const panelW = s.width >= 96 ? 30 : 0;
      const mapW = s.width - panelW;
      const colW = Math.max(5, Math.min(11, Math.floor((mapW - 6) / map.cols)));
      const x0 = Math.max(1, Math.floor((mapW - colW * map.cols) / 2));

      // Spread the rows over whatever vertical room there is, then centre the
      // whole ladder so it never hugs one edge of the terminal.
      const topLimit = 3;
      const bottomLimit = s.height - 4;
      const span = Math.max(1, bottomLimit - topLimit);
      const rowStep = Math.max(1, Math.min(2, Math.floor(span / (map.rows - 1))));
      const used = (map.rows - 1) * rowStep;
      const bottom = topLimit + used + Math.floor((span - used) * 0.65);
      const yOf = (row: number) => bottom - row * rowStep;
      const xOf = (col: number) => x0 + col * colW + Math.floor(colW / 2);

      s.putCenter(0, mapW, 1, `${app.actName()}  ${t.glyph('bullet')}  choose your route`,
        sgr(t.fg('title'), BOLD));

      // Connectors sit one row above their source node and lean toward their
      // destination, so a fork reads as a fork rather than as scattered slashes.
      if (rowStep > 1) {
        for (const node of Object.values(map.nodes)) {
          for (const nextId of node.next) {
            const nx = map.nodes[nextId];
            if (!nx) continue;
            const y = yOf(node.row) - 1;
            if (y <= 1 || y >= s.height - 2) continue;
            const dir = Math.sign(nx.col - node.col);
            const ch = dir > 0 ? '/' : dir < 0 ? '\\' : '|';
            const lit = node.visited || map.current === node.id;
            s.put(xOf(node.col) + dir, y, ch, lit ? t.fg('border') : t.fg('borderDim'));
          }
        }
      }

      for (const node of Object.values(map.nodes)) {
        const y = yOf(node.row);
        if (y < 2 || y > bottomLimit) continue;
        const x = xOf(node.col) - 1;
        const availIdx = avail.findIndex((n) => n.id === node.id);
        const isAvail = availIdx >= 0;
        const isCursor = isAvail && availIdx === cursor;
        const isHere = map.current === node.id;
        const g = t.icon(NODE_GLYPH[node.kind]);

        // The frame around a glyph carries the state, so the map still reads
        // correctly with no colour at all.
        let cell: string;
        let style: string;
        if (isCursor) { cell = `>${g}<`; style = sgr(t.fg('invert'), t.bg('accent'), BOLD); }
        else if (isAvail) { cell = `[${g}]`; style = sgr(t.fg(NODE_COLOR[node.kind] ?? 'text'), BOLD); }
        else if (isHere) { cell = `(${g})`; style = sgr(t.fg('title'), BOLD); }
        else if (node.visited) { cell = ` ${g} `; style = t.fg('dim'); }
        else { cell = ` ${g} `; style = t.fg('borderDim'); }
        s.put(x, y, cell, style);
      }

      const focus = avail[cursor];
      if (focus) {
        s.putCenter(0, mapW, s.height - 3,
          truncate(`${t.icon(NODE_GLYPH[focus.kind])}  ${NODE_LABEL[focus.kind]}${describeNode(focus)}`, mapW - 2),
          sgr(t.fg(NODE_COLOR[focus.kind] ?? 'text'), BOLD));
      }
      if (panelW > 0) drawSidePanel(app, mapW, panelW);
      else {
        const compact = legend(app, mapW - 2);
        s.putCenter(0, mapW, s.height - 2, compact, t.fg('faint'));
      }

      drawBottomBar(app, [
        ['←→', 'route'], ['↵', 'enter'], ['c', 'deck'], ['r', 'relics'], ['q', 'menu'],
      ]);
    },

    onKey(app, key) {
      const run = app.run;
      if (!run) return;
      const avail = options(run);
      switch (key.name) {
        case 'left': case 'h': case 'up': case 'k':
          cursor = (cursor - 1 + avail.length) % Math.max(1, avail.length);
          break;
        case 'right': case 'l': case 'down': case 'j':
          cursor = (cursor + 1) % Math.max(1, avail.length);
          break;
        case 'enter': case 'space': {
          const node = avail[cursor];
          if (node) o.onEnter(app, node);
          break;
        }
        case 'c':
          app.push(createCardList({
            id: 'deck', title: 'Your deck', cards: run.deck,
            onCancel: (a) => a.pop(),
          }));
          break;
        case 'r': openRelics(app); break;
        case '?': app.push(createMapHelp()); break;
        case 'q': case 'escape': openRunMenu(app); break;
        default: {
          const n = Number(key.name);
          if (Number.isInteger(n) && n >= 1 && n <= avail.length) {
            cursor = n - 1;
            const node = avail[cursor];
            if (node) o.onEnter(app, node);
          }
        }
      }
    },
  };
}

function describeNode(node: MapNode): string {
  switch (node.kind) {
    case 'combat': return ' — a fight, a card, some gold';
    case 'elite': return ' — hard fight, guaranteed relic';
    case 'event': return ' — could be anything';
    case 'shop': return ' — spend gold, thin your deck';
    case 'rest': return ' — heal, or upgrade a card';
    case 'treasure': return ' — a relic, no fight';
    case 'boss': return ' — the floor boss';
  }
}

/**
 * The legend, at three levels of terseness. It is the only thing that tells a
 * new player what the symbols mean, so it degrades rather than disappearing.
 */
function legend(app: App, width: number): string {
  const t = app.theme;
  const kinds = Object.keys(NODE_GLYPH) as (keyof typeof NODE_GLYPH)[];
  const long = kinds.map((k) => `${NODE_GLYPH[k]} ${NODE_LABEL[k].toLowerCase()}`)
    .join(`  ${t.glyph('bullet')}  `);
  if (long.length <= width) return long;
  const short = kinds.map((k) => `${NODE_GLYPH[k]} ${NODE_SHORT[k]}`).join('  ');
  if (short.length <= width) return short;
  return truncate(kinds.map((k) => NODE_GLYPH[k]).join(' '), width);
}

/**
 * The side panel is sized to its contents rather than to the window, so a tall
 * terminal does not leave a column of empty box.
 */
function drawSidePanel(app: App, x: number, w: number): void {
  const run = app.run;
  if (!run) return;
  const { screen: s, theme: t } = app;
  const inner = w - 5;

  const lines: { text: string; style: string }[] = [
    { text: `deck  ${run.deck.length} cards`, style: t.fg('dim') },
    { text: '', style: '' },
    { text: 'RELICS', style: sgr(t.fg('title'), BOLD) },
    ...run.relics.map((id) => {
      const d = relicDef(id);
      return { text: truncate(`${t.icon(d.glyph)} ${d.name}`, inner), style: t.fg('accent') };
    }),
    { text: '', style: '' },
    { text: 'DRAUGHTS', style: sgr(t.fg('title'), BOLD) },
    ...(run.draughts.length === 0
      ? [{ text: '(none)', style: t.fg('faint') }]
      : run.draughts.map((id) => {
          const d = draughtDef(id);
          return { text: truncate(`${t.icon(d.glyph)} ${d.name}`, inner), style: t.fg('frost') };
        })),
    { text: '', style: '' },
    { text: 'MAP', style: sgr(t.fg('title'), BOLD) },
    ...(Object.keys(NODE_GLYPH) as (keyof typeof NODE_GLYPH)[]).map((k) => ({
      text: truncate(`${t.icon(NODE_GLYPH[k])}  ${NODE_LABEL[k].toLowerCase()}`, inner),
      style: t.fg('dim'),
    })),
  ];

  const h = Math.min(s.height - 3, lines.length + 3);
  box(s, t, x, 1, w - 1, h, { title: 'Carrying', fill: true });
  lines.forEach((line, i) => {
    const y = 3 + i;
    if (y >= 1 + h - 1) return;
    if (line.text) s.put(x + 2, y, line.text, line.style);
  });
}

function openRelics(app: App): void {
  const run = app.run;
  if (!run) return;
  app.push(createMenu({
    id: 'relics',
    title: 'Relics',
    overlay: true,
    body: run.relics.flatMap((id) => {
      const d = relicDef(id);
      return [`${app.theme.icon(d.glyph)} ${d.name}`, `   ${d.text}`, ''];
    }),
    items: [{ label: 'Close', onSelect: (a) => a.pop() }],
    onCancel: (a) => a.pop(),
  }));
}

function openRunMenu(app: App): void {
  app.push(createMenu({
    id: 'runmenu',
    title: 'Run',
    subtitle: app.run ? `seed ${app.run.seed}` : '',
    overlay: true,
    items: [
      { label: 'Back to the map', onSelect: (a) => a.pop() },
      { label: 'View deck', onSelect: (a) => {
        a.pop();
        const run = a.run;
        if (run) a.push(createCardList({ id: 'deck', title: 'Your deck', cards: run.deck, onCancel: (b) => b.pop() }));
      } },
      { label: 'How to play', onSelect: (a) => { a.pop(); a.push(createMapHelp()); } },
      { label: 'Save and quit', detail: 'Your run resumes from this floor.', onSelect: (a) => a.quit() },
    ],
    onCancel: (a) => a.pop(),
  }));
}

export function createMapHelp(): View {
  return createMenu({
    id: 'maphelp',
    title: 'The Fall',
    overlay: true,
    body: [
      'Three acts. Each act is a branching map you climb once.',
      '',
      `${NODE_GLYPH.combat} combat    a card reward and gold`,
      `${NODE_GLYPH.elite} elite     harder, always drops a relic`,
      `${NODE_GLYPH.treasure} treasure  a free relic`,
      `${NODE_GLYPH.shop} shop      buy cards, relics, draughts — or pay to delete a card`,
      `${NODE_GLYPH.rest} rest      heal 30%, or permanently upgrade one card`,
      `${NODE_GLYPH.event} unknown   a choice with a price`,
      `${NODE_GLYPH.boss} boss      beat it to descend`,
      '',
      'A shorter deck is a stronger deck. Deleting a card at a shop is',
      'often worth more than buying one.',
    ],
    items: [{ label: 'Close', onSelect: (a) => a.pop() }],
    onCancel: (a) => a.pop(),
  });
}
