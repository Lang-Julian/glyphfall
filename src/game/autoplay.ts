import { Rng } from '../core/rng.js';
import { cardDef } from '../content/cards.js';
import { canUpgrade } from '../content/cards.js';
import { draughtDef, MAX_DRAUGHTS } from '../content/draughts.js';
import {
  canPlay, cloneCombat, endTurn, incomingDamage, livingEnemies, playCard,
  startCombat, telegraphAll, useDraughtEffects, type CombatState,
} from './combat.js';
import {
  addCard, addDraught, addRelic, advanceAct, applyEventOutcome, bossRelicChoices,
  buildShop, combatRewards, enemyHpScale, heal, newRun, pickEncounter, pickEvent,
  removeCard, restHealAmount, treasureReward, upgradableCards, type RunState,
} from './run.js';
import { availableNodes } from './map.js';
import { DEFAULT_CHARACTER } from '../content/characters.js';
import type { EventDef, EventOption, EventOutcome } from '../content/events.js';
import type { Card, Suit } from '../core/types.js';

/**
 * A headless player.
 *
 * This exists to answer a question no amount of design intuition can: is the
 * game actually beatable, and is it beatable *often enough*? It plays a
 * competent-but-not-brilliant game — roughly the level of someone on their
 * tenth run — so its win rate is a usable balance signal rather than a
 * theoretical maximum.
 *
 * It is also a genuine correctness harness: thousands of simulated runs
 * exercise every card, relic and enemy interaction far past what handwritten
 * tests reach.
 */

export interface SimResult {
  seed: string;
  character: string;
  depth: number;
  outcome: 'won' | 'lost';
  act: number;
  floors: number;
  fights: number;
  bestChain: number;
  deckSize: number;
  turns: number;
  hp: number;
}

export interface SimOptions {
  /** Which character to play. Defaults to the Archivist. */
  character?: string;
  /** Aborts a run that exceeds this many combat turns; catches infinite loops. */
  turnBudget?: number;
  /** Optional narration, for debugging balance without a debugger. */
  trace?: (line: string) => void;
}

export function simulateRun(seed: string, depth = 0, o: SimOptions = {}): SimResult {
  const { run, rng } = newRun(seed, depth, o.character ?? DEFAULT_CHARACTER);
  const budget = o.turnBudget ?? 4000;
  const trace = o.trace ?? (() => {});
  let turnsUsed = 0;

  outer: while (run.outcome === 'running') {
    const choices = availableNodes(run.map);
    if (choices.length === 0) break;
    const node = chooseNode(run, choices, rng);
    trace(`floor ${run.stats.floorsCleared + 1} ${node.kind} hp ${run.hp}/${run.maxHp} deck ${run.deck.length} gold ${run.gold}`);
    run.map.current = node.id;
    node.visited = true;
    run.stats.floorsCleared++;

    switch (node.kind) {
      case 'combat': case 'elite': case 'boss': {
        const tier = node.kind === 'combat' ? 'normal' : node.kind;
        const encounter = pickEncounter(run, rng, tier);
        const combat = startCombat({
          deck: run.deck, hp: run.hp, maxHp: run.maxHp, relics: run.relics,
          enemyIds: encounter.enemies, tier, encounterName: encounter.name,
          seed: `${run.seed}:${run.act}:${run.stats.floorsCleared}:${encounter.id}`,
          hpScale: enemyHpScale(run),
        });
        telegraphAll(combat);
        trace(`  ${encounter.name}: ${combat.enemies.map((e) => `${e.name} ${e.hp}`).join(', ')}`);
        turnsUsed += fight(combat, run);
        trace(`  -> ${combat.over} after ${combat.turn} turns, hp ${combat.player.hp}`);
        if (turnsUsed > budget) { run.outcome = 'lost'; break outer; }

        run.hp = combat.player.hp;
        run.stats.bestChain = Math.max(run.stats.bestChain, combat.maxChainThisCombat);
        run.stats.turnsTaken += combat.turn;

        if (combat.over === 'lose') { run.outcome = 'lost'; break outer; }
        run.stats.fightsWon++;
        if (tier === 'normal') run.actFights++;
        if (tier === 'boss') {
          const relics = bossRelicChoices(run, rng, 3);
          if (relics[0]) addRelic(run, relics[0]);
          run.gold += 100;
          // Go through the same act transition the game itself uses, so the
          // simulation can never drift from the played game.
          if (!advanceAct(run, rng)) break outer;
        } else {
          takeRewards(run, rng, tier);
        }
        break;
      }
      case 'treasure': {
        const { relic, gold } = treasureReward(run, rng);
        run.gold += gold;
        if (relic) addRelic(run, relic);
        break;
      }
      case 'rest': {
        if (run.hp < run.maxHp * 0.62 || upgradableCards(run).length === 0) {
          heal(run, restHealAmount(run));
        } else {
          const target = bestUpgradeTarget(run);
          if (target) target.upgrades++;
          else heal(run, restHealAmount(run));
        }
        break;
      }
      case 'shop': shop(run, rng); break;
      case 'event': {
        const event = pickEvent(run, rng);
        const option = chooseEventOption(run, event);
        const report = applyEventOutcome(run, rng, option.outcome);
        for (const pending of report.pending) {
          if (pending === 'remove-card') {
            const worst = worstCard(run);
            if (worst && run.deck.length > 5) removeCard(run, worst.uid);
          } else if (report.cardChoices) {
            const pick = bestCardChoice(run, report.cardChoices);
            if (pick) addCard(run, pick);
          }
        }
        break;
      }
    }
  }

  return {
    seed, depth,
    character: run.character,
    outcome: run.outcome === 'won' ? 'won' : 'lost',
    act: run.act,
    floors: run.stats.floorsCleared,
    fights: run.stats.fightsWon,
    bestChain: run.stats.bestChain,
    deckSize: run.deck.length,
    turns: run.stats.turnsTaken,
    hp: run.hp,
  };
}

