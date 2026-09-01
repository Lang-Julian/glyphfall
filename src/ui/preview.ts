import { makeCard } from '../content/cards.js';
import { playCard, startCombat } from '../game/combat.js';
import { addCard, addRelic, combatRewards, newRun, options } from '../game/run.js';
import { createCardPicker } from '../views/common.js';
import { createCombatView } from '../views/combatview.js';
import { createGameOverView } from '../views/gameover.js';
import { createMapView } from '../views/mapview.js';
import { createEventView } from '../views/eventview.js';
import { createRestView } from '../views/restview.js';
import { createShopView } from '../views/shopview.js';
import { createTitleView } from '../views/title.js';
import { EVENTS } from '../content/events.js';
import type { App, View } from './app.js';
import { setAsciiMode } from './draw.js';
import { Screen } from './screen.js';
import { makeTheme, type ColorLevel } from './theme.js';

/**
 * Headless screen rendering.
 *
 * Renders any screen to plain text without a terminal. It backs
 * `scripts/preview.mjs` for eyeballing a layout during development, and the
 * layout tests, which assert that nothing clips, nothing overflows, and that
 * ASCII mode really is ASCII — at every window size worth caring about.
 */

export const PREVIEW_SCREENS =
  ['title', 'map', 'combat', 'reward', 'shop', 'rest', 'event', 'gameover'] as const;
export type PreviewScreen = (typeof PREVIEW_SCREENS)[number];

export interface PreviewOptions {
  width?: number;
  height?: number;
  ascii?: boolean;
  colorLevel?: ColorLevel;
}

/** A fixed, representative mid-run state, so previews are comparable over time. */
function scenario() {
  const { run, rng } = newRun('preview-frame', 0);
  addRelic(run, 'chainwright-glove');
  addRelic(run, 'ember-lens');
  run.gold = 264;
  run.draughts = ['ember-draught', 'mending-draught'];
  for (const id of ['flare', 'twin-spark', 'hoarfrost', 'litany', 'prism-shard', 'cascade']) {
    addCard(run, makeCard(id, id === 'flare' ? 1 : 0));
  }
  const first = options(run)[0]!;
  run.map.current = first.id;
  first.visited = true;
  run.stats.floorsCleared = 2;
  run.stats.fightsWon = 1;
  run.stats.bestChain = 5;
  run.stats.cardsPlayed = 34;
  run.hp = 61;

  const combat = startCombat({
    deck: run.deck, hp: run.hp, maxHp: run.maxHp, relics: run.relics,
    enemyIds: ['ledger-moth', 'cinder-hound', 'glass-wisp'],
    tier: 'normal', encounterName: 'Moth & Wisp', seed: 'preview',
  });
  combat.hand = [...combat.hand, ...combat.draw.splice(0, 3)];
  const strike = combat.hand.findIndex((c) => c.defId === 'strike');
  if (strike >= 0) playCard(combat, strike, 0);

  return { run, rng, combat };
}

export function renderPreview(screenName: PreviewScreen, o: PreviewOptions = {}): string {
  const width = o.width ?? 96;
  const height = o.height ?? 30;
  const ascii = o.ascii ?? false;

  const screen = new Screen(width, height);
  const theme = makeTheme(o.colorLevel ?? 'none', !ascii);
  setAsciiMode(ascii);
  screen.setSanitizer(ascii ? (ch) => theme.icon(ch) : null);

  const { run, rng, combat } = scenario();
  const noop = () => {};

  const app = {
    screen, theme, run, combat, rng,
    opts: { animations: false },
    profile: {
      runs: 12, wins: 2, bestChain: 8, bestFloor: 27, totalFightsWon: 61,
      fastestWinMs: 1_500_000, dailiesDone: [], version: 1,
      settings: { ascii, noColor: false, animations: true, confirmEndTurn: false },
      history: [
        { seed: 'ember-lantern-412', depth: 1, act: 3, floor: 27, outcome: 'won' as const, bestChain: 8, at: 0 },
        { seed: 'salt-moth-118', depth: 0, act: 2, floor: 14, outcome: 'lost' as const, bestChain: 5, at: 0 },
      ],
    },
    actName: () => 'The Upper Shelves',
    actLabel: () => 'Act 1/3',
    autosave: noop, clearPendingNode: noop, toast: noop,
    push: noop, pop: noop, replace: noop, reset: noop,
    top: () => undefined, exit: noop, stepInto: () => true,
  } as unknown as App;

  const views: Record<PreviewScreen, () => View> = {
    title: () => createTitleView({ onNewRun: noop, onContinue: noop }),
    map: () => createMapView({ onEnter: noop }),
    combat: () => createCombatView({ onWin: noop, onLose: noop }),
    reward: () => createCardPicker({
      id: 'preview-reward',
      title: 'A card for the road',
      prompt: 'Pick the card that makes your deck sharper, not bigger.',
      cards: combatRewards(run, rng, 'elite').cards,
      skipLabel: 'take nothing (a smaller deck is a faster deck)',
      onPick: noop,
    }),
    shop: () => createShopView(noop),
    rest: () => createRestView(noop),
    event: () => createEventView(EVENTS.find((e) => e.id === 'the-lamplighter') ?? EVENTS[0]!, noop),
    gameover: () => createGameOverView(run, 'lost', {
      onRetrySeed: noop, onNewRun: noop, onTitle: noop,
    }),
  };

  screen.clear();
  views[screenName]().render(app);
  const text = screen.toText();
  setAsciiMode(false);
  return text;
}
