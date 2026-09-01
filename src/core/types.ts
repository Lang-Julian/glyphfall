/** Shared vocabulary for the whole game. Data-only: no behaviour lives here. */

/* ------------------------------------------------------------------ suits -- */

/**
 * A card's glyph suit. Suits exist for one reason: CHAIN. Play a card whose
 * suit matches the previous card this turn and the chain grows; break the
 * match and it collapses to zero. Every point of chain adds +1 to each
 * instance of damage or block a card produces, so the *order* you play your
 * hand in matters as much as what is in it.
 */
export type Suit = 'ember' | 'frost' | 'void' | 'iron' | 'prism';

export const SUITS: readonly Suit[] = ['ember', 'frost', 'void', 'iron', 'prism'];

/** PRISM is wild: it matches any suit and never breaks a chain. */
export const WILD_SUIT: Suit = 'prism';

/* ------------------------------------------------------------------ cards -- */

export type CardType = 'attack' | 'guard' | 'skill' | 'power' | 'curse';
export type CardRarity = 'starter' | 'common' | 'uncommon' | 'rare' | 'special';
export type CardTarget = 'enemy' | 'all-enemies' | 'self' | 'none';

export interface CardDef {
  id: string;
  name: string;
  suit: Suit;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  target: CardTarget;
  /** Templated with the card's numbers at render time — see `describeCard`. */
  text: string;
  /** Numbers the effect and the text both read from. Upgrading edits these. */
  vars: Readonly<Record<string, number>>;
  /** What upgrading does. Omitted keys are untouched. */
  upgrade?: Readonly<Record<string, number>>;
  /** Leaves play permanently once resolved. */
  exhaust?: boolean;
  /** Cannot be chosen by the player; only played by an effect. */
  unplayable?: boolean;
  /** Ends the turn the moment it resolves. */
  endsTurn?: boolean;
  /** Drawn into hand and played for free at the start of the turn. */
  innate?: boolean;
  /** Fires from the hand at end of turn instead of being discarded. */
  ethereal?: boolean;
  /** Effect script, resolved by the combat engine. */
  effects: readonly Effect[];
  /** Effect script that fires when the card is *discarded* by another card. */
  onDiscard?: readonly Effect[];
  /**
   * Persistent hooks installed for the rest of the combat. Powers and relics
   * share one hook system on purpose: a power is just a relic you drew.
   */
  power?: readonly RelicHook[];
  /** Flavour, shown in the inspector only. */
  flavour?: string;
}

/** A card as it exists inside one particular deck. */
export interface Card {
  /** Unique within a run, so two copies of the same card are distinguishable. */
  uid: string;
  defId: string;
  upgrades: number;
  /** Set when a temporary card is created mid-combat (it never joins the deck). */
  temporary?: boolean;
}

/* ---------------------------------------------------------------- effects -- */

/**
 * Effects are plain data, not closures. That keeps combat a pure reducer over
 * serialisable state, which is what lets the game save mid-fight and lets the
 * tests assert on exact numbers.
 *
 * `amount` is read from the card's `vars` when it is a string key.
 */
export type Amount = number | string;

export type Effect =
  | { kind: 'damage'; amount: Amount; hits?: Amount; ignoreBlock?: boolean }
  | { kind: 'damage-all'; amount: Amount; hits?: Amount }
  | { kind: 'block'; amount: Amount }
  | { kind: 'heal'; amount: Amount }
  | { kind: 'draw'; amount: Amount }
  | { kind: 'energy'; amount: Amount }
  | { kind: 'status'; who: 'self' | 'target' | 'all-enemies'; status: StatusId; amount: Amount }
  | { kind: 'discard'; amount: Amount; random?: boolean }
  | { kind: 'exhaust-hand' }
  | { kind: 'add-card'; defId: string; to: 'hand' | 'draw' | 'discard'; count?: Amount; upgraded?: boolean }
  | { kind: 'chain'; amount: Amount }
  /** Damage that scales with the current chain beyond the standard +1/point. */
  | { kind: 'damage-per-chain'; amount: Amount }
  | { kind: 'block-per-chain'; amount: Amount }
  /** Damage equal to `amount` per card already played this turn. */
  | { kind: 'damage-per-card'; amount: Amount }
  | { kind: 'block-per-block'; amount: Amount }
  | { kind: 'double-block' }
  | { kind: 'replay-last'; amount: Amount }
  | { kind: 'lose-hp'; amount: Amount }
  | { kind: 'shuffle-discard-into-draw' }
  | { kind: 'damage-from-block'; scale?: Amount }
  | { kind: 'discard-hand-draw'; bonus: Amount }
  | { kind: 'if-chain-at-least'; chain: number; then: readonly Effect[]; else?: readonly Effect[] };

