import { describe, expect, it } from 'vitest';
import type { PhotogateEvent, SourceState } from '../photogate';
import { createSimulatedWorld, immediateScheduler, SimulatedPhotogateSource } from './SimulatedPhotogateSource';
import { simulateDrop } from './fallSimulation';
import { seededRandom } from './random';
import { GoDirectPhotogateSource, NotImplementedError } from '../godirect/GoDirectPhotogateSource';

const gates = [0.1, 0.3, 0.5].map((position, i) => ({ channelId: `gate-${i + 1}`, label: `${i + 1}`, position }));

describe('simulateDrop', () => {
  it('produces noise-free times matching free fall from rest', () => {
    const world = createSimulatedWorld(gates, { timingNoise: 0, releaseDelay: 0, gravity: 9.8 });
    const blocks = simulateDrop(world, seededRandom(1)).filter((e) => e.state === 'blocked');
    expect(blocks.map((e) => e.channelId)).toEqual(['gate-1', 'gate-2', 'gate-3']);
    blocks.forEach((e, i) => expect(e.time).toBeCloseTo(Math.sqrt((2 * gates[i]!.position) / 9.8), 12));
  });

  it('handles an upward-positive axis (heights above the floor)', () => {
    const heights = [1.0, 0.8, 0.6].map((position, i) => ({ channelId: `g${i}`, label: `${i}`, position }));
    const world = createSimulatedWorld(heights, {
      releasePosition: 1.1,
      positiveDirection: 'up',
      timingNoise: 0,
      releaseDelay: 0,
    });
    const blocks = simulateDrop(world, seededRandom(1)).filter((e) => e.state === 'blocked');
    expect(blocks.map((e) => e.channelId)).toEqual(['g0', 'g1', 'g2']);
    expect(blocks[0]!.time).toBeCloseTo(Math.sqrt((2 * 0.1) / 9.81), 12);
  });

  it('omits gates above the release point (they never see the object)', () => {
    const world = createSimulatedWorld(gates, { releasePosition: 0.2 });
    const ids = new Set(simulateDrop(world, seededRandom(1)).map((e) => e.channelId));
    expect(ids.has('gate-1')).toBe(false);
    expect(ids.has('gate-3')).toBe(true);
  });

  it('adds reproducible noise for a given seed, and unblocks after blocking', () => {
    const world = createSimulatedWorld(gates);
    const a = simulateDrop(world, seededRandom(7));
    expect(simulateDrop(world, seededRandom(7))).toEqual(a);
    expect(simulateDrop(world, seededRandom(8))).not.toEqual(a);
    for (const g of gates) {
      const ev = a.filter((e) => e.channelId === g.channelId);
      expect(ev.find((e) => e.state === 'unblocked')!.time).toBeGreaterThan(ev.find((e) => e.state === 'blocked')!.time);
    }
  });
});

describe('SimulatedPhotogateSource', () => {
  it('goes through connect → run → stop and emits events via the PhotogateSource interface', async () => {
    const source = new SimulatedPhotogateSource({
      world: createSimulatedWorld(gates),
      seed: 3,
      scheduler: immediateScheduler,
    });
    const events: PhotogateEvent[] = [];
    const states: SourceState[] = [];
    source.onEvent((e) => events.push(e));
    source.onStateChange((s) => states.push(s));

    const channels = await source.connect();
    expect(channels.map((c) => c.channelId)).toEqual(['gate-1', 'gate-2', 'gate-3']);
    await source.start();

    expect(events.filter((e) => e.state === 'blocked')).toHaveLength(3);
    expect(states).toEqual(['connected', 'running', 'connected']);
  });

  it('refuses to start before connecting', async () => {
    const source = new SimulatedPhotogateSource({ world: createSimulatedWorld(gates), scheduler: immediateScheduler });
    await expect(source.start()).rejects.toThrow();
  });

  it('uses updated gate positions after setWorld', async () => {
    const source = new SimulatedPhotogateSource({ world: createSimulatedWorld(gates), scheduler: immediateScheduler });
    const events: PhotogateEvent[] = [];
    source.onEvent((e) => events.push(e));
    await source.connect();
    source.setWorld(createSimulatedWorld(gates.slice(0, 2)));
    await source.start();
    expect(new Set(events.map((e) => e.channelId))).toEqual(new Set(['gate-1', 'gate-2']));
  });

  it('stop() cancels a run in progress', async () => {
    const queued: (() => void)[] = [];
    const source = new SimulatedPhotogateSource({
      world: createSimulatedWorld(gates),
      scheduler: (_ms, fn) => {
        let cancelled = false;
        queued.push(() => !cancelled && fn());
        return () => (cancelled = true);
      },
    });
    const events: PhotogateEvent[] = [];
    source.onEvent((e) => events.push(e));
    await source.connect();
    await source.start();
    expect(source.state).toBe('running');
    await source.stop();
    queued.forEach((run) => run());
    expect(events).toHaveLength(0);
    expect(source.state).toBe('connected');
  });
});

describe('GoDirectPhotogateSource placeholder', () => {
  it('does not pretend to connect', async () => {
    const source = new GoDirectPhotogateSource();
    await expect(source.connect()).rejects.toBeInstanceOf(NotImplementedError);
    expect(source.state).toBe('error');
  });
});
