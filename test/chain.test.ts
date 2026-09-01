import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeCard } from '../src/content/cards.js';
import {
  MAX_CHAIN, playCard, previewCard, startCombat, wouldChain, type CombatState,
} from '../src/game/combat.js';
import type { Card } from '../src/core/types.js';

/**
 * The chain is the game. These tests pin down its exact arithmetic, because a
 * silent change here would quietly invalidate every card in the pool.
 */

function combat(deck: readonly string[], enemies: readonly string[] = ['ashling']): CombatState {
  const s = startCombat({
    deck: deck.map((id) => makeCard(id)),
    hp: 80, maxHp: 80, relics: [], enemyIds: enemies,
    tier: 'normal', encounterName: 'test', seed: 'chain-test',
  });
  // Put the whole deck in hand so tests control the order exactly.
  s.hand = [...s.hand, ...s.draw.splice(0)];
  s.energy = 99;
  return s;
}

function handIndexOf(s: CombatState, defId: string): number {
  const i = s.hand.findIndex((c: Card) => c.defId === defId);
  assert.ok(i >= 0, `${defId} not in hand`);
  return i;
}

test('matching suits grow the chain, mismatching suits collapse it', () => {
  const s = combat(['strike', 'strike', 'strike', 'ward']);
  assert.equal(s.chain, 0, 'a turn starts with no chain');

  playCard(s, handIndexOf(s, 'strike'), 0);
  assert.equal(s.chain, 0, 'the first card only sets the suit');

  playCard(s, handIndexOf(s, 'strike'), 0);
  assert.equal(s.chain, 1);

  playCard(s, handIndexOf(s, 'strike'), 0);
  assert.equal(s.chain, 2);

  playCard(s, handIndexOf(s, 'ward'), 0);
  assert.equal(s.chain, 0, 'a different suit breaks the chain');
});

test('each point of chain adds one damage to every instance', () => {
  const s = combat(['cinder-jab', 'cinder-jab', 'twin-spark'], ['the-anvil']);
  const enemy = s.enemies[0]!;
  const startHp = enemy.hp;

  playCard(s, handIndexOf(s, 'cinder-jab'), 0);   // chain 0 → 5 damage
  playCard(s, handIndexOf(s, 'cinder-jab'), 0);   // chain 1 → 6 damage
  playCard(s, handIndexOf(s, 'twin-spark'), 0);   // chain 2 → (3+2) x2 = 10

  assert.equal(startHp - enemy.hp, 5 + 6 + 10);
});

test('multi-hit cards scale harder with chain than single hits', () => {
  const multi = combat(['cinder-jab', 'cinder-jab', 'cinder-jab', 'twin-spark'], ['the-anvil']);
  for (let i = 0; i < 3; i++) playCard(multi, handIndexOf(multi, 'cinder-jab'), 0);
  assert.equal(multi.chain, 2);
  const before = multi.enemies[0]!.hp;
  playCard(multi, handIndexOf(multi, 'twin-spark'), 0);
  const chained = before - multi.enemies[0]!.hp;

  const cold = combat(['twin-spark'], ['the-anvil']);
  const b2 = cold.enemies[0]!.hp;
  playCard(cold, handIndexOf(cold, 'twin-spark'), 0);
  const unchained = b2 - cold.enemies[0]!.hp;

  assert.equal(unchained, 6, '3 damage twice with no chain');
  // Three jabs leave the chain at 2; Twin Spark is Ember too, so playing it
  // takes the chain to 3 before it resolves: (3+3) x2.
  assert.equal(chained, 12, '3+3 damage twice at chain 3');
});

test('prism cards match anything and never break a chain', () => {
  const s = combat(['strike', 'strike', 'prism-shard', 'strike'], ['the-anvil']);
  playCard(s, handIndexOf(s, 'strike'), 0);
  playCard(s, handIndexOf(s, 'strike'), 0);
  assert.equal(s.chain, 1);

  playCard(s, handIndexOf(s, 'prism-shard'), 0);
  assert.equal(s.chain, 2, 'prism extends the chain');

  playCard(s, handIndexOf(s, 'strike'), 0);
  assert.equal(s.chain, 3, 'and the suit before it is still remembered');
});

test('block gains the chain bonus too', () => {
  const s = combat(['ward', 'ward', 'ward']);
  playCard(s, handIndexOf(s, 'ward'), 0);
  assert.equal(s.player.block, 6, 'Ward is 6 block at chain 0');
  playCard(s, handIndexOf(s, 'ward'), 0);
  assert.equal(s.player.block, 6 + 7, 'chain 1 adds one');
  playCard(s, handIndexOf(s, 'ward'), 0);
  assert.equal(s.player.block, 6 + 7 + 8, 'chain 2 adds two');
});

test('the chain is capped', () => {
  const s = combat(Array.from({ length: 20 }, () => 'cinder-jab'), ['the-anvil']);
  for (let i = 0; i < 20; i++) playCard(s, handIndexOf(s, 'cinder-jab'), 0);
  assert.equal(s.chain, MAX_CHAIN);
});

test('the preview matches what actually happens', () => {
  const s = combat(['strike', 'strike', 'strike'], ['the-anvil']);
  playCard(s, handIndexOf(s, 'strike'), 0);

  const idx = handIndexOf(s, 'strike');
  const preview = previewCard(s, idx, 0);
  assert.ok(preview);
  const before = s.enemies[0]!.hp;
  playCard(s, idx, 0);
  assert.equal(before - s.enemies[0]!.hp, preview.damage);
  assert.equal(s.chain, preview.chainAfter);
});

test('the preview flags a chain break before you commit', () => {
  const s = combat(['strike', 'strike', 'ward'], ['the-anvil']);
  playCard(s, handIndexOf(s, 'strike'), 0);
  playCard(s, handIndexOf(s, 'strike'), 0);
  const preview = previewCard(s, handIndexOf(s, 'ward'), 0);
  assert.equal(preview?.breaks, true);
  assert.equal(preview?.chainAfter, 0);
});

test('wouldChain agrees with what playing the card does', () => {
  const s = combat(['strike', 'strike', 'ward'], ['the-anvil']);
  playCard(s, handIndexOf(s, 'strike'), 0);
  assert.equal(wouldChain(s, s.hand[handIndexOf(s, 'strike')]!), true);
  assert.equal(wouldChain(s, s.hand[handIndexOf(s, 'ward')]!), false);
});

test('the chain resets between turns unless something seeds it', () => {
  const plain = combat(['strike', 'strike', 'strike', 'strike']);
  playCard(plain, handIndexOf(plain, 'strike'), 0);
  playCard(plain, handIndexOf(plain, 'strike'), 0);
  assert.equal(plain.chain, 1);

  const seeded = startCombat({
    deck: Array.from({ length: 10 }, () => makeCard('strike')),
    hp: 80, maxHp: 80, relics: ['first-link'], enemyIds: ['ashling'],
    tier: 'normal', encounterName: 'test', seed: 'seeded',
  });
  assert.equal(seeded.chain, 1, 'First Link seeds one chain each turn');
});
