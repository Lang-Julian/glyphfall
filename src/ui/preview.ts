import { EVENTS } from '../content/events.js';
import { makeCard } from '../content/cards.js';
import { playCard, startCombat, type CombatState } from '../game/combat.js';
import { addCard, addRelic, combatRewards, newRun, options, type RunState } from '../game/run.js';
import type { Rng } from '../core/rng.js';
import { createCardPicker } from '../views/common.js';
import { createCombatView } from '../views/combatview.js';
import { createEventView } from '../views/eventview.js';
import { createGameOverView } from '../views/gameover.js';
import { createMapView } from '../views/mapview.js';
import { createRestView } from '../views/restview.js';
import { createShopView } from '../views/shopview.js';
import { createTitleView } from '../views/title.js';
import type { App, View } from './app.js';
import { setAsciiMode } from './draw.js';
import { Screen } from './screen.js';
import { makeTheme, type Appearance, type ColorLevel, type Theme } from './theme.js';

/**
 * Headless screen rendering.
 *
 * Renders any screen to plain text without a terminal. It backs
 * `scripts/preview.mjs` for eyeballing a layout during development, and the
 * layout and contrast tests, which assert that nothing clips, nothing
 * overflows, every character is single-width, and every cell carries the
 * game's own background — at every window size worth caring about.
 */

export const PREVIEW_SCREENS =
  ['title', 'map', 'combat', 'reward', 'shop', 'rest', 'event', 'gameover'] as const;
export type PreviewScreen = (typeof PREVIEW_SCREENS)[number];

export interface PreviewOptions {
  width?: number;
  height?: number;
  ascii?: boolean;
  colorLevel?: ColorLevel;
  appearance?: Appearance;
}

/** A fixed, representative mid-run state, so previews stay comparable. */
function scenario(): { run: RunState; rng: Rng; combat: CombatState } {
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

const noop = (): void => {};

function buildApp(
  screen: Screen, theme: Theme, run: RunState, rng: Rng, combat: CombatState,
  appearance: Appearance, ascii: boolean,
): App {
  return {
    screen, theme, run, combat, rng,
    opts: { animations: false, appearance, ascii },
    profile: {
      version: 1, runs: 12, wins: 2, bestChain: 8, bestFloor: 27, totalFightsWon: 61,
      fastestWinMs: 1_500_000, dailiesDone: [],
      settings: { ascii, noColor: false, animations: true, confirmEndTurn: false, appearance },
      history: [
        { seed: 'ember-lantern-412', depth: 1, act: 3, floor: 27, outcome: 'won' as const, bestChain: 8, at: 0 },
        { seed: 'salt-moth-118', depth: 0, act: 2, floor: 14, outcome: 'lost' as const, bestChain: 5, at: 0 },
      ],
    },
    actName: () => 'The Upper Shelves',
    actLabel: () => 'Act 1/3',
    autosave: noop, clearPendingNode: noop, toast: noop, setAppearance: noop,
    push: noop, pop: noop, replace: noop, reset: noop,
    top: () => undefined, exit: noop, stepInto: () => true,
  } as unknown as App;
}

function viewsFor(run: RunState, rng: Rng): Record<PreviewScreen, () => View> {
  return {
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
}

/** Renders a screen and hands back the buffer, for tests that inspect styles. */
export function renderPreviewScreen(name: PreviewScreen, o: PreviewOptions = {}): Screen {
  const ascii = o.ascii ?? false;
  const appearance = o.appearance ?? 'dark';
  const screen = new Screen(o.width ?? 96, o.height ?? 30);
  const theme = makeTheme(o.colorLevel ?? 'none', !ascii, appearance);

  setAsciiMode(ascii);
  screen.setSanitizer(ascii ? (ch) => theme.icon(ch) : null);
  screen.setBaseStyle(theme.bg('base'));

  const { run, rng, combat } = scenario();
  const app = buildApp(screen, theme, run, rng, combat, appearance, ascii);
  screen.clear();
  viewsFor(run, rng)[name]().render(app);
  setAsciiMode(false);
  return screen;
}

export function renderPreview(name: PreviewScreen, o: PreviewOptions = {}): string {
  return renderPreviewScreen(name, o).toText();
}
