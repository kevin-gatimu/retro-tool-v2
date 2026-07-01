/**
 * Deterministic, seedable pseudo-random helpers.
 *
 * Icebreaker sessions persist an integer `seed` so the prompt deck can be
 * rebuilt in exactly the same order — making a session reproducible. We avoid a
 * dependency by hand-rolling a tiny `mulberry32` PRNG (fast, good distribution,
 * 32-bit state) and a Fisher–Yates shuffle driven by it.
 */

/**
 * Returns a generator producing floats in [0, 1) from a 32-bit integer seed.
 * Same seed → same sequence.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns a new array with `items` shuffled deterministically for the given
 * `seed`. The input array is not mutated.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generates a fresh non-negative 31-bit integer seed for a new session.
 */
export function generateSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
