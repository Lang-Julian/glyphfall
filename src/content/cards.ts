import type { Card, CardDef } from '../core/types.js';

/**
 * The card pool.
 *
 * Design rules this list is held to:
 *  1. Every common is playable in a bad deck. Every rare rewrites a run.
 *  2. Each suit owns a fantasy: EMBER kills, FROST survives, VOID cycles,
 *     IRON compounds, PRISM ignores the rules.
 *  3. Cheap cards exist mainly to *extend chains*. A 0-cost 4-damage card is
 *     weak on paper and excellent in the middle of an ember run.
 *  4. Nothing is strictly better than anything else at the same cost. Where a
 *     card looks strictly better, it costs HP, a card slot, or the chain.
 */

const def = (d: CardDef): CardDef => d;

export const CARDS: readonly CardDef[] = [
  /* ============================================================ STARTERS == */
  def({
    id: 'strike', name: 'Strike', suit: 'ember', type: 'attack', rarity: 'starter',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage.',
    vars: { dmg: 6 }, upgrade: { dmg: 9 },
    effects: [{ kind: 'damage', amount: 'dmg' }],
    flavour: 'The first glyph anyone learns, and the last one anyone forgets.',
  }),
  def({
    id: 'ward', name: 'Ward', suit: 'frost', type: 'guard', rarity: 'starter',
    cost: 1, target: 'self', text: 'Gain {blk} block.',
    vars: { blk: 6 }, upgrade: { blk: 9 },
    effects: [{ kind: 'block', amount: 'blk' }],
    flavour: 'Cold enough to hold a shape.',
  }),
  def({
    id: 'sift', name: 'Sift', suit: 'void', type: 'skill', rarity: 'starter',
    cost: 1, target: 'none', text: 'Draw {n} cards.',
    vars: { n: 2 }, upgrade: { n: 3 },
    effects: [{ kind: 'draw', amount: 'n' }],
    flavour: 'Most of the archive is dust. You are looking for the rest.',
  }),
  def({
    id: 'temper', name: 'Temper', suit: 'iron', type: 'skill', rarity: 'starter',
    cost: 1, target: 'self', text: 'Gain {str} Strength and {blk} block.',
    vars: { str: 1, blk: 3 }, upgrade: { str: 2, blk: 4 },
    effects: [
      { kind: 'status', who: 'self', status: 'strength', amount: 'str' },
      { kind: 'block', amount: 'blk' },
    ],
    flavour: 'Heat it, fold it, hit it. Repeat until it stops arguing.',
  }),

  /* =============================================================== EMBER == */
  def({
    id: 'cinder-jab', name: 'Cinder Jab', suit: 'ember', type: 'attack', rarity: 'common',
    cost: 0, target: 'enemy', text: 'Deal {dmg} damage.',
    vars: { dmg: 5 }, upgrade: { dmg: 7 },
    effects: [{ kind: 'damage', amount: 'dmg' }],
    flavour: 'Free links make long chains.',
  }),
  def({
    id: 'flare', name: 'Flare', suit: 'ember', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage.',
    vars: { dmg: 10 }, upgrade: { dmg: 14 },
    effects: [{ kind: 'damage', amount: 'dmg' }],
  }),
  def({
    id: 'twin-spark', name: 'Twin Spark', suit: 'ember', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage {hits} times.',
    vars: { dmg: 3, hits: 2 }, upgrade: { dmg: 4 },
    effects: [{ kind: 'damage', amount: 'dmg', hits: 'hits' }],
    flavour: 'Chain bonus applies to every hit. Do the arithmetic.',
  }),
  def({
    id: 'kindle', name: 'Kindle', suit: 'ember', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Apply {burn} Burn.',
    vars: { burn: 5 }, upgrade: { burn: 8 },
    effects: [{ kind: 'status', who: 'target', status: 'burn', amount: 'burn' }],
  }),
  def({
    id: 'scorch-line', name: 'Scorch Line', suit: 'ember', type: 'attack', rarity: 'common',
    cost: 1, target: 'all-enemies', text: 'Deal {dmg} damage to ALL enemies.',
    vars: { dmg: 6 }, upgrade: { dmg: 9 },
    effects: [{ kind: 'damage-all', amount: 'dmg' }],
  }),
  def({
    id: 'backdraft', name: 'Backdraft', suit: 'ember', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage. Lose {hp} HP.',
    vars: { dmg: 14, hp: 3 }, upgrade: { dmg: 18 },
    effects: [{ kind: 'damage', amount: 'dmg' }, { kind: 'lose-hp', amount: 'hp' }],
    flavour: 'The fire goes both ways. It always did.',
  }),
  def({
    id: 'chain-lash', name: 'Chain Lash', suit: 'ember', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage, plus {per} for each point of chain.',
    vars: { dmg: 5, per: 3 }, upgrade: { per: 4 },
    effects: [{ kind: 'damage', amount: 'dmg' }, { kind: 'damage-per-chain', amount: 'per' }],
    flavour: 'The chain is the weapon. The card is just the handle.',
  }),
  def({
    id: 'emberstorm', name: 'Emberstorm', suit: 'ember', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', text: 'Deal {dmg} damage {hits} times.',
    vars: { dmg: 5, hits: 3 }, upgrade: { hits: 4 },
    effects: [{ kind: 'damage', amount: 'dmg', hits: 'hits' }],
  }),
  def({
    id: 'ashen-blade', name: 'Ashen Blade', suit: 'ember', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage. If your chain is {req} or more, draw {n}.',
    vars: { dmg: 8, req: 3, n: 2 }, upgrade: { dmg: 11 },
    effects: [
      { kind: 'damage', amount: 'dmg' },
      { kind: 'if-chain-at-least', chain: 3, then: [{ kind: 'draw', amount: 'n' }] },
    ],
  }),
  def({
    id: 'immolate', name: 'Immolate', suit: 'ember', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'all-enemies', text: 'Deal {dmg} damage and apply {burn} Burn to ALL enemies.',
    vars: { dmg: 8, burn: 4 }, upgrade: { dmg: 11, burn: 6 },
    effects: [
      { kind: 'damage-all', amount: 'dmg' },
      { kind: 'status', who: 'all-enemies', status: 'burn', amount: 'burn' },
    ],
  }),
  def({
    id: 'wildfire', name: 'Wildfire', suit: 'ember', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all-enemies', text: 'Deal {dmg} damage to ALL enemies. Exhaust.',
    vars: { dmg: 18 }, upgrade: { dmg: 25 }, exhaust: true,
    effects: [{ kind: 'damage-all', amount: 'dmg' }],
  }),
  def({
    id: 'ember-crown', name: 'Ember Crown', suit: 'ember', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', text: 'Power. Whenever your chain reaches {req}, deal {dmg} damage to ALL enemies.',
    vars: { req: 4, dmg: 6 }, upgrade: { dmg: 9 },
    effects: [],
    power: [{ on: 'chain-reached', chain: 4, effects: [{ kind: 'damage-all', amount: 6 }] }],
    flavour: 'Four links and the crown catches.',
  }),
  def({
    id: 'furnace-heart', name: 'Furnace Heart', suit: 'ember', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', text: 'Power. At the start of each turn, gain {str} Strength.',
    vars: { str: 1 }, upgrade: { str: 2 },
    effects: [],
    power: [{ on: 'turn-start', effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 1 }] }],
  }),

  /* =============================================================== FROST == */
  def({
    id: 'rime', name: 'Rime', suit: 'frost', type: 'guard', rarity: 'common',
    cost: 0, target: 'self', text: 'Gain {blk} block.',
    vars: { blk: 4 }, upgrade: { blk: 6 },
    effects: [{ kind: 'block', amount: 'blk' }],
  }),
  def({
    id: 'bulwark', name: 'Bulwark', suit: 'frost', type: 'guard', rarity: 'common',
    cost: 1, target: 'self', text: 'Gain {blk} block.',
    vars: { blk: 10 }, upgrade: { blk: 14 },
    effects: [{ kind: 'block', amount: 'blk' }],
  }),
  def({
    id: 'frostbite', name: 'Frostbite', suit: 'frost', type: 'guard', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Gain {blk} block. Apply {weak} Weak.',
    vars: { blk: 5, weak: 2 }, upgrade: { blk: 7, weak: 3 },
    effects: [
      { kind: 'block', amount: 'blk' },
      { kind: 'status', who: 'target', status: 'weak', amount: 'weak' },
    ],
  }),
  def({
    id: 'cold-snap', name: 'Cold Snap', suit: 'frost', type: 'guard', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Gain {blk} block. Apply {vuln} Vulnerable.',
    vars: { blk: 4, vuln: 2 }, upgrade: { vuln: 3 },
    effects: [
      { kind: 'block', amount: 'blk' },
      { kind: 'status', who: 'target', status: 'vulnerable', amount: 'vuln' },
    ],
  }),
  def({
    id: 'mirror-ice', name: 'Mirror Ice', suit: 'frost', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', text: 'Gain {th} Thorns.',
    vars: { th: 3 }, upgrade: { th: 5 },
    effects: [{ kind: 'status', who: 'self', status: 'thorns', amount: 'th' }],
  }),
  def({
    id: 'hoarfrost', name: 'Hoarfrost', suit: 'frost', type: 'guard', rarity: 'uncommon',
    cost: 1, target: 'self', text: 'Gain {blk} block, plus {per} for each point of chain.',
    vars: { blk: 4, per: 3 }, upgrade: { per: 4 },
    effects: [{ kind: 'block', amount: 'blk' }, { kind: 'block-per-chain', amount: 'per' }],
  }),
  def({
    id: 'glacier', name: 'Glacier', suit: 'frost', type: 'guard', rarity: 'uncommon',
    cost: 2, target: 'self', text: 'Gain {blk} block. Draw {n}.',
    vars: { blk: 16, n: 1 }, upgrade: { blk: 21 },
    effects: [{ kind: 'block', amount: 'blk' }, { kind: 'draw', amount: 'n' }],
  }),
  def({
    id: 'reflect', name: 'Reflect', suit: 'frost', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', text: 'Double your block.',
    vars: {}, upgrade: {},
    effects: [{ kind: 'double-block' }],
    flavour: 'Ice does not argue with what hits it. It copies it.',
  }),
  def({
    id: 'avalanche', name: 'Avalanche', suit: 'frost', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', text: 'Deal damage equal to your block.',
    vars: {}, upgrade: {},
    effects: [{ kind: 'damage-from-block' }],
  }),
  def({
    id: 'winters-hold', name: "Winter's Hold", suit: 'frost', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', text: 'Power. Your block is no longer cleared at the start of your turn.',
    vars: {}, upgrade: {},
    effects: [{ kind: 'status', who: 'self', status: 'anchor', amount: 1 }],
  }),
  def({
    id: 'permafrost', name: 'Permafrost', suit: 'frost', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', text: 'Power. At the start of each turn, gain {blk} block.',
    vars: { blk: 6 }, upgrade: { blk: 9 },
    effects: [],
    power: [{ on: 'turn-start', effects: [{ kind: 'block', amount: 6 }] }],
  }),

  /* ================================================================ VOID == */
  def({
    id: 'gleam', name: 'Gleam', suit: 'void', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', text: 'Draw {n} card.',
    vars: { n: 1 }, upgrade: { n: 2 },
    effects: [{ kind: 'draw', amount: 'n' }],
  }),
  def({
    id: 'rift', name: 'Rift', suit: 'void', type: 'skill', rarity: 'common',
    cost: 0, target: 'none', text: 'Gain {e} energy. Exhaust.',
    vars: { e: 2 }, upgrade: { e: 3 }, exhaust: true,
    effects: [{ kind: 'energy', amount: 'e' }],
  }),
  def({
    id: 'unspool', name: 'Unspool', suit: 'void', type: 'skill', rarity: 'common',
    cost: 1, target: 'none', text: 'Discard your hand, then draw that many cards plus {b}.',
    vars: { b: 1 }, upgrade: { b: 2 },
    effects: [{ kind: 'discard-hand-draw', bonus: 'b' }],
  }),
  def({
    id: 'shear', name: 'Shear', suit: 'void', type: 'attack', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage. Discard {n} card at random.',
    vars: { dmg: 11, n: 1 }, upgrade: { dmg: 15 },
    effects: [{ kind: 'damage', amount: 'dmg' }, { kind: 'discard', amount: 'n', random: true }],
  }),
  def({
    id: 'echo', name: 'Echo', suit: 'void', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', text: 'Play your last non-Echo card of this turn again, for free.',
    vars: { n: 1 }, upgrade: { n: 2 },
    effects: [{ kind: 'replay-last', amount: 'n' }],
    flavour: 'The archive stutters. You take advantage.',
  }),
  def({
    id: 'recur', name: 'Recur', suit: 'void', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', text: 'Shuffle your discard pile into your draw pile. Draw {n}.',
    vars: { n: 2 }, upgrade: { n: 3 },
    effects: [{ kind: 'shuffle-discard-into-draw' }, { kind: 'draw', amount: 'n' }],
  }),
  def({
    id: 'cascade', name: 'Cascade', suit: 'void', type: 'attack', rarity: 'uncommon',
    cost: 2, target: 'enemy', text: 'Deal {per} damage for each card you played this turn.',
    vars: { per: 5 }, upgrade: { per: 7 },
    effects: [{ kind: 'damage-per-card', amount: 'per' }],
  }),
  def({
    id: 'purge', name: 'Purge', suit: 'void', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'none', text: 'Exhaust your hand. Draw {n}. Gain {e} energy.',
    vars: { n: 3, e: 1 }, upgrade: { n: 4 },
    effects: [{ kind: 'exhaust-hand' }, { kind: 'draw', amount: 'n' }, { kind: 'energy', amount: 'e' }],
  }),
  def({
    id: 'long-thought', name: 'Long Thought', suit: 'void', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', text: 'Power. At the start of each turn, draw {n} extra card.',
    vars: { n: 1 }, upgrade: { n: 2 },
    effects: [],
    power: [{ on: 'turn-start', effects: [{ kind: 'draw', amount: 1 }] }],
  }),
  def({
    id: 'event-horizon', name: 'Event Horizon', suit: 'void', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', text: 'Power. Every {nth} cards you play, gain {e} energy.',
    vars: { nth: 3, e: 1 }, upgrade: { nth: 2 },
    effects: [],
    power: [{ on: 'card-played', nth: 3, effects: [{ kind: 'energy', amount: 1 }] }],
  }),

  /* ================================================================ IRON == */
  def({
    id: 'whetstone', name: 'Whetstone', suit: 'iron', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', text: 'Gain {str} Strength.',
    vars: { str: 2 }, upgrade: { str: 3 },
    effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 'str' }],
  }),
  def({
    id: 'second-skin', name: 'Second Skin', suit: 'iron', type: 'skill', rarity: 'common',
    cost: 1, target: 'self', text: 'Gain {g} Guard.',
    vars: { g: 2 }, upgrade: { g: 3 },
    effects: [{ kind: 'status', who: 'self', status: 'guard', amount: 'g' }],
  }),
  def({
    id: 'forge-ahead', name: 'Forge Ahead', suit: 'iron', type: 'skill', rarity: 'common',
    cost: 0, target: 'self', text: 'Gain {str} Strength. Lose {hp} HP.',
    vars: { str: 2, hp: 4 }, upgrade: { hp: 2 },
    effects: [
      { kind: 'status', who: 'self', status: 'strength', amount: 'str' },
      { kind: 'lose-hp', amount: 'hp' },
    ],
  }),
  def({
    id: 'shackle', name: 'Shackle', suit: 'iron', type: 'skill', rarity: 'common',
    cost: 1, target: 'enemy', text: 'Apply {weak} Weak and {frail} Frail.',
    vars: { weak: 2, frail: 2 }, upgrade: { weak: 3, frail: 3 },
    effects: [
      { kind: 'status', who: 'target', status: 'weak', amount: 'weak' },
      { kind: 'status', who: 'target', status: 'frail', amount: 'frail' },
    ],
  }),
  def({
    id: 'litany', name: 'Litany', suit: 'iron', type: 'skill', rarity: 'uncommon',
    cost: 1, target: 'self', text: 'Gain {r} Resolve. (Start each turn with that much chain.)',
    vars: { r: 1 }, upgrade: { r: 2 },
    effects: [{ kind: 'status', who: 'self', status: 'resolve', amount: 'r' }],
    flavour: 'Say it enough times and the first link is already there.',
  }),
  def({
    id: 'reforge', name: 'Reforge', suit: 'iron', type: 'skill', rarity: 'uncommon',
    cost: 2, target: 'self', text: 'Gain {str} Strength and {g} Guard.',
    vars: { str: 2, g: 2 }, upgrade: { str: 3, g: 3 },
    effects: [
      { kind: 'status', who: 'self', status: 'strength', amount: 'str' },
      { kind: 'status', who: 'self', status: 'guard', amount: 'g' },
    ],
  }),
  def({
    id: 'anvil-stance', name: 'Anvil Stance', suit: 'iron', type: 'guard', rarity: 'uncommon',
    cost: 1, target: 'self', text: 'Gain {blk} block and {th} Thorns.',
    vars: { blk: 7, th: 3 }, upgrade: { blk: 10, th: 4 },
    effects: [
      { kind: 'block', amount: 'blk' },
      { kind: 'status', who: 'self', status: 'thorns', amount: 'th' },
    ],
  }),
  def({
    id: 'proof', name: 'Proof', suit: 'iron', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage. If your chain is {req} or more, deal {dmg} again.',
    vars: { dmg: 7, req: 2 }, upgrade: { dmg: 10 },
    effects: [
      { kind: 'damage', amount: 'dmg' },
      { kind: 'if-chain-at-least', chain: 2, then: [{ kind: 'damage', amount: 'dmg' }] },
    ],
  }),
  def({
    id: 'rite-of-iron', name: 'Rite of Iron', suit: 'iron', type: 'power', rarity: 'rare',
    cost: 2, target: 'self', text: 'Gain {r} Resolve. Exhaust.',
    vars: { r: 3 }, upgrade: { r: 4 }, exhaust: true,
    effects: [{ kind: 'status', who: 'self', status: 'resolve', amount: 'r' }],
  }),
  def({
    id: 'unbreakable', name: 'Unbreakable', suit: 'iron', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', text: 'Power. At the start of each turn, gain {g} Guard.',
    vars: { g: 2 }, upgrade: { g: 3 },
    effects: [],
    power: [{ on: 'turn-start', effects: [{ kind: 'status', who: 'self', status: 'guard', amount: 2 }] }],
  }),

  /* =============================================================== PRISM == */
  def({
    id: 'facet', name: 'Facet', suit: 'prism', type: 'skill', rarity: 'uncommon',
    cost: 0, target: 'none', text: 'Draw {n} card. Prism: never breaks your chain.',
    vars: { n: 1 }, upgrade: { n: 2 },
    effects: [{ kind: 'draw', amount: 'n' }],
  }),
  def({
    id: 'prism-shard', name: 'Prism Shard', suit: 'prism', type: 'attack', rarity: 'uncommon',
    cost: 1, target: 'enemy', text: 'Deal {dmg} damage. Prism: never breaks your chain.',
    vars: { dmg: 8 }, upgrade: { dmg: 12 },
    effects: [{ kind: 'damage', amount: 'dmg' }],
  }),
  def({
    id: 'prism-ward', name: 'Prism Ward', suit: 'prism', type: 'guard', rarity: 'uncommon',
    cost: 1, target: 'self', text: 'Gain {blk} block. Prism: never breaks your chain.',
    vars: { blk: 8 }, upgrade: { blk: 12 },
    effects: [{ kind: 'block', amount: 'blk' }],
  }),
  def({
    id: 'refraction', name: 'Refraction', suit: 'prism', type: 'skill', rarity: 'rare',
    cost: 1, target: 'none', text: 'Gain {c} chain.',
    vars: { c: 3 }, upgrade: { c: 4 },
    effects: [{ kind: 'chain', amount: 'c' }],
    flavour: 'Light does not have to travel in a straight line to arrive.',
  }),
  def({
    id: 'kaleidoscope', name: 'Kaleidoscope', suit: 'prism', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', text: 'Power. Start each turn with {c} chain and gain {c} chain now.',
    vars: { c: 2 }, upgrade: { c: 3 },
    effects: [
      { kind: 'status', who: 'self', status: 'resolve', amount: 'c' },
      { kind: 'chain', amount: 'c' },
    ],
  }),

  /* ========================================================== SIGNATURES == */
  def({
    id: 'concordance', name: 'Concordance', suit: 'iron', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', classes: ['archivist'],
    text: 'Power. At the start of each turn, gain {c} chain and {blk} block.',
    vars: { c: 1, blk: 3 }, upgrade: { blk: 5 },
    effects: [],
    power: [{ on: 'turn-start', effects: [
      { kind: 'chain', amount: 1 },
      { kind: 'block', amount: 3 },
    ] }],
    flavour: 'Everything cross-referenced against everything else, forever.',
  }),
  def({
    id: 'cross-reference', name: 'Cross-Reference', suit: 'prism', type: 'skill', rarity: 'rare',
    cost: 1, target: 'none', classes: ['archivist'],
    text: 'Gain {c} chain. Draw {n}.',
    vars: { c: 2, n: 1 }, upgrade: { n: 2 },
    effects: [{ kind: 'chain', amount: 'c' }, { kind: 'draw', amount: 'n' }],
  }),
  def({
    id: 'bellows', name: 'Bellows', suit: 'ember', type: 'power', rarity: 'rare',
    cost: 1, target: 'none', classes: ['kindler'],
    text: 'Power. Whenever you play an Ember card, deal {dmg} damage to a random enemy.',
    vars: { dmg: 3 }, upgrade: { dmg: 5 },
    effects: [],
    power: [{ on: 'card-played', suit: 'ember', effects: [{ kind: 'damage', amount: 3 }] }],
  }),
  def({
    id: 'conflagration', name: 'Conflagration', suit: 'ember', type: 'attack', rarity: 'rare',
    cost: 2, target: 'all-enemies', classes: ['kindler'],
    text: 'Deal {dmg} damage to ALL enemies, plus {per} more for each point of chain.',
    vars: { dmg: 5, per: 4 }, upgrade: { per: 6 },
    effects: [
      { kind: 'damage-all', amount: 'dmg' },
      { kind: 'damage-all-per-chain', amount: 'per' },
    ],
    flavour: 'The whole shelf at once.',
  }),
  def({
    id: 'riposte', name: 'Riposte', suit: 'frost', type: 'attack', rarity: 'rare',
    cost: 1, target: 'enemy', classes: ['warden'],
    text: 'Gain {blk} block, then deal damage equal to your block.',
    vars: { blk: 8 }, upgrade: { blk: 12 },
    effects: [{ kind: 'block', amount: 'blk' }, { kind: 'damage-from-block' }],
  }),
  def({
    id: 'standing-stone', name: 'Standing Stone', suit: 'iron', type: 'power', rarity: 'rare',
    cost: 2, target: 'none', classes: ['warden'],
    text: 'Power. At the start of each turn, gain {blk} block and {str} Strength.',
    vars: { blk: 5, str: 1 }, upgrade: { blk: 8 },
    effects: [],
    power: [{ on: 'turn-start', effects: [
      { kind: 'block', amount: 5 },
      { kind: 'status', who: 'self', status: 'strength', amount: 1 },
    ] }],
  }),

  /* ============================================================== CURSES == */
  def({
    id: 'doubt', name: 'Doubt', suit: 'void', type: 'curse', rarity: 'special',
    cost: 0, target: 'none', text: 'Unplayable. While in hand, lose {hp} HP at the end of your turn.',
    vars: { hp: 2 }, unplayable: true,
    effects: [],
    flavour: 'It only asks one question, and it asks it forever.',
  }),
  def({
    id: 'slag', name: 'Slag', suit: 'iron', type: 'curse', rarity: 'special',
    cost: 0, target: 'none', text: 'Unplayable. Breaks your chain when drawn.',
    vars: {}, unplayable: true,
    effects: [],
  }),

  /* ===================================================== GENERATED TOKENS == */
  def({
    id: 'spark', name: 'Spark', suit: 'ember', type: 'attack', rarity: 'special',
    cost: 0, target: 'enemy', text: 'Deal {dmg} damage. Exhaust.',
    vars: { dmg: 5 }, exhaust: true,
    effects: [{ kind: 'damage', amount: 'dmg' }],
  }),
];

