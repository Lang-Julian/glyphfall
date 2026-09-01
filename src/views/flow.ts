import { randomSeed } from '../core/seed.js';
import { draughtDef } from '../content/draughts.js';
import { relicDef } from '../content/relics.js';
import { startCombat, telegraphAll } from '../game/combat.js';
import {
  addCard, addDraught, addRelic, bossRelicChoices, combatRewards, enemyHpScale,
  pickEncounter, pickEvent, treasureReward,
} from '../game/run.js';
import type { MapNode } from '../game/map.js';
import type { App, View } from '../ui/app.js';
import { loadSave } from '../meta/store.js';
import { createCardPicker, createMenu } from './common.js';
import { createCombatHelp, createCombatView } from './combatview.js';
import { createEventView } from './eventview.js';
import { createGameOverView } from './gameover.js';
import { createMapView } from './mapview.js';
import { createRestView } from './restview.js';
import { createShopView } from './shopview.js';
import { createTitleView } from './title.js';

/**
 * Game flow.
 *
 * Every transition between screens lives here, in one file, in the order it
 * happens: title → map → node → reward → map → boss → act → end. When a
 * roguelike's flow is scattered across its screens, states leak; keeping it in
 * one place is why "quit mid-fight and resume" is a two-line guarantee.
 */

export function showTitle(app: App): void {
  app.reset(createTitleView({
    onNewRun: (a, seed, depth) => startRun(a, seed, depth),
    onContinue: (a) => { if (!resumeRun(a)) a.toast('No run to continue.'); },
  }));
}

/**
 * Picks up the saved run. Returns false when there is nothing to pick up.
 *
 * A run saved inside a node resumes *inside that node*: the node is already
 * marked visited, so dropping the player back on the map would hand them the
 * floor's rewards without the fight.
 */
export function resumeRun(app: App): boolean {
  const save = loadSave();
  if (!save) return false;
  app.adoptRun(save.run, save.resumeNode);
  app.reset(mapView(app));
  if (save.resumeNode) {
    const node = save.run.map.nodes[save.resumeNode];
    if (node) resolveNode(app, node, true);
  }
  return true;
}

export function startRun(app: App, seed: string, depth: number): void {
  app.beginRun(seed, depth);
  app.reset(mapView(app));
  // A first-time player has no way to know the one rule the game is built on,
  // and a rule you have to go looking for is a rule most people never find.
  if (app.profile.runs === 0) app.push(createCombatHelp());
  else app.toast(`seed ${seed}`);
}

function mapView(app: App): View {
  return createMapView({
    onEnter: (a, node) => {
      if (!a.stepInto(node.id)) return;
      resolveNode(a, node, false);
    },
  });
}

export function backToMap(app: App): void {
  // The node is done: from here a resumed run starts on the map, not inside it.
  app.clearPendingNode();
  app.reset(mapView(app));
  app.autosave();
}

/* ------------------------------------------------------------------- nodes -- */

function resolveNode(app: App, node: MapNode, resuming: boolean): void {
  const run = app.run;
  if (!run) return;
  if (resuming) run.map.current = node.id;

  switch (node.kind) {
    case 'combat': startFight(app, 'normal'); break;
    case 'elite': startFight(app, 'elite'); break;
    case 'boss': startFight(app, 'boss'); break;
    case 'treasure': openTreasure(app); break;
    case 'shop': app.push(createShopView(backToMap)); break;
    case 'rest': app.push(createRestView(backToMap)); break;
    case 'event': app.push(createEventView(pickEvent(run, app.rng), backToMap)); break;
  }
}

function startFight(app: App, tier: 'normal' | 'elite' | 'boss'): void {
  const run = app.run;
  if (!run) return;
  const encounter = pickEncounter(run, app.rng, tier);
  const combat = startCombat({
    deck: run.deck,
    hp: run.hp,
    maxHp: run.maxHp,
    relics: run.relics,
    enemyIds: encounter.enemies,
    tier,
    encounterName: encounter.name,
    seed: `${run.seed}:${run.act}:${run.stats.floorsCleared}:${encounter.id}`,
    hpScale: enemyHpScale(run),
  });
  telegraphAll(combat);
  app.combat = combat;
  app.combatTier = tier;

  app.reset(createCombatView({
    onWin: (a) => onCombatWon(a, tier),
    onLose: (a) => onCombatLost(a),
  }));
}

/* ----------------------------------------------------------------- rewards -- */

