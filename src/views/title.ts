import { dailySeed, normaliseSeed, randomSeed } from '../core/seed.js';
import { loadSave } from '../meta/store.js';
import type { App, View } from '../ui/app.js';
import { drawBottomBar } from '../ui/app.js';
import { box, truncate } from '../ui/draw.js';
import { BOLD, sgr } from '../ui/theme.js';
import { banner } from './banner.js';
import { createMenu } from './common.js';
import { createMapHelp } from './mapview.js';

/**
 * The title screen.
 *
 * It answers three questions immediately: is there a run to continue, what is
 * today's daily, and how do I play. Everything else is one keystroke deeper.
 */
export function createTitleView(o: {
  onNewRun(app: App, seed: string, depth: number): void;
  onContinue(app: App): void;
}): View {
  let cursor = 0;
  const save = loadSave();

  const items: {
    label: string; detail: string; disabled?: boolean; act(app: App): void;
  }[] = [
    ...(save
      ? [{
          label: 'Continue run',
          detail: `${save.run.seed} · act ${save.run.act} · floor ${save.run.stats.floorsCleared} · ${save.run.hp}/${save.run.maxHp} HP`,
          act: (app: App) => o.onContinue(app),
        }]
      : []),
    {
      label: 'Descend',
      detail: 'A fresh run with a fresh seed.',
      act: (app) => o.onNewRun(app, randomSeed(), 0),
    },
    {
      label: "Today's Fall",
      detail: `Daily seed — everyone gets the same run: ${dailySeed()}`,
      act: (app) => o.onNewRun(app, dailySeed(), 0),
    },
    {
      label: 'Custom seed',
      detail: 'Type a seed. Any text works.',
      act: (app) => app.push(createSeedPrompt((seed) => o.onNewRun(app, seed, 0))),
    },
    {
      label: 'Deeper',
      detail: 'Raise the difficulty. Enemies hit harder and you start with less.',
      act: (app) => app.push(createDepthPicker((depth) => o.onNewRun(app, randomSeed(), depth))),
    },
    {
      label: 'How to play',
      detail: 'The chain, in sixty seconds.',
      act: (app) => app.push(createHowTo()),
    },
    {
      label: 'Records',
      detail: 'Runs, wins, longest chain.',
      act: (app) => app.push(createRecords()),
    },
    {
      // Terminal backgrounds are not reliably detectable, so this is one
      // keystroke away rather than buried in a config file.
      label: 'Appearance',
      detail: 'switch between light and dark — press enter to toggle',
      act: (app) => app.setAppearance(app.opts.appearance === 'light' ? 'dark' : 'light'),
    },
    {
      label: 'Quit',
      detail: '',
      act: (app) => app.exit(),
    },
  ];

  return {
    id: 'title',
    render(app) {
      const { screen: s, theme: t } = app;
      s.clear();

      const art = banner('GLYPHFALL', s.width - 6, t.unicode);
      let y = 2;
      if (art) {
        art.forEach((line, i) => {
          const shade = i < 2 ? 'ember' : i < 4 ? 'prism' : 'frost';
          s.putCenter(0, s.width, y + i, line, sgr(t.fg(shade), BOLD));
        });
        y += art.length + 1;
      } else {
        s.putCenter(0, s.width, y, 'G L Y P H F A L L', sgr(t.fg('title'), BOLD));
        y += 2;
      }
      s.putCenter(0, s.width, y, 'a roguelike deckbuilder about the order you do things in', t.fg('dim'));
      y += 2;

      const w = Math.min(64, s.width - 6);
      const x = Math.floor((s.width - w) / 2);
      const h = Math.min(s.height - y - 2, items.length + 3);
      box(s, t, x, y, w, h, { color: 'borderDim', fill: true });

      items.forEach((item, i) => {
        const iy = y + 1 + i;
        if (iy >= y + h - 1) return;
        const active = i === cursor;
        s.put(x + 2, iy, active ? `${t.glyph('arrow')} ` : '  ', sgr(t.fg('accent'), BOLD));
        s.put(x + 4, iy, truncate(item.label, 18), active ? sgr(t.fg('title'), BOLD) : t.fg('text'));
        const detail = item.label === 'Appearance'
          ? `currently ${app.opts.appearance} — press enter to switch`
          : item.detail;
        s.put(x + 23, iy, truncate(detail, w - 25), active ? t.fg('dim') : t.fg('faint'));
      });

      const p = app.profile;
      s.putCenter(0, s.width, s.height - 3,
        `runs ${p.runs}  ${t.glyph('bullet')}  wins ${p.wins}  ${t.glyph('bullet')}  best chain ${p.bestChain}  ${t.glyph('bullet')}  deepest floor ${p.bestFloor}`,
        t.fg('faint'));

      drawBottomBar(app, [['↑↓', 'move'], ['↵', 'select'], ['q', 'quit']]);
    },
    onKey(app, key) {
      switch (key.name) {
        case 'up': case 'k': cursor = (cursor - 1 + items.length) % items.length; break;
        case 'down': case 'j': cursor = (cursor + 1) % items.length; break;
        case 'enter': case 'space': items[cursor]?.act(app); break;
        case 'q': case 'escape': app.exit(); break;
        case '?': app.push(createHowTo()); break;
      }
    },
  };
}

