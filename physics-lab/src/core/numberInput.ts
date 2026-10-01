import type { Result } from './result';

export type NumberInputError = 'EMPTY' | 'NOT_A_NUMBER' | 'NOT_FINITE';

/**
 * Parse a number typed by a student. Accepts plain decimals and scientific
 * notation ("0.45", "-1.2", "4.5e-1"). Rejects blanks, junk ("0.4m", "1..2"),
 * and values that overflow to ±Infinity.
 */
export function parseNumberInput(raw: string): Result<number, NumberInputError> {
  const text = raw.trim();
  if (text === '') return { ok: false, error: 'EMPTY' };
  // Number('') === 0 and Number('0x10') === 16, so validate the shape first.
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
    return { ok: false, error: 'NOT_A_NUMBER' };
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: 'NOT_FINITE' };
  return { ok: true, value };
}

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
