import { Rng } from '../core/rng.js';
import { STATUSES } from '../content/statuses.js';
import { cardDef, cardName, cardVars, makeCard } from '../content/cards.js';
import { enemyDef } from '../content/enemies.js';
import { relicDef } from '../content/relics.js';
import type {
  Amount, Card, CardType, Combatant, Effect, EnemyDef, EnemyMove, Intent,
  RelicHook, StatusId, Suit,
} from '../core/types.js';
import { WILD_SUIT } from '../core/types.js';

/* ========================================================================== *
 * THE CHAIN
 *
 * One rule carries this whole game:
 *
 *   Play a card whose suit matches the previous card you played this turn and
 *   your CHAIN grows by 1. Break the match and the chain collapses. Every point
 *   of chain adds +1 to each instance of damage or block a card produces.
 *
 * That is why a 0-cost 4-damage card is a real card, why "Deal 3 damage twice"
 * outscales "Deal 7 damage" at chain 4, and why the interesting decision every
 * turn is the ORDER of your hand rather than its contents.
 * ========================================================================== */

export const MAX_CHAIN = 9;
export const BASE_ENERGY = 3;
export const BASE_HAND_SIZE = 5;
export const HAND_LIMIT = 10;

export interface EnemyState extends Combatant {
  defId: string;
  /** The move telegraphed for its next turn — the player plans against this. */
  nextMove: EnemyMove | null;
  lastMoveId: string | null;
  streak: number;
  turnsTaken: number;
}

export interface LogEntry {
  text: string;
  tone: 'player' | 'enemy' | 'system' | 'good' | 'bad';
}

export interface CombatState {
  player: Combatant;
  enemies: EnemyState[];

  draw: Card[];
  hand: Card[];
  discard: Card[];
  exhaust: Card[];

  energy: number;
  energyPerTurn: number;
  handSize: number;

  chain: number;
  lastSuit: Suit | null;
  maxChainThisCombat: number;

  turn: number;
  cardsPlayedThisTurn: number;
  suitPlays: Record<string, number>;
  typePlays: Record<string, number>;
  /** Stack of cards played this turn, newest last. Drives `replay-last`. */
  playedThisTurn: Card[];

  /** Hooks from power cards, live for this combat only. */
  powers: RelicHook[];
  relics: string[];
  /** Chain-threshold hooks already fired this turn, keyed `hookIndex@chain`. */
  firedChainHooks: Set<string>;

  /**
   * Whose turn it is. The enemy phase is resolved one enemy at a time so the
   * interface can put a beat between each action — resolving a whole round in
   * a single frame means the player never sees what hit them.
   */
  phase: 'player' | 'enemy';
  /** Enemy ids still to act this round. */
  pendingEnemies: string[];

  log: LogEntry[];
  over: 'win' | 'lose' | null;
  /** Rewards context. */
  tier: 'normal' | 'elite' | 'boss';
  encounterName: string;

  rng: Rng;
  /** Purely cosmetic: what the renderer should flash this frame. */
  fx: {
    shake: number;
    hitEnemy: Record<string, number>;
    hitPlayer: number;
    chainPulse: number;
    /** Damage from the most recent hit on the player, for the floating number. */
    lastHit: number;
    /** Enemy currently acting, highlighted during the enemy phase. */
    actor: string | null;
  };
}

/* -------------------------------------------------------------- utilities -- */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function amt(a: Amount | undefined, vars: Record<string, number>, fallback = 0): number {
  if (a === undefined) return fallback;
  if (typeof a === 'number') return a;
  return vars[a] ?? fallback;
}

export function statusOf(c: Combatant, id: StatusId): number {
  return c.statuses[id] ?? 0;
}

function addStatus(c: Combatant, id: StatusId, n: number): void {
  if (n === 0) return;
  const next = (c.statuses[id] ?? 0) + n;
  if (next <= 0) delete c.statuses[id];
  else c.statuses[id] = next;
}

export function isAlive(c: Combatant): boolean {
  return c.hp > 0;
}

export function livingEnemies(s: CombatState): EnemyState[] {
  return s.enemies.filter(isAlive);
}