/* ------------------------------------------------------------------- fight -- */

function fight(c: CombatState, run: RunState): number {
  let turns = 0;
  while (!c.over && turns < 60) {
    turns++;
    let guard = 0;
    while (!c.over && guard++ < 12) {
      const plan = planTurn(c);
      if (plan.length === 0) break;
      // Execute one step at a time: a draw can invalidate the rest of the line.
      const move = plan[0]!;
      if (!canPlay(c, move.index).ok) break;
      playCard(c, move.index, move.target);
      run.stats.cardsPlayed++;
    }
    if (c.over) break;
    // Drink when a hit would otherwise be lethal.
    if (c.player.hp - Math.max(0, incomingDamage(c) - c.player.block) <= 0 && run.draughts.length > 0) {
      const id = run.draughts.shift()!;
      const alive = livingEnemies(c);
      useDraughtEffects(c, draughtDef(id).effects, alive[0] ? c.enemies.indexOf(alive[0]) : 0);
    }
    if (!c.over) endTurn(c);
  }
  return turns;
}

/* ------------------------------------------------------------------ planner -- */

/**
 * Turn planning by beam search.
 *
 * A greedy one-card-at-a-time bot cannot see the chain — the whole point of
 * the mechanic is that the value of a card depends on what you played before
 * it. So the planner clones the fight, explores orderings a few plays deep,
 * keeps the best handful at each depth, and executes the best line it found.
 *
 * Width 5 / depth 6 is enough to find the obvious "lead with your three ember
 * cards" lines that a human finds instantly, and cheap enough to run thousands
 * of simulated runs in a few seconds.
 */
const BEAM_WIDTH = 5;
const BEAM_DEPTH = 6;

interface Branch {
  state: CombatState;
  moves: { index: number; target: number }[];
  score: number;
}

