import { describe, expect, it } from 'vitest';
import { parseNumberInput } from './numberInput';

describe('parseNumberInput', () => {
  it.each([
    ['0.45', 0.45],
    [' 1.2 ', 1.2],
    ['-0.3', -0.3],
    ['.5', 0.5],
    ['5.', 5],
    ['4.5e-1', 0.45],
    ['0', 0],
  ])('accepts %j', (raw, value) => {
    expect(parseNumberInput(raw)).toEqual({ ok: true, value });
  });

  it.each(['', '   '])('reports empty for %j', (raw) => {
    expect(parseNumberInput(raw)).toEqual({ ok: false, error: 'EMPTY' });
  });

  it.each(['abc', '0.4m', '1..2', '1,5', '0x10', 'NaN', 'Infinity', '-', '.', 'e5'])(
    'rejects %j as not a number',
    (raw) => {
      expect(parseNumberInput(raw)).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    },
  );

  it('rejects values that overflow to Infinity', () => {
    expect(parseNumberInput('1e999')).toEqual({ ok: false, error: 'NOT_FINITE' });
  });
});