/* --------------------------------------------------------------- statuses -- */

export type StatusId =
  | 'strength'   // +N damage per attack instance
  | 'guard'      // +N block per block instance
  | 'weak'       // deals 25% less damage
  | 'vulnerable' // takes 50% more damage
  | 'frail'      // gains 25% less block
  | 'burn'       // N damage at end of turn, then N-1
  | 'regen'      // heal N at end of turn, then N-1
  | 'thorns'     // attacker takes N
  | 'resolve'    // +N chain at the start of each turn
  | 'anchor'     // block is not cleared at the start of your turn
  | 'stun';      // loses its next turn

export interface StatusDef {
  id: StatusId;
  name: string;
  glyph: string;
  hint: string;
  /** How the number shrinks between turns. */
  decay: 'none' | 'turn' | 'one';
  good: boolean;
}

/* -------------------------------------------------------------- creatures -- */

export interface Combatant {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Record<string, number>;
}

export interface EnemyDef {
  id: string;
  name: string;
  glyph: string;
  /** ASCII portrait, drawn in the combat pane. Lines are centred. */
  art: readonly string[];
  hp: readonly [number, number];
  tier: 'minion' | 'normal' | 'elite' | 'boss';
  acts: readonly number[];
  /** Chosen by the AI each turn; see `pickEnemyMove`. */
  moves: readonly EnemyMove[];
  /** Statuses applied to itself when combat starts. */
  opener?: readonly { status: StatusId; amount: number }[];
  flavour?: string;
}

export interface EnemyMove {
  id: string;
  /** Player-facing summary of what is about to happen. */
  intent: Intent;
  effects: readonly Effect[];
  /** Relative likelihood. */
  weight: number;
  /** Never play this move more than `maxStreak` times in a row. */
  maxStreak?: number;
  /** Only available from this turn on (1-indexed). */
  fromTurn?: number;
  /** Only available every `everyTurn` turns. */
  everyTurn?: number;
  /** Only when the enemy is below this fraction of max HP. */
  belowHp?: number;
}

export interface Intent {
  kind: 'attack' | 'attack-block' | 'block' | 'buff' | 'debuff' | 'stun' | 'unknown';
  damage?: number;
  hits?: number;
  /** Block the enemy is about to gain, so the note never has to spell it out. */
  block?: number;
  /** Anything the numbers cannot say, kept to a few words. */
  note?: string;
}

/* ---------------------------------------------------------------- relics --- */

export interface RelicDef {
  id: string;
  name: string;
  glyph: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'boss' | 'shop';
  text: string;
  /** Hook points the combat engine and run loop query by id. */
  hooks: readonly RelicHook[];
}

export type RelicHook =
  | { on: 'combat-start'; effects: readonly Effect[] }
  | { on: 'turn-start'; effects: readonly Effect[] }
  | { on: 'turn-end'; effects: readonly Effect[] }
  | { on: 'chain-reached'; chain: number; effects: readonly Effect[] }
  | { on: 'card-played'; suit?: Suit; type?: CardType; nth?: number; effects: readonly Effect[] }
  | { on: 'combat-win'; heal?: number; gold?: number }
  | { on: 'stat'; energy?: number; handSize?: number; maxHp?: number; startChain?: number }
  | { on: 'rest'; healBonus?: number }
  | { on: 'shop'; discount?: number };
