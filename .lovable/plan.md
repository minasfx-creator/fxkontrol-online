

# Replace FXK Logo + Favicon with Tactical Logo

## Overview

Replace the current `fxk-logo.png` asset and favicon with the newly generated tactical FXK logo. Redesign the SplashScreen to match the military/tactical aesthetic already established across the platform.

## Steps

### 1. Replace logo asset file
- Copy the generated `FXK_Logo.png` from `/mnt/documents/` to `src/assets/fxk-logo.png` (overwrite)
- Copy it also to `public/favicon.png` (overwrite) for the favicon

### 2. Redesign SplashScreen to tactical style
**File:** `src/components/editor/SplashScreen.tsx`

- Replace the soft glassmorphism background with the tactical dark canvas (`#080a0f`) + tactical grid overlay (matching the platform's existing `.tactical-grid` aesthetic)
- Replace the rounded logo container with a sharp-edged tactical frame — no `rounded-2xl`, use `rounded-sm` with tactical green border
- Increase logo display size to `w-28 h-28` so the hexagonal detail is visible
- Update typography to use `font-tech` (Rajdhani) for headers and `font-mono-code` (JetBrains Mono) for labels
- Replace the cyan/orange color scheme with tactical green (`hsl(165 100% 42%)`) and amber accents
- Add corner bracket decorations (military HUD style) around the central content
- Add product line indicators below the logo: colored dots for PYRO (red), DMX (cyan), LIGHT (violet), DRONES (teal) — matching the logo itself
- Update "Click to Start" button to tactical green with scanline overlay
- Update version label to `v2.0 · FXK TACTICAL ENGINE`
- Add subtle scanline animation overlay on the entire splash

### 3. Update Toolbar logo container
**File:** `src/components/editor/Toolbar.tsx`

- No import change needed (same filename)
- Adjust the logo `img` tag sizing if needed for the new square aspect ratio

## Files Affected
1. **Copy:** `/mnt/documents/FXK_Logo.png` → `src/assets/fxk-logo.png`
2. **Copy:** `/mnt/documents/FXK_Logo.png` → `public/favicon.png`
3. **Edit:** `src/components/editor/SplashScreen.tsx` — full tactical redesign
4. **Edit:** `index.html` — ensure favicon reference is correct (already `/favicon.png`)

