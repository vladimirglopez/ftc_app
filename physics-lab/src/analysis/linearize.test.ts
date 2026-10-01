import { describe, expect, it } from 'vitest';
import { linearizedFit, transformData } from './linearize';

describe('linearization', () => {
  it('x vs t² is linear with slope a/2 when the object starts from rest at t = 0', () => {
    const data = [0.1, 0.2, 0.3, 0.4].map((time) => ({ time, position: 4.9 * time * time }));
    const r = linearizedFit(data, 't2', 'x');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.points[1]).toEqual({ x: expect.closeTo(0.04, 12), y: expect.closeTo(0.196, 12), sourceIndex: 1 });
    expect(r.value.fit.slope).toBeCloseTo(4.9, 10);
    expect(r.value.fit.intercept).toBeCloseTo(0, 10);
    expect(r.value.fit.rSquared).toBeCloseTo(1, 12);
  });

  it('x vs t² is NOT perfectly linear when the object is already moving at t = 0', () => {
    const data = [0, 0.1, 0.2, 0.3, 0.4].map((time) => ({ time, position: 1 + 2 * time + 5 * time * time }));
    const r = linearizedFit(data, 't2', 'x');
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.fit.rSquared!).toBeLessThan(0.999);
  });

  it('drops non-finite rows from the transformed table', () => {
    const pts = transformData(
      [
        { time: 0.1, position: 0.5 },
        { time: NaN, position: 0.6 },
      ],
      't',
      'x',
    );
    expect(pts).toEqual([{ x: 0.1, y: 0.5, sourceIndex: 0 }]);
  });

  it('fails gracefully with insufficient data', () => {
    expect(linearizedFit([{ time: 0.1, position: 0.2 }], 't2', 'x').ok).toBe(false);
  });
});
