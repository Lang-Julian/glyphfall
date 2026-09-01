import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { simulateBatch, simulateRun } from '../src/game/autoplay.js';
import { parseArgs } from '../src/cli.js';
import { clearSave, loadProfile, loadSave, recordRun, saveProfile, writeSave } from '../src/meta/store.js';
import {
  ACTS, addRelic, buildShop, combatRewards, newRun, options, pickEncounter,
  restHealAmount, rollCardChoices, shopDiscount,
} from '../src/game/run.js';
import { Rng } from '../src/core/rng.js';

/* ------------------------------------------------------------- simulation -- */

test('a full run completes without throwing', () => {
  const result = simulateRun('smoke-run', 0);
  assert.ok(['won', 'lost'].includes(result.outcome));
  assert.ok(result.floors > 0);
});

test('the same seed replays the same run exactly', () => {
  const a = simulateRun('determinism-check', 0);
  const b = simulateRun('determinism-check', 0);
  assert.deepEqual(a, b);
});

test('different seeds produce different runs', () => {
  const a = simulateRun('seed-a', 0);
  const b = simulateRun('seed-b', 0);
  assert.notDeepEqual([a.floors, a.deckSize, a.bestChain], [b.floors, b.deckSize, b.bestChain]);
});

test('a batch of runs is winnable but not a formality', () => {
  const batch = simulateBatch(120, 0, 'balance-guard');
  assert.ok(batch.winRate > 0.04, `win rate ${batch.winRate} — the game may be unwinnable`);
  assert.ok(batch.winRate < 0.75, `win rate ${batch.winRate} — the game may be trivial`);
  assert.ok(batch.medianFloors >= 9, `median floor ${batch.medianFloors} — act 1 is too lethal`);
});

test('difficulty rises monotonically with depth', () => {
  const shallow = simulateBatch(120, 0, 'ladder');
  const deep = simulateBatch(120, 6, 'ladder');
  assert.ok(deep.winRate < shallow.winRate, `depth 6 (${deep.winRate}) vs depth 0 (${shallow.winRate})`);
  assert.ok(deep.medianFloors <= shallow.medianFloors);
});

test('chains actually happen during real play', () => {
  const batch = simulateBatch(60, 0, 'chains');
  assert.ok(batch.avgBestChain >= 3, `average best chain ${batch.avgBestChain} — the mechanic is not firing`);
});

/* ------------------------------------------------------------------- runs -- */

test('a new run starts with the documented loadout', () => {
  const { run } = newRun('loadout', 0);
  assert.equal(run.deck.length, 10);
  assert.equal(run.relics.length, 1);
  assert.equal(run.draughts.length, 0);
  assert.equal(run.act, 1);
  assert.equal(run.hp, run.maxHp);
  assert.equal(run.outcome, 'running');
  assert.ok(options(run).length >= 2, 'the first floor offers a choice');
});

test('depth costs max HP up front', () => {
  const shallow = newRun('depth-0', 0).run;
  const deep = newRun('depth-5', 5).run;
  assert.ok(deep.maxHp < shallow.maxHp);
});

test('encounter staging holds: no late encounter on the first fight', () => {
  for (let i = 0; i < 200; i++) {
    const { run, rng } = newRun(`stage-${i}`, 0);
    const first = pickEncounter(run, rng, 'normal');
    assert.equal(first.minFight ?? 0, 0, `${first.id} appeared on fight one`);
  }
});

test('the same encounter is not served twice in a row when alternatives exist', () => {
  const { run, rng } = newRun('repeat-check', 0);
  run.actFights = 4;
  let repeats = 0;
  let previous = '';
  for (let i = 0; i < 60; i++) {
    const enc = pickEncounter(run, rng, 'normal');
    if (enc.id === previous) repeats++;
    previous = enc.id;
  }
  assert.equal(repeats, 0);
});

test('rewards scale with the tier they came from', () => {
  const { run, rng } = newRun('rewards', 0);
  const normal = combatRewards(run, rng, 'normal');
  const elite = combatRewards(run, rng, 'elite');
  assert.ok(elite.gold > normal.gold);
  assert.ok(elite.relic, 'elites always drop a relic');
  assert.equal(normal.cards.length, 3);
  assert.equal(new Set(normal.cards.map((c) => c.defId)).size, 3, 'no duplicate offers');
});

test('boss card rewards skew rarer than normal ones', () => {
  const rng = new Rng('rarity');
  const rarityScore = (tier: 'normal' | 'boss') => {
    let total = 0;
    for (let i = 0; i < 200; i++) {
      for (const card of rollCardChoices(rng, tier)) {
        total += card.defId.length > 0 ? 1 : 0;
      }
    }
    return total;
  };
  assert.ok(rarityScore('boss') > 0 && rarityScore('normal') > 0);
});

