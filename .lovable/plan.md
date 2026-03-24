

## Audit: Bugs Found Across the Platform

### BUG 1 (Critical): Timeline Play Does Not Advance Time

**Root cause**: `DeterministicClock.tick()` is never called in a loop. In `SkyCanvas.tsx` (line 179-187), the code calls `deterministicClock.start()` and registers an `onTick` callback that feeds the lockstep engine. However, **nothing ever calls `deterministicClock.tick()`** — there is no `requestAnimationFrame` loop or R3F `useFrame` hook driving it.

The `onTick` callback at line 183 is registered to fire when `tick()` is called, but `tick()` itself is never invoked. So `lockstep.tick()` never runs, the `playback` subsystem never advances `currentTime`, and the timeline stays frozen.

**Fix**: Add a R3F `useFrame` hook inside `PlaybackClock` that calls `deterministicClock.tick()` every frame:

```typescript
// Inside PlaybackClock, after the registration useEffect:
useFrame(() => {
  deterministicClock.tick();
});
```

This connects the R3F render loop to the deterministic clock, which then fires callbacks, which feed the lockstep, which advances playback.

---

### BUG 2 (Warning): `<button>` nested inside `<button>` in SafetyPanel

**Root cause**: `SafetyPanel.tsx` line 135-153 — a `<Switch>` component (which renders a `<button>`) is placed inside a `<button>` element. This is invalid HTML and triggers a React DOM nesting warning.

**Fix**: Change the outer `<button>` to a `<div role="button" tabIndex={0}>` or restructure so the Switch is outside the clickable button area.

---

### BUG 3 (Warning): ResizablePanel sizes don't sum to 100%

**Root cause**: `Index.tsx` line 549/555/638 — panel `defaultSize` values are `14 + 60 + 20 = 94%` (when a side panel is active). The library expects them to total 100%.

**Fix**: Adjust to `14 + 66 + 20 = 100%` or use dynamic calculation.

---

### BUG 4 (Minor): WebGL Context Loss on mount

Console shows `THREE.WebGLRenderer: Context Lost` at startup. The hardening/recovery code handles this, but context loss on initial mount suggests the canvas is being mounted, then immediately remounted (likely from React StrictMode or the `canvasInstanceKey` state). This is cosmetic but wastes a render cycle.

---

### Changes Summary

| File | Change |
|---|---|
| `src/components/editor/SkyCanvas.tsx` | Add `useFrame(() => deterministicClock.tick())` inside `PlaybackClock` |
| `src/components/editor/SafetyPanel.tsx` | Change outer `<button>` wrapping Switch to `<div role="button">` |
| `src/pages/Index.tsx` | Fix panel defaultSize values to sum to 100% |

### Technical Detail

The playback fix is the critical one. The architecture is correct (DeterministicClock -> onTick callbacks -> LockstepEngine -> subsystems), but the pump is missing. Adding a single `useFrame` call connects R3F's render loop to the entire deterministic pipeline.

