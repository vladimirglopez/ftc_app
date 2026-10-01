import {
  Emitter,
  type PhotogateChannel,
  type PhotogateEvent,
  type PhotogateSource,
  type SourceState,
} from '../photogate';
import { DEFAULT_FALL_WORLD, simulateDrop, type FallWorld } from './fallSimulation';
import { seededRandom, type RandomFn } from './random';

/** Schedules fn after ms; returns a cancel function. Injected so tests run instantly. */
export type Scheduler = (ms: number, fn: () => void) => () => void;

const realTimeScheduler: Scheduler = (ms, fn) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export const immediateScheduler: Scheduler = (_ms, fn) => {
  fn();
  return () => {};
};

export interface SimulatedPhotogateOptions {
  world: FallWorld;
  /** Seed for reproducible noise; omit for a different run every time. */
  seed?: number;
  scheduler?: Scheduler;
  /** Playback speed; 1 = real time. Event timestamps are unaffected. */
  timeScale?: number;
}

/**
 * Plays back a simulated drop through the same PhotogateSource interface the
 * hardware will use. Call setWorld() when the student edits gate positions so
 * the simulated gates sit where the student says they are.
 */
export class SimulatedPhotogateSource implements PhotogateSource {
  readonly kind = 'simulated' as const;
  readonly displayName = 'Simulated Data';
  readonly isSupported = true;

  private _state: SourceState = 'disconnected';
  private world: FallWorld;
  private readonly random: RandomFn;
  private readonly schedule: Scheduler;
  private readonly timeScale: number;
  private pending: (() => void)[] = [];
  private readonly events = new Emitter<[PhotogateEvent]>();
  private readonly states = new Emitter<[SourceState, Error?]>();

  constructor(options: SimulatedPhotogateOptions) {
    this.world = options.world;
    this.random = seededRandom(options.seed ?? Math.floor(Math.random() * 2 ** 32));
    this.schedule = options.scheduler ?? realTimeScheduler;
    this.timeScale = options.timeScale ?? 1;
  }

  get state(): SourceState {
    return this._state;
  }

  setWorld(world: FallWorld): void {
    this.world = world;
  }

  async connect(): Promise<PhotogateChannel[]> {
    this.setState('connected');
    return this.channels();
  }

  async disconnect(): Promise<void> {
    this.cancelPending();
    this.setState('disconnected');
  }

  /** Starts collection and "drops" the object once. Stops itself after the last event. */
  async start(): Promise<void> {
    if (this._state === 'disconnected') throw new Error('Connect before starting.');
    this.cancelPending();
    this.setState('running');

    const drop = simulateDrop(this.world, this.random);
    const lastTime = drop.length ? drop[drop.length - 1]!.time : 0;
    for (const event of drop) {
      this.pending.push(this.schedule((event.time * 1000) / this.timeScale, () => this.events.emit(event)));
    }
    this.pending.push(
      this.schedule((lastTime * 1000) / this.timeScale + 1, () => {
        this.pending = [];
        if (this._state === 'running') this.setState('connected');
      }),
    );
  }

  async stop(): Promise<void> {
    this.cancelPending();
    if (this._state === 'running') this.setState('connected');
  }

  onEvent(listener: (event: PhotogateEvent) => void) {
    return this.events.on(listener);
  }

  onStateChange(listener: (state: SourceState, error?: Error) => void) {
    return this.states.on(listener);
  }

  private channels(): PhotogateChannel[] {
    return this.world.gates.map(({ channelId, label }) => ({ channelId, label }));
  }

  private cancelPending() {
    this.pending.forEach((cancel) => cancel());
    this.pending = [];
  }

  private setState(state: SourceState) {
    this._state = state;
    this.states.emit(state);
  }
}

export function createSimulatedWorld(
  gates: FallWorld['gates'],
  overrides: Partial<Omit<FallWorld, 'gates'>> = {},
): FallWorld {
  return { ...DEFAULT_FALL_WORLD, ...overrides, gates };
}
