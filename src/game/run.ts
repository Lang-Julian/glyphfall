import { Rng } from '../core/rng.js';
import { CARDS, POOL, STARTER_DECK, canUpgrade, cardDef, makeCard } from '../content/cards.js';
import { DRAUGHTS, MAX_DRAUGHTS, draughtDef } from '../content/draughts.js';
import { EVENTS, type EventDef, type EventOutcome } from '../content/events.js';
import { RELICS, STARTER_RELIC, relicDef } from '../content/relics.js';
import { encountersFor, type EncounterDef } from '../content/enemies.js';
import { relicMaxHpBonus } from './combat.js';
import { availableNodes, generateMap, type ActMap, type MapNode } from './map.js';
import type { Card, CardRarity } from '../core/types.js';

/**
 * The run layer: everything that persists between fights.
 *
 * It owns no rendering and no input. That separation is what lets the test
 * suite play a whole run headlessly and lets a run be saved mid-combat.
 */

export const ACTS = 3;
export const SAVE_VERSION = 1;

export interface RunStats {
  floorsCleared: number;
  fightsWon: number;
  elitesKilled: number;
  bossesKilled: number;
  cardsPlayed: number;
  damageDealt: number;
  bestChain: number;
  longestChainCombat: number;
  turnsTaken: number;
  startedAt: number;
}

export interface RunState {
  version: number;
  seed: string;
  /** 0 = Descent. Each step up scales enemies and thins your margins. */
  depth: number;
  act: number;
  map: ActMap;
  hp: number;
  maxHp: number;
  gold: number;
  deck: Card[];
  relics: string[];
  draughts: string[];
  seenEvents: string[];
  /** Normal fights already won in the current act; drives encounter staging. */
  actFights: number;
  /** Avoids showing the same encounter twice in a row. */
  lastEncounter: string | null;
  /** Cost of the next card removal in a shop; it climbs as you use it. */
  removalCost: number;
  stats: RunStats;
  rngPos: number;
  outcome: 'running' | 'won' | 'lost';
  /** One-line notes shown on the run summary. */
  journal: string[];
}

export const BASE_MAX_HP = 78;

/** Clearing an act is the run's main source of durability growth. */
export const ACT_CLEAR_MAX_HP = 8;
export const ACT_CLEAR_HEAL = 0.25;

/* ------------------------------------------------------------------- setup -- */

export function newRun(seed: string, depth = 0): { run: RunState; rng: Rng } {
  const rng = new Rng(seed);
  const relics = [STARTER_RELIC];
  const maxHp = BASE_MAX_HP + relicMaxHpBonus(relics) - depth * 4;

  const run: RunState = {
    version: SAVE_VERSION,
    seed,
    depth,
    act: 1,
    map: generateMap(rng.fork('map-1'), 1),
    hp: maxHp,
    maxHp,
    gold: 99,
    deck: STARTER_DECK.map((id) => makeCard(id)),
    relics,
    draughts: [],
    seenEvents: [],
    actFights: 0,
    lastEncounter: null,
    removalCost: 70,
    stats: {
      floorsCleared: 0, fightsWon: 0, elitesKilled: 0, bossesKilled: 0,
      cardsPlayed: 0, damageDealt: 0, bestChain: 0, longestChainCombat: 0,
      turnsTaken: 0, startedAt: Date.now(),
    },
    rngPos: 0,
    outcome: 'running',
    journal: [],
  };
  return { run, rng };
}

/** Rebuilds the run's RNG at its saved position. */
export function rngFor(run: RunState): Rng {
  return new Rng(run.seed, run.rngPos);
}

export function syncRng(run: RunState, rng: Rng): void {
  run.rngPos = rng.position;
}

/* ------------------------------------------------------------------ scaling -- */

export function enemyHpScale(run: RunState): number {
  return 1 + run.depth * 0.07;
}

/* --------------------------------------------------------------- navigation -- */

export function options(run: RunState): MapNode[] {
  return availableNodes(run.map);
}

export function enterNode(run: RunState, nodeId: string): MapNode | null {
  const node = run.map.nodes[nodeId];
  if (!node) return null;
  if (!options(run).some((n) => n.id === nodeId)) return null;
  run.map.current = nodeId;
  node.visited = true;
  run.stats.floorsCleared++;
  return node;
}

/**
 * Called once the act's boss is dead. Returns false when that was the last act.
 *
 * The act-clear bonus is deliberate: enemy numbers roughly double between acts,
 * so the player needs a durability step to match, and a heal here is the one
 * place it cannot be spent on anything else.
 */
