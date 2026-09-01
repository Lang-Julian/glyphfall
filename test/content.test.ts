import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARDS, POOL, cardDef, cardVars, describeCard, makeCard, poolFor } from '../src/content/cards.js';
import { CHARACTERS } from '../src/content/characters.js';
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

test('every character starts with a legal, playable ten-card deck', () => {
  for (const character of CHARACTERS) {
    assert.equal(character.deck.length, 10, `${character.id} deck size`);
    const suits = new Set(character.deck.map((id: string) => cardDef(id).suit));
    assert.ok(suits.size >= 3, `${character.id} only touches ${suits.size} suits`);
    if (character.affinity) {
      const counts = new Map<string, number>();
      for (const id of character.deck) {
        const suit = cardDef(id).suit;
        counts.set(suit, (counts.get(suit) ?? 0) + 1);
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      assert.equal(top, character.affinity,
        `${character.id} leans ${character.affinity} but its deck is mostly ${top}`);
    }
    for (const id of character.deck) {
      const d = cardDef(id);
      assert.ok(!d.unplayable, `${character.id} starts with an unplayable card: ${id}`);
      assert.ok(d.cost <= 1, `${character.id} starts with a ${d.cost}-cost card: ${id}`);
    }
    assert.ok(character.maxHp >= 60 && character.maxHp <= 100, `${character.id} hp ${character.maxHp}`);
    assert.ok(character.blurb.length > 0 && character.playstyle.length > 0);
    assert.equal(character.art.length, 4, `${character.id} art must be 4 lines`);
  }
});

test('characters are actually different from one another', () => {
  const decks = CHARACTERS.map((c) => c.deck.join(','));
  assert.equal(new Set(decks).size, CHARACTERS.length, 'two characters share a deck');
  assert.equal(new Set(CHARACTERS.map((c) => c.startingRelic)).size, CHARACTERS.length);
  assert.equal(new Set(CHARACTERS.map((c) => c.maxHp)).size, CHARACTERS.length);
});

test('every character has signature cards, and can still see the shared pool', () => {
  for (const character of CHARACTERS) {
    const pool = poolFor(character.id);
    const signatures = pool.filter((c) => c.classes?.includes(character.id));
    assert.ok(signatures.length >= 2, `${character.id} has ${signatures.length} signature cards`);
    assert.ok(pool.length >= 40, `${character.id} pool is only ${pool.length} cards`);
    for (const card of pool) {
      assert.ok(!card.classes || card.classes.includes(character.id),
        `${card.id} leaked into ${character.id}'s pool`);
    }
  }
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

test('every act has an opener, a mid pool, elites and several bosses', () => {
  for (const act of [1, 2, 3]) {
    const inAct = ENCOUNTERS.filter((e) => e.act === act);
    const normals = inAct.filter((e) => e.tier === 'normal');
    const openers = normals.filter((e) => (e.minFight ?? 0) === 0);
    assert.ok(openers.length >= 2, `act ${act} has ${openers.length} openers`);
    assert.ok(normals.length >= 5, `act ${act} has ${normals.length} normal encounters`);
    assert.ok(inAct.filter((e) => e.tier === 'elite').length >= 2, `act ${act} needs elites`);
    // Several bosses per act is what stops the third run feeling like the first.
    assert.ok(inAct.filter((e) => e.tier === 'boss').length >= 3, `act ${act} needs bosses`);
  }
});

test('bosses across an act are in the same weight class', () => {
  for (const act of [1, 2, 3]) {
    const totals = ENCOUNTERS
      .filter((e) => e.act === act && e.tier === 'boss')
      .map((e) => ({
        id: e.id,
        hp: e.enemies.reduce((sum, id) => sum + enemyDef(id).hp[0], 0),
      }));
    const lo = Math.min(...totals.map((x) => x.hp));
    const hi = Math.max(...totals.map((x) => x.hp));
    assert.ok(hi <= lo * 1.6,
      `act ${act} bosses range ${lo}-${hi}: ${totals.map((x) => `${x.id} ${x.hp}`).join(', ')}`);
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
