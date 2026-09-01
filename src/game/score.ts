import { characterDef } from '../content/characters.js';
import { ACTS, type RunState } from './run.js';

/**
 * Run scoring.
 *
 * A roguelike needs a number to beat on the runs you lose, or a loss is just an
 * ending. The weights say what the game thinks is worth doing: killing elites
 * and bosses, going deep, and — because it is the mechanic the whole game is
 * built on — running a long chain.
 */

export interface ScoreLine {
  label: string;
  points: number;
}

export interface RunScore {
  lines: readonly ScoreLine[];
  /** Sum of the lines, before the difficulty multiplier. */
  subtotal: number;
  multiplier: number;
  total: number;
}

export function scoreRun(run: RunState, outcome: 'won' | 'lost'): RunScore {
  const lines: ScoreLine[] = [];
  const add = (label: string, points: number): void => {
    if (points !== 0) lines.push({ label, points });
  };

  add(`floors cleared (${run.stats.floorsCleared})`, run.stats.floorsCleared * 12);
  add(`fights won (${run.stats.fightsWon})`, run.stats.fightsWon * 8);
  add(`elites killed (${run.stats.elitesKilled})`, run.stats.elitesKilled * 35);
  add(`bosses killed (${run.stats.bossesKilled})`, run.stats.bossesKilled * 90);
  add(`longest chain (${run.stats.bestChain})`, run.stats.bestChain * 18);
  add(`gold kept (${run.gold})`, Math.floor(run.gold / 10));
  if (outcome === 'won') {
    add('the Fall broken', 400);
    add(`health remaining (${run.hp})`, run.hp * 2);
  }

  const subtotal = lines.reduce((sum, l) => sum + l.points, 0);
  const multiplier = 1 + run.depth * 0.12;
  return {
    lines,
    subtotal,
    multiplier,
    total: Math.max(0, Math.round(subtotal * multiplier)),
  };
}

/**
 * A one-line summary built to be pasted somewhere.
 *
 * Everything needed to reproduce the run is in it, seed included, so "beat
 * this" is a complete instruction rather than a boast.
 */
export function shareLine(run: RunState, outcome: 'won' | 'lost'): string {
  const score = scoreRun(run, outcome);
  // Kept short enough to survive an 80-column terminal and a chat window.
  const parts = [
    'glyphfall',
    characterDef(run.character).name.replace(/^The /, '').toLowerCase(),
    run.seed,
    `d${run.depth}`,
    outcome === 'won' ? `won ${ACTS}/${ACTS}` : `floor ${run.stats.floorsCleared}`,
    `chain ${run.stats.bestChain}`,
    `${score.total} pts`,
  ];
  return parts.join(' · ');
}
