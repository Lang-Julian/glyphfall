import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeCard } from '../src/content/cards.js';
import {
  BASE_HAND_SIZE, HAND_LIMIT, canPlay, cloneCombat, drawCards, endTurn,
  incomingDamage, playCard, startCombat, statusOf, type CombatState,
} from '../src/game/combat.js';

function combat(deck: readonly string[], o: Partial<{
  enemies: readonly string[]; relics: readonly string[]; hp: number;
}> = {}): CombatState {
  return startCombat({
    deck: deck.map((id) => makeCard(id)),
    hp: o.hp ?? 80, maxHp: 80,
    relics: o.relics ?? [],
    enemyIds: o.enemies ?? ['ashling'],
    tier: 'normal', encounterName: 'test', seed: 'combat-test',
  });
}

function pull(s: CombatState): void {
  s.hand = [...s.hand, ...s.draw.splice(0)];
  s.energy = 99;
}

const idx = (s: CombatState, defId: string): number => {
  const i = s.hand.findIndex((c) => c.defId === defId);
  assert.ok(i >= 0, `${defId} not in hand`);
  return i;
};

test('the opening hand is the configured size', () => {
  const s = combat(Array.from({ length: 12 }, () => 'strike'));
  assert.equal(s.hand.length, BASE_HAND_SIZE);
  assert.equal(s.energy, 3);
});

test('block absorbs damage before HP', () => {
  const s = combat(['ward', 'ward', 'ward', 'ward', 'ward'], { enemies: ['cinder-hound'] });
  pull(s);
  playCard(s, idx(s, 'ward'), 0);
  const block = s.player.block;
  const hp = s.player.hp;
  endTurn(s);
  assert.ok(s.player.hp >= hp - Math.max(0, 8 - block), 'block soaked the hit');
});

test('strength adds to every attack instance, weak scales it down', () => {
  const s = combat(['whetstone', 'twin-spark'], { enemies: ['the-anvil'] });
  pull(s);
  playCard(s, idx(s, 'whetstone'), 0);
  assert.equal(statusOf(s.player, 'strength'), 2);
  const before = s.enemies[0]!.hp;
  playCard(s, idx(s, 'twin-spark'), 0);
  // Twin Spark is Ember, Whetstone is Iron, so the chain broke: (3+2) x2.
  assert.equal(before - s.enemies[0]!.hp, 10);
});

test('vulnerable multiplies incoming damage by 1.5, floored', () => {
  const s = combat(['cold-snap', 'flare'], { enemies: ['the-anvil'] });
  pull(s);
  playCard(s, idx(s, 'cold-snap'), 0);
  assert.equal(statusOf(s.enemies[0]!, 'vulnerable'), 2);
  const before = s.enemies[0]!.hp;
  playCard(s, idx(s, 'flare'), 0);
  // Flare is Ember after a Frost card: chain broke, so 10 damage, x1.5 = 15.
  assert.equal(before - s.enemies[0]!.hp, 15);
});

test('frail reduces block by a quarter, floored', () => {
  const s = combat(['ward'], { enemies: ['ashling'] });
  pull(s);
  s.player.statuses['frail'] = 2;
  playCard(s, idx(s, 'ward'), 0);
  assert.equal(s.player.block, Math.floor(6 * 0.75));
});

test('guard adds to every block gain', () => {
  const s = combat(['second-skin', 'ward']);
  pull(s);
  playCard(s, idx(s, 'second-skin'), 0);
  assert.equal(statusOf(s.player, 'guard'), 2);
  playCard(s, idx(s, 'ward'), 0);
  assert.equal(s.player.block, 6 + 2, 'Iron then Frost breaks the chain, so no chain bonus');
});

test('burn ticks at end of turn and decays', () => {
  const s = combat(['kindle'], { enemies: ['the-anvil'] });
  pull(s);
  playCard(s, idx(s, 'kindle'), 0);
  const enemy = s.enemies[0]!;
  assert.equal(statusOf(enemy, 'burn'), 5);
  const hp = enemy.hp;
  endTurn(s);
  assert.equal(hp - enemy.hp >= 5, true, 'burn dealt at least its value');
  assert.equal(statusOf(enemy, 'burn'), 4, 'and shrank by one');
});

test('thorns punish the attacker', () => {
  const s = combat(['strike'], { enemies: ['glass-wisp'] });
  pull(s);
  const hp = s.player.hp;
  playCard(s, idx(s, 'strike'), 0);
  assert.equal(hp - s.player.hp, 3, 'Glass Wisp opens with 3 thorns');
});

test('energy is spent and cards cannot be played without it', () => {
  const s = combat(['glacier', 'glacier', 'glacier']);
  s.hand = [...s.hand, ...s.draw.splice(0)];
  s.energy = 2;
  assert.equal(canPlay(s, idx(s, 'glacier')).ok, true);
  playCard(s, idx(s, 'glacier'), 0);
  assert.equal(s.energy, 0);
  assert.equal(canPlay(s, idx(s, 'glacier')).ok, false);
});

test('unplayable curses cannot be played', () => {
  const s = combat(['doubt', 'strike']);
  pull(s);
  assert.equal(canPlay(s, idx(s, 'doubt')).ok, false);
});

test('Doubt costs HP while it sits in hand', () => {
  const s = combat(['doubt', 'strike', 'strike', 'strike', 'strike', 'strike']);
  s.hand = s.hand.length > 0 ? s.hand : [];
  // Force Doubt into hand.
  const inDraw = s.draw.findIndex((c) => c.defId === 'doubt');
  if (inDraw >= 0) s.hand.push(...s.draw.splice(inDraw, 1));
  const hp = s.player.hp;
  endTurn(s);
  assert.ok(s.player.hp < hp, 'Doubt bit');
});