function say(s: CombatState, text: string, tone: LogEntry['tone'] = 'system'): void {
  s.log.push({ text, tone });
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

/* ----------------------------------------------------------- relic lookup -- */

/**
 * A handful of relics change a *rule* rather than adding an effect, so they are
 * read directly by name at the point the rule applies. Keeping them explicit
 * here beats inventing a hook for every one-off.
 */
const RULE_RELICS = {
  /** Chain drops by 2 on a break instead of resetting to 0. */
  softBreak: 'unbroken-thread',
  /** The first card each turn never breaks the chain. */
  freeFirst: 'prism-key',
  /** Enemies start combat with Thorns. */
  thornyFoes: 'glass-heart',
  /** First attack each turn deals +3. */
  firstAttackBonus: 'whetted-thumb',
} as const;

function has(s: CombatState, relicId: string): boolean {
  return s.relics.includes(relicId);
}

function statTotals(relics: readonly string[]): {
  energy: number; handSize: number; maxHp: number; startChain: number;
} {
  const t = { energy: 0, handSize: 0, maxHp: 0, startChain: 0 };
  for (const id of relics) {
    for (const h of relicDef(id).hooks) {
      if (h.on !== 'stat') continue;
      t.energy += h.energy ?? 0;
      t.handSize += h.handSize ?? 0;
      t.maxHp += h.maxHp ?? 0;
      t.startChain += h.startChain ?? 0;
    }
  }
  return t;
}

/** Max-HP modifiers from relics, needed by the run layer before combat starts. */
export function relicMaxHpBonus(relics: readonly string[]): number {
  return statTotals(relics).maxHp;
}

function activeHooks(s: CombatState): RelicHook[] {
  const out: RelicHook[] = [];
  for (const id of s.relics) out.push(...relicDef(id).hooks);
  out.push(...s.powers);
  return out;
}

/* ------------------------------------------------------------ combat start -- */

export interface StartCombatOptions {
  deck: readonly Card[];
  hp: number;
  maxHp: number;
  relics: readonly string[];
  enemyIds: readonly string[];
  tier: 'normal' | 'elite' | 'boss';
  encounterName: string;
  seed: string;
  /** Scales enemy HP; used by the ascension-style difficulty ladder. */
  hpScale?: number;
}

export function startCombat(o: StartCombatOptions): CombatState {
  const rng = new Rng(o.seed);
  const stats = statTotals(o.relics);

  const enemies: EnemyState[] = o.enemyIds.map((id, i) => {
    const d = enemyDef(id);
    const base = rng.int(d.hp[0], d.hp[1]);
    const hp = Math.max(1, Math.round(base * (o.hpScale ?? 1)));
    const st: EnemyState = {
      id: `${id}#${i}`, defId: id, name: d.name,
      hp, maxHp: hp, block: 0, statuses: {},
      nextMove: null, lastMoveId: null, streak: 0, turnsTaken: 0,
    };
    for (const op of d.opener ?? []) addStatus(st, op.status, op.amount);
    return st;
  });

  const s: CombatState = {
    player: { id: 'player', name: 'Archivist', hp: o.hp, maxHp: o.maxHp, block: 0, statuses: {} },
    enemies,
    draw: rng.shuffle(o.deck.map((c) => ({ ...c }))),
    hand: [], discard: [], exhaust: [],
    energy: 0,
    energyPerTurn: BASE_ENERGY + stats.energy,
    handSize: clamp(BASE_HAND_SIZE + stats.handSize, 2, HAND_LIMIT),
    chain: 0, lastSuit: null, maxChainThisCombat: 0,
    turn: 0, cardsPlayedThisTurn: 0,
    suitPlays: {}, typePlays: {}, playedThisTurn: [],
    powers: [], relics: [...o.relics], firedChainHooks: new Set(),
    phase: 'player', pendingEnemies: [],
    log: [], over: null,
    tier: o.tier, encounterName: o.encounterName,
    rng,
    fx: { shake: 0, hitEnemy: {}, hitPlayer: 0, chainPulse: 0, lastHit: 0, actor: null },
  };

  if (has(s, RULE_RELICS.thornyFoes)) {
    for (const en of s.enemies) addStatus(en, 'thorns', 4);
  }

  say(s, `— ${o.encounterName} —`, 'system');

  // Innate cards are pulled to the front of the draw pile so the opening hand
  // is the one the deck was built to have.
  const innate = s.draw.filter((c) => cardDef(c.defId).innate);
  if (innate.length > 0) {
    s.draw = [...innate, ...s.draw.filter((c) => !innate.includes(c))];
  }

  runHooks(s, (h) => (h.on === 'combat-start' ? h.effects : null), null);
  beginTurn(s);
  // Telegraph immediately: an intent the player cannot see on turn one is a
  // turn they cannot plan, and forgetting to call this separately was a real
  // footgun for anything driving the engine directly.
  telegraphAll(s);
  return s;
}

/* -------------------------------------------------------------- turn cycle -- */

export function beginTurn(s: CombatState): void {
  if (s.over) return;
  s.turn++;
  s.energy = s.energyPerTurn;
  s.cardsPlayedThisTurn = 0;
  s.suitPlays = {};
  s.typePlays = {};
  s.playedThisTurn = [];
  s.firedChainHooks = new Set();

  if (statusOf(s.player, 'anchor') === 0) s.player.block = 0;

  const stats = statTotals(s.relics);
  s.chain = clamp(stats.startChain + statusOf(s.player, 'resolve'), 0, MAX_CHAIN);
  s.lastSuit = null;
  if (s.chain > 0) s.maxChainThisCombat = Math.max(s.maxChainThisCombat, s.chain);

  drawCards(s, s.handSize);
  runHooks(s, (h) => (h.on === 'turn-start' ? h.effects : null), null);

  // Innate cards fire for free the moment they arrive.
  for (const card of [...s.hand]) {
    if (!cardDef(card.defId).innate) continue;
    const idx = s.hand.indexOf(card);
    if (idx >= 0) playCard(s, idx, 0, { free: true });
  }
}

/**
 * Ends the player's turn and hands over to the enemies.
 *
 * Resolves everything that belongs to the player's own end of turn, then queues
 * the enemies rather than running them. Call `stepEnemyPhase` until it returns
 * false to finish the round — or `endTurn`, which does exactly that in one go.
 */
export function beginEnemyPhase(s: CombatState): void {
  if (s.over || s.phase === 'enemy') return;

  // Ethereal cards resolve from hand; curses bite.
  for (const card of [...s.hand]) {
    const d = cardDef(card.defId);
    if (card.defId === 'doubt') {
      const n = cardVars(card).hp ?? 2;
      damagePlayer(s, n, { ignoreBlock: true, source: 'Doubt' });
    }
    if (d.ethereal) {
      resolveEffects(s, d.effects, { vars: cardVars(card), targetIndex: 0, fromCard: true });
      moveToDiscard(s, card, d.exhaust === true);
    }
  }

  runHooks(s, (h) => (h.on === 'turn-end' ? h.effects : null), null);

  // Discard the hand (cards flagged `ethereal` already left).
  for (const card of [...s.hand]) moveToDiscard(s, card, false);
  s.hand = [];

  tickStatuses(s, s.player, 'player');
  if (checkOver(s)) return;

  s.phase = 'enemy';
  s.pendingEnemies = livingEnemies(s).map((e) => e.id);
  say(s, '— their turn —', 'system');
}

/**
 * Resolves one enemy's action, or finishes the round when none are left.
 * Returns true while the enemy phase is still running.
 */
export function stepEnemyPhase(s: CombatState): boolean {
  if (s.over) { s.phase = 'player'; s.pendingEnemies = []; s.fx.actor = null; return false; }
  if (s.phase !== 'enemy') return false;

  const id = s.pendingEnemies.shift();
  if (id !== undefined) {
    const enemy = s.enemies.find((e) => e.id === id);
    if (enemy && isAlive(enemy)) {
      s.fx.actor = enemy.id;
      takeEnemyTurn(s, enemy);
    }
    if (checkOver(s)) { s.phase = 'player'; s.pendingEnemies = []; s.fx.actor = null; return false; }
    return true;
  }

  // End of the round: statuses tick, block resets, next intents are telegraphed.
  s.fx.actor = null;
  for (const en of livingEnemies(s)) {
    tickStatuses(s, en, 'enemy');
    en.block = 0;
    telegraph(s, en);
  }
  if (checkOver(s)) { s.phase = 'player'; return false; }
  s.phase = 'player';
  beginTurn(s);
  return false;
}

/** The whole round at once. Used by tests and the autoplayer. */
export function endTurn(s: CombatState): void {
  if (s.over) return;
  beginEnemyPhase(s);
  let guard = 0;
  while (stepEnemyPhase(s) && guard++ < 64) { /* resolve every enemy */ }
}

function tickStatuses(s: CombatState, c: Combatant, side: 'player' | 'enemy'): void {
  const burn = statusOf(c, 'burn');
  if (burn > 0) {
    if (side === 'player') damagePlayer(s, burn, { ignoreBlock: true, source: 'Burn' });
    else damageEnemyDirect(s, c as EnemyState, burn, true, 'Burn');
  }
  const regen = statusOf(c, 'regen');
  if (regen > 0) {
    c.hp = Math.min(c.maxHp, c.hp + regen);
    say(s, `${c.name} regenerates ${regen}.`, 'good');
  }
  for (const [id, value] of Object.entries(c.statuses)) {
    const def = STATUSES[id as StatusId];
    if (!def) continue;
    if (def.decay === 'none') continue;
    const next = value - 1;
    if (next <= 0) delete c.statuses[id];
    else c.statuses[id] = next;
  }
}

/* --------------------------------------------------------------- card flow -- */

export function drawCards(s: CombatState, n: number): number {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (s.hand.length >= HAND_LIMIT) break;
    if (s.draw.length === 0) {
      if (s.discard.length === 0) break;
      s.draw = s.rng.shuffle(s.discard.splice(0));
      say(s, 'Reshuffled the discard pile.', 'system');
    }
    const card = s.draw.shift();
    if (!card) break;
    s.hand.push(card);
    drawn++;
    // Slag is a curse whose whole job is to arrive at the wrong moment.
    if (card.defId === 'slag') {
      breakChain(s, true);
      say(s, 'Slag clatters into your hand — the chain snaps.', 'bad');
    }
  }
  return drawn;
}

