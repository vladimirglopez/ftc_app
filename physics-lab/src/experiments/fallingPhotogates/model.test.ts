import { describe, expect, it } from 'vitest';
import {
  addGate,
  applyPhotogateEvents,
  clearTimes,
  createExperiment,
  MAX_GATES,
  removeGate,
  setGatePosition,
  validateExperiment,
  type FallingPhotogateExperiment,
} from './model';
import { createExampleExperiment, EXAMPLE_TRUE_POSITIONS } from './example';
import { quadraticFit } from '../../analysis/regression';
import { interpretQuadratic } from '../../analysis/kinematics';

function withData(rows: [string, number | null][]): FallingPhotogateExperiment {
  const exp = createExperiment('simulated', rows.length);
  return { ...exp, gates: exp.gates.map((g, i) => ({ ...g, positionInput: rows[i]![0], time: rows[i]![1] })) };
}

describe('experiment editing', () => {
  it('creates five empty gates by default', () => {
    const exp = createExperiment();
    expect(exp.gates.map((g) => g.label)).toEqual(['1', '2', '3', '4', '5']);
    expect(exp.gates.every((g) => g.positionInput === '' && g.time === null)).toBe(true);
  });

  it('adds gates with fresh ids even after removals, within limits', () => {
    let exp = removeGate(createExperiment('simulated', 3), 'gate-2');
    exp = addGate(exp);
    expect(exp.gates.map((g) => g.gateId)).toEqual(['gate-1', 'gate-3', 'gate-4']);
    for (let i = 0; i < 20; i++) exp = addGate(exp);
    expect(exp.gates).toHaveLength(MAX_GATES);
  });

  it('never removes the last gate', () => {
    expect(removeGate(createExperiment('simulated', 1), 'gate-1').gates).toHaveLength(1);
  });

  it('keeps typed text verbatim and clearTimes keeps positions', () => {
    let exp = setGatePosition(createExperiment(), 'gate-2', '0.3');
    exp = { ...exp, gates: exp.gates.map((g) => ({ ...g, time: 0.1 })) };
    exp = clearTimes(exp);
    expect(exp.gates[1]!.positionInput).toBe('0.3');
    expect(exp.gates.every((g) => g.time === null)).toBe(true);
  });
});

describe('applyPhotogateEvents', () => {
  it('measures times from the first blocked gate and ignores repeats/unblocks', () => {
    const exp = applyPhotogateEvents(createExperiment('simulated', 3), [
      { channelId: 'gate-1', state: 'blocked', time: 2.5 },
      { channelId: 'gate-1', state: 'unblocked', time: 2.51 },
      { channelId: 'gate-2', state: 'blocked', time: 2.6 },
      { channelId: 'gate-1', state: 'blocked', time: 3.0 },
      { channelId: 'unknown', state: 'blocked', time: 1.0 },
    ]);
    expect(exp.gates.map((g) => g.time)).toEqual([0, expect.closeTo(0.1, 12), null]);
  });
});

describe('validateExperiment', () => {
  it('returns complete measurements in SI units', () => {
    const v = validateExperiment(withData([['0.10', 0], ['0.30', 0.1], ['0.50', 0.18]]));
    expect(v.issues).toEqual([]);
    expect(v.measurements).toEqual([
      { gateId: 'gate-1', position: 0.1, time: 0 },
      { gateId: 'gate-2', position: 0.3, time: 0.1 },
      { gateId: 'gate-3', position: 0.5, time: 0.18 },
    ]);
  });

  it('flags missing positions, invalid positions, missing times and duplicate times', () => {
    const v = validateExperiment(
      withData([
        ['', 0],
        ['abc', 0.1],
        ['0.5', null],
        ['0.7', 0.2],
        ['0.9', 0.2],
        ['1e999', 0.3],
      ]),
    );
    const codes = v.issues.map((i) => `${i.gateId}:${i.code}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        'gate-1:MISSING_POSITION',
        'gate-2:INVALID_POSITION',
        'gate-3:MISSING_TIME',
        'gate-4:DUPLICATE_TIME',
        'gate-5:DUPLICATE_TIME',
        'gate-6:INVALID_POSITION',
      ]),
    );
    expect(v.usableCount).toBe(2);
    expect(v.issues.every((i) => !/NaN|Infinity|undefined/.test(i.message))).toBe(true);
  });

  it('flags NaN/Infinity times as missing', () => {
    const v = validateExperiment(withData([['0.1', NaN], ['0.2', Infinity]]));
    expect(v.issues.filter((i) => i.code === 'MISSING_TIME')).toHaveLength(2);
    expect(v.measurements).toEqual([]);
  });
});

describe('example experiment', () => {
  it('is labelled simulated and complete', () => {
    const exp = createExampleExperiment();
    expect(exp.isExample).toBe(true);
    expect(exp.title).toMatch(/Simulated/);
    const v = validateExperiment(exp);
    expect(v.issues).toEqual([]);
    expect(v.usableCount).toBe(EXAMPLE_TRUE_POSITIONS.length);
  });

  it('analyses to g ≈ 9.81 m/s² through the normal regression code', () => {
    const { measurements } = validateExperiment(createExampleExperiment());
    const fit = quadraticFit(
      measurements.map((m) => m.time),
      measurements.map((m) => m.position),
    );
    if (!fit.ok) throw new Error(fit.error.message);
    const phys = interpretQuadratic(fit.value);
    expect(phys.acceleration).toBeGreaterThan(9.5);
    expect(phys.acceleration).toBeLessThan(10.1);
    expect(phys.initialVelocity).toBeCloseTo(Math.sqrt(2 * 9.81 * 0.1), 1);
    expect(fit.value.rSquared!).toBeGreaterThan(0.999);
  });
});
