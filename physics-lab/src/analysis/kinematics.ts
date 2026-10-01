import { linearFit, type LinearFit, type QuadraticFit } from './regression';
import type { Result } from '../core/result';

/** Minimal shape the analysis needs. PhotogateMeasurement satisfies it structurally. */
export interface TimedPosition {
  time: number;
  position: number;
}

/**
 * Physical meaning of x(t) = At² + Bt + C, compared term by term with
 * x(t) = ½at² + v₀t + x₀.
 */
export interface QuadraticInterpretation {
  /** x₀ = C (m): position at t = 0 */
  initialPosition: number;
  /** v₀ = B (m/s): velocity at t = 0 */
  initialVelocity: number;
  /** a = 2A (m/s²) */
  acceleration: number;
}

export function interpretQuadratic(fit: Pick<QuadraticFit, 'a' | 'b' | 'c'>): QuadraticInterpretation {
  return { initialPosition: fit.c, initialVelocity: fit.b, acceleration: 2 * fit.a };
}

/** d/dt (At² + Bt + C) = 2At + B, returned as a line v(t) = m·t + b. */
export function velocityModelFromQuadratic(
  fit: Pick<QuadraticFit, 'a' | 'b'>,
): Pick<LinearFit, 'slope' | 'intercept'> {
  return { slope: 2 * fit.a, intercept: fit.b };
}

/** v(t) = 2At + B */
export function instantaneousVelocity(fit: Pick<QuadraticFit, 'a' | 'b'>, t: number): number {
  return 2 * fit.a * t + fit.b;
}

/** a = 2A (constant for a quadratic model) */
export function accelerationFromQuadratic(fit: Pick<QuadraticFit, 'a'>): number {
  return 2 * fit.a;
}

export interface VelocityPoint {
  time: number;
  velocity: number;
}

/** Instantaneous velocity from the fitted model at each measured time. */
export function velocitiesFromQuadratic(
  fit: Pick<QuadraticFit, 'a' | 'b'>,
  times: readonly number[],
): VelocityPoint[] {
  return times.map((time) => ({ time, velocity: instantaneousVelocity(fit, time) }));
}

/**
 * Velocity-vs-time step of the workflow: compute v(t) = 2At + B at each measured
 * time, then fit v(t) = m·t + b to those points.
 *
 * NOTE: these points lie exactly on a line by construction, so m = 2A, b = B and
 * R² = 1 always. This step shows the derivative relationship; it is not
 * independent evidence for constant acceleration. Use intervalAverageVelocities
 * for that.
 */
export function velocityAnalysis(
  fit: Pick<QuadraticFit, 'a' | 'b'>,
  times: readonly number[],
): Result<{ points: VelocityPoint[]; fit: LinearFit }> {
  const points = velocitiesFromQuadratic(fit, times);
  const line = linearFit(
    points.map((p) => p.time),
    points.map((p) => p.velocity),
  );
  return line.ok ? { ok: true, value: { points, fit: line.value } } : line;
}

export interface IntervalVelocity {
  /** Midpoint time of the interval (s). For constant acceleration, v_avg equals v at this time. */
  midTime: number;
  /** Δx/Δt (m/s) */
  velocity: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Average velocity between consecutive gates (sorted by time), assigned to the
 * midpoint time. Model-free, so it is an independent check on the quadratic fit.
 * Pairs with Δt = 0 are skipped rather than producing Infinity.
 */
export function intervalAverageVelocities(points: readonly TimedPosition[]): IntervalVelocity[] {
  const order = points
    .map((p, index) => ({ ...p, index }))
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.position))
    .sort((p, q) => p.time - q.time);
  const out: IntervalVelocity[] = [];
  for (let i = 1; i < order.length; i++) {
    const p0 = order[i - 1]!;
    const p1 = order[i]!;
    const dt = p1.time - p0.time;
    if (dt <= 0) continue;
    out.push({
      midTime: (p0.time + p1.time) / 2,
      velocity: (p1.position - p0.position) / dt,
      startIndex: p0.index,
      endIndex: p1.index,
    });
  }
  return out;
}