function moveToDiscard(s: CombatState, card: Card, exhaust: boolean): void {
  const i = s.hand.indexOf(card);
  if (i >= 0) s.hand.splice(i, 1);
  if (card.temporary) return;
  (exhaust ? s.exhaust : s.discard).push(card);
}

/* ------------------------------------------------------------------ chain -- */

function breakChain(s: CombatState, force = false): void {
  if (!force && has(s, RULE_RELICS.softBreak)) {
    s.chain = Math.max(0, s.chain - 2);
    return;
  }
  s.chain = 0;
}

/** Applies the chain rule for a card about to be played. Returns the chain
 *  value the card will resolve with. */
function advanceChain(s: CombatState, suit: Suit): number {
  const wild = suit === WILD_SUIT || s.lastSuit === WILD_SUIT;
  const first = s.cardsPlayedThisTurn === 0;
  const exempt = first && has(s, RULE_RELICS.freeFirst);

  if (s.lastSuit === null) {
    // Opening a turn does not grow the chain, but it does not break it either:
    // Resolve and relics can seed a chain, and the first card keeps it.
    if (!exempt && !wild) { /* chain kept as seeded */ }
  } else if (wild || suit === s.lastSuit) {
    s.chain = clamp(s.chain + 1, 0, MAX_CHAIN);
    s.fx.chainPulse = 1;
  } else if (!exempt) {
    breakChain(s);
  }

  s.lastSuit = suit === WILD_SUIT ? (s.lastSuit ?? WILD_SUIT) : suit;
  s.maxChainThisCombat = Math.max(s.maxChainThisCombat, s.chain);
  fireChainHooks(s);
  return s.chain;
}

