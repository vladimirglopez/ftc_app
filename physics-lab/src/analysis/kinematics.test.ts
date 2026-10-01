import { describe, expect, it } from 'vitest';
import {
  accelerationFromQuadratic,
  instantaneousVelocity,
  intervalAverageVelocities,
  interpretQuadratic,
  velocityAnalysis,
  velocityModelFromQuadratic,
} from './kinematics';
import { quadraticFit } from './regression';

const ts = [0, 0.1, 0.2, 0.3, 0.4];
const positions = ts.map((t) => 1 + 2 * t + 5 * t * t);

function fitted() {
  const r = quadraticFit(ts, positions);
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe('quadratic → velocity → acceleration (x = 1 + 2t + 5t²)', () => {
  it('interprets coefficients physically: x₀ = C, v₀ = B, a = 2A', () => {
    const phys = interpretQuadratic(fitted());
    expect(phys.initialPosition).toBeCloseTo(1, 10);
    expect(phys.initialVelocity).toBeCloseTo(2, 10);
    expect(phys.acceleration).toBeCloseTo(10, 10);
  });

  it('derives v(t) = 10t + 2 and a = 10 m/s²', () => {
    const fit = fitted();
    const v = velocityModelFromQuadratic(fit);
    expect(v.slope).toBeCloseTo(10, 10);
    expect(v.intercept).toBeCloseTo(2, 10);
    expect(accelerationFromQuadratic(fit)).toBeCloseTo(10, 10);
    expect(instantaneousVelocity(fit, 0.3)).toBeCloseTo(5, 10);
  });

  it('velocity graph fit has slope = acceleration and intercept = B', () => {
    const r = velocityAnalysis(fitted(), ts);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.points.map((p) => p.velocity)).toEqual(ts.map((t) => expect.closeTo(10 * t + 2, 9)));
    expect(r.value.fit.slope).toBeCloseTo(10, 9);
    expect(r.value.fit.intercept).toBeCloseTo(2, 9);
  });

  it('velocity analysis fails gracefully with too few times', () => {
    expect(velocityAnalysis({ a: 5, b: 2 }, [0.1]).ok).toBe(false);
  });
});

describe('intervalAverageVelocities', () => {
  it('equals the instantaneous velocity at the midpoint time for constant acceleration', () => {
    const iv = intervalAverageVelocities(ts.map((time, i) => ({ time, position: positions[i]! })));
    expect(iv).toHaveLength(4);
    iv.forEach((p) => expect(p.velocity).toBeCloseTo(10 * p.midTime + 2, 10));
  });

  it('sorts by time and skips zero-duration intervals and invalid points', () => {
    const iv = intervalAverageVelocities([
      { time: 0.2, position: 1.6 },
      { time: 0, position: 1 },
      { time: 0.2, position: 1.6 },
      { time: NaN, position: 3 },
      { time: 0.1, position: 1.25 },
    ]);
    expect(iv.map((p) => p.midTime)).toEqual([0.05, expect.closeTo(0.15, 12)]);
    iv.forEach((p) => expect(Number.isFinite(p.velocity)).toBe(true));
  });
});
