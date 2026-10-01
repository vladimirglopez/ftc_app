/** Deterministic PRNG (mulberry32) so simulated runs are reproducible in tests. */
export type RandomFn = () => number;

export function seededRandom(seed: number): RandomFn {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box–Muller. */
export function gaussian(random: RandomFn, mean = 0, stdDev = 1): number {
  if (stdDev === 0) return mean;
  const u1 = Math.max(random(), Number.MIN_VALUE);
  const u2 = random();
  return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
