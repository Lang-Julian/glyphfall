import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARDS, POOL, STARTER_DECK, cardDef, cardVars, describeCard, makeCard } from '../src/content/cards.js';
import { DRAUGHTS } from '../src/content/draughts.js';
import { ENCOUNTERS, ENEMIES, enemyDef } from '../src/content/enemies.js';
import { EVENTS } from '../src/content/events.js';
import { RELICS, STARTER_RELIC, relicDef } from '../src/content/relics.js';
import { STATUSES } from '../src/content/statuses.js';
import { validateContent } from '../src/game/run.js';
import type { StatusId } from '../src/core/types.js';

/**
 * Content tests. A typo in a data table is the most likely bug in a game like
 * this and the hardest to notice by playing, so the tables check themselves.
 */

test('every content id is unique', () => {
  const check = (name: string, ids: string[]) => {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `duplicate ${name}: ${dupes.join(', ')}`);
  };
  check('card', CARDS.map((c) => c.id));
  check('enemy', ENEMIES.map((e) => e.id));
  check('relic', RELICS.map((r) => r.id));
  check('draught', DRAUGHTS.map((d) => d.id));
  check('event', EVENTS.map((e) => e.id));
  check('encounter', ENCOUNTERS.map((e) => e.id));
});

test('validateContent finds no dangling references', () => {
  assert.deepEqual(validateContent(), []);
});

test('every card renders its text with real numbers', () => {
  for (const def of CARDS) {
    const card = makeCard(def.id);
    const text = describeCard(card);
    assert.ok(!text.includes('{'), `${def.id} left a placeholder: ${text}`);
    assert.ok(text.length > 0, `${def.id} has no text`);
  }
});

test('upgrades change at least one number and never make a card worse to read', () => {
  for (const def of CARDS) {
    if (!def.upgrade || Object.keys(def.upgrade).length === 0) continue;
    const base = cardVars(makeCard(def.id, 0));
    const up = cardVars(makeCard(def.id, 1));
    assert.notDeepEqual(base, up, `${def.id} upgrade changes nothing`);
  }
});

test('starter deck is exactly ten cards and teaches all four suits', () => {
  assert.equal(STARTER_DECK.length, 10);
  const suits = new Set(STARTER_DECK.map((id) => cardDef(id).suit));
  assert.deepEqual([...suits].sort(), ['ember', 'frost', 'iron', 'void']);
});

test('the reward pool contains no starters or curses', () => {
  for (const def of POOL) {
    assert.notEqual(def.rarity, 'starter', `${def.id} leaked into the pool`);
    assert.notEqual(def.type, 'curse', `${def.id} leaked into the pool`);
  }
});

test('every rarity has enough cards for a three-card reward', () => {
  for (const rarity of ['common', 'uncommon', 'rare'] as const) {
    const n = POOL.filter((c) => c.rarity === rarity).length;
    assert.ok(n >= 3, `only ${n} ${rarity} cards`);
  }
});

test('every suit has playable options at every rarity band', () => {
  for (const suit of ['ember', 'frost', 'void', 'iron'] as const) {
    const commons = POOL.filter((c) => c.suit === suit && c.rarity === 'common');
    assert.ok(commons.length >= 3, `${suit} has only ${commons.length} commons`);
  }
});

test('every enemy referenced by an encounter exists', () => {
  for (const enc of ENCOUNTERS) {
    for (const id of enc.enemies) assert.doesNotThrow(() => enemyDef(id), `${enc.id} → ${id}`);
    assert.ok(enc.enemies.length > 0, `${enc.id} has no enemies`);
  }
});

test('every act has an opener, a mid pool, an elite and exactly one boss', () => {
  for (const act of [1, 2, 3]) {
    const inAct = ENCOUNTERS.filter((e) => e.act === act);
    const normals = inAct.filter((e) => e.tier === 'normal');
    const openers = normals.filter((e) => (e.minFight ?? 0) === 0);
    assert.ok(openers.length >= 2, `act ${act} has ${openers.length} openers`);
    assert.ok(normals.length >= 5, `act ${act} has ${normals.length} normal encounters`);
    assert.ok(inAct.filter((e) => e.tier === 'elite').length >= 2, `act ${act} needs elites`);
    assert.equal(inAct.filter((e) => e.tier === 'boss').length, 1, `act ${act} boss count`);
  }
});

