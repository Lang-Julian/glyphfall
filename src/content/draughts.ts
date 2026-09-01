import type { Effect } from '../core/types.js';

/**
 * Draughts — the run's emergency brakes.
 *
 * A deckbuilder without consumables punishes bad luck twice: once when the bad
 * hand arrives and again when there is nothing to do about it. Three slots of
 * one-shot power is enough to rescue a turn without deciding a run.
 */
export interface DraughtDef {
  id: string;
  name: string;
  glyph: string;
  price: number;
  text: string;
  /** Usable outside combat (healing only). */
  outOfCombat?: boolean;
  effects: readonly Effect[];
}

export const DRAUGHTS: readonly DraughtDef[] = [
  { id: 'ember-draught', name: 'Ember Draught', glyph: '◆', price: 55,
    text: 'Deal 22 damage to one enemy.',
    effects: [{ kind: 'damage', amount: 22 }] },
  { id: 'frost-draught', name: 'Frost Draught', glyph: '▲', price: 50,
    text: 'Gain 22 block.',
    effects: [{ kind: 'block', amount: 22 }] },
  { id: 'void-draught', name: 'Void Draught', glyph: '●', price: 55,
    text: 'Draw 3 cards and gain 1 energy.',
    effects: [{ kind: 'draw', amount: 3 }, { kind: 'energy', amount: 1 }] },
  { id: 'iron-draught', name: 'Iron Draught', glyph: '■', price: 60,
    text: 'Gain 3 Strength.',
    effects: [{ kind: 'status', who: 'self', status: 'strength', amount: 3 }] },
  { id: 'prism-draught', name: 'Prism Draught', glyph: '◉', price: 70,
    text: 'Gain 4 chain.',
    effects: [{ kind: 'chain', amount: 4 }] },
  { id: 'mending-draught', name: 'Mending Draught', glyph: '+', price: 60,
    text: 'Heal 25 HP. Can be used outside combat.',
    outOfCombat: true,
    effects: [{ kind: 'heal', amount: 25 }] },
  { id: 'scouring-draught', name: 'Scouring Draught', glyph: '×', price: 65,
    text: 'Apply 3 Weak and 3 Vulnerable to all enemies.',
    effects: [
      { kind: 'status', who: 'all-enemies', status: 'weak', amount: 3 },
      { kind: 'status', who: 'all-enemies', status: 'vulnerable', amount: 3 },
    ] },
];

export const MAX_DRAUGHTS = 3;

const BY_ID = new Map(DRAUGHTS.map((d) => [d.id, d]));

export function draughtDef(id: string): DraughtDef {
  const d = BY_ID.get(id);
  if (!d) throw new Error(`Unknown draught: ${id}`);
  return d;
}