export function advanceAct(run: RunState, rng: Rng): boolean {
  if (run.act >= ACTS) { run.outcome = 'won'; return false; }
  run.maxHp += ACT_CLEAR_MAX_HP;
  run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * ACT_CLEAR_HEAL));
  // One free upgrade per act, so a deck keeps improving even on a route with
  // no rest sites to spare.
  const forgeable = upgradableCards(run);
  if (forgeable.length > 0) rng.pick(forgeable).upgrades++;
  run.act++;
  run.actFights = 0;
  run.lastEncounter = null;
  run.map = generateMap(rng.fork(`map-${run.act}`), run.act);
  return true;
}

/* ---------------------------------------------------------------- encounters -- */

/**
 * Picks the next encounter.
 *
 * Two rules, both about fairness rather than randomness: an encounter cannot
 * appear before the act has had `minFight` normal fights, and the harder
 * encounters you have just unlocked are weighted up so the act keeps climbing
 * instead of flattening out. The immediately previous encounter is skipped
 * where an alternative exists, because repeats read as a bug even when they
 * are not.
 */
export function pickEncounter(
  run: RunState, rng: Rng, tier: 'normal' | 'elite' | 'boss',
): EncounterDef {
  const pool = encountersFor(run.act, tier);
  if (tier !== 'normal') {
    const fresh = pool.filter((e) => e.id !== run.lastEncounter);
    const chosen = rng.pick(fresh.length > 0 ? fresh : pool);
    run.lastEncounter = chosen.id;
    return chosen;
  }

  const unlocked = pool.filter((e) => (e.minFight ?? 0) <= run.actFights);
  const eligible = unlocked.length > 0 ? unlocked : pool.filter((e) => (e.minFight ?? 0) === 0);
  const fresh = eligible.filter((e) => e.id !== run.lastEncounter);
  const candidates = fresh.length > 0 ? fresh : eligible;

  const chosen = rng.weighted(
    candidates.map((e) => [e, 1 + (e.minFight ?? 0) * 1.6] as const),
  );
  run.lastEncounter = chosen.id;
  return chosen;
}

/* ------------------------------------------------------------------- rewards -- */

export interface CombatReward {
  gold: number;
  cards: Card[];
  relic?: string;
  draught?: string;
}

const CARD_WEIGHTS: Record<'normal' | 'elite' | 'boss', readonly (readonly [CardRarity, number])[]> = {
  normal: [['common', 62], ['uncommon', 31], ['rare', 7]],
  elite: [['common', 45], ['uncommon', 40], ['rare', 15]],
  boss: [['common', 20], ['uncommon', 45], ['rare', 35]],
};

export function rollCardChoices(rng: Rng, tier: 'normal' | 'elite' | 'boss', n = 3): Card[] {
  const chosen: Card[] = [];
  const usedDefs = new Set<string>();
  let guard = 0;
  while (chosen.length < n && guard++ < 100) {
    const rarity = rng.weighted(CARD_WEIGHTS[tier]);
    const candidates = POOL.filter((c) => c.rarity === rarity && !usedDefs.has(c.id));
    if (candidates.length === 0) continue;
    const def = rng.pick(candidates);
    usedDefs.add(def.id);
    chosen.push(makeCard(def.id, rng.chance(0.18) ? 1 : 0));
  }
  return chosen;
}

export function rollRelic(
  run: RunState, rng: Rng, rarity: 'common' | 'uncommon' | 'rare' | 'boss' | 'shop',
): string | undefined {
  const owned = new Set(run.relics);
  const pool = RELICS.filter((r) => r.rarity === rarity && !owned.has(r.id));
  if (pool.length === 0) {
    const any = RELICS.filter((r) => !owned.has(r.id) && r.rarity !== 'boss');
    return any.length > 0 ? rng.pick(any).id : undefined;
  }
  return rng.pick(pool).id;
}

export function combatRewards(
  run: RunState, rng: Rng, tier: 'normal' | 'elite' | 'boss',
): CombatReward {
  const actBonus = (run.act - 1) * 6;
  const gold =
    tier === 'boss' ? rng.int(90, 115) + actBonus
    : tier === 'elite' ? rng.int(48, 68) + actBonus
    : rng.int(22, 36) + actBonus;

  const reward: CombatReward = { gold, cards: rollCardChoices(rng, tier) };
  if (tier === 'elite') reward.relic = rollRelic(run, rng, rng.weighted([['uncommon', 60], ['rare', 40]] as const));
  if (tier === 'normal' && rng.chance(0.28)) reward.draught = rng.pick(DRAUGHTS).id;
  if (tier === 'elite' && rng.chance(0.5)) reward.draught = rng.pick(DRAUGHTS).id;
  return reward;
}

