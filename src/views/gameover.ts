import { cardDef } from '../content/cards.js';
import { characterDef } from '../content/characters.js';
import { relicDef } from '../content/relics.js';
import { scoreRun, shareLine } from '../game/score.js';
import type { RunState } from '../game/run.js';
import { copyToClipboard } from '../meta/clipboard.js';
import type { App, View } from '../ui/app.js';
import { drawBottomBar } from '../ui/app.js';
import { truncate, wrap } from '../ui/draw.js';
import { panel, statGrid } from '../ui/widgets.js';
import { BOLD, sgr } from '../ui/theme.js';
import { banner } from './banner.js';

/**
 * The run summary.
 *
 * Three jobs, in order: say what the run was worth, make the next run one
 * keystroke away, and hand over a line you can paste at someone. A death
 * screen that makes you stop playing has failed.
 */
export function createGameOverView(
  run: RunState,
  outcome: 'won' | 'lost',
  o: { onRetrySeed(app: App): void; onNewRun(app: App): void; onTitle(app: App): void },
): View {
  const minutes = Math.max(1, Math.round((Date.now() - run.stats.startedAt) / 60000));
  const score = scoreRun(run, outcome);
  const share = shareLine(run, outcome);
  const character = characterDef(run.character);
  let copied = false;

  return {
    id: 'gameover',
    render(app) {
      const { screen: s, theme: t } = app;
      s.clear();

      let y = 1;
      const art = banner('GLYPHFALL', s.width - 6, t.unicode);
      if (art && s.height >= 30) {
        art.forEach((line, i) => s.putCenter(0, s.width, y + i, line,
          sgr(t.fg(outcome === 'won' ? 'prism' : 'faint'), BOLD)));
        y += art.length + 1;
      }

      s.putCenter(0, s.width, y, outcome === 'won'
        ? 'The Fall is quiet. You walked out.'
        : `${character.name} falls on floor ${run.stats.floorsCleared}.`,
        sgr(t.fg(outcome === 'won' ? 'good' : 'bad'), BOLD));
      y += 2;

      // Score breakdown on the left, run facts on the right.
      const facts: [string, string][] = [
        ['character', character.name],
        ['seed', run.seed],
        ['depth', String(run.depth)],
        ['act reached', String(run.act)],
        ['deck size', String(run.deck.length)],
        ['cards played', String(run.stats.cardsPlayed)],
        ['time', `${minutes} min`],
      ];
      const rows = Math.max(score.lines.length + 2, facts.length);
      const p = panel(s, t, {
        width: 78, height: Math.min(s.height - y - 5, rows + 3), y,
        title: outcome === 'won' ? 'Run complete' : 'Run over',
      });
      const half = Math.floor(p.inner / 2);

      s.put(p.left, p.top, 'SCORE', sgr(t.fg('title'), BOLD));
      score.lines.forEach((line, i) => {
        const cy = p.top + 1 + i;
        if (cy > p.bottom - 1) return;
        s.put(p.left, cy, truncate(line.label, half - 6), t.fg('dim'));
        s.putRight(p.left + half - 2, cy, String(line.points), t.fg('text'));
      });
      const totalY = Math.min(p.bottom, p.top + 1 + score.lines.length);
      s.put(p.left, totalY, run.depth > 0 ? `total  (x${score.multiplier.toFixed(2)} depth)` : 'total',
        sgr(t.fg('accent'), BOLD));
      s.putRight(p.left + half - 2, totalY, String(score.total), sgr(t.fg('accent'), BOLD));

      const rx = p.left + half + 2;
      s.put(rx, p.top, 'RUN', sgr(t.fg('title'), BOLD));
      statGrid(s, t, {
        x: rx, y: p.top + 1, width: p.inner - half - 2,
        maxRows: p.bottom - p.top, rows: facts, columns: 1, labelWidth: 15,
      });
      const w = p.width;
      const x = p.x;
      const h = p.height;

      const relicLine = run.relics.map((id) => relicDef(id).name).join(', ') || 'none';
      const notable = run.deck
        .filter((c) => cardDef(c.defId).rarity === 'rare')
        .map((c) => cardDef(c.defId).name);
      let ny = y + h;
      wrap(`relics: ${relicLine}`, w - 4).slice(0, 2).forEach((line) => {
        if (ny < s.height - 4) s.put(x + 2, ny++, line, t.fg('accent'));
      });
      if (notable.length > 0 && ny < s.height - 4) {
        s.put(x + 2, ny++, truncate(`rares: ${notable.join(', ')}`, w - 4), t.fg('prism'));
      }

      s.putCenter(0, s.width, s.height - 3, truncate(share, s.width - 4),
        copied ? sgr(t.fg('good'), BOLD) : t.fg('faint'));
      if (copied) s.putCenter(0, s.width, s.height - 2, 'copied to clipboard', t.fg('good'));

      drawBottomBar(app, [
        ['r', 'same seed'], ['n', 'new run'], ['y', 'copy summary'],
        ['t', 'title'], ['q', 'quit'],
      ]);
    },
    onKey(app, key) {
      switch (key.name) {
        case 'r': o.onRetrySeed(app); break;
        case 'n': case 'enter': case 'space': o.onNewRun(app); break;
        case 'y': {
          copied = copyToClipboard(share);
          app.toast(copied ? 'Summary copied.' : 'No clipboard tool found.');
          break;
        }
        case 't': case 'escape': o.onTitle(app); break;
        case 'q': app.exit(); break;
      }
    },
  };
}
