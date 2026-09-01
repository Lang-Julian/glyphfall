/**
 * Deterministic RNG.
 *
 * Every random decision in a run flows through one of these. Given the same
 * seed the entire run — map, cards, shops, enemy moves — replays identically,
 * which is what makes seeded runs and the daily challenge honest.
 *
 * Algorithm: sfc32, seeded through a xmur3 string hash. Small, fast, and it
 * passes PractRand well past anything a card game will ever ask of it.
 */

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  /** Number of values drawn. Part of the save file so a resumed run stays deterministic. */
  private calls = 0;

  constructor(seed: string | number, calls = 0) {
    const h = xmur3(String(seed));
    this.a = h();
    this.b = h();
    this.c = h();
    this.d = h();
    // sfc32 needs a warm-up or the first few values correlate with the seed.
    for (let i = 0; i < 12; i++) this.next();
    for (let i = 0; i < calls; i++) this.next();
    this.calls = calls;
  }

  /** Raw float in [0, 1). */
  next(): number {
    this.calls++;
    this.a |= 0;
    this.b |= 0;
    this.c |= 0;
    this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** `n` distinct items, or fewer if the pool is smaller. Order is randomised. */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items.slice()).slice(0, Math.min(n, items.length));
  }

  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [items[i], items[j]] = [items[j] as T, items[i] as T];
    }
    return items;
  }

  /** Weighted pick. Weights need not sum to 1; non-positive weights never fire. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
    if (total <= 0) throw new Error('Rng.weighted: no positive weights');
    let roll = this.next() * total;
    for (const [value, w] of entries) {
      roll -= Math.max(0, w);
      if (roll < 0) return value;
    }
    return entries[entries.length - 1]![0];
  }

  /** An independent stream derived from this one — lets subsystems draw without
   *  perturbing each other's sequences. */
  fork(label: string): Rng {
    return new Rng(`${label}:${this.int(0, 2 ** 31 - 1)}`);
  }

  /** An exact copy, including internal state. Lets an AI explore a branch
   *  without consuming the real run's random sequence. */
  clone(): Rng {
    const copy = Object.create(Rng.prototype) as Rng;
    Object.assign(copy, this);
    return copy;
  }

  /** Serialisable position, so a saved run resumes on the same sequence. */
  get position(): number {
    return this.calls;
  }
}

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