function fireChainHooks(s: CombatState): void {
  const hooks = activeHooks(s);
  hooks.forEach((h, i) => {
    if (h.on !== 'chain-reached') return;
    if (s.chain < h.chain) return;
    const key = `${i}@${h.chain}`;
    if (s.firedChainHooks.has(key)) return;
    s.firedChainHooks.add(key);
    resolveEffects(s, h.effects, { vars: {}, targetIndex: randomEnemyIndex(s), fromCard: false });
  });
}

/* ------------------------------------------------------------- playability -- */

export interface Playability {
  ok: boolean;
  reason?: string;
  cost: number;
}

export function cardCost(s: CombatState, card: Card): number {
  return cardDef(card.defId).cost;
}

export function canPlay(s: CombatState, handIndex: number): Playability {
  const card = s.hand[handIndex];
  if (!card) return { ok: false, reason: 'No such card.', cost: 0 };
  const d = cardDef(card.defId);
  const cost = cardCost(s, card);
  if (d.unplayable) return { ok: false, reason: `${d.name} cannot be played.`, cost };
  if (cost > s.energy) return { ok: false, reason: `Needs ${cost} energy.`, cost };
  if (d.target === 'enemy' && livingEnemies(s).length === 0) {
    return { ok: false, reason: 'No target.', cost };
  }
  return { ok: true, cost };
}

/** Does this card need the player to pick an enemy? */
export function needsTarget(card: Card): boolean {
  return cardDef(card.defId).target === 'enemy';
}

/* -------------------------------------------------------------- play a card -- */

export function playCard(
  s: CombatState,
  handIndex: number,
  targetIndex: number,
  opts: { free?: boolean } = {},
): boolean {
  if (s.over) return false;
  const card = s.hand[handIndex];
  if (!card) return false;
  const check = canPlay(s, handIndex);
  if (!check.ok && !opts.free) return false;

  const d = cardDef(card.defId);
  if (!opts.free) s.energy -= check.cost;

  s.hand.splice(handIndex, 1);
  const chainBefore = s.chain;
  advanceChain(s, d.suit);

  s.cardsPlayedThisTurn++;
  s.suitPlays[d.suit] = (s.suitPlays[d.suit] ?? 0) + 1;
  s.typePlays[d.type] = (s.typePlays[d.type] ?? 0) + 1;
  s.playedThisTurn.push(card);

  // Spelling out what happened to the chain is the cheapest tutorial there is.
  const chainNote =
    s.chain > chainBefore ? `  chain ${s.chain}`
    : chainBefore > 0 && s.chain < chainBefore ? '  chain broken'
    : s.chain > 0 ? `  chain ${s.chain}` : '';
  say(s, `You play ${cardName(card)}.${chainNote}`, 'player');

  resolveCardBody(s, card, targetIndex);
  fireCardPlayedHooks(s, d.suit, d.type, targetIndex);

  if (!card.temporary) (d.exhaust ? s.exhaust : s.discard).push(card);
  if (d.endsTurn) { checkOver(s); if (!s.over) endTurn(s); return true; }
  checkOver(s);
  return true;
}

function resolveCardBody(s: CombatState, card: Card, targetIndex: number, depth = 0): void {
  const d = cardDef(card.defId);
  const vars = cardVars(card);
  if (d.power) s.powers.push(...d.power);
  resolveEffects(s, d.effects, { vars, targetIndex, fromCard: true, cardType: d.type, depth });
}

function fireCardPlayedHooks(s: CombatState, suit: Suit, type: CardType, targetIndex: number): void {
  for (const h of activeHooks(s)) {
    if (h.on !== 'card-played') continue;
    if (h.suit && h.suit !== suit) continue;
    if (h.type && h.type !== type) continue;
    if (h.nth !== undefined) {
      const count = h.suit ? (s.suitPlays[h.suit] ?? 0)
        : h.type ? (s.typePlays[h.type] ?? 0)
        : s.cardsPlayedThisTurn;
      if (h.nth === 1 ? count !== 1 : count % h.nth !== 0) continue;
    }
    resolveEffects(s, h.effects, { vars: {}, targetIndex, fromCard: false });
  }
}

/* ---------------------------------------------------------------- effects -- */

interface Ctx {
  vars: Record<string, number>;
  targetIndex: number;
  /** Card effects get the chain bonus; relic and power procs do not. */
  fromCard: boolean;
  cardType?: CardType;
  /** How deep a replay chain we are in; see `replay-last`. */
  depth?: number;
}

/** Hard ceiling on nested replays, so no content bug can hang a turn. */
const MAX_REPLAY_DEPTH = 4;

/** True when a card's own effects can replay another card. */
function isReplayCard(defId: string): boolean {
  return cardDef(defId).effects.some((fx) => fx.kind === 'replay-last');
}

export function resolveEffects(s: CombatState, effects: readonly Effect[], ctx: Ctx): void {
  for (const fx of effects) resolveEffect(s, fx, ctx);
}

