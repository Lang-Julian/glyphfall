/**
 * Library surface.
 *
 * The engine is exported separately from the CLI so the combat rules can be
 * driven headlessly — by the test suite, by a balance sweep, or by anyone who
 * wants to build a different front end on top of the same game.
 */
export * from './core/rng.js';
export * from './core/seed.js';
export type * from './core/types.js';
export * from './content/cards.js';
export * from './content/enemies.js';
export * from './content/relics.js';
export * from './content/draughts.js';
export * from './content/events.js';
export * from './content/statuses.js';
export * from './game/combat.js';
export * from './game/map.js';
export * from './game/run.js';
export * from './game/score.js';
export * from './content/characters.js';
export * from './game/autoplay.js';
export { version } from './version.js';
