/** Deterministic, serialisable RNG (mulberry32). State lives in the game save. */
export interface RngState {
  rng: number;
}

export function rand(s: RngState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function chance(s: RngState, p: number): boolean {
  return rand(s) < p;
}

export function randInt(s: RngState, min: number, max: number): number {
  return min + Math.floor(rand(s) * (max - min + 1));
}

export function pick<T>(s: RngState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}

/** Binomial sample (n small, so direct simulation is fine). */
export function binomial(s: RngState, n: number, p: number): number {
  let k = 0;
  const pp = Math.max(0, Math.min(1, p));
  for (let i = 0; i < n; i++) if (rand(s) < pp) k++;
  return k;
}

/** Round a fractional amount stochastically (2.3 -> 2 or 3, 30% chance of 3). */
export function stochasticRound(s: RngState, v: number): number {
  if (v <= 0) return 0;
  const f = Math.floor(v);
  return f + (rand(s) < v - f ? 1 : 0);
}

export function weightedPick<T>(s: RngState, items: { item: T; weight: number }[]): T | null {
  const total = items.reduce((a, b) => a + Math.max(0, b.weight), 0);
  if (total <= 0) return null;
  let r = rand(s) * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r <= 0) return it.item;
  }
  return items[items.length - 1].item;
}