function resolveEffect(s: CombatState, fx: Effect, ctx: Ctx): void {
  const v = ctx.vars;
  const chainBonus = ctx.fromCard ? s.chain : 0;

  switch (fx.kind) {
    case 'damage': {
      const hits = Math.max(1, amt(fx.hits, v, 1));
      const base = amt(fx.amount, v);
      const target = resolveTarget(s, ctx.targetIndex);
      for (let i = 0; i < hits; i++) {
        if (!target || !isAlive(target)) break;
        dealPlayerDamage(s, target, base + chainBonus, {
          ignoreBlock: fx.ignoreBlock === true,
          isAttack: true,
          firstAttack: ctx.fromCard && (s.typePlays['attack'] ?? 0) === 1 && i === 0,
        });
      }
      break;
    }
    case 'damage-all': {
      const hits = Math.max(1, amt(fx.hits, v, 1));
      const base = amt(fx.amount, v);
      for (let i = 0; i < hits; i++) {
        for (const en of livingEnemies(s)) {
          dealPlayerDamage(s, en, base + chainBonus, { isAttack: true });
        }
      }
      break;
    }
    case 'damage-per-chain': {
      const target = resolveTarget(s, ctx.targetIndex);
      if (target) dealPlayerDamage(s, target, amt(fx.amount, v) * s.chain, { isAttack: true });
      break;
    }
    case 'damage-per-card': {
      const target = resolveTarget(s, ctx.targetIndex);
      const n = Math.max(0, s.cardsPlayedThisTurn - 1);
      if (target) dealPlayerDamage(s, target, amt(fx.amount, v) * n + chainBonus, { isAttack: true });
      break;
    }
    case 'damage-from-block': {
      const target = resolveTarget(s, ctx.targetIndex);
      const scale = amt(fx.scale, v, 1);
      if (target) dealPlayerDamage(s, target, Math.floor(s.player.block * scale) + chainBonus, { isAttack: true });
      break;
    }
    case 'block': {
      gainBlock(s, amt(fx.amount, v) + chainBonus);
      break;
    }
    case 'block-per-chain': {
      gainBlock(s, amt(fx.amount, v) * s.chain);
      break;
    }
    case 'block-per-block': {
      gainBlock(s, Math.floor(s.player.block * amt(fx.amount, v)));
      break;
    }
    case 'double-block': {
      const gain = s.player.block;
      if (gain > 0) { s.player.block += gain; say(s, `Block doubled to ${s.player.block}.`, 'good'); }
      break;
    }
    case 'heal': {
      const n = amt(fx.amount, v);
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + n);
      say(s, `You heal ${n}.`, 'good');
      break;
    }
    case 'lose-hp': {
      damagePlayer(s, amt(fx.amount, v), { ignoreBlock: true, source: 'the cost' });
      break;
    }
    case 'draw': {
      const n = drawCards(s, amt(fx.amount, v));
      if (n > 0) say(s, `You draw ${n}.`, 'player');
      break;
    }
    case 'energy': {
      s.energy += amt(fx.amount, v);
      break;
    }
    case 'chain': {
      s.chain = clamp(s.chain + amt(fx.amount, v), 0, MAX_CHAIN);
      s.maxChainThisCombat = Math.max(s.maxChainThisCombat, s.chain);
      s.fx.chainPulse = 1;
      fireChainHooks(s);
      break;
    }
    case 'status': {
      const n = amt(fx.amount, v);
      if (fx.who === 'self') {
        addStatus(s.player, fx.status, n);
      } else if (fx.who === 'all-enemies') {
        for (const en of livingEnemies(s)) addStatus(en, fx.status, n);
      } else {
        const target = resolveTarget(s, ctx.targetIndex);
        if (target) addStatus(target, fx.status, n);
      }
      break;
    }
    case 'discard': {
      const n = amt(fx.amount, v);
      for (let i = 0; i < n && s.hand.length > 0; i++) {
        const idx = fx.random ? s.rng.int(0, s.hand.length - 1) : s.hand.length - 1;
        const card = s.hand[idx]!;
        const d = cardDef(card.defId);
        s.hand.splice(idx, 1);
        if (d.onDiscard) resolveEffects(s, d.onDiscard, { vars: cardVars(card), targetIndex: ctx.targetIndex, fromCard: true });
        if (!card.temporary) s.discard.push(card);
      }
      break;
    }
    case 'discard-hand-draw': {
      const n = s.hand.length;
      for (const card of [...s.hand]) {
        const d = cardDef(card.defId);
        if (d.onDiscard) resolveEffects(s, d.onDiscard, { vars: cardVars(card), targetIndex: ctx.targetIndex, fromCard: true });
      }
      for (const card of [...s.hand]) moveToDiscard(s, card, false);
      s.hand = [];
      drawCards(s, n + amt(fx.bonus, v));
      break;
    }
    case 'exhaust-hand': {
      for (const card of [...s.hand]) moveToDiscard(s, card, true);
      s.hand = [];
      break;
    }
    case 'shuffle-discard-into-draw': {
      s.draw = s.rng.shuffle([...s.draw, ...s.discard.splice(0)]);
      break;
    }
    case 'add-card': {
      const count = amt(fx.count, v, 1);
      for (let i = 0; i < count; i++) {
        const card = makeCard(fx.defId, fx.upgraded ? 1 : 0);
        if (fx.to === 'hand') { if (s.hand.length < HAND_LIMIT) s.hand.push(card); else s.discard.push(card); }
        else if (fx.to === 'draw') s.draw.splice(s.rng.int(0, s.draw.length), 0, card);
        else s.discard.push(card);
      }
      break;
    }
    case 'replay-last': {
      const depth = ctx.depth ?? 0;
      if (depth >= MAX_REPLAY_DEPTH) break;
      const count = amt(fx.amount, v, 1);
      // Walk back past the card that triggered this, and past any other replay
      // card: an Echo that copies an Echo would otherwise recurse forever.
      let last: Card | undefined;
      for (let i = s.playedThisTurn.length - 2; i >= 0; i--) {
        const candidate = s.playedThisTurn[i]!;
        if (isReplayCard(candidate.defId)) continue;
        last = candidate;
        break;
      }
      if (!last) { say(s, 'Nothing to echo.', 'system'); break; }
      for (let i = 0; i < count; i++) {
        resolveCardBody(s, last, ctx.targetIndex, depth + 1);
      }
      say(s, `Echo: ${cardName(last)}.`, 'player');
      break;
    }
    case 'if-chain-at-least': {
      if (s.chain >= fx.chain) resolveEffects(s, fx.then, ctx);
      else if (fx.else) resolveEffects(s, fx.else, ctx);
      break;
    }
  }
}

