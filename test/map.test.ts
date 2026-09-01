import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/core/rng.js';
import { MAP_ROWS, availableNodes, generateMap } from '../src/game/map.js';

/**
 * Map invariants. A map with a dead end silently ends a run, which is the one
 * failure mode a player can never diagnose, so it is checked exhaustively.
 */

const MAPS = 500;

test('every generated map is fully traversable to the boss', () => {
  for (let i = 0; i < MAPS; i++) {
    const map = generateMap(new Rng(`map-${i}`), 1 + (i % 3));
    const start = availableNodes(map);
    assert.ok(start.length >= 2, `map ${i} offers only ${start.length} routes`);

    const seen = new Set<string>();
    const stack = start.map((n) => n.id);
    let reachedBoss = false;
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = map.nodes[id];
      assert.ok(node, `map ${i} points at a node that does not exist: ${id}`);
      if (node.kind === 'boss') { reachedBoss = true; continue; }
      const next = node.next.map((n) => map.nodes[n]).filter(Boolean);
      assert.ok(next.length > 0, `map ${i}: dead end at ${id} (row ${node.row})`);
      stack.push(...node.next);
    }
    assert.ok(reachedBoss, `map ${i} never reaches its boss`);
  }
});

test('every route leads to the boss, not just some', () => {
  for (let i = 0; i < 200; i++) {
    const map = generateMap(new Rng(`route-${i}`), 1);
    // Walk greedily down every branch; each walk must terminate at the boss.
    const walk = (id: string, depth: number): void => {
      assert.ok(depth <= MAP_ROWS + 1, 'walk ran too long');
      const node = map.nodes[id]!;
      if (node.kind === 'boss') return;
      for (const nextId of node.next) walk(nextId, depth + 1);
    };
    for (const node of availableNodes(map)) walk(node.id, 0);
  }
});

test('guaranteed nodes are where they are promised to be', () => {
  for (let i = 0; i < 200; i++) {
    const map = generateMap(new Rng(`fixed-${i}`), 2);
    for (const node of Object.values(map.nodes)) {
      if (node.row === 0) assert.equal(node.kind, 'combat', 'row 0 must be a soft combat');
      if (node.row === 4) assert.equal(node.kind, 'treasure', 'row 4 is treasure');
      if (node.row === map.rows - 2) assert.equal(node.kind, 'rest', 'the pre-boss row is a rest');
      if (node.row === map.rows - 1) assert.equal(node.kind, 'boss', 'the top row is the boss');
      if (node.kind === 'elite' || node.kind === 'shop') {
        assert.ok(node.row >= 2, `${node.kind} appeared on row ${node.row}`);
      }
    }
  }
});

test('the same seed always builds the same map', () => {
  const a = generateMap(new Rng('identical'), 1);
  const b = generateMap(new Rng('identical'), 1);
  assert.deepEqual(
    Object.values(a.nodes).map((n) => `${n.id}:${n.kind}:${n.next.join(',')}`).sort(),
    Object.values(b.nodes).map((n) => `${n.id}:${n.kind}:${n.next.join(',')}`).sort(),
  );
});

test('an act offers a meaningful spread of node types', () => {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 200; i++) {
    for (const node of Object.values(generateMap(new Rng(`spread-${i}`), 2).nodes)) {
      counts[node.kind] = (counts[node.kind] ?? 0) + 1;
    }
  }
  for (const kind of ['combat', 'elite', 'event', 'shop', 'rest', 'treasure', 'boss']) {
    assert.ok((counts[kind] ?? 0) > 0, `no ${kind} nodes generated in 200 maps`);
  }
  assert.ok(counts['combat']! > counts['elite']!, 'combat should be the common node');
});
