import type { PhotogateEvent } from '../photogate';
import { gaussian, type RandomFn } from './random';

export interface SimulatedGate {
  channelId: string;
  label: string;
  /** TRUE physical position on the position axis (m). */
  position: number;
}

/** The simulated physical world: where the gates really are and how the object falls. */
export interface FallWorld {
  gates: SimulatedGate[];
  /** Position of the object's leading edge at release (m), same axis as gates. */
  releasePosition: number;
  /** Which way the position axis points. 'down' → positions increase as it falls. */
  positiveDirection: 'down' | 'up';
  /** m/s² (magnitude) */
  gravity: number;
  /** Object length along the fall (m); sets how long each beam stays blocked. */
  objectLength: number;
  /** Seconds between collection start and release, as when a student clicks Start then drops. */
  releaseDelay: number;
  /** Standard deviation of random timing error per event (s). */
  timingNoise: number;
}

export const DEFAULT_FALL_WORLD: Omit<FallWorld, 'gates'> = {
  releasePosition: 0,
  positiveDirection: 'down',
  gravity: 9.81,
  objectLength: 0.025,
  releaseDelay: 0.8,
  timingNoise: 0.0002,
};

/**
 * Generate block/unblock events for one drop from rest, ignoring air drag.
 * Gates above the release point are never reached and produce no events.
 */
export function simulateDrop(world: FallWorld, random: RandomFn): PhotogateEvent[] {
  const sign = world.positiveDirection === 'down' ? 1 : -1;
  const timeToFall = (distance: number) => Math.sqrt((2 * distance) / world.gravity);
  const events: PhotogateEvent[] = [];
  for (const gate of world.gates) {
    const distance = (gate.position - world.releasePosition) * sign;
    if (!Number.isFinite(distance) || distance < 0) continue;
    const blocked = world.releaseDelay + timeToFall(distance) + gaussian(random, 0, world.timingNoise);
    const unblocked =
      world.releaseDelay + timeToFall(distance + world.objectLength) + gaussian(random, 0, world.timingNoise);
    events.push({ channelId: gate.channelId, state: 'blocked', time: blocked });
    events.push({ channelId: gate.channelId, state: 'unblocked', time: Math.max(unblocked, blocked) });
  }
  return events.sort((a, b) => a.time - b.time);
}