function resolveTarget(s: CombatState, index: number): EnemyState | null {
  const alive = livingEnemies(s);
  if (alive.length === 0) return null;
  const direct = s.enemies[index];
  if (direct && isAlive(direct)) return direct;
  return alive[0] ?? null;
}

function randomEnemyIndex(s: CombatState): number {
  const alive = livingEnemies(s);
  if (alive.length === 0) return 0;
  return s.enemies.indexOf(s.rng.pick(alive));
}

/* ----------------------------------------------------------------- damage -- */

function gainBlock(s: CombatState, base: number): void {
  if (base <= 0) return;
  let n = base + statusOf(s.player, 'guard');
  if (statusOf(s.player, 'frail') > 0) n = Math.floor(n * 0.75);
  n = Math.max(0, n);
  s.player.block += n;
}

function dealPlayerDamage(
  s: CombatState,
  target: EnemyState,
  base: number,
  o: { ignoreBlock?: boolean; isAttack?: boolean; firstAttack?: boolean } = {},
): void {
  let n = base;
  if (o.isAttack) {
    n += statusOf(s.player, 'strength');
    if (o.firstAttack && has(s, RULE_RELICS.firstAttackBonus)) n += 3;
    if (statusOf(s.player, 'weak') > 0) n = Math.floor(n * 0.75);
  }
  if (statusOf(target, 'vulnerable') > 0) n = Math.floor(n * 1.5);
  n = Math.max(0, n);
  damageEnemyDirect(s, target, n, o.ignoreBlock === true, null);

  const thorns = statusOf(target, 'thorns');
  if (o.isAttack && thorns > 0 && n >= 0) {
    damagePlayer(s, thorns, { source: `${target.name}'s thorns` });
  }
}

function damageEnemyDirect(
  s: CombatState, target: Combatant, n: number, ignoreBlock: boolean, source: string | null,
): void {
  let remaining = n;
  if (!ignoreBlock && target.block > 0) {
    const absorbed = Math.min(target.block, remaining);
    target.block -= absorbed;
    remaining -= absorbed;
  }
  target.hp = Math.max(0, target.hp - remaining);
  s.fx.hitEnemy[target.id] = 1;
  if (source) say(s, `${target.name} takes ${remaining} from ${source}.`, 'player');
  if (target.hp === 0) say(s, `${target.name} falls.`, 'good');
}

export function damagePlayer(
  s: CombatState, n: number, o: { ignoreBlock?: boolean; source?: string } = {},
): void {
  let remaining = Math.max(0, n);
  if (!o.ignoreBlock && s.player.block > 0) {
    const absorbed = Math.min(s.player.block, remaining);
    s.player.block -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    s.player.hp = Math.max(0, s.player.hp - remaining);
    s.fx.hitPlayer = 8;
    s.fx.lastHit = remaining;
    s.fx.shake = Math.min(3, 1 + Math.floor(remaining / 12));
    say(s, `You take ${remaining}${o.source ? ` from ${o.source}` : ''}.`, 'bad');
  } else if (n > 0) {
    say(s, `Blocked ${n}${o.source ? ` from ${o.source}` : ''}.`, 'good');
  }
}

/* ------------------------------------------------------------- enemy brain -- */

/**
 * Enemy AI. Deliberately legible: the player sees the telegraphed intent and
 * the constraints (`maxStreak`, `fromTurn`, `everyTurn`, `belowHp`) are the
 * only hidden state. Legible AI is what makes planning feel fair.
 */
export function pickEnemyMove(s: CombatState, en: EnemyState): EnemyMove {
  const d = enemyDef(en.defId);
  const turn = en.turnsTaken + 1;
  const hpFrac = en.hp / en.maxHp;

  const eligible = d.moves.filter((m) => {
    if (m.fromTurn && turn < m.fromTurn) return false;
    if (m.everyTurn && turn % m.everyTurn !== 0) return false;
    if (m.belowHp !== undefined && hpFrac > m.belowHp) return false;
    if (m.maxStreak && en.lastMoveId === m.id && en.streak >= m.maxStreak) return false;
    return true;
  });

  const pool = eligible.length > 0 ? eligible : d.moves.filter((m) => !m.fromTurn && !m.belowHp);
  const finalPool = pool.length > 0 ? pool : d.moves;
  return s.rng.weighted(finalPool.map((m) => [m, m.weight] as const));
}

function telegraph(s: CombatState, en: EnemyState): void {
  en.nextMove = pickEnemyMove(s, en);
}

function takeEnemyTurn(s: CombatState, en: EnemyState): void {
  if (statusOf(en, 'stun') > 0) {
    say(s, `${en.name} is stunned.`, 'good');
    return;
  }
  const move = en.nextMove ?? pickEnemyMove(s, en);
  en.streak = en.lastMoveId === move.id ? en.streak + 1 : 1;
  en.lastMoveId = move.id;
  en.turnsTaken++;
  en.nextMove = null;

  say(s, `${en.name} uses ${move.id.replace(/-/g, ' ')}.`, 'enemy');
  runEnemyEffects(s, en, move.effects);
}

