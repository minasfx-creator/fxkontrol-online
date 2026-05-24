---
name: Show3D ↔ Timeline/Audio Clock Sync
description: External-clock bridge so the 3D viewport playback follows the timeline Play button (driven by useProjectStore.currentTime, which audio master clock pins to audio.currentTime)
type: feature
---
# Show3D Engine ↔ Timeline/Audio Sync

When the operator clicks **Play** on the timeline, the 3D viewport must
fire Particle Explosions / Light Points exactly in sync with the audio
waveform. Two clocks (engine RAF + timelineClock) ticking independently
drift within seconds.

## Architecture
```
audio.currentTime
  └─ useAudioMasterClock → timelineClock.syncExternalTime(t)
       └─ useProjectStore.currentTime
            └─ useShow3DEngineSync → engine.seek(t, mode)  ← 3D follows
```

## Components
- **`src/hooks/useShow3DEngineSync.ts`**: subscribes to `useProjectStore`
  and forwards `currentTime → engine.seek(...)`, `playbackSpeed → setRate`,
  `isPlaying → setPlayingMirror`. Small forward delta (≤0.35s) → `mode:
  'playback'` (newly-crossed cues fire). Backward / large jump → `mode:
  'scrub'` (effects layer rebuilt).
- **`Show3DEngine.setPlayingMirror(playing)`**: marks the engine as
  "playing" in the snapshot WITHOUT starting internal RAF advance. Sets
  `externalClockDriven=true` which gates the auto-advance branch in
  `renderFrame`. `play()` flips it back off (engine owns clock again).
- **`ShowEngineHost`** prop `externalClock?: boolean`: when true, skips
  `engine.play()` on plan load, mounts the sync hook, hides the embedded
  transport overlay (the timeline transport is canonical).

## When to use
- Editor / Studio (audio-driven show): `<ShowEngineHost externalClock />`.
- Standalone preview pages (`/dev/golden-shows`, Phase 1 transition):
  default `externalClock=false` → engine owns its RAF clock + transport
  overlay (Play/Pause/Stop/Loop/Seek).

## Tests
- `src/hooks/__tests__/useShow3DEngineSync.test.ts` (5)
- `src/lib/showEngine/__tests__/show3DEnginePlayback.test.ts` (5)
- Total: 10/10 green.