/** Treasure nodes: one relic, weighted toward the middle of the curve. */
export function treasureReward(run: RunState, rng: Rng): { relic?: string; gold: number } {
  const rarity = rng.weighted([['common', 45], ['uncommon', 40], ['rare', 15]] as const);
  return { relic: rollRelic(run, rng, rarity), gold: rng.int(20, 45) };
}

export function bossRelicChoices(run: RunState, rng: Rng, n = 3): string[] {
  const owned = new Set(run.relics);
  const pool = RELICS.filter((r) => r.rarity === 'boss' && !owned.has(r.id));
  const picks = rng.sample(pool, n).map((r) => r.id);
  while (picks.length < n) {
    const extra = rollRelic(run, rng, 'rare');
    if (!extra || picks.includes(extra)) break;
    picks.push(extra);
  }
  return picks;
}

/* ---------------------------------------------------------------------- shop -- */

export interface ShopItem {
  kind: 'card' | 'relic' | 'draught' | 'removal';
  id: string;
  name: string;
  price: number;
  detail: string;
  card?: Card;
  sold?: boolean;
}

const CARD_PRICE: Record<string, number> = { common: 52, uncommon: 78, rare: 155, starter: 40, special: 40 };
const RELIC_PRICE: Record<string, number> = { common: 155, uncommon: 200, rare: 270, shop: 175, boss: 300 };

export function shopDiscount(run: RunState): number {
  let d = 0;
  for (const id of run.relics) {
    for (const h of relicDef(id).hooks) if (h.on === 'shop') d += h.discount ?? 0;
  }
  return Math.min(0.6, d);
}

export function buildShop(run: RunState, rng: Rng): ShopItem[] {
  const discount = shopDiscount(run);
  const price = (base: number) => Math.max(1, Math.round(base * (1 - discount) * rng.int(92, 110) / 100));
  const items: ShopItem[] = [];

  const cardDefs = rng.sample(POOL.filter((c) => c.rarity !== 'starter'), 5);
  for (const d of cardDefs) {
    const card = makeCard(d.id);
    items.push({
      kind: 'card', id: card.uid, name: d.name, card,
      price: price(CARD_PRICE[d.rarity] ?? 60),
      detail: `${d.suit} · ${d.type} · ${d.cost} energy`,
    });
  }

  for (let i = 0; i < 2; i++) {
    const rarity = rng.weighted([['common', 35], ['uncommon', 40], ['shop', 15], ['rare', 10]] as const);
    const relic = rollRelic(run, rng, rarity);
    if (!relic || items.some((x) => x.id === relic)) continue;
    const d = relicDef(relic);
    items.push({ kind: 'relic', id: relic, name: d.name, price: price(RELIC_PRICE[d.rarity] ?? 180), detail: d.text });
  }

  for (const d of rng.sample(DRAUGHTS, 3)) {
    items.push({ kind: 'draught', id: d.id, name: d.name, price: price(d.price), detail: d.text });
  }

  items.push({
    kind: 'removal', id: 'removal', name: 'Strike a card from your deck',
    price: Math.round(run.removalCost * (1 - discount)),
    detail: 'The cheapest way to make a deck faster is to make it smaller.',
  });

  return items;
}

/* ---------------------------------------------------------------------- rest -- */

export function restHealAmount(run: RunState): number {
  let bonus = 0;
  for (const id of run.relics) {
    for (const h of relicDef(id).hooks) if (h.on === 'rest') bonus += h.healBonus ?? 0;
  }
  if (bonus <= -1) return 0;
  return Math.max(0, Math.floor(run.maxHp * (0.3 + bonus)));
}

export function upgradableCards(run: RunState): Card[] {
  return run.deck.filter(canUpgrade);
}

/* -------------------------------------------------------------------- events -- */

export function pickEvent(run: RunState, rng: Rng): EventDef {
  const fresh = EVENTS.filter((e) => e.acts.includes(run.act) && !run.seenEvents.includes(e.id));
  const pool = fresh.length > 0 ? fresh : EVENTS.filter((e) => e.acts.includes(run.act));
  const chosen = rng.pick(pool);
  run.seenEvents.push(chosen.id);
  return chosen;
}

export interface OutcomeReport {
  lines: string[];
  /** The UI must resolve these before continuing. */
  pending: ('remove-card' | 'card-choice')[];
  cardChoices?: Card[];
}

export function applyEventOutcome(run: RunState, rng: Rng, outcome: EventOutcome): OutcomeReport {
  const report: OutcomeReport = { lines: [], pending: [] };
  applyOne(run, rng, outcome, report);
  return report;
}

