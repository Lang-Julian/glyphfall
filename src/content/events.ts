/**
 * Events.
 *
 * Every event is a *priced* decision: something the run wants, and a cost paid
 * in the resource the run can least afford. An event with a strictly-best
 * option is a loading screen, so none of these have one.
 */
export interface EventOption {
  label: string;
  detail: string;
  /** Executed by the run layer; see `applyEventOutcome`. */
  outcome: EventOutcome;
}

export type EventOutcome =
  | { kind: 'gold'; amount: number }
  | { kind: 'hp'; amount: number }
  | { kind: 'maxHp'; amount: number }
  | { kind: 'heal-percent'; percent: number }
  | { kind: 'relic'; rarity: 'common' | 'uncommon' | 'rare' }
  | { kind: 'card'; rarity: 'common' | 'uncommon' | 'rare' }
  | { kind: 'curse'; defId: string }
  | { kind: 'upgrade-random'; count: number }
  | { kind: 'remove-card' }
  | { kind: 'draught' }
  | { kind: 'nothing' }
  | { kind: 'combo'; of: readonly EventOutcome[] };

export interface EventDef {
  id: string;
  title: string;
  /** Two to four lines of scene-setting. Kept short: this is a card game. */
  body: readonly string[];
  acts: readonly number[];
  options: readonly EventOption[];
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'the-lamplighter', title: 'The Lamplighter', acts: [1, 2, 3],
    body: [
      'A figure is refilling lamps that have no wicks left to burn.',
      'She does not look up. "You can take oil, or you can take the lamp.',
      'Not both. The lamp remembers who carried it."',
    ],
    options: [
      { label: 'Take the oil', detail: 'Heal 20% of your max HP.', outcome: { kind: 'heal-percent', percent: 0.2 } },
      { label: 'Take the lamp', detail: 'Gain a common relic. Lose 8 max HP.', outcome: { kind: 'combo', of: [{ kind: 'relic', rarity: 'common' }, { kind: 'maxHp', amount: -8 }] } },
      { label: 'Leave her to it', detail: 'Nothing happens.', outcome: { kind: 'nothing' } },
    ],
  },
  {
    id: 'the-ledger', title: 'The Open Ledger', acts: [1, 2],
    body: [
      'A ledger lies open, every entry in a hand very much like yours.',
      'The last line is blank and the pen is still wet.',
    ],
    options: [
      { label: 'Sign it', detail: 'Gain 120 gold. Add a Doubt to your deck.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: 120 }, { kind: 'curse', defId: 'doubt' }] } },
      { label: 'Cross it out', detail: 'Remove a card from your deck.', outcome: { kind: 'remove-card' } },
      { label: 'Close the book', detail: 'Nothing happens.', outcome: { kind: 'nothing' } },
    ],
  },
  {
    id: 'the-forge', title: 'The Cold Forge', acts: [1, 2, 3],
    body: [
      'The coals are out but the anvil is warm to the touch.',
      'Something was finished here very recently, and in a hurry.',
    ],
    options: [
      { label: 'Work the bellows', detail: 'Upgrade 2 random cards. Lose 10 HP.', outcome: { kind: 'combo', of: [{ kind: 'upgrade-random', count: 2 }, { kind: 'hp', amount: -10 }] } },
      { label: 'Pocket the scrap', detail: 'Gain 75 gold.', outcome: { kind: 'gold', amount: 75 } },
      { label: 'Bank the coals', detail: 'Gain a draught.', outcome: { kind: 'draught' } },
    ],
  },
  {
    id: 'salt-well', title: 'The Salt Well', acts: [1, 2],
    body: [
      'The water is white and perfectly still. Coins glitter at the bottom.',
      'A sign, in five languages: TAKE OR DRINK.',
    ],
    options: [
      { label: 'Drink', detail: 'Gain 12 max HP and heal fully.', outcome: { kind: 'combo', of: [{ kind: 'maxHp', amount: 12 }, { kind: 'heal-percent', percent: 1 }] } },
      { label: 'Take the coins', detail: 'Gain 150 gold. Lose 12 HP.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: 150 }, { kind: 'hp', amount: -12 }] } },
    ],
  },
  {
    id: 'the-collector', title: 'The Collector', acts: [2, 3],
    body: [
      'A dealer with too many coats spreads three objects on a cloth.',
      '"One is worth more than the other two. I have forgotten which."',
    ],
    options: [
      { label: 'Pay 90 gold', detail: 'Gain an uncommon relic.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: -90 }, { kind: 'relic', rarity: 'uncommon' }] } },
      { label: 'Trade a memory', detail: 'Gain a rare relic. Add a Doubt.', outcome: { kind: 'combo', of: [{ kind: 'relic', rarity: 'rare' }, { kind: 'curse', defId: 'doubt' }] } },
      { label: 'Walk on', detail: 'Nothing happens.', outcome: { kind: 'nothing' } },
    ],
  },
  {
    id: 'chain-shrine', title: 'The Shrine of Links', acts: [1, 2, 3],
    body: [
      'A chain hangs from the ceiling to the floor with no ends visible.',
      'Every link is a different glyph. None of them repeat.',
    ],
    options: [
      { label: 'Add a link', detail: 'Gain a card of your choice.', outcome: { kind: 'card', rarity: 'uncommon' } },
      { label: 'Remove a link', detail: 'Remove a card from your deck. Lose 6 HP.', outcome: { kind: 'combo', of: [{ kind: 'remove-card' }, { kind: 'hp', amount: -6 }] } },
      { label: 'Pull hard', detail: 'Gain a rare card. Lose 18 HP.', outcome: { kind: 'combo', of: [{ kind: 'card', rarity: 'rare' }, { kind: 'hp', amount: -18 }] } },
    ],
  },
  {
    id: 'the-mirror', title: 'The Mirror That Waits', acts: [2, 3],
    body: [
      'It shows the room, correct in every detail, except that you are not in it.',
      'Reaching toward it, your reflection reaches first.',
    ],
    options: [
      { label: 'Step through', detail: 'Upgrade 3 random cards. Lose 15% max HP.', outcome: { kind: 'combo', of: [{ kind: 'upgrade-random', count: 3 }, { kind: 'maxHp', amount: -12 }] } },
      { label: 'Break it', detail: 'Gain 110 gold and a draught.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: 110 }, { kind: 'draught' }] } },
    ],
  },
  {
    id: 'rest-of-strangers', title: 'A Rest of Strangers', acts: [1, 2, 3],
    body: [
      'Four bedrolls, three of them occupied by people who will not wake.',
      'The fourth has been made up carefully, as if for an expected guest.',
    ],
    options: [
      { label: 'Sleep', detail: 'Heal 35% of your max HP.', outcome: { kind: 'heal-percent', percent: 0.35 } },
      { label: 'Search the packs', detail: 'Gain 60 gold and a common relic. Lose 8 HP.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: 60 }, { kind: 'relic', rarity: 'common' }, { kind: 'hp', amount: -8 }] } },
    ],
  },
  {
    id: 'the-appraiser', title: 'The Appraiser', acts: [1, 2, 3],
    body: [
      'She weighs your deck by eye and clicks her tongue.',
      '"Too many of these. Not enough of those. I can fix one of those problems."',
    ],
    options: [
      { label: 'Fix the first', detail: 'Remove a card from your deck.', outcome: { kind: 'remove-card' } },
      { label: 'Fix the second', detail: 'Gain an uncommon card.', outcome: { kind: 'card', rarity: 'uncommon' } },
      { label: 'Pay for both', detail: 'Costs 100 gold.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: -100 }, { kind: 'remove-card' }, { kind: 'card', rarity: 'uncommon' }] } },
    ],
  },
  {
    id: 'furnace-mouth', title: 'The Furnace Mouth', acts: [2, 3],
    body: [
      'Heat comes off it in slabs. Somebody has left an offering bowl.',
      'The bowl is empty. The furnace is not.',
    ],
    options: [
      { label: 'Feed it a card', detail: 'Remove a card. Gain a rare card.', outcome: { kind: 'combo', of: [{ kind: 'remove-card' }, { kind: 'card', rarity: 'rare' }] } },
      { label: 'Feed it blood', detail: 'Lose 20 HP. Gain a rare relic.', outcome: { kind: 'combo', of: [{ kind: 'hp', amount: -20 }, { kind: 'relic', rarity: 'rare' }] } },
      { label: 'Feed it nothing', detail: 'Gain 40 gold.', outcome: { kind: 'gold', amount: 40 } },
    ],
  },
  {
    id: 'the-cartographer', title: 'The Cartographer', acts: [1, 2, 3],
    body: [
      'He is drawing the floor you are standing on, at a scale of one to one.',
      '"Almost done," he says, and has clearly been saying it for years.',
    ],
    options: [
      { label: 'Help him', detail: 'Gain 90 gold. Lose 8 HP.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: 90 }, { kind: 'hp', amount: -8 }] } },
      { label: 'Buy the map', detail: 'Costs 70 gold. Heal 30% of max HP.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: -70 }, { kind: 'heal-percent', percent: 0.3 } ] } },
      { label: 'Steal a page', detail: 'Gain a common relic. Add a Slag.', outcome: { kind: 'combo', of: [{ kind: 'relic', rarity: 'common' }, { kind: 'curse', defId: 'slag' }] } },
    ],
  },
  {
    id: 'quiet-floor', title: 'The Quiet Floor', acts: [1, 2, 3],
    body: [
      'Nothing lives here. Nothing has for a long time.',
      'It is, briefly, restful.',
    ],
    options: [
      { label: 'Catch your breath', detail: 'Heal 25% of your max HP.', outcome: { kind: 'heal-percent', percent: 0.25 } },
      { label: 'Search anyway', detail: 'Gain 55 gold and a draught.', outcome: { kind: 'combo', of: [{ kind: 'gold', amount: 55 }, { kind: 'draught' }] } },
    ],
  },
];

export function eventsForAct(act: number): EventDef[] {
  return EVENTS.filter((e) => e.acts.includes(act));
}
