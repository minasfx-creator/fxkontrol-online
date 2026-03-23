

## Plan: Fix 3D Engine + Weapon-Drop Animation

### Findings from Investigation

The 3D engine (WebGL/Three.js) **is actually working** — the globe renders fine, the SkyCanvas code is structurally sound, and heavy post-processing effects are already disabled by default. The user may be experiencing the issue on their device specifically, or the problem is that the intro sequence makes it hard to reach the editor viewport.

The real missing piece is the **weapon-drop animation** for console swaps — the CSS classes `swap-in`, `swap-out`, `swap-flash` are referenced in `CommandCenter.tsx` (lines 252-254) but **never defined in `index.css`**. This means console transitions have zero visual feedback.

### Changes

#### 1. Add Missing Weapon-Drop CSS Animations (`src/index.css`)

Define the swap animation classes that `CommandCenter.tsx` already references:
- `.swap-out` — weapon-drop-out: scale down + translate up + fade (200ms)
- `.swap-in` — weapon-drop-in: drop from above with spring bounce overshoot (400ms, cubic-bezier)  
- `.swap-flash` — brief white flash overlay on swap-in

```
@keyframes weapon-drop-out {
  0% { opacity: 1; transform: scale(1) translateY(0); }
  100% { opacity: 0; transform: scale(0.95) translateY(-15px); }
}
@keyframes weapon-drop-in {
  0% { opacity: 0; transform: scale(0.96) translateY(-30px); }
  60% { transform: scale(1.01) translateY(4px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
```

#### 2. Harden 3D Engine Recovery (`src/components/editor/SkyCanvas.tsx`)

- Wrap the entire `<Canvas>` children in a try/catch error boundary that shows a "Retry" button instead of a blank screen
- Add a 2-second delay before mounting heavy components (NiagaraVFX, WeatherEffects, AudioSpectrum) to let the base renderer stabilize first
- Ensure the `WebGLErrorBoundary` includes a retry mechanism (re-increment `canvasInstanceKey`)

#### 3. Add Skip-to-Editor Shortcut

- In the globe phase, add a visible "SKIP" button so users can jump directly to the editor without selecting a venue (for testing/dev)

### Build verification
- TypeScript build check for 0 errors