function runEnemyEffects(s: CombatState, en: EnemyState, effects: readonly Effect[]): void {
  for (const fx of effects) {
    switch (fx.kind) {
      case 'damage': {
        const hits = Math.max(1, amt(fx.hits, {}, 1));
        for (let i = 0; i < hits; i++) {
          if (!isAlive(en)) break;
          let n = amt(fx.amount, {}) + statusOf(en, 'strength');
          if (statusOf(en, 'weak') > 0) n = Math.floor(n * 0.75);
          if (statusOf(s.player, 'vulnerable') > 0) n = Math.floor(n * 1.5);
          damagePlayer(s, n, { source: en.name });
          const thorns = statusOf(s.player, 'thorns');
          if (thorns > 0) damageEnemyDirect(s, en, thorns, false, 'your thorns');
        }
        break;
      }
      case 'block': {
        en.block += Math.max(0, amt(fx.amount, {}));
        break;
      }
      case 'heal': {
        en.hp = Math.min(en.maxHp, en.hp + amt(fx.amount, {}));
        break;
      }
      case 'status': {
        const n = amt(fx.amount, {});
        if (fx.who === 'self') addStatus(en, fx.status, n);
        else if (fx.who === 'all-enemies') for (const o of livingEnemies(s)) addStatus(o, fx.status, n);
        else addStatus(s.player, fx.status, n);
        break;
      }
      case 'discard': {
        const n = amt(fx.amount, {});
        for (let i = 0; i < n && s.hand.length > 0; i++) {
          const idx = s.rng.int(0, s.hand.length - 1);
          const card = s.hand.splice(idx, 1)[0]!;
          if (!card.temporary) s.discard.push(card);
        }
        break;
      }
      case 'add-card': {
        const count = amt(fx.count, {}, 1);
        for (let i = 0; i < count; i++) {
          const card = makeCard(fx.defId);
          if (fx.to === 'draw') s.draw.splice(s.rng.int(0, s.draw.length), 0, card);
          else if (fx.to === 'hand' && s.hand.length < HAND_LIMIT) s.hand.push(card);
          else s.discard.push(card);
        }
        break;
      }
      default:
        // Enemies only use the subset above; anything else is a content bug.
        break;
    }
  }
}

/* ------------------------------------------------------------------ intent -- */

/** The intent as the player should see it, with strength and weak folded in. */
export function displayIntent(s: CombatState, en: EnemyState): Intent | null {
  const move = en.nextMove;
  if (!move) return null;
  if (statusOf(en, 'stun') > 0) return { kind: 'stun', note: 'stunned' };
  const i = move.intent;
  if (i.damage === undefined) return i;
  let dmg = i.damage + statusOf(en, 'strength');
  if (statusOf(en, 'weak') > 0) dmg = Math.floor(dmg * 0.75);
  if (statusOf(s.player, 'vulnerable') > 0) dmg = Math.floor(dmg * 1.5);
  return { ...i, damage: Math.max(0, dmg) };
}

/** Total damage the player is about to eat if they do nothing. */
export function incomingDamage(s: CombatState): number {
  let total = 0;
  for (const en of livingEnemies(s)) {
    const i = displayIntent(s, en);
    if (!i || i.damage === undefined) continue;
    total += i.damage * (i.hits ?? 1);
  }
  return total;
}

/* ------------------------------------------------------------------- hooks -- */

function runHooks(
  s: CombatState,
  select: (h: RelicHook) => readonly Effect[] | null,
  targetIndex: number | null,
): void {
  for (const h of activeHooks(s)) {
    const effects = select(h);
    if (!effects) continue;
    resolveEffects(s, effects, {
      vars: {}, targetIndex: targetIndex ?? randomEnemyIndex(s), fromCard: false,
    });
  }
}

/* ------------------------------------------------------------------- state -- */

export function checkOver(s: CombatState): boolean {
  if (s.over) return true;
  if (s.player.hp <= 0) { s.over = 'lose'; say(s, 'You fall.', 'bad'); return true; }
  if (livingEnemies(s).length === 0) { s.over = 'win'; say(s, 'The floor is quiet.', 'good'); return true; }
  return false;
}

/** Ensures every living enemy has a visible intent. Idempotent. */
export function telegraphAll(s: CombatState): void {
  for (const en of livingEnemies(s)) if (!en.nextMove) telegraph(s, en);
}

/** Post-combat relic payouts, applied by the run layer. */
export function combatWinBonuses(relics: readonly string[]): { heal: number; gold: number } {
  let heal = 0, gold = 0;
  for (const id of relics) {
    for (const h of relicDef(id).hooks) {
      if (h.on !== 'combat-win') continue;
      heal += h.heal ?? 0;
      gold += h.gold ?? 0;
    }
  }
  return { heal, gold };
}

/* ---------------------------------------------------------------- previews -- */

export interface CardPreview {
  /** Damage of a single instance, after strength, weak, vulnerable and chain. */
  damage?: number;
  hits?: number;
  block?: number;
  /** What the chain will be once this card resolves. */
  chainAfter: number;
  /** True when playing this card would break the chain. */
  breaks: boolean;
}

