import {
  Emitter,
  type PhotogateChannel,
  type PhotogateEvent,
  type PhotogateSource,
  type SourceState,
} from '../photogate';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * PLACEHOLDER for Vernier Go Direct Photogate support. Intentionally does not
 * talk to hardware. All Vernier-specific code (including any @vernier/godirect
 * import) must stay inside src/sensors/godirect/.
 *
 * See docs/VERNIER_INTEGRATION.md for the open questions that must be answered
 * before this is implemented.
 */
export class GoDirectPhotogateSource implements PhotogateSource {
  readonly kind = 'godirect' as const;
  readonly displayName = 'Vernier Go Direct Photogate (experimental — not yet available)';
  readonly isSupported =
    typeof navigator !== 'undefined' && ('bluetooth' in navigator || 'hid' in navigator);

  private _state: SourceState = 'disconnected';
  private readonly events = new Emitter<[PhotogateEvent]>();
  private readonly states = new Emitter<[SourceState, Error?]>();

  get state(): SourceState {
    return this._state;
  }

  async connect(): Promise<PhotogateChannel[]> {
    const error = new NotImplementedError(
      'Vernier Go Direct Photogate support is not available yet. Use Simulated Data for now.',
    );
    this._state = 'error';
    this.states.emit('error', error);
    throw error;
  }

  async disconnect(): Promise<void> {
    this._state = 'disconnected';
    this.states.emit('disconnected');
  }

  async start(): Promise<void> {
    throw new NotImplementedError('Vernier Go Direct Photogate support is not available yet.');
  }

  async stop(): Promise<void> {}

  onEvent(listener: (event: PhotogateEvent) => void) {
    return this.events.on(listener);
  }

  onStateChange(listener: (state: SourceState, error?: Error) => void) {
    return this.states.on(listener);
  }
}
