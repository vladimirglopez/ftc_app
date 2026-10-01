import { fail, ok, type Result } from '../core/result';

/** y = m·x + b */
export interface LinearFit {
  kind: 'linear';
  /** m */
  slope: number;
  /** b */
  intercept: number;
  /** Coefficient of determination; null when undefined (all y identical). */
  rSquared: number | null;
  /** Number of data points used. */
  n: number;
  /** n − 2. Zero means the line is forced through both points and R² carries no information. */
  degreesOfFreedom: number;
}

/** y = A·x² + B·x + C */
export interface QuadraticFit {
  kind: 'quadratic';
  a: number;
  b: number;
  c: number;
  rSquared: number | null;
  n: number;
  /** n − 3. Zero means the parabola passes exactly through all three points. */
  degreesOfFreedom: number;
}

export type FitModel = LinearFit | QuadraticFit;

export function evaluateLinear(fit: Pick<LinearFit, 'slope' | 'intercept'>, x: number): number {
  return fit.slope * x + fit.intercept;
}

export function evaluateQuadratic(fit: Pick<QuadraticFit, 'a' | 'b' | 'c'>, x: number): number {
  return (fit.a * x + fit.b) * x + fit.c;
}

export function evaluateFit(fit: FitModel, x: number): number {
  return fit.kind === 'linear' ? evaluateLinear(fit, x) : evaluateQuadratic(fit, x);
}

/** Evenly spaced points along a fitted curve, for drawing it over the data. */
export function sampleFit(
  fit: FitModel,
  xMin: number,
  xMax: number,
  count = 100,
): { x: number; y: number }[] {
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || count < 2) return [];
  const step = (xMax - xMin) / (count - 1);
  return Array.from({ length: count }, (_, i) => {
    const x = xMin + i * step;
    return { x, y: evaluateFit(fit, x) };
  });
}

/**
 * R² = 1 − SS_res / SS_tot. Returns null when SS_tot = 0 (every y identical),
 * where R² is mathematically undefined, rather than NaN.
 */
export function rSquared(ys: readonly number[], predicted: readonly number[]): number | null {
  if (ys.length === 0 || ys.length !== predicted.length) return null;
  const mean = ys.reduce((s, y) => s + y, 0) / ys.length;
  let ssTot = 0;
  let ssRes = 0;
  ys.forEach((y, i) => {
    ssTot += (y - mean) ** 2;
    ssRes += (y - predicted[i]!) ** 2;
  });
  if (ssTot === 0) return null;
  const r2 = 1 - ssRes / ssTot;
  return Number.isFinite(r2) ? r2 : null;
}

export function linearFit(xs: readonly number[], ys: readonly number[]): Result<LinearFit> {
  const coeffs = polynomialLeastSquares(xs, ys, 1);
  if (!coeffs.ok) return coeffs;
  const [intercept, slope] = coeffs.value as [number, number];
  const fit = { slope, intercept };
  return ok({
    kind: 'linear',
    slope,
    intercept,
    rSquared: rSquared(ys, xs.map((x) => evaluateLinear(fit, x))),
    n: xs.length,
    degreesOfFreedom: xs.length - 2,
  });
}

export function quadraticFit(xs: readonly number[], ys: readonly number[]): Result<QuadraticFit> {
  const coeffs = polynomialLeastSquares(xs, ys, 2);
  if (!coeffs.ok) return coeffs;
  const [c, b, a] = coeffs.value as [number, number, number];
  const fit = { a, b, c };
  return ok({
    kind: 'quadratic',
    a,
    b,
    c,
    rSquared: rSquared(ys, xs.map((x) => evaluateQuadratic(fit, x))),
    n: xs.length,
    degreesOfFreedom: xs.length - 3,
  });
}

const MODEL_NAME = { 1: 'a straight line', 2: 'a quadratic (parabola)' } as const;

/**
 * Least-squares polynomial fit of degree 1 or 2. Returns coefficients in
 * ascending power order: [c0, c1, (c2)].
 *
 * x is centred and scaled before solving the normal equations so the system is
 * well conditioned even when times are offset (e.g. t ≈ 100 s after
 * collection started), then the coefficients are mapped back to raw x.
 */
export function polynomialLeastSquares(
  xs: readonly number[],
  ys: readonly number[],
  degree: 1 | 2,
): Result<number[]> {
  const params = degree + 1;
  if (xs.length !== ys.length) {
    return fail('LENGTH_MISMATCH', 'Each time value needs exactly one matching value to plot against it.');
  }
  if (!xs.every(Number.isFinite) || !ys.every(Number.isFinite)) {
    return fail('NON_FINITE_INPUT', 'Some values are missing or are not valid numbers.');
  }
  if (xs.length < params) {
    return fail(
      'INSUFFICIENT_DATA',
      `Fitting ${MODEL_NAME[degree]} needs at least ${params} data points; you have ${xs.length}.`,
    );
  }
  if (new Set(xs).size < params) {
    return fail(
      'NOT_ENOUGH_DISTINCT_X',
      `Fitting ${MODEL_NAME[degree]} needs at least ${params} different x-values. Some points share the same x-value.`,
    );
  }

  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const scale = Math.max(...xs.map((x) => Math.abs(x - mean)));
  const us = xs.map((x) => (x - mean) / scale);

  // Normal equations (VᵀV)p = Vᵀy for the Vandermonde matrix V in u.
  const ata = Array.from({ length: params }, () => new Array<number>(params).fill(0));
  const aty = new Array<number>(params).fill(0);
  us.forEach((u, i) => {
    const powers = Array.from({ length: params }, (_, k) => u ** k);
    for (let r = 0; r < params; r++) {
      aty[r]! += powers[r]! * ys[i]!;
      for (let c = 0; c < params; c++) ata[r]![c]! += powers[r]! * powers[c]!;
    }
  });

  const p = solveLinearSystem(ata, aty);
  if (!p) return fail('SINGULAR', 'These data cannot determine a unique fit.');

  // Expand Σ p_k ((x − mean)/scale)^k back into powers of x.
  const result =
    degree === 1
      ? [p[0]! - (p[1]! * mean) / scale, p[1]! / scale]
      : [
          p[0]! - (p[1]! * mean) / scale + (p[2]! * mean * mean) / (scale * scale),
          p[1]! / scale - (2 * p[2]! * mean) / (scale * scale),
          p[2]! / (scale * scale),
        ];

  if (!result.every(Number.isFinite)) {
    return fail('SINGULAR', 'The fit produced invalid numbers. Check the data for extreme values.');
  }
  return ok(result);
}

/** Gaussian elimination with partial pivoting. Returns null if (near-)singular. */
function solveLinearSystem(matrix: number[][], rhs: number[]): number[] | null {
  const size = rhs.length;
  const m = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let r = col + 1; r < size; r++) {
      if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![col]!) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    for (let r = col + 1; r < size; r++) {
      const factor = m[r]![col]! / m[col]![col]!;
      for (let c = col; c <= size; c++) m[r]![c]! -= factor * m[col]![c]!;
    }
  }
  const x = new Array<number>(size).fill(0);
  for (let r = size - 1; r >= 0; r--) {
    let sum = m[r]![size]!;
    for (let c = r + 1; c < size; c++) sum -= m[r]![c]! * x[c]!;
    x[r] = sum / m[r]![r]!;
  }
  return x;
}
