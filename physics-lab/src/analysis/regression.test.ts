import { describe, expect, it } from 'vitest';
import {
  evaluateLinear,
  evaluateQuadratic,
  linearFit,
  quadraticFit,
  rSquared,
  sampleFit,
} from './regression';
import { gaussian, seededRandom } from '../sensors/simulated/random';

const x = (t: number) => 1 + 2 * t + 5 * t * t;

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
}

describe('quadraticFit', () => {
  it('recovers x(t) = 1 + 2t + 5t² exactly', () => {
    const ts = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
    const fit = unwrap(quadraticFit(ts, ts.map(x)));
    expect(fit.a).toBeCloseTo(5, 10);
    expect(fit.b).toBeCloseTo(2, 10);
    expect(fit.c).toBeCloseTo(1, 10);
    expect(fit.rSquared).toBeCloseTo(1, 12);
    expect(fit.n).toBe(6);
    expect(fit.degreesOfFreedom).toBe(3);
  });

  it('is accurate when times are far from zero (raw sensor clock)', () => {
    const offset = 1000;
    const ts = [0, 0.05, 0.11, 0.18, 0.24].map((t) => t + offset);
    const fit = unwrap(quadraticFit(ts, ts.map((t) => x(t - offset))));
    // Shifted parabola: A unchanged
    expect(fit.a).toBeCloseTo(5, 6);
    expect(evaluateQuadratic(fit, offset + 0.3)).toBeCloseTo(x(0.3), 6);
  });

  it('gives close coefficients and R² < 1 for noisy data', () => {
    const random = seededRandom(42);
    const ts = Array.from({ length: 10 }, (_, i) => i * 0.05);
    const ys = ts.map((t) => x(t) + gaussian(random, 0, 0.003));
    const fit = unwrap(quadraticFit(ts, ys));
    expect(fit.a).toBeCloseTo(5, 0);
    expect(fit.b).toBeCloseTo(2, 0);
    expect(fit.c).toBeCloseTo(1, 1);
    expect(fit.rSquared!).toBeLessThan(1);
    expect(fit.rSquared!).toBeGreaterThan(0.999);
  });

  it('passes exactly through three points (zero degrees of freedom)', () => {
    const ts = [0.1, 0.2, 0.4];
    const fit = unwrap(quadraticFit(ts, ts.map(x)));
    expect(fit.degreesOfFreedom).toBe(0);
    expect(fit.rSquared).toBeCloseTo(1, 12);
  });

  it('works regardless of point order', () => {
    const ts = [0.4, 0.1, 0.3, 0.0, 0.2];
    const fit = unwrap(quadraticFit(ts, ts.map(x)));
    expect(fit.a).toBeCloseTo(5, 10);
  });

  it('rejects insufficient data', () => {
    const r = quadraticFit([0, 1], [1, 8]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INSUFFICIENT_DATA');
    expect(quadraticFit([], []).ok).toBe(false);
  });

  it('rejects too few distinct times (duplicates)', () => {
    const r = quadraticFit([0.1, 0.1, 0.2, 0.2], [1, 1.1, 2, 2.1]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ENOUGH_DISTINCT_X');
  });

  it('tolerates one duplicate time when enough distinct times remain', () => {
    const ts = [0, 0.1, 0.1, 0.2, 0.3];
    const fit = unwrap(quadraticFit(ts, ts.map(x)));
    expect(fit.a).toBeCloseTo(5, 8);
  });

  it.each([
    [[0, 0.1, NaN], [1, 2, 3]],
    [[0, 0.1, 0.2], [1, Infinity, 3]],
    [[0, 0.1, 0.2], [1, 2, -Infinity]],
  ])('rejects non-finite input %j / %j', (ts, ys) => {
    const r = quadraticFit(ts, ys);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NON_FINITE_INPUT');
  });

  it('rejects mismatched lengths', () => {
    const r = quadraticFit([0, 1, 2], [0, 1]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('LENGTH_MISMATCH');
  });

  it('never returns NaN or Infinity in a successful fit', () => {
    const fit = unwrap(quadraticFit([0, 1e-9, 2e-9], [0, 1, 4]));
    expect([fit.a, fit.b, fit.c].every(Number.isFinite)).toBe(true);
  });

  it('reports null R² (not NaN) when all positions are identical', () => {
    const fit = unwrap(quadraticFit([0, 0.1, 0.2, 0.3], [0.5, 0.5, 0.5, 0.5]));
    expect(fit.a).toBeCloseTo(0, 10);
    expect(fit.rSquared).toBeNull();
  });
});

describe('linearFit', () => {
  it('recovers v(t) = 10t + 2', () => {
    const ts = [0, 0.1, 0.2, 0.3];
    const fit = unwrap(linearFit(ts, ts.map((t) => 10 * t + 2)));
    expect(fit.slope).toBeCloseTo(10, 10);
    expect(fit.intercept).toBeCloseTo(2, 10);
    expect(fit.rSquared).toBeCloseTo(1, 12);
    expect(evaluateLinear(fit, 0.5)).toBeCloseTo(7, 10);
  });

  it('matches the textbook closed form on noisy data', () => {
    const xs = [1, 2, 3, 4, 5];
    const ys = [2.1, 3.9, 6.2, 7.8, 10.1];
    const n = xs.length;
    const sx = xs.reduce((a, b) => a + b);
    const sy = ys.reduce((a, b) => a + b);
    const sxy = xs.reduce((a, xi, i) => a + xi * ys[i]!, 0);
    const sxx = xs.reduce((a, xi) => a + xi * xi, 0);
    const m = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const fit = unwrap(linearFit(xs, ys));
    expect(fit.slope).toBeCloseTo(m, 10);
    expect(fit.intercept).toBeCloseTo((sy - m * sx) / n, 10);
    expect(fit.rSquared!).toBeGreaterThan(0.99);
    expect(fit.rSquared!).toBeLessThan(1);
  });

  it('rejects a single point and identical x values', () => {
    expect(linearFit([1], [2]).ok).toBe(false);
    const r = linearFit([1, 1, 1], [2, 3, 4]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_ENOUGH_DISTINCT_X');
  });
});

describe('rSquared', () => {
  it('is 1 for perfect prediction and 0 for predicting the mean', () => {
    expect(rSquared([1, 2, 3], [1, 2, 3])).toBe(1);
    expect(rSquared([1, 2, 3], [2, 2, 2])).toBe(0);
  });
  it('returns null for undefined cases', () => {
    expect(rSquared([], [])).toBeNull();
    expect(rSquared([1, 2], [1])).toBeNull();
    expect(rSquared([3, 3, 3], [3, 3, 3])).toBeNull();
  });
});

describe('sampleFit', () => {
  it('samples the curve across the range', () => {
    const pts = sampleFit({ kind: 'quadratic', a: 5, b: 2, c: 1, rSquared: 1, n: 3, degreesOfFreedom: 0 }, 0, 1, 11);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual({ x: 0, y: 1 });
    expect(pts[10]!.y).toBeCloseTo(8, 10);
  });
  it('returns nothing for invalid ranges', () => {
    const fit = { kind: 'linear', slope: 1, intercept: 0, rSquared: 1, n: 2, degreesOfFreedom: 0 } as const;
    expect(sampleFit(fit, NaN, 1)).toEqual([]);
    expect(sampleFit(fit, 0, 1, 1)).toEqual([]);
  });
});
