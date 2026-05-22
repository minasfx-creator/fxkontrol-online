---
name: Engine playback auto-fire (drones + pyro)
description: Show3DEngine auto-advances showTime via RAF while playing, firing Particle Explosions (pyro) and Light Points (drones) as the timeline crosses each cue.startTime. Transport overlay (Play/Pause/Stop/Loop/Seek) mounted in ShowEngineHost.
type: feature
---

## API

`Show3DEngine`
- `play({ rate?, loop? })` / `pause()` / `stop()` / `setRate(r)`
- `isPlaying()`, `getShowTime()`, `getDuration()`
- `subscribePlayback(fn) → unsubscribe` — emits `PlaybackSnapshot { time, duration, playing, rate, loop }` on every state change and seek.
- `seek(t, { mode: 'playback' | 'scrub' })` — playback fires only newly-crossed cues; scrub wipes effects layer and re-spawns cues active at `t` (idempotent).

`renderFrame(delta)` advances `showTime += delta * playRate` while playing and calls `seek()` internally so cues fire on the very frame their `startTime` is crossed (no separate timer, no drift). On reaching `duration`: stop, or wrap when `loop=true`.

## Visual contract

`applyCue` spawns ONE root mesh per cue command (preserves the `userData.cueFlash` reaper contract used by `tickEffects` and existing tests), with a Points child:
- `spawn-pyro` / `finale-burst` → **Particle Explosion**: 48–154 points launched on a unit sphere (Marsaglia), additive blending, advected each frame with `v += g·dt` (g=-9.8) and frame-rate-aware drag `pow(0.92, dt*60)`. Opacity ∝ pow(lifeRatio, 1.4). TTL ≥ 900ms, finale 1.6×.
- `move-drone` → **Light Point**: single additive point sprite, drifts upward (driftY ≈ 1.4–3m/s), 4 Hz pulse on opacity. TTL ≥ 600ms.

Both Points children store `userData.particleBurst` / `userData.lightPoint` and a `_lastTick` timestamp for stable per-frame integration. `disposeSubtree` walks the flash mesh recursively when the reaper expires the cue.

## UI

`ShowEngineHost` props: `autoPlay?: boolean` (default true), `hideTransport?: boolean` (default false). Mounts `PlaybackTransportOverlay` (Play/Pause/Stop/Loop + scrub slider + time/duration) at bottom-center when viewport is `ready`. Uses ds-* tokens (no hardcoded brand colors).

## Tests

`src/lib/showEngine/__tests__/show3DEnginePlayback.test.ts` (5 tests):
- pause: showTime stays 0, no effects spawn.
- play + dt=1.5 → pyro cue at t=1 fires; flash has Points child with `particleBurst` and ≥40 vertices.
- play + dt=3.5 → both pyro and drone fire; one flash carries `lightPoint`.
- past duration without loop → playing flips false, snapshot emitted.
- scrub re-spawn is idempotent; scrub to 0 wipes effects.

`src/lib/showEngine/__tests__/show3DEngineApplyCue.test.ts` original contract preserved (cueFlash userData on top-level effect mesh).