function applyOne(run: RunState, rng: Rng, o: EventOutcome, report: OutcomeReport): void {
  switch (o.kind) {
    case 'combo':
      for (const sub of o.of) applyOne(run, rng, sub, report);
      break;
    case 'gold': {
      const delta = o.amount < 0 ? -Math.min(run.gold, -o.amount) : o.amount;
      run.gold += delta;
      report.lines.push(delta >= 0 ? `+${delta} gold` : `${delta} gold`);
      break;
    }
    case 'hp':
      run.hp = Math.max(1, Math.min(run.maxHp, run.hp + o.amount));
      report.lines.push(o.amount >= 0 ? `+${o.amount} HP` : `${o.amount} HP`);
      break;
    case 'maxHp':
      run.maxHp = Math.max(10, run.maxHp + o.amount);
      run.hp = Math.max(1, Math.min(run.hp, run.maxHp));
      report.lines.push(`${o.amount >= 0 ? '+' : ''}${o.amount} max HP`);
      break;
    case 'heal-percent': {
      const n = Math.floor(run.maxHp * o.percent);
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + n);
      report.lines.push(`healed ${run.hp - before} HP`);
      break;
    }
    case 'relic': {
      const id = rollRelic(run, rng, o.rarity);
      if (id) { run.relics.push(id); report.lines.push(`gained relic: ${relicDef(id).name}`); }
      else report.lines.push('no relic left to give');
      break;
    }
    case 'card': {
      report.cardChoices = rollCardChoices(rng, o.rarity === 'rare' ? 'boss' : 'elite', 3);
      report.pending.push('card-choice');
      break;
    }
    case 'curse': {
      run.deck.push(makeCard(o.defId));
      report.lines.push(`added ${cardDef(o.defId).name} to your deck`);
      break;
    }
    case 'upgrade-random': {
      const pool = upgradableCards(run);
      const picks = rng.sample(pool, o.count);
      for (const c of picks) c.upgrades++;
      report.lines.push(picks.length > 0
        ? `upgraded ${picks.map((c) => cardDef(c.defId).name).join(', ')}`
        : 'nothing left to upgrade');
      break;
    }
    case 'remove-card':
      report.pending.push('remove-card');
      break;
    case 'draught': {
      const d = rng.pick(DRAUGHTS);
      if (run.draughts.length < MAX_DRAUGHTS) { run.draughts.push(d.id); report.lines.push(`gained ${d.name}`); }
      else report.lines.push('no room for another draught');
      break;
    }
    case 'nothing':
      report.lines.push('nothing happens');
      break;
  }
}

/* ------------------------------------------------------------------ mutation -- */

export function addCard(run: RunState, card: Card): void {
  run.deck.push(card);
}

export function removeCard(run: RunState, uid: string): boolean {
  const i = run.deck.findIndex((c) => c.uid === uid);
  if (i < 0) return false;
  run.deck.splice(i, 1);
  return true;
}

export function addRelic(run: RunState, id: string): void {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  const bonus = relicDef(id).hooks.find((h) => h.on === 'stat');
  if (bonus && bonus.on === 'stat' && bonus.maxHp) {
    run.maxHp = Math.max(10, run.maxHp + bonus.maxHp);
    run.hp = Math.min(run.hp + Math.max(0, bonus.maxHp), run.maxHp);
  }
}

export function addDraught(run: RunState, id: string): boolean {
  draughtDef(id);
  if (run.draughts.length >= MAX_DRAUGHTS) return false;
  run.draughts.push(id);
  return true;
}

export function heal(run: RunState, n: number): number {
  const before = run.hp;
  run.hp = Math.min(run.maxHp, run.hp + n);
  return run.hp - before;
}

/* --------------------------------------------------------------- validation -- */

/** Fails loudly on content typos: every referenced id must exist. */
export function validateContent(): string[] {
  const problems: string[] = [];
  const cardIds = new Set(CARDS.map((c) => c.id));
  for (const c of CARDS) {
    for (const fx of c.effects) {
      if (fx.kind === 'add-card' && !cardIds.has(fx.defId)) problems.push(`${c.id} adds unknown card ${fx.defId}`);
    }
    for (const key of Object.keys(c.upgrade ?? {})) {
      if (!(key in c.vars)) problems.push(`${c.id} upgrades unknown var ${key}`);
    }
    for (const m of c.text.matchAll(/\{(\w+)\}/g)) {
      if (!(m[1]! in c.vars)) problems.push(`${c.id} text references unknown var ${m[1]}`);
    }
  }
  return problems;
}