/**
 * What the selected card is about to do, shown next to the target.
 *
 * The whole point of the chain is arithmetic the player performs in their head;
 * showing the result of that arithmetic is what makes the mechanic teachable
 * instead of mysterious. This is a read-only projection — it never mutates.
 */
export function previewCard(s: CombatState, handIndex: number, targetIndex: number): CardPreview | null {
  const card = s.hand[handIndex];
  if (!card) return null;
  const d = cardDef(card.defId);
  const vars = cardVars(card);

  const wild = d.suit === WILD_SUIT || s.lastSuit === WILD_SUIT;
  const first = s.cardsPlayedThisTurn === 0;
  const exempt = first && has(s, RULE_RELICS.freeFirst);

  let chainAfter = s.chain;
  let breaks = false;
  if (s.lastSuit === null) {
    // keeps whatever the turn was seeded with
  } else if (wild || d.suit === s.lastSuit) {
    chainAfter = clamp(s.chain + 1, 0, MAX_CHAIN);
  } else if (!exempt) {
    breaks = true;
    chainAfter = has(s, RULE_RELICS.softBreak) ? Math.max(0, s.chain - 2) : 0;
  }

  const target = resolveTarget(s, targetIndex);
  const out: CardPreview = { chainAfter, breaks };

  for (const fx of d.effects) {
    switch (fx.kind) {
      case 'damage':
      case 'damage-all': {
        let n = amt(fx.amount, vars) + chainAfter + statusOf(s.player, 'strength');
        if (statusOf(s.player, 'weak') > 0) n = Math.floor(n * 0.75);
        if (target && statusOf(target, 'vulnerable') > 0) n = Math.floor(n * 1.5);
        out.damage = (out.damage ?? 0) + Math.max(0, n);
        out.hits = Math.max(out.hits ?? 1, amt(fx.hits, vars, 1));
        break;
      }
      case 'damage-per-chain': {
        let n = amt(fx.amount, vars) * chainAfter + statusOf(s.player, 'strength');
        if (statusOf(s.player, 'weak') > 0) n = Math.floor(n * 0.75);
        if (target && statusOf(target, 'vulnerable') > 0) n = Math.floor(n * 1.5);
        out.damage = (out.damage ?? 0) + Math.max(0, n);
        break;
      }
      case 'damage-from-block': {
        let n = Math.floor(s.player.block * amt(fx.scale, vars, 1)) + chainAfter;
        if (statusOf(s.player, 'weak') > 0) n = Math.floor(n * 0.75);
        out.damage = (out.damage ?? 0) + Math.max(0, n);
        break;
      }
      case 'damage-per-card': {
        const n = amt(fx.amount, vars) * s.cardsPlayedThisTurn + chainAfter;
        out.damage = (out.damage ?? 0) + Math.max(0, n);
        break;
      }
      case 'block': {
        let n = amt(fx.amount, vars) + chainAfter + statusOf(s.player, 'guard');
        if (statusOf(s.player, 'frail') > 0) n = Math.floor(n * 0.75);
        out.block = (out.block ?? 0) + Math.max(0, n);
        break;
      }
      case 'block-per-chain': {
        let n = amt(fx.amount, vars) * chainAfter + statusOf(s.player, 'guard');
        if (statusOf(s.player, 'frail') > 0) n = Math.floor(n * 0.75);
        out.block = (out.block ?? 0) + Math.max(0, n);
        break;
      }
      case 'double-block':
        out.block = (out.block ?? 0) + s.player.block;
        break;
      default:
        break;
    }
  }
  return out;
}

/** Would playing this card extend the chain? Drives the card-corner marker. */
export function wouldChain(s: CombatState, card: Card): boolean {
  const d = cardDef(card.defId);
  if (s.lastSuit === null) return false;
  return d.suit === WILD_SUIT || s.lastSuit === WILD_SUIT || d.suit === s.lastSuit;
}

/** Applies a draught mid-combat. Draughts never touch the chain. */
export function useDraughtEffects(
  s: CombatState, effects: readonly Effect[], targetIndex: number,
): void {
  resolveEffects(s, effects, { vars: {}, targetIndex, fromCard: false });
  checkOver(s);
}

/* ----------------------------------------------------------------- cloning -- */

/**
 * A deep, independent copy of a combat.
 *
 * Exists so the planner can explore "what if I played these three cards in
 * this order" without touching the real fight. Everything is plain data except
 * the RNG and one Set, both of which are copied explicitly.
 */
export function cloneCombat(s: CombatState): CombatState {
  const copyCombatant = (c: Combatant): Combatant => ({ ...c, statuses: { ...c.statuses } });
  return {
    ...s,
    player: copyCombatant(s.player),
    enemies: s.enemies.map((e) => ({ ...e, statuses: { ...e.statuses } })),
    draw: s.draw.map((c) => ({ ...c })),
    hand: s.hand.map((c) => ({ ...c })),
    discard: s.discard.map((c) => ({ ...c })),
    exhaust: s.exhaust.map((c) => ({ ...c })),
    pendingEnemies: [...s.pendingEnemies],
    suitPlays: { ...s.suitPlays },
    typePlays: { ...s.typePlays },
    playedThisTurn: s.playedThisTurn.map((c) => ({ ...c })),
    powers: [...s.powers],
    relics: [...s.relics],
    firedChainHooks: new Set(s.firedChainHooks),
    log: [],
    rng: s.rng.clone(),
    fx: { shake: 0, hitEnemy: {}, hitPlayer: 0, chainPulse: 0, lastHit: 0, actor: null },
  };
}