function onCombatWon(app: App, tier: 'normal' | 'elite' | 'boss'): void {
  const run = app.run;
  if (!run) return;
  app.applyCombatWin(tier);
  app.combat = null;

  if (tier === 'boss') {
    openBossReward(app);
    return;
  }

  const reward = combatRewards(run, app.rng, tier);
  run.gold += reward.gold;

  const steps: ((done: () => void) => void)[] = [];

  steps.push((done) => {
    app.reset(createCardPicker({
      id: 'reward-card',
      title: `${reward.gold} gold, and one card`,
      prompt: 'Pick the card that makes your deck sharper, not bigger.',
      cards: reward.cards,
      skipLabel: 'take nothing (a smaller deck is a faster deck)',
      onPick: (a, card) => {
        if (card) { addCard(run, card); a.toast(`Added ${card.defId}.`); }
        done();
      },
    }));
  });

  if (reward.relic) {
    const relic = reward.relic;
    steps.push((done) => {
      const d = relicDef(relic);
      app.reset(createMenu({
        id: 'reward-relic',
        title: 'Relic',
        body: [`${app.theme.icon(d.glyph)}  ${d.name}`, '', d.text],
        items: [{ label: 'Take it', onSelect: () => { addRelic(run, relic); done(); } }],
        hints: [['↵', 'take']],
      }));
    });
  }

  if (reward.draught) {
    const draught = reward.draught;
    steps.push((done) => {
      const d = draughtDef(draught);
      app.reset(createMenu({
        id: 'reward-draught',
        title: 'Draught',
        body: [`${app.theme.icon(d.glyph)}  ${d.name}`, '', d.text],
        items: [
          {
            label: 'Take it',
            detail: `${run.draughts.length}/3 slots used.`,
            onSelect: () => {
              if (!addDraught(run, draught)) app.toast('No slots left.');
              done();
            },
          },
          { label: 'Leave it', onSelect: () => done() },
        ],
      }));
    });
  }

  runSteps(steps, () => backToMap(app));
}

function openBossReward(app: App): void {
  const run = app.run;
  if (!run) return;
  const gold = 100 + run.act * 10;
  run.gold += gold;

  const choices = bossRelicChoices(run, app.rng, 3);
  app.reset(createMenu({
    id: 'boss-reward',
    title: 'The boss leaves something behind',
    subtitle: `+${gold} gold. Choose one — these change how a run plays.`,
    items: choices.map((id) => {
      const d = relicDef(id);
      return {
        label: `${app.theme.icon(d.glyph)}  ${d.name}`,
        detail: d.text,
        onSelect: (a: App) => {
          addRelic(run, id);
          afterAct(a);
        },
      };
    }),
    hints: [['↑↓', 'weigh'], ['↵', 'take']],
  }));
}

function afterAct(app: App): void {
  const run = app.run;
  if (!run) return;
  app.clearPendingNode();
  const more = app.finishAct();
  if (!more) {
    app.endRun('won');
    app.reset(createGameOverView(run, 'won', gameOverActions(run)));
    return;
  }
  app.reset(createMenu({
    id: 'act-transition',
    title: app.actName(),
    subtitle: `Act ${run.act}. It gets worse from here.`,
    body: [
      `You are at ${run.hp}/${run.maxHp} HP with ${run.deck.length} cards and ${run.relics.length} relics.`,
      '',
      'The map below is new. So is everything on it.',
    ],
    items: [{ label: 'Descend', onSelect: (a) => backToMap(a) }],
    hints: [['↵', 'descend']],
  }));
}

function onCombatLost(app: App): void {
  const run = app.run;
  if (!run) return;
  run.hp = 0;
  app.combat = null;
  app.endRun('lost');
  app.reset(createGameOverView(run, 'lost', gameOverActions(run)));
}

function gameOverActions(run: { seed: string; depth: number }) {
  return {
    onRetrySeed: (a: App) => startRun(a, run.seed, run.depth),
    onNewRun: (a: App) => startRun(a, randomSeed(), run.depth),
    onTitle: (a: App) => showTitle(a),
  };
}

/* ---------------------------------------------------------------- treasure -- */

function openTreasure(app: App): void {
  const run = app.run;
  if (!run) return;
  const { relic, gold } = treasureReward(run, app.rng);
  run.gold += gold;

  if (!relic) {
    app.push(createMenu({
      id: 'treasure',
      title: 'Treasure',
      body: [`An empty plinth, and ${gold} gold someone dropped running past it.`],
      items: [{ label: 'Move on', onSelect: (a) => backToMap(a) }],
    }));
    return;
  }

  const d = relicDef(relic);
  app.push(createMenu({
    id: 'treasure',
    title: 'Treasure',
    subtitle: `+${gold} gold`,
    body: [`${app.theme.icon(d.glyph)}  ${d.name}`, '', d.text],
    items: [{ label: 'Take it', onSelect: (a) => { addRelic(run, relic); backToMap(a); } }],
    hints: [['↵', 'take']],
  }));
}

/* ------------------------------------------------------------------- utils -- */

/** Runs a list of screen steps in order, each calling back when it is done. */
function runSteps(steps: readonly ((done: () => void) => void)[], finish: () => void): void {
  let i = 0;
  const next = (): void => {
    const step = steps[i++];
    if (!step) { finish(); return; }
    step(next);
  };
  next();
}
