/**
 * Explicit success/failure value. Analysis functions return this instead of
 * throwing or leaking NaN/Infinity, so the UI can always show a readable message.
 */
export type Result<T, E = AnalysisError> = { ok: true; value: T } | { ok: false; error: E };

export type AnalysisErrorCode =
  | 'INSUFFICIENT_DATA'
  | 'NOT_ENOUGH_DISTINCT_X'
  | 'NON_FINITE_INPUT'
  | 'LENGTH_MISMATCH'
  | 'SINGULAR';

export interface AnalysisError {
  code: AnalysisErrorCode;
  /** Student-readable explanation. */
  message: string;
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const fail = (code: AnalysisErrorCode, message: string): Result<never, AnalysisError> => ({
  ok: false,
  error: { code, message },
});
