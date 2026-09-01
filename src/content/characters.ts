import type { Suit } from '../core/types.js';

/**
 * The characters.
 *
 * Three ways to hold the same deck of cards. Each one is defined by four
 * things and nothing else — health, a starting deck, a starting relic, and a
 * suit the rewards lean toward — because that is enough to make runs feel
 * different without splitting the card pool into three thin ones.
 *
 * Two signature rares each carry the identity further; everything else in the
 * pool is shared, so no character ever runs out of interesting rewards.
 */
export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  /** Two or three lines on the character select screen. */
  blurb: readonly string[];
  /** One line naming what the character is actually good at. */
  playstyle: string;
  maxHp: number;
  startingRelic: string;
  deck: readonly string[];
  /** Rewards lean toward this suit. Omitted means an even spread. */
  affinity?: Suit;
  art: readonly string[];
}

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'archivist',
    name: 'The Archivist',
    title: 'keeps the record',
    blurb: [
      'She has read every glyph on every floor and filed each one.',
      'The Fall is, to her, a cataloguing problem with teeth.',
    ],
    playstyle: 'Balanced. The chain, learned properly.',
    maxHp: 78,
    startingRelic: 'first-link',
    deck: ['strike', 'strike', 'strike', 'strike', 'ward', 'ward', 'ward', 'ward', 'sift', 'temper'],
    art: [
      '   .---.   ',
      '  ( o o )  ',
      '  /|===|\\  ',
      '   |   |   ',
    ],
  },
  {
    id: 'kindler',
    name: 'The Kindler',
    title: 'burns the record',
    blurb: [
      'He decided the archive was the problem, not the solution.',
      'He is not wrong. He is also not careful.',
    ],
    playstyle: 'Aggressive. Long ember chains, thin margins.',
    maxHp: 72,
    startingRelic: 'ashheart',
    deck: ['strike', 'strike', 'strike', 'strike', 'ward', 'ward', 'ward', 'cinder-jab', 'cinder-jab', 'whetstone'],
    affinity: 'ember',
    art: [
      '   \\ | /   ',
      '  ( >o< )  ',
      '  /|~~~|\\  ',
      '   / \\     ',
    ],
  },
  {
    id: 'warden',
    name: 'The Warden',
    title: 'guards the record',
    blurb: [
      'Posted at a door that stopped having another side a long time ago.',
      'Still there. Still counting.',
    ],
    playstyle: 'Defensive. Outlast, then turn the wall into a weapon.',
    maxHp: 86,
    startingRelic: 'ballast',
    deck: ['strike', 'strike', 'strike', 'ward', 'ward', 'ward', 'ward', 'ward', 'rime', 'temper'],
    affinity: 'frost',
    art: [
      '  [=====]  ',
      '  | o o |  ',
      '  |_____|  ',
      '  /|   |\\  ',
    ],
  },
];

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function characterDef(id: string): CharacterDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unknown character: ${id}`);
  return d;
}

export const DEFAULT_CHARACTER = 'archivist';
