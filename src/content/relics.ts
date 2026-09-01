import type { RelicDef } from '../core/types.js';

/**
 * Relics.
 *
 * Relics are the run's *identity*. A card changes a turn; a relic changes what
 * kind of deck is worth building. Most of them therefore point at the chain,
 * because the chain is the thing the game is actually about.
 */

/** Glyphs follow the same single-width rule as the theme: no pictographs. */
const r = (d: RelicDef): RelicDef => d;

export const RELICS: readonly RelicDef[] = [
  /* --------------------------------------------------------------- common -- */
  r({
    id: 'first-link', name: 'First Link', glyph: '∞', rarity: 'common',
    text: 'Start each turn with 1 chain.',
    hooks: [{ on: 'stat', startChain: 1 }],
  }),
  r({
    id: 'tinder-box', name: 'Tinder Box', glyph: '△', rarity: 'common',
    text: 'At the start of combat, gain 2 Strength.',
    hooks: [{ on: 'combat-start', effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 2 }] }],
  }),
  r({
    id: 'quilted-lining', name: 'Quilted Lining', glyph: '◇', rarity: 'common',
    text: 'At the start of combat, gain 9 block.',
    hooks: [{ on: 'combat-start', effects: [{ kind: 'block', amount: 9 }] }],
  }),
  r({
    id: 'dog-eared-index', name: 'Dog-Eared Index', glyph: '≡', rarity: 'common',
    text: 'At the start of combat, draw 2 extra cards.',
    hooks: [{ on: 'combat-start', effects: [{ kind: 'draw', amount: 2 }] }],
  }),
  r({
    id: 'field-rations', name: 'Field Rations', glyph: '+', rarity: 'common',
    text: 'Heal 6 HP after every combat.',
    hooks: [{ on: 'combat-win', heal: 6 }],
  }),
  r({
    id: 'cracked-tithe', name: 'Cracked Tithe', glyph: '¤', rarity: 'common',
    text: 'Gain 12 extra gold after every combat.',
    hooks: [{ on: 'combat-win', gold: 12 }],
  }),
  r({
    id: 'whetted-thumb', name: 'Whetted Thumb', glyph: '↑', rarity: 'common',
    text: 'The first Attack you play each turn deals 3 more damage.',
    hooks: [{ on: 'card-played', type: 'attack', nth: 1, effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 0 }] }],
  }),

  /* ------------------------------------------------------------ uncommon -- */
  r({
    id: 'chainwright-glove', name: "Chainwright's Glove", glyph: '∞', rarity: 'uncommon',
    text: 'Whenever your chain reaches 3, gain 1 energy.',
    hooks: [{ on: 'chain-reached', chain: 3, effects: [{ kind: 'energy', amount: 1 }] }],
  }),
  r({
    id: 'ember-lens', name: 'Ember Lens', glyph: '◆', rarity: 'uncommon',
    text: 'Whenever you play an Ember card, deal 2 damage to a random enemy.',
    hooks: [{ on: 'card-played', suit: 'ember', effects: [{ kind: 'damage', amount: 2 }] }],
  }),
  r({
    id: 'frost-mantle', name: 'Frost Mantle', glyph: '▲', rarity: 'uncommon',
    text: 'Whenever you play a Frost card, gain 2 block.',
    hooks: [{ on: 'card-played', suit: 'frost', effects: [{ kind: 'block', amount: 2 }] }],
  }),
  r({
    id: 'hollow-coin', name: 'Hollow Coin', glyph: '●', rarity: 'uncommon',
    text: 'Whenever you play a Void card, draw 1 card. Once per turn.',
    hooks: [{ on: 'card-played', suit: 'void', nth: 1, effects: [{ kind: 'draw', amount: 1 }] }],
  }),
  r({
    id: 'iron-liturgy', name: 'Iron Liturgy', glyph: '■', rarity: 'uncommon',
    text: 'Whenever you play an Iron card, gain 1 Guard.',
    hooks: [{ on: 'card-played', suit: 'iron', effects: [{ kind: 'status', who: 'self', status: 'guard', amount: 1 }] }],
  }),
  r({
    id: 'long-lever', name: 'Long Lever', glyph: '≫', rarity: 'uncommon',
    text: 'Maximum hand size +2.',
    hooks: [{ on: 'stat', handSize: 2 }],
  }),
  r({
    id: 'salt-poultice', name: 'Salt Poultice', glyph: '+', rarity: 'uncommon',
    text: 'Resting heals 15% more of your max HP.',
    hooks: [{ on: 'rest', healBonus: 0.15 }],
  }),
  r({
    id: 'bargainers-seal', name: "Bargainer's Seal", glyph: '¤', rarity: 'uncommon',
    text: 'Shop prices are 25% lower.',
    hooks: [{ on: 'shop', discount: 0.25 }],
  }),

  /* ---------------------------------------------------------------- rare -- */
  r({
    id: 'the-second-hand', name: 'The Second Hand', glyph: '±', rarity: 'rare',
    text: 'Gain 1 extra energy each turn. Lose 8 max HP.',
    hooks: [{ on: 'stat', energy: 1, maxHp: -8 }],
  }),
  r({
    id: 'unbroken-thread', name: 'Unbroken Thread', glyph: '∞', rarity: 'rare',
    text: 'Your chain no longer resets when you break a suit; it drops by 2 instead.',
    hooks: [],
  }),
  r({
    id: 'resonant-core', name: 'Resonant Core', glyph: '◎', rarity: 'rare',
    text: 'Whenever your chain reaches 5, deal 10 damage to all enemies.',
    hooks: [{ on: 'chain-reached', chain: 5, effects: [{ kind: 'damage-all', amount: 10 }] }],
  }),
  r({
    id: 'archivists-ring', name: "Archivist's Ring", glyph: '○', rarity: 'rare',
    text: 'At the start of each turn, gain 1 chain and 3 block.',
    hooks: [{ on: 'turn-start', effects: [{ kind: 'chain', amount: 1 }, { kind: 'block', amount: 3 }] }],
  }),
  r({
    id: 'gravebloom', name: 'Gravebloom', glyph: '∗', rarity: 'rare',
    text: 'Heal 12 HP after every combat. Gain 4 less gold.',
    hooks: [{ on: 'combat-win', heal: 12, gold: -4 }],
  }),

  /* ---------------------------------------------------------------- boss -- */
  r({
    id: 'crown-of-links', name: 'Crown of Links', glyph: '◈', rarity: 'boss',
    text: 'Start each turn with 2 chain. Draw 1 fewer card each turn.',
    hooks: [{ on: 'stat', startChain: 2, handSize: -1 }],
  }),
  r({
    id: 'furnace-ledger', name: 'Furnace Ledger', glyph: '⊗', rarity: 'boss',
    text: 'Gain 2 extra energy each turn. You can no longer heal at rest sites.',
    hooks: [{ on: 'stat', energy: 2 }, { on: 'rest', healBonus: -1 }],
  }),
  r({
    id: 'glass-heart', name: 'Glass Heart', glyph: '⊙', rarity: 'boss',
    text: 'Gain 25 max HP. Enemies start combat with 4 Thorns.',
    hooks: [{ on: 'stat', maxHp: 25 }],
  }),

  /* ---------------------------------------------------------------- shop -- */
  r({
    id: 'prism-key', name: 'Prism Key', glyph: '◉', rarity: 'shop',
    text: 'The first card you play each turn never breaks your chain.',
    hooks: [],
  }),
  r({
    id: 'sharpening-stone', name: 'Sharpening Stone', glyph: '◆', rarity: 'shop',
    text: 'At the start of combat, gain 1 Strength and 1 Guard.',
    hooks: [{ on: 'combat-start', effects: [
      { kind: 'status', who: 'self', status: 'strength', amount: 1 },
      { kind: 'status', who: 'self', status: 'guard', amount: 1 },
    ] }],
  }),
];

const BY_ID = new Map(RELICS.map((x) => [x.id, x]));

export function relicDef(id: string): RelicDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unknown relic: ${id}`);
  return d;
}

export const STARTER_RELIC = 'first-link';

/** Relics reachable through normal play, keyed by where they drop from. */
export function relicsByRarity(rarity: RelicDef['rarity']): RelicDef[] {
  return RELICS.filter((x) => x.rarity === rarity);
}
