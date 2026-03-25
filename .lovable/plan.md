

## Fix: Timeline playback does not start

### Root cause

In `PlaybackClock` (SkyCanvas.tsx line 194-197), the deterministic clock wires its tick to lockstep through `frameSyncEngine`:

```typescript
const alignedDelta = frameSyncEngine.getSyncedTimeSec(time + delta) 
                   - frameSyncEngine.getSyncedTimeSec(time);
lockstep.tick(Math.max(0, alignedDelta));
```

**The bug**: `getSyncedTimeSec()` has **side effects** — each call modifies `_accumulatedCorrection` internally. Calling it twice per tick with different values corrupts the correction state, causing `alignedDelta` to frequently come out as **0 or negative**, which gets clamped to 0. The lockstep engine receives zero deltas, so `accumulator` never reaches the `FIXED_DT` threshold (1/60s), and the playback subsystem never fires.

### Fix

**File: `src/components/editor/SkyCanvas.tsx`** (line ~194-198)

Replace the double-call pattern with a single pass-through of delta to lockstep. The frameSyncEngine correction is meant for cue fire-time calculations, not for throttling the main playback delta:

```typescript
deterministicClock.onTick((_time: number, delta: number) => {
  lockstep.tick(delta);
});
```

This ensures the lockstep accumulator receives the actual frame delta from the deterministic clock (which already applies drift correction against AudioContext/SMPTE), allowing the fixed-timestep scheduler to advance properly and fire the playback subsystem.

### Impact
- Timeline play/pause/seek will work correctly
- All lockstep-registered subsystems (playback, executionBridge) will tick at the expected 60Hz
- No changes to the frameSyncEngine itself — it remains available for cue timing

