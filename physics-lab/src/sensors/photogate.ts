/**
 * Hardware-agnostic photogate data source. The UI and analysis layers only see
 * this interface; simulated and Vernier implementations live behind it.
 *
 * Contract: every event from one source is stamped on ONE shared clock, in
 * seconds. An implementation that aggregates several physical devices must
 * reconcile their clocks itself (or refuse to), so downstream code can subtract
 * times across channels safely.
 */
export type PhotogateSourceKind = 'simulated' | 'godirect';

export type SourceState = 'disconnected' | 'connecting' | 'connected' | 'running' | 'error';

export interface PhotogateChannel {
  /** Stable id assigned by the source (e.g. device serial + channel). */
  channelId: string;
  /** Human-readable label, e.g. "Gate 1". */
  label: string;
}

export type BeamState = 'blocked' | 'unblocked';

export interface PhotogateEvent {
  channelId: string;
  state: BeamState;
  /** Seconds on the source's clock (arbitrary zero, e.g. collection start). */
  time: number;
}

export type Unsubscribe = () => void;

export interface PhotogateSource {
  readonly kind: PhotogateSourceKind;
  readonly displayName: string;
  /** False when the browser/platform cannot support this source at all. */
  readonly isSupported: boolean;
  readonly state: SourceState;

  /** Must be called from a user gesture for hardware sources (browser security). */
  connect(): Promise<PhotogateChannel[]>;
  disconnect(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;

  onEvent(listener: (event: PhotogateEvent) => void): Unsubscribe;
  onStateChange(listener: (state: SourceState, error?: Error) => void): Unsubscribe;
}

/** Small typed emitter shared by source implementations. */
export class Emitter<T extends unknown[]> {
  private listeners = new Set<(...args: T) => void>();

  on(listener: (...args: T) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(...args: T): void {
    this.listeners.forEach((l) => l(...args));
  }
}
