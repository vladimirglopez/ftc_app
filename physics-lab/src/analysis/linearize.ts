import { linearFit, type LinearFit } from './regression';
import type { TimedPosition } from './kinematics';
import type { Result } from '../core/result';

/**
 * Variables a student may choose for each axis when linearizing.
 * Add entries here (e.g. '1/t', 'v', 'x/t') without touching the UI.
 */
export type LinearizeVariableId = 't' | 't2' | 'x';

export interface LinearizeVariable {
  id: LinearizeVariableId;
  /** Display symbol, e.g. "t²" */
  symbol: string;
  name: string;
  unit: string;
  compute: (p: TimedPosition) => number;
}

export const LINEARIZE_VARIABLES: Record<LinearizeVariableId, LinearizeVariable> = {
  t: { id: 't', symbol: 't', name: 'Time', unit: 's', compute: (p) => p.time },
  t2: { id: 't2', symbol: 't²', name: 'Time squared', unit: 's²', compute: (p) => p.time * p.time },
  x: { id: 'x', symbol: 'x', name: 'Position', unit: 'm', compute: (p) => p.position },
};

export interface TransformedPoint {
  x: number;
  y: number;
  /** Index into the source array, so rows can be matched back to gates. */
  sourceIndex: number;
}

export function transformData(
  data: readonly TimedPosition[],
  xVar: LinearizeVariableId,
  yVar: LinearizeVariableId,
): TransformedPoint[] {
  const fx = LINEARIZE_VARIABLES[xVar].compute;
  const fy = LINEARIZE_VARIABLES[yVar].compute;
  return data
    .map((p, sourceIndex) => ({ x: fx(p), y: fy(p), sourceIndex }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

export function linearizedFit(
  data: readonly TimedPosition[],
  xVar: LinearizeVariableId,
  yVar: LinearizeVariableId,
): Result<{ points: TransformedPoint[]; fit: LinearFit }> {
  const points = transformData(data, xVar, yVar);
  const fit = linearFit(
    points.map((p) => p.x),
    points.map((p) => p.y),
  );
  return fit.ok ? { ok: true, value: { points, fit: fit.value } } : fit;
}
