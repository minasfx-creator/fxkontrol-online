

# BR2049 Platform Upgrade — Opening Animations, Smart Swaps, MacBook Menus & Ambient Sound

## Overview

Four major enhancements to deepen the Blade Runner 2049 immersion: (1) cinematic opening animations on every console/page, (2) intelligent swap transitions between panels, (3) macOS-style menus in the sidebar, and (4) ambient sound engine with synthesized hum and navigation bleeps.

## 1. Opening Animations on Consoles & Pages

### `src/index.css` — New keyframes

Add boot-sequence animations:
- `@keyframes console-boot`: staged reveal — horizontal line scan (0-30%), grid materialize (30-60%), content fade-in (60-100%)
- `@keyframes terminal-type`: typewriter cursor effect for headers
- `@keyframes holo-materialize`: scale(0.96) + blur(8px) → scale(1) + blur(0) with amber glow flash at 40%
- `.animate-console-boot`, `.animate-holo-materialize`, `.animate-terminal-type` utility classes

### `src/pages/Dashboard.tsx`

- Wrap hero banner in `animate-holo-materialize` with 0.1s delay
- Each HubCard gets staggered `animate-console-boot` (already has stagger, enhance with new boot effect)
- Feed cards get `animate-holo-materialize` with incremental delays

### `src/pages/CommandCenter.tsx`

- On mode change (`handleModeChange`): add a `transitioning` state (true for 300ms) that applies a CSS class to the content area
- Content area gets `animate-console-boot` on each mode swap (key prop forces remount)
- Sidebar mode buttons: add `animate-holo-materialize` on first render
- Breadcrumb bar: typewriter-style label animation on mode change

### `src/pages/Auth.tsx`

- Card entrance: `animate-holo-materialize` with 0.3s delay
- Input fields: staggered `animate-fxk-stagger` (0.4s, 0.5s)
- Button: `animate-fxk-stagger` at 0.6s
- Add boot text sequence above card: "NEXUS TERMINAL v2.0 // INITIALIZING..." that types out then fades

### `src/components/editor/SplashScreen.tsx`

- Migrate colors from cyan (`hsl(165...)`) to amber (`hsl(32...)`) to match BR2049 palette
- Corner brackets, grid, glow, product line indicators all amber-tinted
- INITIALIZE button: amber styling

## 2. Smart Swap Transitions

### `src/pages/CommandCenter.tsx`

- Add `prevMode` state alongside `activeMode`
- On mode change: set `swapPhase` to `'out'`, after 200ms set new mode + `'in'`, after 400ms set `'idle'`
- Content wrapper applies:
  - `out`: `opacity-0 scale-[0.97] translate-x-[-8px]` (slides left + fades)
  - `in`: `opacity-0 scale-[0.97] translate-x-[8px]` → animates to neutral via CSS transition
  - `idle`: normal state
- This creates a directional swap feel without unmounting (uses CSS transitions, not React AnimatePresence)

### `src/layouts/MainLayout.tsx`

- Add route-change detection via `useLocation().pathname`
- On pathname change: flash a horizontal amber scanline across the content area (200ms CSS animation)
- Content area (`<Outlet />`) wrapper: apply `animate-holo-materialize` keyed by pathname

## 3. MacBook Pro-Style Menus

### `src/components/AppSidebar.tsx`

- Redesign nav items as a macOS-style dock:
  - Rounded pill shape with frosted glass background on hover
  - Active item: filled pill with amber glow, icon slightly scales up (1.1x)
  - Hover tooltip (non-collapsed): subtle description popover with glass background, arrow pointer
  - Group separator: thin amber gradient line with diamond marker (existing pattern)
- Add "quick actions" row at bottom (above user): small icon-only buttons for Search, Notifications, Theme — macOS menu bar style
- Collapsed state: icons get macOS dock magnification effect on hover (scale 1.15 with smooth transition)
- Footer user card: macOS-style avatar with ring glow + online status dot

### `src/pages/CommandCenter.tsx` sidebar

- Mode list items: add macOS-style hover state — subtle inset shadow + scale(1.02) + glass background reveal
- Active mode: left accent bar slides in with spring animation (CSS transition)
- Section headers: small amber diamond bullet instead of plain line

## 4. Ambient Sound Engine — BR2049 Hum & Bleeps

### NEW: `src/lib/ambientSound.ts`

Create a singleton `AmbientSoundEngine` using Web Audio API:
- **Base hum**: OscillatorNode (sawtooth, 55Hz) + GainNode (volume 0.015) + BiquadFilterNode (lowpass 200Hz). Starts on first user interaction.
- **Navigation bleep**: Short sine tone (880Hz, 40ms decay) triggered on route change. Gain envelope: attack 5ms, decay 40ms.
- **Click feedback**: Higher sine (1200Hz, 20ms) for button interactions.
- **Console boot**: Descending sweep (2000Hz → 200Hz, 300ms) when opening a new console/mode.
- **Error tone**: Two-tone discord (440Hz + 466Hz, 100ms) for toast errors.
- Master volume control (default 0.3), mute toggle, stored in localStorage.
- `play(sound: 'nav' | 'click' | 'boot' | 'error')` method
- `startHum()` / `stopHum()` for background drone
- Auto-resume on AudioContext unlock (mobile)

### `src/layouts/MainLayout.tsx`

- Import `ambientSound` singleton
- On route change (`useEffect` with `location.pathname`): `ambientSound.play('nav')`
- On first render: `ambientSound.startHum()` (guarded by user gesture via click listener)
- Add small volume control in footer status bar: speaker icon + mute toggle (8px tactical style)

### `src/pages/CommandCenter.tsx`

- On mode change: `ambientSound.play('boot')`

### `src/components/AppSidebar.tsx`

- Nav item click: `ambientSound.play('click')`

### `src/pages/Auth.tsx`

- On successful login: `ambientSound.play('boot')`
- On error: `ambientSound.play('error')`

## Files (priority order)

1. `src/lib/ambientSound.ts` — **NEW** Web Audio ambient engine
2. `src/index.css` — New boot/materialize/type keyframes
3. `src/components/editor/SplashScreen.tsx` — Amber palette migration
4. `src/components/AppSidebar.tsx` — MacBook dock-style menus
5. `src/layouts/MainLayout.tsx` — Route transitions + sound integration + volume control
6. `src/pages/Auth.tsx` — Boot sequence + sound hooks
7. `src/pages/Dashboard.tsx` — Console boot animations
8. `src/pages/CommandCenter.tsx` — Smart swaps + boot animations + sound

## Technical Notes

- All sound via Web Audio API (no audio files, no external deps)
- Sound respects user gesture requirement (AudioContext.resume on click)
- Volume persisted in localStorage (`fxk-ambient-volume`, `fxk-ambient-muted`)
- CSS transitions for swaps (no framer-motion dependency)
- SplashScreen cyan→amber migration aligns with global BR2049 palette
- No database changes

