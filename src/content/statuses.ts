import type { StatusDef, StatusId } from '../core/types.js';

/**
 * `decay` semantics, applied at the end of the owner's turn:
 *   none — sticks until combat ends (strength, guard)
 *   one  — loses exactly 1 (burn, regen: they tick, then shrink)
 *   turn — drops to 0 (weak, vulnerable and friends last "N turns", so they
 *          actually decay by 1 too; 'turn' means "counts down and expires")
 */
export const STATUSES: Record<StatusId, StatusDef> = {
  strength:   { id: 'strength',   name: 'Strength',   glyph: 'STR', hint: '+N damage per attack instance.',        decay: 'none', good: true  },
  guard:      { id: 'guard',      name: 'Guard',      glyph: 'GRD', hint: '+N block whenever you gain block.',     decay: 'none', good: true  },
  weak:       { id: 'weak',       name: 'Weak',       glyph: 'WKN', hint: 'Deals 25% less attack damage.',         decay: 'turn', good: false },
  vulnerable: { id: 'vulnerable', name: 'Vulnerable', glyph: 'VUL', hint: 'Takes 50% more attack damage.',         decay: 'turn', good: false },
  frail:      { id: 'frail',      name: 'Frail',      glyph: 'FRL', hint: 'Gains 25% less block.',                 decay: 'turn', good: false },
  burn:       { id: 'burn',       name: 'Burn',       glyph: 'BRN', hint: 'Take N damage at end of turn, then N-1.', decay: 'one',  good: false },
  regen:      { id: 'regen',      name: 'Regen',      glyph: 'RGN', hint: 'Heal N at end of turn, then N-1.',      decay: 'one',  good: true  },
  thorns:     { id: 'thorns',     name: 'Thorns',     glyph: 'THN', hint: 'Attackers take N damage.',              decay: 'none', good: true  },
  resolve:    { id: 'resolve',    name: 'Resolve',    glyph: 'RSV', hint: 'Start each turn with N chain.',         decay: 'none', good: true  },
  anchor:     { id: 'anchor',     name: 'Anchor',     glyph: 'ANC', hint: 'Block is no longer cleared each turn.', decay: 'none', good: true  },
  stun:       { id: 'stun',       name: 'Stunned',    glyph: 'STN', hint: 'Loses its next turn.',                  decay: 'turn', good: false },
};

export const STATUS_ORDER: readonly StatusId[] = [
  'strength', 'guard', 'thorns', 'regen', 'resolve', 'anchor',
  'weak', 'vulnerable', 'frail', 'burn', 'stun',
];
