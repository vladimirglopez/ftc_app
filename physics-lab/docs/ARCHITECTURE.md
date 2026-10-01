# Architecture

Dependencies point one way: **UI → experiment → (analysis, sensors) → core**. The analysis and sensor layers never import each other, React, or Vernier code.

```
src/
  core/                       framework-free primitives
    result.ts                 Result<T> type: analysis returns errors, never NaN/Infinity
    numberInput.ts            strict parsing of student-typed numbers
  analysis/                   pure math/physics, no React, no sensor knowledge
    regression.ts             linear & quadratic least squares, R², evaluate, sampleFit
    kinematics.ts             x(t)=At²+Bt+C → v(t)=2At+B, a=2A; interval average velocities
    linearize.ts              variable registry (t, t², x) + linear fit of transformed data
  sensors/                    hardware acquisition
    photogate.ts              PhotogateSource interface + event types
    simulated/                SimulatedPhotogateSource, free-fall physics, seeded RNG
    godirect/                 placeholder; ALL Vernier-specific code lives here only
  experiments/
    fallingPhotogates/        experiment module: data model, validation, event→time mapping, demo data
  App.tsx, main.tsx           placeholder shell (UI comes next)
```

## Key decisions

- **SI units internally.** Position in m, time in s. Conversion happens only at display/export.
- **Analysis takes `{ time, position }`**, not the experiment type, so future modules (Sensor Cart, force) reuse it unchanged.
- **Result types instead of exceptions.** Every failure (too few points, duplicate times, non-finite input, singular system) returns a coded error with a student-readable message. R² is `null` when it is undefined, never NaN.
- **Numerically safe fitting.** x is centred and scaled before solving the normal equations, so raw sensor clocks (t ≈ 1000 s) fit correctly.
- **Fits report `degreesOfFreedom`.** With 3 gates a parabola passes through every point, so R² = 1 means nothing. The UI should say so.
- **The velocity graph is circular, by design.** v = 2At + B evaluated at measured times lies exactly on a line (R² = 1 always). `intervalAverageVelocities` (Δx/Δt at midpoint times) is the model-free check, and is exact for constant acceleration.
- **Time zero = first gate blocked.** Source clocks have an arbitrary zero (collection start). `applyPhotogateEvents` subtracts the first block time; otherwise B and C are meaningless.
- **One clock per source.** `PhotogateSource` requires all events from one source to share a time base. Multi-device hardware must reconcile clocks inside its adapter or refuse.
- **Raw input preserved.** `GateRow.positionInput` stores exactly what the student typed; parsing happens during validation.
- **Simulator mirrors reality.** It emits raw block/unblock events with a release delay, timing jitter and object length through the same interface as hardware. `setWorld()` places simulated gates where the student says they are. Scheduler and seed are injectable for deterministic tests.
- **Versioned, serializable experiment state** (`schemaVersion`, `experimentType`), ready for save/load and further modules. `MEASUREMENT_COLUMNS` is the extension point for CSV export.