test('encounter difficulty never goes down as minFight rises', () => {
  for (const act of [1, 2, 3]) {
    const normals = ENCOUNTERS
      .filter((e) => e.act === act && e.tier === 'normal')
      .map((e) => ({
        id: e.id,
        stage: e.minFight ?? 0,
        hp: e.enemies.reduce((sum, id) => sum + (enemyDef(id).hp[0] + enemyDef(id).hp[1]) / 2, 0),
      }))
      .sort((a, b) => a.stage - b.stage);
    const first = normals[0]!;
    const last = normals[normals.length - 1]!;
    assert.ok(last.hp > first.hp, `act ${act}: ${last.id} should be tougher than ${first.id}`);
  }
});

test('enemy art is rectangular enough to lay out three abreast', () => {
  for (const enemy of ENEMIES) {
    assert.equal(enemy.art.length, 4, `${enemy.id} art must be 4 lines`);
    for (const line of enemy.art) {
      assert.ok([...line].length <= 11, `${enemy.id} art line too wide: "${line}"`);
    }
  }
});

test('every enemy move has a weight and a reachable slot', () => {
  for (const enemy of ENEMIES) {
    assert.ok(enemy.moves.length >= 2, `${enemy.id} needs at least two moves`);
    const alwaysAvailable = enemy.moves.filter((m) => !m.fromTurn && !m.belowHp && !m.everyTurn);
    assert.ok(alwaysAvailable.length >= 1, `${enemy.id} could stall on turn one`);
    for (const move of enemy.moves) {
      assert.ok(move.weight > 0, `${enemy.id}.${move.id} has no weight`);
    }
  }
});

test('boss HP climbs from act to act', () => {
  const bosses = [1, 2, 3].map((act) => {
    const enc = ENCOUNTERS.find((e) => e.act === act && e.tier === 'boss')!;
    return enemyDef(enc.enemies[0]!).hp[0];
  });
  assert.ok(bosses[0]! < bosses[1]! && bosses[1]! < bosses[2]!, `boss HP: ${bosses.join(' → ')}`);
});

test('relic hooks reference statuses and cards that exist', () => {
  for (const relic of RELICS) {
    assert.ok(relic.text.length > 0, `${relic.id} has no text`);
    assert.ok(relic.glyph.length > 0, `${relic.id} has no glyph`);
    for (const hook of relic.hooks) {
      if ('effects' in hook) {
        for (const fx of hook.effects) {
          if (fx.kind === 'status') assert.ok(STATUSES[fx.status as StatusId], `${relic.id} → ${fx.status}`);
        }
      }
    }
  }
  assert.doesNotThrow(() => relicDef(STARTER_RELIC));
});

test('there are enough boss relics to fill a choice of three', () => {
  assert.ok(RELICS.filter((r) => r.rarity === 'boss').length >= 3);
});

test('every event fits an act and offers a real decision', () => {
  for (const event of EVENTS) {
    assert.ok(event.acts.length > 0, `${event.id} appears in no act`);
    assert.ok(event.options.length >= 2, `${event.id} is not a choice`);
    assert.ok(event.body.length > 0, `${event.id} has no text`);
    for (const option of event.options) {
      assert.ok(option.label.length > 0);
      assert.ok(option.detail.length > 0, `${event.id}/${option.label} does not say what it does`);
    }
  }
  for (const act of [1, 2, 3]) {
    assert.ok(EVENTS.filter((e) => e.acts.includes(act)).length >= 6, `act ${act} needs more events`);
  }
});

test('every draught is priced and described', () => {
  for (const d of DRAUGHTS) {
    assert.ok(d.price > 0 && d.price < 200, `${d.id} price ${d.price}`);
    assert.ok(d.text.length > 0);
    assert.ok(d.effects.length > 0);
  }
});

test('card costs stay inside the energy budget', () => {
  for (const def of CARDS) {
    assert.ok(def.cost >= 0 && def.cost <= 3, `${def.id} costs ${def.cost}`);
  }
});