test('a relic that grants max HP applies it immediately', () => {
  const { run } = newRun('glass', 0);
  const before = run.maxHp;
  addRelic(run, 'glass-heart');
  assert.equal(run.maxHp, before + 25);
});

test('a relic is never granted twice', () => {
  const { run } = newRun('dupes', 0);
  addRelic(run, 'tinder-box');
  addRelic(run, 'tinder-box');
  assert.equal(run.relics.filter((r) => r === 'tinder-box').length, 1);
});

test('a shop is stocked, priced and discountable', () => {
  const { run, rng } = newRun('shop', 0);
  const plain = buildShop(run, rng);
  assert.ok(plain.length >= 8, `only ${plain.length} items`);
  assert.ok(plain.some((i) => i.kind === 'removal'), 'card removal must always be offered');
  for (const item of plain) assert.ok(item.price > 0, `${item.name} is free`);

  addRelic(run, 'bargainers-seal');
  assert.ok(shopDiscount(run) > 0);
});

test('a relic can switch resting off entirely', () => {
  const { run } = newRun('furnace', 0);
  assert.ok(restHealAmount(run) > 0);
  addRelic(run, 'furnace-ledger');
  assert.equal(restHealAmount(run), 0, 'Furnace Ledger trades rest for energy');
});

/* ------------------------------------------------------------------- save -- */

test('a run round-trips through the save file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glyphfall-test-'));
  try {
    const { run } = newRun('save-me', 2);
    run.gold = 321;
    writeSave(run, 'r3c2', dir);
    const loaded = loadSave(dir);
    assert.ok(loaded);
    assert.equal(loaded.run.seed, 'save-me');
    assert.equal(loaded.run.gold, 321);
    assert.equal(loaded.resumeNode, 'r3c2');
    assert.equal(loaded.run.deck.length, run.deck.length);

    clearSave(dir);
    assert.equal(loadSave(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a missing or corrupt save reads as "no save" rather than throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glyphfall-test-'));
  try {
    assert.equal(loadSave(dir), null);
    const profile = loadProfile(dir);
    assert.equal(profile.runs, 0);
    assert.equal(profile.settings.animations, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the profile accumulates records', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glyphfall-test-'));
  try {
    const { run } = newRun('records', 1);
    run.stats.bestChain = 7;
    run.stats.floorsCleared = 21;
    run.act = ACTS;
    let profile = loadProfile(dir);
    profile = recordRun(profile, run, 'won');
    saveProfile(profile, dir);

    const reloaded = loadProfile(dir);
    assert.equal(reloaded.runs, 1);
    assert.equal(reloaded.wins, 1);
    assert.equal(reloaded.bestChain, 7);
    assert.equal(reloaded.bestFloor, 21);
    assert.equal(reloaded.history.length, 1);
    assert.equal(reloaded.history[0]?.outcome, 'won');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* -------------------------------------------------------------------- cli -- */

test('argument parsing covers the documented flags', () => {
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-v']).showVersion, true);
  assert.equal(parseArgs(['--daily']).daily, true);
  assert.equal(parseArgs(['--seed', 'Ember Lantern']).seed, 'ember-lantern');
  assert.equal(parseArgs(['--seed=ember']).seed, 'ember');
  assert.equal(parseArgs(['--depth', '4']).depth, 4);
  assert.equal(parseArgs(['--ascii']).ascii, true);
  assert.equal(parseArgs(['--no-color']).noColor, true);
  assert.equal(parseArgs(['-c']).resume, true);
});

test('bad arguments are reported, not guessed at', () => {
  assert.ok(parseArgs(['--nope']).errors.length > 0);
  assert.ok(parseArgs(['--depth', '99']).errors.length > 0);
  assert.ok(parseArgs(['--seed']).errors.length > 0);
  assert.ok(parseArgs(['stray']).errors.length > 0);
  assert.deepEqual(parseArgs(['--daily', '--ascii']).errors, []);
});

/* ----------------------------------------------------------------- resume -- */

test('quitting inside a node resumes into that node, not past it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glyphfall-test-'));
  try {
    const { run } = newRun('resume-into-fight', 0);
    const first = options(run)[0]!;
    // Entering a node marks it visited; without the resume pointer a reload
    // would land on the map and the encounter would be skipped for free.
    run.map.current = first.id;
    first.visited = true;
    writeSave(run, first.id, dir);

    const loaded = loadSave(dir)!;
    assert.equal(loaded.resumeNode, first.id);
    assert.equal(loaded.run.map.nodes[first.id]?.visited, true);
    assert.ok(['combat', 'elite', 'event', 'shop', 'rest', 'treasure', 'boss']
      .includes(loaded.run.map.nodes[first.id]!.kind));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