function planTurn(c: CombatState): { index: number; target: number }[] {
  let frontier: Branch[] = [{ state: cloneCombat(c), moves: [], score: evaluate(c) }];
  let best: Branch = frontier[0]!;

  for (let depth = 0; depth < BEAM_DEPTH; depth++) {
    const next: Branch[] = [];
    for (const branch of frontier) {
      const s = branch.state;
      if (s.over) continue;
      const alive = livingEnemies(s);
      if (alive.length === 0) continue;
      const focus = alive.reduce((a, b) => (a.hp + a.block <= b.hp + b.block ? a : b));
      const target = s.enemies.indexOf(focus);

      const seen = new Set<string>();
      for (let i = 0; i < s.hand.length; i++) {
        const card = s.hand[i]!;
        if (!canPlay(s, i).ok) continue;
        // Two copies of the same card in hand are interchangeable.
        const key = `${card.defId}:${card.upgrades}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const child = cloneCombat(s);
        playCard(child, i, target);
        next.push({
          state: child,
          moves: [...branch.moves, { index: i, target }],
          score: evaluate(child),
        });
      }
    }
    if (next.length === 0) break;
    next.sort((a, b) => b.score - a.score);
    if (next[0]!.score > best.score) best = next[0]!;
    frontier = next.slice(0, BEAM_WIDTH);
  }

  return best.moves;
}

/**
 * How good is this position?
 *
 * Enemy HP removed, damage actually prevented, and the player's own HP, in
 * that order. Buffs are valued because they compound; unspent energy is not
 * punished, because holding energy is sometimes right.
 */
function evaluate(s: CombatState): number {
  const alive = livingEnemies(s);
  const enemyPool = alive.reduce((sum, e) => sum + e.hp + e.block, 0);
  const dead = s.enemies.length - alive.length;
  const incoming = incomingDamage(s);

  let score = 0;
  score -= enemyPool * 1.0;
  score += dead * 30;
  score += s.player.hp * 1.5;
  score += Math.min(s.player.block, incoming) * 1.35;
  score += Math.max(0, s.player.block - incoming) * 0.12;
  score += (s.player.statuses['strength'] ?? 0) * 5;
  score += (s.player.statuses['guard'] ?? 0) * 3.5;
  score += (s.player.statuses['thorns'] ?? 0) * 1.5;
  score += (s.player.statuses['resolve'] ?? 0) * 6;
  score -= (s.player.statuses['weak'] ?? 0) * 2;
  score -= (s.player.statuses['frail'] ?? 0) * 2;
  score += s.hand.length * 0.5;
  score += s.chain * 0.6;
  if (alive.length === 0) score += 200;
  if (s.player.hp <= 0) score -= 1000;
  return score;
}

/* ----------------------------------------------------------------- rewards -- */

function takeRewards(run: RunState, rng: Rng, tier: 'normal' | 'elite'): void {
  const reward = combatRewards(run, rng, tier);
  run.gold += reward.gold;
  if (reward.relic) addRelic(run, reward.relic);
  if (reward.draught && run.draughts.length < MAX_DRAUGHTS) addDraught(run, reward.draught);

  // A tight deck beats a big one: only take a card that beats what we have.
  const pick = bestCardChoice(run, reward.cards);
  if (pick && run.deck.length < 26) addCard(run, pick);
}

function dominantSuit(run: RunState): Suit {
  const counts: Record<string, number> = {};
  for (const c of run.deck) {
    const d = cardDef(c.defId);
    counts[d.suit] = (counts[d.suit] ?? 0) + 1;
  }
  let best: Suit = 'ember';
  let bestN = -1;
  for (const [suit, n] of Object.entries(counts)) {
    if (suit === 'prism') continue;
    if (n > bestN) { bestN = n; best = suit as Suit; }
  }
  return best;
}

function cardValue(run: RunState, card: Card): number {
  const d = cardDef(card.defId);
  const rarity = d.rarity === 'rare' ? 9 : d.rarity === 'uncommon' ? 6 : 3;
  const onSuit = d.suit === dominantSuit(run) ? 5 : d.suit === 'prism' ? 4 : 0;
  const power = d.type === 'power' ? 4 : 0;
  return rarity + onSuit + power + card.upgrades * 2;
}

function bestCardChoice(run: RunState, cards: readonly Card[]): Card | null {
  let best: Card | null = null;
  let bestScore = 6.5; // below this, skipping is better than diluting the deck
  for (const card of cards) {
    const score = cardValue(run, card);
    if (score > bestScore) { best = card; bestScore = score; }
  }
  return best;
}

function worstCard(run: RunState): Card | null {
  const ranked = [...run.deck].sort((a, b) => {
    const da = cardDef(a.defId), db = cardDef(b.defId);
    const curse = (x: typeof da) => (x.type === 'curse' ? -100 : 0);
    return (curse(da) + cardValue(run, a)) - (curse(db) + cardValue(run, b));
  });
  return ranked[0] ?? null;
}

function bestUpgradeTarget(run: RunState): Card | null {
  const pool = run.deck.filter(canUpgrade);
  if (pool.length === 0) return null;
  return pool.reduce((a, b) => (cardValue(run, a) >= cardValue(run, b) ? a : b));
}

function shop(run: RunState, rng: Rng): void {
  const items = buildShop(run, rng);
  const removal = items.find((i) => i.kind === 'removal');
  if (removal && run.gold >= removal.price && run.deck.length > 12) {
    const worst = worstCard(run);
    if (worst) { run.gold -= removal.price; removeCard(run, worst.uid); run.removalCost += 25; }
  }
  for (const item of items) {
    if (item.sold || run.gold < item.price) continue;
    if (item.kind === 'relic') { run.gold -= item.price; addRelic(run, item.id); item.sold = true; }
    else if (item.kind === 'card' && item.card && cardValue(run, item.card) >= 9 && run.deck.length < 24) {
      run.gold -= item.price; addCard(run, item.card); item.sold = true;
    } else if (item.kind === 'draught' && run.draughts.length < MAX_DRAUGHTS && run.gold > item.price + 120) {
      run.gold -= item.price; addDraught(run, item.id); item.sold = true;
    }
  }
}

/* ------------------------------------------------------------------ events -- */

/**
 * Weighs an event's options the way a player does: relics and permanent deck
 * improvements are worth real HP, but nothing is worth an option that could
 * end the run on the spot.
 */
function chooseEventOption(run: RunState, event: EventDef): EventOption {
  const score = (o: EventOutcome): number => {
    switch (o.kind) {
      case 'combo': return o.of.reduce((sum, sub) => sum + score(sub), 0);
      case 'gold': return o.amount * 0.06;
      case 'hp': return o.amount * 1.0;
      case 'maxHp': return o.amount * 1.3;
      case 'heal-percent': return Math.min(run.maxHp - run.hp, run.maxHp * o.percent) * 1.0;
      case 'relic': return o.rarity === 'rare' ? 30 : o.rarity === 'uncommon' ? 24 : 18;
      case 'card': return o.rarity === 'rare' ? 14 : 9;
      case 'curse': return -16;
      case 'upgrade-random': return o.count * 7;
      case 'remove-card': return run.deck.length > 12 ? 12 : 4;
      case 'draught': return 6;
      case 'nothing': return 0;
    }
  };
  const hpCost = (o: EventOutcome): number => {
    switch (o.kind) {
      case 'combo': return o.of.reduce((sum, sub) => sum + hpCost(sub), 0);
      case 'hp': return o.amount < 0 ? -o.amount : 0;
      case 'maxHp': return o.amount < 0 ? -o.amount : 0;
      default: return 0;
    }
  };

  let best = event.options[0]!;
  let bestScore = -Infinity;
  for (const option of event.options) {
    // Never take an option that could leave the run one hit from over.
    if (run.hp - hpCost(option.outcome) < run.maxHp * 0.28) continue;
    const value = score(option.outcome);
    if (value > bestScore) { bestScore = value; best = option; }
  }
  return best;
}

/* -------------------------------------------------------------------- map --- */

function chooseNode(run: RunState, choices: ReturnType<typeof availableNodes>, rng: Rng) {
  const hpFrac = run.hp / run.maxHp;
  const floor = run.stats.floorsCleared;
  // Elites are a real risk early: a starter deck loses to one. A competent
  // player takes them once the deck has come together, not on floor two.
  const eliteReady = hpFrac > 0.76 && floor >= 4 && run.deck.length >= 12;
  const rank = (kind: string): number => {
    switch (kind) {
      case 'boss': return 100;
      case 'rest': return hpFrac < 0.6 ? 92 : 34;
      case 'elite': return eliteReady ? 68 : 4;
      case 'treasure': return 66;
      case 'shop': return run.gold > 170 ? 62 : 36;
      case 'event': return 46;
      default: return 50;
    }
  };
  return [...choices].sort((a, b) => rank(b.kind) - rank(a.kind) || rng.int(-1, 1))[0]!;
}

/** Convenience: run a batch and report the aggregate. */
export function simulateBatch(
  count: number, depth = 0, seedPrefix = 'sim', character = DEFAULT_CHARACTER,
): {
  results: SimResult[];
  winRate: number;
  medianFloors: number;
  avgBestChain: number;
} {
  const results: SimResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(simulateRun(`${seedPrefix}-${i}`, depth, { character }));
  }
  const wins = results.filter((r) => r.outcome === 'won').length;
  const floors = results.map((r) => r.floors).sort((a, b) => a - b);
  return {
    results,
    winRate: wins / count,
    medianFloors: floors[Math.floor(floors.length / 2)] ?? 0,
    avgBestChain: results.reduce((s, r) => s + r.bestChain, 0) / count,
  };
}
