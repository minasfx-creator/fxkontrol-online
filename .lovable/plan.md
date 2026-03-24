

## Plan: FXK Ultra Hardening — Execution & Time Layer

Most of the reliability infrastructure already exists (`/core/reliability/` has 8 engines). This plan adds the **missing execution layer** — the bridge between simulation and real-world output — plus the deterministic clock and state buffer systems.

### What already exists (no duplication)
- `lockstepEngine.ts`, `predictiveEngine.ts`, `realityEngine.ts`, `emergencySystem.ts` — all built
- `autoScaler.ts`, `selfDiagnostic.ts`, `blackBoxRecorder.ts`, `seededRandom.ts` — all built
- `fixedTimestep.ts` — accumulator pattern at 60Hz
- `safetyEngine.ts` — collision/geofence validation
- `MissionControlPanel.tsx` — health dashboard UI

### New modules to create

| # | File | Purpose |
|---|------|---------|
| 1 | `src/core/time/deterministicClock.ts` | High-res clock with drift correction, audio/timecode sync, `onTick()` callbacks |
| 2 | `src/core/state/stateBuffer.ts` | Double-buffer pattern: simulation writes to back buffer, render reads front, `swap()` each frame |
| 3 | `src/core/execution/executionBridge.ts` | Timeline → real commands dispatcher. Calls pyro/drone/dmx subsystems on each tick with pre-fire compensation |
| 4 | `src/core/network/fieldBus.ts` | Multi-transport abstraction (WiFi primary, RS-485 backup, relay fallback) with heartbeat and auto-failover |
| 5 | `src/core/validation/simulationValidator.ts` | Fast-forward simulation at 100x to detect collisions, timing errors, and overflow before show start |
| 6 | `src/core/execution/pyroExecutor.ts` | Deterministic pyro fire engine with pre-fire delay compensation and local buffer fail-safe |
| 7 | `src/core/execution/droneExecutor.ts` | Deterministic drone waypoint sender with WGS84→MAVLink conversion and RTH fail-safe |

### Modified files

| File | Change |
|------|--------|
| `src/core/reliability/index.ts` | Re-export new modules for unified import |
| `src/components/editor/MissionControlPanel.tsx` | Add Validation Engine results section and FieldBus status indicators |

### Technical details

**DeterministicClock**: Wraps `performance.now()` with continuous drift correction against an external reference (audio context `currentTime` or SMPTE timecode). Maintains a monotonic simulation clock that never jumps backward. Exposes `getTime()`, `getDelta()`, `onTick(cb)`.

**StateBuffer**: Generic `StateBuffer<T>` class. Simulation writes to `back`, render reads from `front`. `swap()` is called once per frame after simulation completes. Prevents partial-state reads during rendering.

**ExecutionBridge**: Single `tick(simTime)` method that iterates the timeline, applies pre-fire compensation (`cue.time - preFireDelay`), and dispatches to PyroExecutor/DroneExecutor/DMX. Uses `blackbox.record()` for every command sent.

**FieldBus**: Abstract transport layer. Each transport (wifi/rs485/relay) implements `send()/receive()/isAlive()`. The bus routes commands through the primary channel, switches to backup within 500ms if heartbeat fails, logs all transitions to BlackBox.

**SimulationValidator**: Takes the full timeline + trajectories, runs `simulate()` at 100x speed using the same deterministic engines, collects all collision warnings, timing violations, and geofence breaches. Returns a `ValidationReport` with pass/fail per cue.

**PyroExecutor / DroneExecutor**: Stateless command dispatchers. Given a cue + simTime, they compute whether to fire and emit the command. PyroExecutor applies pre-fire delay. DroneExecutor converts local coords to WGS84 via existing `localToGeo()`. Both have offline fallback: if `fieldBus.isAlive() === false`, they buffer commands locally and execute from the local timeline.

