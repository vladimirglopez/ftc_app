# Vernier Go Direct integration — preliminary findings

Status: **not implemented.** These notes come from reading the published `@vernier/godirect` package (v1.8.3, BSD-3, last published June 2023) source. Validate everything here against real hardware before changing the architecture.

## What the official library provides

| Topic | Finding |
|---|---|
| Browser | Requires Web Bluetooth (BLE) or WebHID (USB). Chromium-based browsers only (Chrome, Edge, ChromeOS). No Safari/iOS and no Firefox. |
| Security | `selectDevice()` must be called from a user gesture (click). A browser chooser picks **one** device per call. Requires a secure context (HTTPS or localhost). |
| Data model | `Device` → `sensors[]`; each `Sensor` emits `value-changed` with `sensor.value`. Periodic sampling uses a minimum period of 10 ms. |
| Aperiodic data | The library parses `APERIODIC_REAL32/INT32` packets (event-style sensors such as photogates) but passes **only values** to `Sensor.setValue`. |
| Timing | `START_TIME` and `PERIOD` packets are **explicitly ignored** ("Purposely Ignoring packet type"). No device timestamp reaches the caller. |
| Multiple devices | Each `selectDevice()` returns an independent `Device`. Several BLE connections are possible in principle, but each device has its own clock, and the library exposes no synchronisation. |

## Why this matters

A falling object crosses gates 30 cm apart roughly 50–100 ms apart. To measure g to ~1%, inter-gate times need sub-millisecond accuracy.

- If event timestamps are not exposed, the only option is host time (`performance.now()` on `value-changed`). BLE connection intervals (7.5–50 ms) and packet batching add jitter **far larger than the signal**. That is unusable.
- With one device per gate, there is no common clock between gates.

## Questions to answer before implementing

1. **Channels:** which sensor channels does the GDX Go Direct Photogate expose (gate state, laser gate, count, …)? Enumerate with `device.sensors` on real hardware.
2. **Event timestamps:** does the aperiodic packet payload contain a device timestamp that the library discards? If so, can we get it via a small, documented patch or upstream PR, without reverse-engineering?
3. **Multiple gates:** can one Go Direct Photogate accept a second gate (e.g. daisy-chain or expansion port) so both share one clock? Otherwise, how does Vernier Graphical Analysis synchronise several Go Direct photogates? Is that documented?
4. **Concurrent connections:** how many simultaneous BLE devices does a Chromebook support reliably?
5. **USB:** is WebHID enabled by default on current ChromeOS and Chrome (no flag)? USB may give lower latency than BLE.
6. **Maintenance:** the package has not been published since 2023. Check whether a newer official SDK exists (e.g. what Graphical Analysis Web uses).

## Architectural guard rails (already in place)

- `PhotogateSource` contract: one clock per source, times in seconds.
- `GoDirectPhotogateSource` placeholder implements the interface and refuses to connect. No Vernier import exists anywhere yet.
- `applyPhotogateEvents(…, channelToGate)` already supports mapping hardware channel ids to table rows.
