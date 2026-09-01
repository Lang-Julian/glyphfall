/**
 * Human-shaped seeds.
 *
 * A seed you can read out loud is a seed people share. Runs are named like
 * `ember-hollow-412` instead of `1839244711`, and any string a player types is
 * accepted verbatim so "for-thomas" is a perfectly valid seed.
 */
import { Rng } from './rng.js';

const ADJECTIVES = [
  'ember', 'hollow', 'glass', 'iron', 'pale', 'salt', 'thorn', 'ash', 'frost',
  'quiet', 'crooked', 'gilded', 'starved', 'velvet', 'brittle', 'sunken',
  'humming', 'copper', 'rotten', 'lucid', 'stark', 'wound', 'dim', 'raw',
];

const NOUNS = [
  'lantern', 'spire', 'hymn', 'archive', 'furnace', 'mirror', 'orchard',
  'ledger', 'gate', 'chorus', 'engine', 'harvest', 'vault', 'signal', 'moth',
  'anvil', 'tide', 'cinder', 'grammar', 'compass', 'wake', 'root', 'bell',
];

/** A fresh, pronounceable seed. */
export function randomSeed(): string {
  const r = new Rng(`${Date.now()}:${Math.random()}:${process.pid}`);
  return `${r.pick(ADJECTIVES)}-${r.pick(NOUNS)}-${r.int(100, 999)}`;
}

/** The seed everyone playing the daily gets, keyed to the UTC calendar day. */
export function dailySeed(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  const r = new Rng(`glyphfall-daily-${day}`);
  return `daily-${day}-${r.pick(ADJECTIVES)}${r.pick(NOUNS)}`;
}

/** Normalise player input without destroying intent: trim, lowercase, collapse space. */
export function normaliseSeed(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, '-');
  return cleaned.length > 0 ? cleaned.slice(0, 64) : randomSeed();
}
