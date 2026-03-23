

## Audit: Gaps & Refinements — Blade Runner 2049 Fidelity

### Issues Identified

**GAP 1: Cinematic Intro Never Triggers on /editor**
- `Index.tsx` line 180: `appPhase` defaults to `'globe'`, skipping the `'cinematic'` phase entirely
- The intro only works on Dashboard (`/`) via `sessionStorage` — and only once per session
- User wants: intro every time they enter `/editor`

**GAP 2: 3D Engine Crashes (WebGL Context Lost)**
- `useSceneStore.ts` defaults: `ssaoEnabled: true`, `ssrEnabled: true`, `motionBlurEnabled: true` — all enabled simultaneously
- `PostProcessing.tsx` line 390: `<EffectComposer multisampling={0}>` with no `enableNormalPass` — SSAO requires a NormalPass internally, causing the error chain
- Combined load (SSR + SSAO + DOF + Motion Blur + Heat Distortion + God Rays + Sharpen + Color Grading) is too heavy for most GPUs on initial load

**GAP 3: Command Center Consoles Look "Old"**
- Desktop layout (line 408-621) has solid glassmorphism sidebar + breadcrumb, but the main content area lacks per-console visual identity (no header color bars, no ambient glow, no HUD corner brackets like landscape mode has)
- The desktop layout is missing the HUD corner brackets that landscape mobile already has
- No "rain" or ambient particles for BR2049 atmosphere

**GAP 4: Floating Footer Missing on Desktop**
- Desktop Command Center has no floating dock — `DockBar` only renders inside `MainLayout`, but Command Center renders fullscreen (`h-full flex overflow-hidden pb-14` — just padding for the DockBar from MainLayout)
- The user explicitly wants the floating footer in Command Center

---

### Plan

#### Step 1: Enable Cinematic Intro on /editor (every entry)
**File: `src/pages/Index.tsx`**
- Change line 180: `useState('globe')` → `useState('cinematic')`
- This triggers: CinematicIntro → SplashScreen → GlobeSelector → Editor
- The CSS fallback boot sequence will play since no .mp4 files exist

#### Step 2: Fix 3D Engine Stability
**File: `src/store/useSceneStore.ts`**
- Change defaults to safe values:
  - `ssaoEnabled: false` (line 295)
  - `ssrEnabled: false` (line 305)
  - `motionBlurEnabled: false` (line 319)
  - `heatDistortionEnabled: false` (line 314)
  - `godRaysEnabled: false` (line 300)
  - `dofEnabled: false` (line 297)
- Keep bloom, vignette, chromatic aberration, sharpen — these are lightweight

**File: `src/components/editor/PostProcessing.tsx`**
- Add `enableNormalPass` prop to `<EffectComposer>` when SSAO is enabled
- Wrap SSAO in error-safe conditional

#### Step 3: Refresh Command Center — Desktop BR2049 Identity
**File: `src/pages/CommandCenter.tsx`**
- Add HUD corner brackets to desktop content area (matching landscape mobile)
- Add ambient accent glow line under breadcrumb
- Add subtle scanline overlay to content area for BR2049 atmosphere
- Add per-console ambient glow background in the content area
- Ensure the existing floating dock in mobile portrait is properly styled

#### Step 4: Enhance BR2049 Atmosphere
**File: `src/pages/CommandCenter.tsx`**
- Add CSS rain particle overlay (subtle, low opacity) to the desktop sidebar
- Add CRT noise texture overlay to the main content area
- Add horizontal scanline sweep animation (reuse from SplashScreen)

#### Step 5: Build Verification
- TypeScript build check for 0 errors

---

### Technical Notes

- The SSAO crash is the root cause of the "3D engine doesn't work" issue. The `@react-three/postprocessing` SSAO effect internally creates a NormalPass, but with `multisampling={0}` and the current effect chain, it fails to initialize properly on many GPUs
- Disabling heavy post-processing by default (users can opt-in via Scene Settings) eliminates the crash while maintaining visual quality through bloom + vignette + tone mapping
- The intro flow change is a single-line fix that unlocks the full cinematic boot sequence every time

