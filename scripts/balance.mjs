/**
 * Balance report.
 *
 * Plays N runs headlessly at each difficulty depth and for each character, and
 * prints where those runs ended. Used to keep tuning honest: a change that turns
 * act 2 into a wall shows up here as a cliff in the "reached act 3" column
 * rather than as a vibe.
 *
 *   node scripts/balance.mjs [runs] [maxDepth]
 */
import { simulateBatch } from '../dist/game/autoplay.js';
import { CHARACTERS } from '../dist/content/characters.js';

const runs = Number(process.argv[2] ?? 200);
const maxDepth = Number(process.argv[3] ?? 4);

console.log(`glyphfall balance — ${runs} runs per cell\n`);

console.log('character     depth 0   depth 2   depth 4');
console.log('------------  -------   -------   -------');
const perCharacter = new Map();
for (const character of CHARACTERS) {
  const cells = [0, 2, 4].map((depth) => {
    const batch = simulateBatch(runs, depth, `ci-${character.id}`, character.id);
    if (depth === 0) perCharacter.set(character.id, batch);
    return `${(batch.winRate * 100).toFixed(0)}%`.padStart(7);
  });
  console.log(`${character.id.padEnd(13)} ${cells.join('   ')}`);
}

console.log('\ndepth   win%   median floor   reached act 3   avg best chain');
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

console.log();
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

if (!anyWin) fail('no run was won at any depth — the game may be unwinnable.');

for (const [id, batch] of perCharacter) {
  if (batch.winRate < 0.05) fail(`${id} wins ${(batch.winRate * 100).toFixed(1)}% at depth 0 — unplayable.`);
  if (batch.winRate > 0.65) fail(`${id} wins ${(batch.winRate * 100).toFixed(1)}% at depth 0 — a formality.`);
  if (batch.medianFloors < 9) fail(`${id} median floor ${batch.medianFloors} — act 1 is too lethal.`);
}

const spread = [...perCharacter.values()].map((b) => b.winRate);
const gap = Math.max(...spread) - Math.min(...spread);
if (gap > 0.3) fail(`characters differ by ${(gap * 100).toFixed(0)} points — one of them is the obvious pick.`);

console.log('balance ok');
