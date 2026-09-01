import { cardDef } from '../content/cards.js';
import { relicDef } from '../content/relics.js';
import type { RunState } from '../game/run.js';
import type { App, View } from '../ui/app.js';
import { drawBottomBar } from '../ui/app.js';
import { box, truncate, wrap } from '../ui/draw.js';
import { BOLD, sgr } from '../ui/theme.js';
import { banner } from './banner.js';

/**
 * The run summary.
 *
 * A death screen's job is to make the next run start immediately, so the seed
 * and a one-key restart are the two most prominent things on it.
 */
export function createGameOverView(
  run: RunState,
  outcome: 'won' | 'lost',
  o: { onRetrySeed(app: App): void; onNewRun(app: App): void; onTitle(app: App): void },
): View {
  const minutes = Math.max(1, Math.round((Date.now() - run.stats.startedAt) / 60000));

  return {
    id: 'gameover',
    render(app) {
      const { screen: s, theme: t } = app;
      s.clear();

      const word = outcome === 'won' ? 'GLYPHFALL' : 'GLYPHFALL';
      const art = banner(word, s.width - 6, t.unicode);
      let y = 1;
      if (art && s.height >= 26) {
        art.forEach((line, i) => s.putCenter(0, s.width, y + i, line,
          sgr(t.fg(outcome === 'won' ? 'prism' : 'faint'), BOLD)));
        y += art.length + 1;
      }

      s.putCenter(0, s.width, y, outcome === 'won'
        ? 'GLYPH ZERO is unwritten. The Fall is quiet.'
        : `You fall on floor ${run.stats.floorsCleared}.`,
        sgr(t.fg(outcome === 'won' ? 'good' : 'bad'), BOLD));
      y += 2;

      const w = Math.min(74, s.width - 6);
      const x = Math.floor((s.width - w) / 2);

      const rows: [string, string][] = [
        ['seed', run.seed],
        ['depth', String(run.depth)],
        ['act reached', `${run.act}`],
        ['floors cleared', String(run.stats.floorsCleared)],
        ['fights won', String(run.stats.fightsWon)],
        ['elites killed', String(run.stats.elitesKilled)],
        ['longest chain', String(run.stats.bestChain)],
        ['cards played', String(run.stats.cardsPlayed)],
        ['deck size', String(run.deck.length)],
        ['time', `${minutes} min`],
      ];
      const relicLine = run.relics.map((id) => relicDef(id).name).join(', ') || 'none';
      const relicRows = wrap(`relics: ${relicLine}`, w - 6).slice(0, 2);
      const statRows = Math.ceil(rows.length / 2);
      const h = Math.min(s.height - y - 4, 2 + statRows + 1 + relicRows.length + 1);

      box(s, t, x, y, w, h, { title: outcome === 'won' ? 'Run complete' : 'Run over', fill: true });
      rows.forEach(([label, value], i) => {
        const cy = y + 1 + Math.floor(i / 2);
        const cx = x + 3 + (i % 2) * Math.floor((w - 6) / 2);
        if (cy >= y + h - 1) return;
        s.put(cx, cy, label, t.fg('dim'));
        s.put(cx + 17, cy, truncate(value, Math.floor((w - 6) / 2) - 18), sgr(t.fg('title'), BOLD));
      });
      relicRows.forEach((line, i) => {
        const cy = y + 2 + statRows + i;
        if (cy < y + h - 1) s.put(x + 3, cy, line, t.fg('accent'));
      });

      const notable = run.deck
        .filter((c) => ['rare', 'uncommon'].includes(cardDef(c.defId).rarity))
        .map((c) => cardDef(c.defId).name);
      s.putCenter(0, s.width, y + h,
        truncate(notable.length > 0 ? `deck highlights: ${notable.join(', ')}` : '', s.width - 4),
        t.fg('faint'));

      s.putCenter(0, s.width, s.height - 3,
        '[r] same seed    [n] new run    [t] title    [q] quit', sgr(t.fg('accent'), BOLD));
      drawBottomBar(app, [['r', 'retry seed'], ['n', 'new run'], ['t', 'title'], ['q', 'quit']]);
    },
    onKey(app, key) {
      switch (key.name) {
        case 'r': o.onRetrySeed(app); break;
        case 'n': case 'enter': case 'space': o.onNewRun(app); break;
        case 't': case 'escape': o.onTitle(app); break;
        case 'q': app.exit(); break;
      }
    },
  };
}