test('the draw pile reshuffles from the discard when it runs dry', () => {
  const s = combat(['strike', 'strike', 'strike', 'strike', 'strike', 'strike']);
  s.draw = [];
  s.discard = [makeCard('strike'), makeCard('ward')];
  const drawn = drawCards(s, 2);
  assert.equal(drawn, 2);
  assert.equal(s.discard.length, 0);
});

test('the hand is capped', () => {
  const s = combat(Array.from({ length: 30 }, () => 'strike'));
  drawCards(s, 50);
  assert.equal(s.hand.length, HAND_LIMIT);
});

test('exhausted cards do not come back', () => {
  const s = combat(['wildfire', 'strike'], { enemies: ['the-anvil'] });
  pull(s);
  playCard(s, idx(s, 'wildfire'), 0);
  assert.equal(s.exhaust.length, 1);
  assert.equal(s.discard.some((c) => c.defId === 'wildfire'), false);
});

test('powers install hooks for the rest of the combat', () => {
  const s = combat(['furnace-heart', 'strike', 'strike', 'strike', 'strike', 'strike']);
  pull(s);
  playCard(s, idx(s, 'furnace-heart'), 0);
  const before = statusOf(s.player, 'strength');
  endTurn(s);
  assert.equal(statusOf(s.player, 'strength'), before + 1, 'turn-start hook fired');
});

test('every enemy telegraphs an intent, and never exceeds it', () => {
  // Every Void Lamprey move is an attack, so the intent always carries a number.
  const s = combat(Array.from({ length: 10 }, () => 'strike'), { enemies: ['void-lamprey'] });
  for (const enemy of s.enemies) {
    assert.ok(enemy.nextMove, `${enemy.name} did not telegraph`);
  }
  const incoming = incomingDamage(s);
  assert.ok(incoming > 0, 'the telegraphed intent carries damage');
  const hp = s.player.hp;
  endTurn(s);
  assert.ok(hp - s.player.hp <= incoming, 'never hit for more than telegraphed');
});

test('combat ends when the last enemy dies', () => {
  const s = combat(Array.from({ length: 10 }, () => 'wildfire'), { enemies: ['cinder-hound'] });
  pull(s);
  while (!s.over && s.hand.some((c) => c.defId === 'wildfire')) {
    playCard(s, idx(s, 'wildfire'), 0);
  }
  assert.equal(s.over, 'win');
});

test('combat ends when the player dies', () => {
  const s = combat(Array.from({ length: 10 }, () => 'strike'), { enemies: ['glyph-zero'], hp: 4 });
  for (let i = 0; i < 4 && !s.over; i++) endTurn(s);
  assert.equal(s.over, 'lose');
});

test('cloning a combat isolates every mutable part', () => {
  const s = combat(['strike', 'ward', 'sift']);
  pull(s);
  const copy = cloneCombat(s);
  playCard(copy, idx(copy, 'strike'), 0);
  assert.notEqual(copy.enemies[0]!.hp, s.enemies[0]!.hp);
  assert.equal(s.hand.length, 3);
  copy.player.statuses['strength'] = 9;
  assert.equal(statusOf(s.player, 'strength'), 0);
});

test('Echo replays the previous card, not itself', () => {
  const s = combat(['flare', 'echo'], { enemies: ['the-anvil'] });
  pull(s);
  const before = s.enemies[0]!.hp;
  playCard(s, idx(s, 'flare'), 0);
  const afterFlare = s.enemies[0]!.hp;
  playCard(s, idx(s, 'echo'), 0);
  const afterEcho = s.enemies[0]!.hp;
  assert.ok(afterFlare - afterEcho > 0, 'the echo dealt damage');
  assert.notEqual(before, afterEcho);
});

test('Avalanche converts block into damage', () => {
  const s = combat(['glacier', 'avalanche'], { enemies: ['the-anvil'] });
  pull(s);
  playCard(s, idx(s, 'glacier'), 0);
  const block = s.player.block;
  const before = s.enemies[0]!.hp;
  playCard(s, idx(s, 'avalanche'), 0);
  // Glacier and Avalanche are both Frost, so the chain ticks to 1 and adds one.
  assert.equal(before - s.enemies[0]!.hp, block + 1);
});

test('Anchor keeps block across turns', () => {
  const s = combat(['winters-hold', 'bulwark', 'strike', 'strike', 'strike']);
  pull(s);
  playCard(s, idx(s, 'winters-hold'), 0);
  playCard(s, idx(s, 'bulwark'), 0);
  const block = s.player.block;
  assert.ok(block > 0);
  endTurn(s);
  assert.ok(s.player.block > 0, 'block survived the turn boundary');
});

test('Echo cannot copy another Echo, and never recurses', () => {
  const s = combat(['flare', 'echo', 'echo', 'echo'], { enemies: ['the-anvil'] });
  pull(s);
  playCard(s, idx(s, 'flare'), 0);
  // Three Echoes in a row used to recurse until the stack blew up.
  assert.doesNotThrow(() => {
    playCard(s, idx(s, 'echo'), 0);
    playCard(s, idx(s, 'echo'), 0);
    playCard(s, idx(s, 'echo'), 0);
  });
  assert.equal(s.over, null);
  assert.ok(s.enemies[0]!.hp < s.enemies[0]!.maxHp, 'the echoes still did something');
});

test('Echo with nothing before it is a no-op, not a crash', () => {
  const s = combat(['echo', 'strike'], { enemies: ['the-anvil'] });
  pull(s);
  const before = s.enemies[0]!.hp;
  assert.doesNotThrow(() => playCard(s, idx(s, 'echo'), 0));
  assert.equal(s.enemies[0]!.hp, before);
});
