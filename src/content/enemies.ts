import type { EnemyDef } from '../core/types.js';

/**
 * The bestiary.
 *
 * Every enemy is a *question* posed to the deck: "can you burst me before turn
 * four", "can you block twice in a row", "can you win without a long chain".
 * A fight that does not ask something new is a fight that should not exist.
 *
 * Art is 4 lines and at most 11 columns wide, so three enemies still fit
 * side by side inside an 80-column terminal.
 */

const e = (d: EnemyDef): EnemyDef => d;

export const ENEMIES: readonly EnemyDef[] = [
  /* ================================================================ ACT 1 == */
  e({
    id: 'ashling', name: 'Ashling', glyph: 'a', tier: 'normal', acts: [1],
    hp: [22, 28],
    art: ['   ,-.   ', '  ( o )  ', '  /|_|\\  ', "  ' ' '  "],
    flavour: 'Burnt paper that learned to want.',
    moves: [
      { id: 'swipe', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 7 }, effects: [{ kind: 'damage', amount: 7 }] },
      { id: 'scatter', weight: 2, maxStreak: 1, intent: { kind: 'attack', damage: 3, hits: 2 }, effects: [{ kind: 'damage', amount: 3, hits: 2 }] },
      { id: 'smoulder', weight: 1, maxStreak: 1, intent: { kind: 'debuff', note: 'Burn 3' }, effects: [{ kind: 'status', who: 'target', status: 'burn', amount: 3 }] },
    ],
  }),
  e({
    id: 'cinder-hound', name: 'Cinder Hound', glyph: 'h', tier: 'minion', acts: [1, 2],
    hp: [14, 18],
    art: ['  /\\_/\\  ', ' ( >.< ) ', '  \\___/  ', '  /] [\\  '],
    moves: [
      { id: 'bite', weight: 4, intent: { kind: 'attack', damage: 6 }, effects: [{ kind: 'damage', amount: 6 }] },
      { id: 'howl', weight: 1, maxStreak: 1, intent: { kind: 'buff', note: 'Strength 2' }, effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 2 }] },
    ],
  }),
  e({
    id: 'ledger-moth', name: 'Ledger Moth', glyph: 'm', tier: 'normal', acts: [1],
    hp: [26, 32],
    art: [' \\  ^  / ', '  \\/|\\/  ', '  /\\|/\\  ', ' /  v  \\ '],
    flavour: 'It eats the entries. Then it eats the ink.',
    moves: [
      { id: 'dust', weight: 2, maxStreak: 1, intent: { kind: 'debuff', note: 'Frail 2' }, effects: [{ kind: 'status', who: 'target', status: 'frail', amount: 2 }] },
      { id: 'flutter', weight: 3, maxStreak: 2, intent: { kind: 'attack-block', damage: 5, block: 6 }, effects: [{ kind: 'damage', amount: 5 }, { kind: 'block', amount: 6 }] },
      { id: 'devour', weight: 2, fromTurn: 3, intent: { kind: 'attack', damage: 11 }, effects: [{ kind: 'damage', amount: 11 }] },
    ],
  }),
  e({
    id: 'glass-wisp', name: 'Glass Wisp', glyph: 'w', tier: 'normal', acts: [1, 2],
    hp: [18, 22],
    art: ['   ***   ', '  * o *  ', '   ***   ', '    |    '],
    opener: [{ status: 'thorns', amount: 3 }],
    flavour: 'Hitting it is the mistake. Not hitting it is also the mistake.',
    moves: [
      { id: 'chime', weight: 3, intent: { kind: 'attack', damage: 5 }, effects: [{ kind: 'damage', amount: 5 }] },
      { id: 'harden', weight: 2, maxStreak: 1, intent: { kind: 'block', block: 8, note: 'Thorns 3' }, effects: [{ kind: 'block', amount: 8 }, { kind: 'status', who: 'self', status: 'thorns', amount: 3 }] },
    ],
  }),
  e({
    id: 'the-auditor', name: 'The Auditor', glyph: 'A', tier: 'elite', acts: [1],
    hp: [52, 58],
    art: ['  ,---.  ', '  |[o]|  ', '  |_=_|  ', '  /   \\  '],
    flavour: 'Asks to see your deck. Objects to most of it.',
    moves: [
      { id: 'assess', weight: 2, maxStreak: 1, intent: { kind: 'debuff', note: 'Weak 2 · Frail 2' }, effects: [
        { kind: 'status', who: 'target', status: 'weak', amount: 2 },
        { kind: 'status', who: 'target', status: 'frail', amount: 2 },
      ] },
      { id: 'levy', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 10 }, effects: [{ kind: 'damage', amount: 10 }] },
      { id: 'penalty', weight: 2, fromTurn: 2, intent: { kind: 'attack', damage: 4, hits: 3 }, effects: [{ kind: 'damage', amount: 4, hits: 3 }] },
      { id: 'seal', weight: 2, fromTurn: 3, everyTurn: 3, intent: { kind: 'debuff', note: 'adds Doubt' }, effects: [{ kind: 'add-card', defId: 'doubt', to: 'discard' }] },
    ],
  }),
  e({
    id: 'molten-warden', name: 'Molten Warden', glyph: 'W', tier: 'elite', acts: [1, 2],
    hp: [56, 64],
    art: [' /^^^^^\\ ', '( () () )', ' \\ vvv / ', '  |___|  '],
    moves: [
      { id: 'sear', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 9, note: 'Burn 3' }, effects: [
        { kind: 'damage', amount: 9 }, { kind: 'status', who: 'target', status: 'burn', amount: 3 },
      ] },
      { id: 'vent', weight: 2, maxStreak: 1, intent: { kind: 'block', block: 14 }, effects: [{ kind: 'block', amount: 14 }] },
      { id: 'overheat', weight: 2, fromTurn: 3, belowHp: 0.6, intent: { kind: 'attack', damage: 17 }, effects: [{ kind: 'damage', amount: 17 }] },
    ],
  }),
  e({
    id: 'hollow-bell', name: 'The Hollow Bell', glyph: 'Ω', tier: 'boss', acts: [1],
    hp: [98, 98],
    art: ['  _____  ', ' /     \\ ', '|  ( )  |', ' \\_____/ '],
    flavour: 'It has been ringing since before there was air to carry it.',
    moves: [
      { id: 'toll', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 12 }, effects: [{ kind: 'damage', amount: 12 }] },
      { id: 'resonate', weight: 2, maxStreak: 1, intent: { kind: 'buff', block: 10, note: 'Strength 3' }, effects: [
        { kind: 'status', who: 'self', status: 'strength', amount: 3 }, { kind: 'block', amount: 10 },
      ] },
      { id: 'shatter-note', weight: 2, fromTurn: 3, everyTurn: 3, intent: { kind: 'attack', damage: 6, hits: 3, note: 'Frail 2' }, effects: [
        { kind: 'damage', amount: 6, hits: 3 }, { kind: 'status', who: 'target', status: 'frail', amount: 2 },
      ] },
      { id: 'silence', weight: 2, fromTurn: 5, belowHp: 0.45, intent: { kind: 'attack', damage: 20 }, effects: [{ kind: 'damage', amount: 20 }] },
    ],
  }),

  /* ================================================================ ACT 2 == */
  e({
    id: 'slag-golem', name: 'Slag Golem', glyph: 'g', tier: 'normal', acts: [2],
    hp: [42, 50],
    art: [' [#####] ', ' |o   o| ', ' |_____| ', ' /|   |\\ '],
    moves: [
      { id: 'slam', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 12 }, effects: [{ kind: 'damage', amount: 12 }] },
      { id: 'plate', weight: 2, maxStreak: 1, intent: { kind: 'block', block: 12 }, effects: [{ kind: 'block', amount: 12 }] },
      { id: 'foundry', weight: 2, fromTurn: 2, intent: { kind: 'debuff', note: 'adds Slag' }, effects: [{ kind: 'add-card', defId: 'slag', to: 'draw' }] },
    ],
  }),
  e({
    id: 'chorus-tooth', name: 'Chorus Tooth', glyph: 't', tier: 'minion', acts: [2, 3],
    hp: [14, 18],
    art: ['  \\/\\/   ', '  |oo|   ', '  |__|   ', '   ||    '],
    moves: [
      { id: 'gnash', weight: 3, intent: { kind: 'attack', damage: 7 }, effects: [{ kind: 'damage', amount: 7 }] },
      { id: 'harmonise', weight: 2, maxStreak: 1, intent: { kind: 'buff', note: 'Strength 2' }, effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 2 }] },
    ],
  }),
  e({
    id: 'mirror-thief', name: 'Mirror Thief', glyph: 'r', tier: 'normal', acts: [2],
    hp: [38, 44],
    art: ['  /===\\  ', ' | \\ / | ', ' |  X  | ', '  \\===/  '],
    flavour: 'It copies your best turn and sells it back to you.',
    moves: [
      { id: 'lift', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 6, hits: 2 }, effects: [{ kind: 'damage', amount: 6, hits: 2 }] },
      { id: 'mirror', weight: 2, maxStreak: 1, intent: { kind: 'block', block: 8, note: 'Thorns 5' }, effects: [
        { kind: 'status', who: 'self', status: 'thorns', amount: 5 }, { kind: 'block', amount: 8 },
      ] },
      { id: 'pickpocket', weight: 2, fromTurn: 2, intent: { kind: 'debuff', note: 'you discard 2' }, effects: [{ kind: 'discard', amount: 2, random: true }] },
    ],
  }),
  e({
    id: 'salt-priest', name: 'Salt Priest', glyph: 'p', tier: 'normal', acts: [2, 3],
    hp: [34, 40],
    art: ['   /^\\   ', '  ( - )  ', '  /|+|\\  ', '   / \\   '],
    moves: [
      { id: 'benediction', weight: 2, maxStreak: 1, intent: { kind: 'buff', note: 'Regen 6' }, effects: [{ kind: 'status', who: 'self', status: 'regen', amount: 6 }] },
      { id: 'brine', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 10, note: 'Weak 2' }, effects: [
        { kind: 'damage', amount: 10 }, { kind: 'status', who: 'target', status: 'weak', amount: 2 },
      ] },
      { id: 'pillar', weight: 2, fromTurn: 3, intent: { kind: 'attack', damage: 14 }, effects: [{ kind: 'damage', amount: 14 }] },
    ],
  }),
  e({
    id: 'copperjaw', name: 'Copperjaw', glyph: 'C', tier: 'elite', acts: [2],
    hp: [78, 86],
    art: [' _/---\\_ ', '|  ° °  |', '|\\vvvvv/|', ' \\_____/ '],
    flavour: 'Bites through the chain. Literally.',
    moves: [
      { id: 'crunch', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 14 }, effects: [{ kind: 'damage', amount: 14 }] },
      { id: 'sever', weight: 2, maxStreak: 1, intent: { kind: 'debuff', note: 'you discard 2 · Frail 3' }, effects: [
        { kind: 'discard', amount: 2, random: true }, { kind: 'status', who: 'target', status: 'frail', amount: 3 },
      ] },
      { id: 'grind', weight: 2, fromTurn: 2, intent: { kind: 'attack', damage: 5, hits: 3 }, effects: [{ kind: 'damage', amount: 5, hits: 3 }] },
      { id: 'gorge', weight: 3, belowHp: 0.5, maxStreak: 1, intent: { kind: 'attack-block', damage: 12, block: 16 }, effects: [
        { kind: 'damage', amount: 12 }, { kind: 'block', amount: 16 },
      ] },
    ],
  }),
  e({
    id: 'archivist-wraith', name: 'Archivist Wraith', glyph: 'V', tier: 'elite', acts: [2, 3],
    hp: [70, 78],
    art: ['  .---.  ', ' / o o \\ ', ' \\  ~  / ', '  \\   /  '],
    moves: [
      { id: 'redact', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 8, hits: 2 }, effects: [{ kind: 'damage', amount: 8, hits: 2 }] },
      { id: 'index', weight: 2, maxStreak: 1, intent: { kind: 'buff', note: 'Strength 4' }, effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 4 }] },
      { id: 'annotate', weight: 2, fromTurn: 2, everyTurn: 2, intent: { kind: 'debuff', note: 'adds Doubt ×2' }, effects: [
        { kind: 'add-card', defId: 'doubt', to: 'discard', count: 2 },
      ] },
    ],
  }),
  e({
    id: 'the-grammar', name: 'The Grammar', glyph: 'Ω', tier: 'boss', acts: [2],
    hp: [138, 138],
    art: [' <<[|]>> ', '  \\ ° /  ', '  /___\\  ', ' <<   >> '],
    flavour: 'It does not attack you. It corrects you.',
    opener: [{ status: 'thorns', amount: 3 }],
    moves: [
      { id: 'parse', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 15 }, effects: [{ kind: 'damage', amount: 15 }] },
      { id: 'clause', weight: 2, maxStreak: 1, intent: { kind: 'attack-block', damage: 9, block: 14 }, effects: [
        { kind: 'damage', amount: 9 }, { kind: 'block', amount: 14 },
      ] },
      { id: 'conjugate', weight: 2, fromTurn: 2, everyTurn: 3, intent: { kind: 'debuff', note: 'Weak 3 · Frail 3 · adds Slag' }, effects: [
        { kind: 'status', who: 'target', status: 'weak', amount: 3 },
        { kind: 'status', who: 'target', status: 'frail', amount: 3 },
        { kind: 'add-card', defId: 'slag', to: 'draw' },
      ] },
      { id: 'declension', weight: 3, fromTurn: 4, belowHp: 0.5, intent: { kind: 'attack', damage: 7, hits: 3 }, effects: [{ kind: 'damage', amount: 7, hits: 3 }] },
    ],
  }),

  /* ================================================================ ACT 3 == */
  e({
    id: 'void-lamprey', name: 'Void Lamprey', glyph: 'l', tier: 'normal', acts: [3],
    hp: [48, 56],
    art: ['   (o)   ', '  (( ))  ', '   )(    ', '  (  )   '],
    moves: [
      { id: 'siphon', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 13, note: 'heals itself' }, effects: [
        { kind: 'damage', amount: 13 }, { kind: 'heal', amount: 5 },
      ] },
      { id: 'coil', weight: 2, maxStreak: 1, intent: { kind: 'attack', damage: 6, hits: 3 }, effects: [{ kind: 'damage', amount: 6, hits: 3 }] },
    ],
  }),
  e({
    id: 'ash-seraph', name: 'Ash Seraph', glyph: 's', tier: 'normal', acts: [3],
    hp: [54, 62],
    art: [' \\\\ | // ', '  \\(o)/  ', '  /|_|\\  ', ' // | \\\\ '],
    moves: [
      { id: 'descend', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 16 }, effects: [{ kind: 'damage', amount: 16 }] },
      { id: 'wings', weight: 2, maxStreak: 1, intent: { kind: 'buff', note: 'Strength 3 · Regen 5' }, effects: [
        { kind: 'status', who: 'self', status: 'strength', amount: 3 },
        { kind: 'status', who: 'self', status: 'regen', amount: 5 },
      ] },
      { id: 'pyre', weight: 2, fromTurn: 3, intent: { kind: 'attack', damage: 8, hits: 2, note: 'Burn 5' }, effects: [
        { kind: 'damage', amount: 8, hits: 2 }, { kind: 'status', who: 'target', status: 'burn', amount: 5 },
      ] },
    ],
  }),
  e({
    id: 'the-anvil', name: 'The Anvil', glyph: 'N', tier: 'elite', acts: [3],
    hp: [110, 120],
    art: [' _______ ', '|  ___  |', ' \\/   \\/ ', '  |___|  '],
    opener: [{ status: 'guard', amount: 4 }],
    moves: [
      { id: 'fall', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 19 }, effects: [{ kind: 'damage', amount: 19 }] },
      { id: 'set', weight: 2, maxStreak: 1, intent: { kind: 'block', block: 22 }, effects: [{ kind: 'block', amount: 22 }] },
      { id: 'temper', weight: 2, fromTurn: 2, everyTurn: 2, intent: { kind: 'buff', note: 'Strength 4 · Thorns 4' }, effects: [
        { kind: 'status', who: 'self', status: 'strength', amount: 4 },
        { kind: 'status', who: 'self', status: 'thorns', amount: 4 },
      ] },
    ],
  }),
  e({
    id: 'prism-eater', name: 'Prism Eater', glyph: 'P', tier: 'elite', acts: [3],
    hp: [96, 104],
    art: ['  /\\/\\   ', ' <(oo)>  ', '  \\/\\/   ', '  /  \\   '],
    flavour: 'It has developed a taste for order.',
    moves: [
      { id: 'unmake', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 9, hits: 3 }, effects: [{ kind: 'damage', amount: 9, hits: 3 }] },
      { id: 'scramble', weight: 2, maxStreak: 1, intent: { kind: 'debuff', note: 'you discard 3 · adds Slag' }, effects: [
        { kind: 'discard', amount: 3, random: true },
        { kind: 'add-card', defId: 'slag', to: 'draw' },
      ] },
      { id: 'swallow', weight: 2, belowHp: 0.5, intent: { kind: 'attack', damage: 26 }, effects: [{ kind: 'damage', amount: 26 }] },
    ],
  }),
  e({
    id: 'glyph-zero', name: 'GLYPH ZERO', glyph: 'Ω', tier: 'boss', acts: [3],
    hp: [204, 204],
    art: [' ___^___ ', '/ \\ | / \\', '|  (0)  |', '\\_/_|_\\_/'],
    flavour: 'The first glyph. It was never meant to be read.',
    opener: [{ status: 'thorns', amount: 3 }],
    moves: [
      { id: 'erase', weight: 3, maxStreak: 2, intent: { kind: 'attack', damage: 20 }, effects: [{ kind: 'damage', amount: 20 }] },
      { id: 'rewrite', weight: 2, maxStreak: 1, intent: { kind: 'buff', block: 16, note: 'Strength 4' }, effects: [
        { kind: 'status', who: 'self', status: 'strength', amount: 4 },
        { kind: 'block', amount: 16 },
      ] },
      { id: 'cite', weight: 2, fromTurn: 2, everyTurn: 3, intent: { kind: 'debuff', note: 'Weak 3 · adds Doubt ×2' }, effects: [
        { kind: 'status', who: 'target', status: 'weak', amount: 3 },
        { kind: 'add-card', defId: 'doubt', to: 'discard', count: 2 },
      ] },
      { id: 'unwrite', weight: 3, fromTurn: 4, intent: { kind: 'attack', damage: 9, hits: 3 }, effects: [{ kind: 'damage', amount: 9, hits: 3 }] },
      { id: 'zero', weight: 4, fromTurn: 6, belowHp: 0.35, maxStreak: 1, intent: { kind: 'attack', damage: 32 }, effects: [{ kind: 'damage', amount: 32 }] },
    ],
  }),
];