/* ------------------------------------------------------------ seed prompt -- */

function createSeedPrompt(onSubmit: (seed: string) => void): View {
  let buffer = '';
  return {
    id: 'seed',
    overlay: true,
    render(app) {
      const { screen: s, theme: t } = app;
      const w = Math.min(56, s.width - 6);
      const x = Math.floor((s.width - w) / 2);
      const y = Math.floor(s.height / 2) - 3;
      box(s, t, x, y, w, 7, { title: 'Seed', fill: true });
      s.put(x + 2, y + 2, 'Any text. Same seed, same run.', t.fg('dim'));
      s.put(x + 2, y + 4, `${t.glyph('arrow')} ${buffer}`, sgr(t.fg('title'), BOLD));
      s.put(x + 4 + buffer.length, y + 4, t.glyph('full'), t.fg('accent'));
      drawBottomBar(app, [['↵', 'descend'], ['esc', 'back']]);
    },
    onKey(app, key) {
      if (key.name === 'escape') { app.pop(); return; }
      if (key.name === 'enter') {
        app.pop();
        onSubmit(normaliseSeed(buffer.length > 0 ? buffer : randomSeed()));
        return;
      }
      if (key.name === 'backspace') { buffer = buffer.slice(0, -1); return; }
      if (key.name === 'space') { buffer += '-'; return; }
      if (key.ch && buffer.length < 40 && /[\w-]/.test(key.ch)) buffer += key.ch;
    },
  };
}

function createDepthPicker(onPick: (depth: number) => void): View {
  return createMenu({
    id: 'depth',
    title: 'How deep',
    overlay: true,
    body: ['Each step scales enemy HP by 7% and costs you 4 max HP.'],
    items: [0, 1, 2, 3, 4, 5].map((d) => ({
      label: d === 0 ? 'Depth 0 — Descent' : `Depth ${d}`,
      detail: d === 0 ? 'The intended experience.' : `+${d * 7}% enemy HP, -${d * 4} max HP.`,
      onSelect: (a: App) => { a.pop(); onPick(d); },
    })),
    onCancel: (a) => a.pop(),
  });
}

function createHowTo(): View {
  return createMapHelp();
}

function createRecords(): View {
  return {
    id: 'records',
    overlay: true,
    render(app) {
      const { screen: s, theme: t } = app;
      const p = app.profile;
      const w = Math.min(70, s.width - 6);
      const x = Math.floor((s.width - w) / 2);
      const rows = Math.min(p.history.length, s.height - 14);
      const h = 10 + rows;
      const y = Math.max(1, Math.floor((s.height - h) / 2));
      box(s, t, x, y, w, h, { title: 'Records', fill: true });

      const stats: [string, string][] = [
        ['runs', String(p.runs)],
        ['wins', String(p.wins)],
        ['fights won', String(p.totalFightsWon)],
        ['longest chain', String(p.bestChain)],
        ['deepest floor', String(p.bestFloor)],
        ['fastest win', p.fastestWinMs ? `${Math.round(p.fastestWinMs / 60000)} min` : '—'],
      ];
      stats.forEach(([label, value], i) => {
        const cy = y + 2 + Math.floor(i / 2);
        const cx = x + 3 + (i % 2) * Math.floor((w - 6) / 2);
        s.put(cx, cy, label, t.fg('dim'));
        s.put(cx + 16, cy, value, sgr(t.fg('title'), BOLD));
      });

      s.put(x + 3, y + 6, 'recent runs', sgr(t.fg('title'), BOLD));
      p.history.slice(0, rows).forEach((run, i) => {
        const line = `${run.outcome === 'won' ? 'won ' : 'lost'}  act ${run.act}  floor ${String(run.floor).padStart(2)}  chain ${String(run.bestChain).padStart(2)}  ${run.seed}`;
        s.put(x + 3, y + 7 + i, truncate(line, w - 6),
          run.outcome === 'won' ? t.fg('good') : t.fg('dim'));
      });
      if (p.history.length === 0) s.put(x + 3, y + 7, 'nothing yet', t.fg('faint'));

      drawBottomBar(app, [['esc', 'back']]);
    },
    onKey(app, key) {
      if (key.name === 'escape' || key.name === 'q' || key.name === 'enter') app.pop();
    },
  };
}
