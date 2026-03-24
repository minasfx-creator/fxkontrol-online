

# FXK Ultra Engine Platform — Full System Build Plan

## Overview

This plan adds 6 major subsystems to the existing FXK architecture, leveraging what already exists (FieldBus, MultiSiteSync, FixedTimestep, RuntimeSafety, WeatherService, SunSystem) and extending them into a distributed, self-optimizing, real-world simulation engine.

---

## Phase 1: Cluster Sync (Master/Client Mode)

**New file**: `src/core/sync/clusterSyncEngine.ts`

- Master node broadcasts camera, time, physics state, qualityLevel at 30-60 FPS via BroadcastChannel (same-machine tabs) + WebSocket (cross-machine)
- Client nodes receive state, interpolate (lerp) toward target — never snap
- Packet loss fallback: hold last valid state, smooth correction on reconnect
- Desync detection via frame-counter divergence; auto-resync from master
- Integrates with existing `globalSyncEngine.ts` for role management

**New file**: `src/core/sync/clusterSyncHook.ts`
- `useClusterSync()` hook consumed by SkyCanvas `useFrame` loop
- If role=client: override camera/time from master state
- If role=master: broadcast current state each frame

**UI**: Add Master/Client toggle to existing `ConnectionManagerPanel.tsx`

---

## Phase 2: Live Environment System (Weather + Tide)

**New file**: `src/core/environment/environmentEngine.ts`

- Wraps existing `fetchWeather()` from `weatherService.ts`
- Adds tide data fetch (Open-Meteo marine API for Angra dos Reis default coords)
- Unified state: `{ wind, humidity, pressure, visibility, tideLevel, seaState }`
- Auto-refresh every 30s with smooth interpolation between samples
- Fallback to last known state if API fails

**Modify**: `src/components/editor/SkyCanvas.tsx`
- Feed environment state into: fog density, water plane Y-offset (tide), wind vector for smoke/particles
- Connect wind to existing `useProjectStore.wind` so drone trajectories and pyro spread react automatically

**Modify**: `src/components/editor/WeatherPanel.tsx`
- Add tide display (current level, trend arrow)
- Add atmosphere density readout

---

## Phase 3: Enhanced Ballistic Physics

**Modify**: `src/lib/pyroPhysics.ts`
- Add wind influence to shell trajectory: `velocity += windVector * dt`
- Add air drag: `velocity *= (1 - dragCoeff * dt)`
- Add fuse timing variance: `± random * fuseVariance`
- Add explosion altitude variance: `breakHeight * (1 ± 0.03)`

**New file**: `src/core/drones/dronePhysicsEngine.ts`
- Max speed / acceleration limits per drone model
- Wind drift compensation (PID already exists in BoidsPanel)
- Inertia model: smooth direction changes, no instant snaps
- Scale: 1 unit = 1 meter (already in place)
- Validates impossible movements and clamps

---

## Phase 4: Unreal Engine Live Bridge

**New file**: `src/core/sync/unrealBridge.ts`

- WebSocket client connecting to configurable Unreal listener endpoint
- Streams at 60 FPS: `{ camera: {pos, rot, fov}, timeline: {t, playing}, events: [] }`
- Frame buffering (3-frame buffer) to absorb jitter
- Auto-reconnect with exponential backoff
- Connection state exposed via singleton

**UI**: Add Unreal Sync toggle + endpoint config to `ShowSettingsPanel.tsx`

---

## Phase 5: Self-Evolving AI Core

**New file**: `src/core/performance/aiOptimizer.ts`

- Monitors: FPS (p95/p99), error rate, tile load time, camera stability, network latency
- Pattern detection: sliding window (60s) identifies repeated drops, heavy scenes, unstable zones
- Learns best config profiles: `{ highSpeed, cinematic, denseGeometry, lowDevice }`
- Stored in localStorage as learned presets
- Auto-applies matching profile when similar scenario detected
- Adjustable: LOD bias, camera damping, tile cache size, render quality tier

**Integration**: Called from existing `AdaptiveQualitySystem` / `autoScaler.ts`

---

## Phase 6: Runtime Safety + Auto-Heal

**Modify**: `src/lib/hardening/runtimeSafety.ts`
- Add NaN/undefined/invalid transform scanner (runs every 60 frames)
- Auto-fix: reset corrupted values to last valid snapshot
- Remove corrupted scene objects with logged warning

**New file**: `src/core/reliability/autoHealEngine.ts`
- Wraps any subsystem failure in detect → isolate → fix → re-test loop
- Max 3 retry attempts per failure type
- If all retries fail: graceful degradation (disable subsystem, log, continue)
- Never crash — always degrade

**Modify**: `src/components/editor/SkyCanvas.tsx`
- Wire auto-heal into the `useFrame` loop via lightweight health check
- Feed diagnostic results to existing `DiagnosticPanel`

---

## Phase 7: Performance Governor

**Modify**: `src/core/performance/memoryManager.ts` + `autoScaler.ts`
- FPS drop response: reduce pixelRatio → reduce tile detail → reduce post-FX (staged)
- When stable for 10s: gradually restore one tier at a time
- Priority order: stability > smoothness > quality
- Log all transitions to BlackBox

---

## Files Created (5 new)
1. `src/core/sync/clusterSyncEngine.ts`
2. `src/core/sync/clusterSyncHook.ts`
3. `src/core/environment/environmentEngine.ts`
4. `src/core/drones/dronePhysicsEngine.ts`
5. `src/core/sync/unrealBridge.ts`
6. `src/core/performance/aiOptimizer.ts`
7. `src/core/reliability/autoHealEngine.ts`

## Files Modified (6 existing)
1. `src/components/editor/SkyCanvas.tsx` — wire cluster sync, environment, auto-heal
2. `src/components/editor/WeatherPanel.tsx` — tide + atmosphere
3. `src/lib/pyroPhysics.ts` — wind/drag/variance
4. `src/lib/hardening/runtimeSafety.ts` — NaN scanner
5. `src/components/editor/ConnectionManagerPanel.tsx` — cluster UI
6. `src/components/editor/ShowSettingsPanel.tsx` — Unreal bridge UI

## Implementation Order
1. Auto-Heal + Runtime Safety (foundation — prevents crashes during development)
2. Environment Engine (independent, high value)
3. Enhanced Ballistic Physics (depends on environment wind)
4. Cluster Sync (complex, builds on existing sync layer)
5. Unreal Bridge (independent WebSocket bridge)
6. AI Optimizer (observes everything, built last)
7. Performance Governor enhancements (integrates with AI optimizer)