const BY_ID = new Map(ENEMIES.map((x) => [x.id, x]));

export function enemyDef(id: string): EnemyDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unknown enemy: ${id}`);
  return d;
}

/**
 * Hand-authored encounters. Random enemy soup produces unfair fights; a curated
 * list lets each encounter be tuned as a unit.
 */
export interface EncounterDef {
  id: string;
  name: string;
  enemies: readonly string[];
  act: number;
  tier: 'normal' | 'elite' | 'boss';
  /**
   * How many normal fights must already be won *in this act* before this
   * encounter can appear. Without this ramp a starter deck can meet a
   * three-enemy pack on floor two, which is not difficulty — it is a coin flip.
   */
  minFight?: number;
}

export const ENCOUNTERS: readonly EncounterDef[] = [
  // Act 1
  { id: 'a1-ashling', name: 'Ashling', enemies: ['ashling'], act: 1, tier: 'normal', minFight: 0 },
  { id: 'a1-hounds', name: 'Pair of Hounds', enemies: ['cinder-hound', 'cinder-hound'], act: 1, tier: 'normal', minFight: 0 },
  { id: 'a1-moth', name: 'Ledger Moth', enemies: ['ledger-moth'], act: 1, tier: 'normal', minFight: 1 },
  { id: 'a1-wisps', name: 'Wisp & Hound', enemies: ['glass-wisp', 'cinder-hound'], act: 1, tier: 'normal', minFight: 2 },
  { id: 'a1-trio', name: 'Kennel', enemies: ['cinder-hound', 'ashling', 'cinder-hound'], act: 1, tier: 'normal', minFight: 4 },
  { id: 'a1-moth-wisp', name: 'Moth & Wisp', enemies: ['ledger-moth', 'glass-wisp'], act: 1, tier: 'normal', minFight: 3 },
  { id: 'a1-e-auditor', name: 'The Auditor', enemies: ['the-auditor'], act: 1, tier: 'elite' },
  { id: 'a1-e-warden', name: 'Molten Warden', enemies: ['molten-warden'], act: 1, tier: 'elite' },
  { id: 'a1-boss', name: 'The Hollow Bell', enemies: ['hollow-bell'], act: 1, tier: 'boss' },
  // Act 2
  { id: 'a2-golem', name: 'Slag Golem', enemies: ['slag-golem'], act: 2, tier: 'normal', minFight: 0 },
  { id: 'a2-chorus', name: 'Chorus of Teeth', enemies: ['chorus-tooth', 'chorus-tooth', 'chorus-tooth'], act: 2, tier: 'normal', minFight: 2 },
  { id: 'a2-thief', name: 'Mirror Thief', enemies: ['mirror-thief'], act: 2, tier: 'normal', minFight: 0 },
  { id: 'a2-priest', name: 'Salt Priest & Wisp', enemies: ['salt-priest', 'glass-wisp'], act: 2, tier: 'normal', minFight: 1 },
  { id: 'a2-congregation', name: 'Congregation', enemies: ['salt-priest', 'chorus-tooth', 'chorus-tooth'], act: 2, tier: 'normal', minFight: 4 },
  { id: 'a2-foundry', name: 'Foundry Floor', enemies: ['slag-golem', 'cinder-hound'], act: 2, tier: 'normal', minFight: 3 },
  { id: 'a2-e-copperjaw', name: 'Copperjaw', enemies: ['copperjaw'], act: 2, tier: 'elite' },
  { id: 'a2-e-wraith', name: 'Archivist Wraith', enemies: ['archivist-wraith'], act: 2, tier: 'elite' },
  { id: 'a2-e-warden', name: 'Warden & Hounds', enemies: ['molten-warden', 'cinder-hound'], act: 2, tier: 'elite' },
  { id: 'a2-boss', name: 'The Grammar', enemies: ['the-grammar'], act: 2, tier: 'boss' },
  // Act 3
  { id: 'a3-lamprey', name: 'Void Lamprey', enemies: ['void-lamprey'], act: 3, tier: 'normal', minFight: 0 },
  { id: 'a3-seraph', name: 'Ash Seraph', enemies: ['ash-seraph'], act: 3, tier: 'normal', minFight: 0 },
  { id: 'a3-choir', name: 'Iron Choir', enemies: ['salt-priest', 'chorus-tooth', 'chorus-tooth'], act: 3, tier: 'normal', minFight: 1 },
  { id: 'a3-pair', name: 'Lamprey & Seraph', enemies: ['void-lamprey', 'ash-seraph'], act: 3, tier: 'normal', minFight: 3 },
  { id: 'a3-deep', name: 'The Deep Shelf', enemies: ['void-lamprey', 'void-lamprey'], act: 3, tier: 'normal', minFight: 2 },
  { id: 'a3-e-anvil', name: 'The Anvil', enemies: ['the-anvil'], act: 3, tier: 'elite' },
  { id: 'a3-e-eater', name: 'Prism Eater', enemies: ['prism-eater'], act: 3, tier: 'elite' },
  { id: 'a3-e-wraith', name: 'Wraith & Teeth', enemies: ['archivist-wraith', 'chorus-tooth', 'chorus-tooth'], act: 3, tier: 'elite' },
  { id: 'a3-boss', name: 'GLYPH ZERO', enemies: ['glyph-zero'], act: 3, tier: 'boss' },
];

export function encountersFor(act: number, tier: 'normal' | 'elite' | 'boss'): EncounterDef[] {
  return ENCOUNTERS.filter((x) => x.act === act && x.tier === tier);
}
