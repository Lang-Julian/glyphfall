/**
 * Balance report.
 *
 * Plays N runs headlessly at each difficulty depth and prints the win rate and
 * where runs end. Used to keep tuning honest: a change that makes act 2 a wall
 * shows up here as a cliff in the "reached" column rather than as a vibe.
 *
 *   node scripts/balance.mjs [runs] [maxDepth]
 */
import { simulateBatch } from '../dist/game/autoplay.js';

const runs = Number(process.argv[2] ?? 200);
const maxDepth = Number(process.argv[3] ?? 4);

console.log(`glyphfall balance — ${runs} runs per depth\n`);
console.log('depth   win%   median floor   reached act 3   avg best chain');
console.log('-----   ----   ------------   -------------   --------------');

let anyWin = false;
for (let depth = 0; depth <= maxDepth; depth++) {
  const batch = simulateBatch(runs, depth, `ci-${depth}`);
  const act3 = batch.results.filter((r) => r.act >= 3).length;
  if (batch.winRate > 0) anyWin = true;
  console.log(
    `${String(depth).padStart(5)}   ${(batch.winRate * 100).toFixed(1).padStart(4)}   ` +
    `${String(batch.medianFloors).padStart(12)}   ` +
    `${`${((act3 / runs) * 100).toFixed(0)}%`.padStart(13)}   ` +
    `${batch.avgBestChain.toFixed(1).padStart(14)}`,
  );
}

const base = simulateBatch(runs, 0, 'ci-0');
console.log();
if (!anyWin) {
  console.error('FAIL: no run was won at any depth — the game may be unwinnable.');
  process.exit(1);
}
if (base.winRate > 0.8) {
  console.error(`FAIL: depth 0 win rate ${base.winRate} — the game is trivial.`);
  process.exit(1);
}
if (base.medianFloors < 9) {
  console.error(`FAIL: median floor ${base.medianFloors} — act 1 is too lethal.`);
  process.exit(1);
}
console.log('balance ok');
