import { parseNumberInput } from '../../core/numberInput';
import type { PhotogateEvent } from '../../sensors/photogate';

/** One complete, validated data point (SI units). */
export interface PhotogateMeasurement {
  gateId: string;
  /** m — entered by the student */
  position: number;
  /** s — measured, relative to the first gate the object blocked */
  time: number;
}

/** One row of the student's table, possibly incomplete. */
export interface GateRow {
  gateId: string;
  label: string;
  /** Exactly what the student typed, so the input never "jumps" while editing. */
  positionInput: string;
  /** s, relative to the first blocked gate; null until measured. */
  time: number | null;
}

export type DataSourceChoice = 'simulated' | 'godirect';

/**
 * Serializable experiment state. schemaVersion + experimentType let future
 * save/load and other experiment modules coexist.
 */
export interface FallingPhotogateExperiment {
  schemaVersion: 1;
  experimentType: 'falling-photogates';
  title: string;
  source: DataSourceChoice;
  /** True for the built-in teacher demo so the UI can label it as simulated. */
  isExample: boolean;
  gates: GateRow[];
}

export const MIN_GATES = 1;
export const MAX_GATES = 12;
export const DEFAULT_GATE_COUNT = 5;

/** Columns for export. Calculated quantities (v, t², …) can be appended later. */
export const MEASUREMENT_COLUMNS = [
  { key: 'gate', header: 'gate', unit: '' },
  { key: 'position', header: 'position_m', unit: 'm' },
  { key: 'time', header: 'time_s', unit: 's' },
] as const;

function nextGateNumber(gates: readonly GateRow[]): number {
  return gates.reduce((max, g) => Math.max(max, Number(g.gateId.replace('gate-', '')) || 0), 0) + 1;
}

export function createGateRow(n: number, positionInput = ''): GateRow {
  return { gateId: `gate-${n}`, label: `${n}`, positionInput, time: null };
}

export function createExperiment(
  source: DataSourceChoice = 'simulated',
  gateCount = DEFAULT_GATE_COUNT,
): FallingPhotogateExperiment {
  return {
    schemaVersion: 1,
    experimentType: 'falling-photogates',
    title: 'Falling Motion — Photogates',
    source,
    isExample: false,
    gates: Array.from({ length: gateCount }, (_, i) => createGateRow(i + 1)),
  };
}

export function addGate(exp: FallingPhotogateExperiment): FallingPhotogateExperiment {
  if (exp.gates.length >= MAX_GATES) return exp;
  return { ...exp, gates: [...exp.gates, createGateRow(nextGateNumber(exp.gates))] };
}

export function removeGate(exp: FallingPhotogateExperiment, gateId: string): FallingPhotogateExperiment {
  if (exp.gates.length <= MIN_GATES) return exp;
  return { ...exp, gates: exp.gates.filter((g) => g.gateId !== gateId) };
}

export function setGatePosition(
  exp: FallingPhotogateExperiment,
  gateId: string,
  positionInput: string,
): FallingPhotogateExperiment {
  return { ...exp, gates: exp.gates.map((g) => (g.gateId === gateId ? { ...g, positionInput } : g)) };
}

/** Clears measured times but keeps positions (students re-drop without re-measuring). */
export function clearTimes(exp: FallingPhotogateExperiment): FallingPhotogateExperiment {
  return { ...exp, gates: exp.gates.map((g) => ({ ...g, time: null })) };
}

/**
 * Convert raw source events into per-gate times measured from the first gate
 * blocked. Only the first 'blocked' event per channel counts (a bouncing or
 * re-passing object is ignored). Raw source clocks have an arbitrary zero
 * (collection start), which would make B and C in the fit meaningless.
 *
 * channelToGate maps hardware channel ids to table rows; identity by default.
 */
export function applyPhotogateEvents(
  exp: FallingPhotogateExperiment,
  events: readonly PhotogateEvent[],
  channelToGate: (channelId: string) => string | undefined = (id) => id,
): FallingPhotogateExperiment {
  const firstBlock = new Map<string, number>();
  for (const e of events) {
    if (e.state !== 'blocked' || !Number.isFinite(e.time)) continue;
    const gateId = channelToGate(e.channelId);
    if (gateId === undefined) continue;
    const prev = firstBlock.get(gateId);
    if (prev === undefined || e.time < prev) firstBlock.set(gateId, e.time);
  }
  const knownGates = exp.gates.filter((g) => firstBlock.has(g.gateId));
  if (knownGates.length === 0) return clearTimes(exp);
  const t0 = Math.min(...knownGates.map((g) => firstBlock.get(g.gateId)!));
  return {
    ...exp,
    gates: exp.gates.map((g) => {
      const t = firstBlock.get(g.gateId);
      return { ...g, time: t === undefined ? null : t - t0 };
    }),
  };
}

export type GateIssueCode = 'MISSING_POSITION' | 'INVALID_POSITION' | 'MISSING_TIME' | 'DUPLICATE_TIME';

export interface GateIssue {
  gateId: string;
  code: GateIssueCode;
  message: string;
}

export interface ValidationResult {
  /** Rows that are complete and valid, in table order. */
  measurements: PhotogateMeasurement[];
  issues: GateIssue[];
  /** Number of usable points; the quadratic fit needs ≥ 3 with distinct times. */
  usableCount: number;
}

/** Per-row validation with student-readable messages. Never throws. */
export function validateExperiment(exp: FallingPhotogateExperiment): ValidationResult {
  const issues: GateIssue[] = [];
  const candidates: PhotogateMeasurement[] = [];

  for (const g of exp.gates) {
    const parsed = parseNumberInput(g.positionInput);
    let position: number | null = null;
    if (parsed.ok) position = parsed.value;
    else if (parsed.error === 'EMPTY')
      issues.push({ gateId: g.gateId, code: 'MISSING_POSITION', message: `Gate ${g.label}: enter its position.` });
    else
      issues.push({
        gateId: g.gateId,
        code: 'INVALID_POSITION',
        message: `Gate ${g.label}: "${g.positionInput.trim()}" is not a number. Enter the position in meters, e.g. 0.45`,
      });

    const timeOk = g.time !== null && Number.isFinite(g.time);
    if (!timeOk)
      issues.push({ gateId: g.gateId, code: 'MISSING_TIME', message: `Gate ${g.label}: no time measured yet.` });

    if (position !== null && timeOk) candidates.push({ gateId: g.gateId, position, time: g.time! });
  }

  // Two gates cannot be blocked at the same instant by one falling object.
  const byTime = new Map<number, PhotogateMeasurement[]>();
  candidates.forEach((m) => byTime.set(m.time, [...(byTime.get(m.time) ?? []), m]));
  const label = (id: string) => exp.gates.find((g) => g.gateId === id)?.label ?? id;
  for (const group of byTime.values()) {
    if (group.length < 2) continue;
    const names = group.map((m) => label(m.gateId)).join(', ');
    group.forEach((m) =>
      issues.push({
        gateId: m.gateId,
        code: 'DUPLICATE_TIME',
        message: `Gates ${names} have the same time. Check the photogate connections and repeat the drop.`,
      }),
    );
  }

  // Duplicate-time rows stay in the data; regression rejects them only if too few distinct times remain.
  return { measurements: candidates, issues, usableCount: candidates.length };
}
