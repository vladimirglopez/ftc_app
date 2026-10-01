import { gaussian, seededRandom } from '../../sensors/simulated/random';
import { simulateDrop } from '../../sensors/simulated/fallSimulation';
import { createSimulatedWorld } from '../../sensors/simulated/SimulatedPhotogateSource';
import { applyPhotogateEvents, createGateRow, type FallingPhotogateExperiment } from './model';

/** True gate positions (m, downward from the release point) for the demo. */
export const EXAMPLE_TRUE_POSITIONS = [0.1, 0.3, 0.5, 0.7, 0.9];

/**
 * Built-in teacher demo: a simulated drop with realistic imperfections —
 * timing jitter and ±mm meter-stick reading error, recorded to the nearest mm.
 * Analysis results are NOT stored; the normal regression code must compute them.
 */
export function createExampleExperiment(seed = 20261001): FallingPhotogateExperiment {
  const random = seededRandom(seed);
  const gates = EXAMPLE_TRUE_POSITIONS.map((position, i) => ({
    channelId: `gate-${i + 1}`,
    label: `${i + 1}`,
    position,
  }));
  const world = createSimulatedWorld(gates, { releasePosition: 0, positiveDirection: 'down' });
  const events = simulateDrop(world, random);

  const recorded = gates.map((g) => (g.position + gaussian(random, 0, 0.002)).toFixed(3));
  const exp: FallingPhotogateExperiment = {
    schemaVersion: 1,
    experimentType: 'falling-photogates',
    title: 'Falling Motion — Photogates (Simulated example)',
    source: 'simulated',
    isExample: true,
    gates: recorded.map((input, i) => createGateRow(i + 1, input)),
  };
  return applyPhotogateEvents(exp, events);
}