/* ------------------------------------------------------------- lookups --- */

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export function cardDef(id: string): CardDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unknown card: ${id}`);
  return d;
}

/** Cards that can legitimately show up as a reward or in a shop. */
export const POOL = CARDS.filter(
  (c) => c.rarity === 'common' || c.rarity === 'uncommon' || c.rarity === 'rare',
);

/** The pool a given character actually draws from. */
export function poolFor(characterId: string): CardDef[] {
  return POOL.filter((c) => !c.classes || c.classes.includes(characterId));
}

/* --------------------------------------------------------- instantiation -- */

let uidCounter = 0;
export function makeCard(defId: string, upgrades = 0, temporary = false): Card {
  cardDef(defId); // validate early — a typo in content should not survive to combat
  return { uid: `c${(++uidCounter).toString(36)}`, defId, upgrades, temporary };
}

/* ----------------------------------------------------------- description -- */

/** A card's numbers after upgrades. Upgrading twice applies the delta twice
 *  for additive-looking values by re-deriving from the upgrade table. */
export function cardVars(card: Card): Record<string, number> {
  const d = cardDef(card.defId);
  const vars: Record<string, number> = { ...d.vars };
  if (card.upgrades > 0 && d.upgrade) {
    for (const [key, upgraded] of Object.entries(d.upgrade)) {
      const base = d.vars[key] ?? 0;
      vars[key] = base + (upgraded - base) * card.upgrades;
    }
  }
  return vars;
}

export function cardName(card: Card): string {
  const d = cardDef(card.defId);
  return card.upgrades > 0 ? `${d.name}${'+'.repeat(Math.min(card.upgrades, 2))}` : d.name;
}

/** Fills `{var}` placeholders with the card's live numbers. */
export function describeCard(card: Card): string {
  const d = cardDef(card.defId);
  const vars = cardVars(card);
  return d.text.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export function canUpgrade(card: Card): boolean {
  const d = cardDef(card.defId);
  return d.rarity !== 'special' && !!d.upgrade && Object.keys(d.upgrade).length > 0 && card.upgrades < 1;
}
