import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rng } from '../src/core/rng.js';
import { dailySeed, normaliseSeed, randomSeed } from '../src/core/seed.js';

test('the same seed produces the same sequence', () => {
  const a = new Rng('ember-lantern-412');
  const b = new Rng('ember-lantern-412');
  const left = Array.from({ length: 200 }, () => a.next());
  const right = Array.from({ length: 200 }, () => b.next());
  assert.deepEqual(left, right);
});

test('different seeds diverge', () => {
  const a = new Rng('one');
  const b = new Rng('two');
  const same = Array.from({ length: 50 }, () => a.next() === b.next()).filter(Boolean);
  assert.ok(same.length < 3, 'sequences should not correlate');
});

test('a run resumes on the same sequence from a saved position', () => {
  const original = new Rng('resume-me');
  for (let i = 0; i < 37; i++) original.next();
  const resumed = new Rng('resume-me', original.position);
  assert.equal(resumed.next(), (() => {
    const check = new Rng('resume-me');
    for (let i = 0; i < 37; i++) check.next();
    return check.next();
  })());
});

test('clone explores without consuming the parent sequence', () => {
  const rng = new Rng('clone-me');
  const clone = rng.clone();
  const branch = Array.from({ length: 10 }, () => clone.next());
  const main = Array.from({ length: 10 }, () => rng.next());
  assert.deepEqual(branch, main, 'a clone starts from the same state');
  assert.notEqual(rng.position, clone.position + 10, 'and advances independently after');
});

test('int stays in range and covers both ends', () => {
  const rng = new Rng('range');
  const seen = new Set<number>();
  for (let i = 0; i < 4000; i++) {
    const n = rng.int(3, 7);
    assert.ok(n >= 3 && n <= 7, `${n} out of range`);
    seen.add(n);
  }
  assert.equal(seen.size, 5, 'every value in [3,7] should occur');
});

test('weighted never returns a zero-weight entry', () => {
  const rng = new Rng('weights');
  for (let i = 0; i < 500; i++) {
    assert.equal(rng.weighted([['yes', 1], ['no', 0]] as const), 'yes');
  }
});

test('shuffle is a permutation', () => {
  const rng = new Rng('shuffle');
  const input = Array.from({ length: 40 }, (_, i) => i);
  const out = rng.shuffle(input.slice());
  assert.deepEqual([...out].sort((a, b) => a - b), input);
});

test('sample returns distinct items and never over-draws', () => {
  const rng = new Rng('sample');
  const pool = ['a', 'b', 'c'];
  const picked = rng.sample(pool, 10);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3);
});

test('the daily seed is stable within a UTC day and changes across days', () => {
  const a = dailySeed(new Date('2026-09-01T00:00:01Z'));
  const b = dailySeed(new Date('2026-09-01T23:59:59Z'));
  const c = dailySeed(new Date('2026-09-02T00:00:01Z'));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('seeds are normalised without losing meaning', () => {
  assert.equal(normaliseSeed('  Ember Lantern  '), 'ember-lantern');
  assert.ok(normaliseSeed('').length > 0, 'an empty seed falls back to a random one');
  assert.ok(randomSeed().includes('-'));
});
