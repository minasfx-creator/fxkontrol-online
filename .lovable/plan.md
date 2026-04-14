

# Fix Build + Prepare FXKGPUEngine for Local Testing

## Problem
1. **Build is broken**: `vite-plugin-pwa` is in `package.json` but missing from `node_modules`. The `virtual:pwa-register` import in `main.tsx` fails at transform time, blocking the entire app.
2. **WebGPU unavailable in sandbox**: The preview browser has no GPU adapter. The FXKGPUEngine volumetric pipeline cannot be tested here — it requires Chrome 113+ or Edge on a real machine.

## Plan

### Step 1 — Fix the PWA build blocker
Install `vite-plugin-pwa` so the Vite dev server resolves `virtual:pwa-register` correctly.

### Step 2 — Add a diagnostic test page for FXKGPUEngine
Create a minimal route `/gpu-test` (or standalone HTML) that:
- Checks `navigator.gpu` and `requestAdapter()` 
- Reports device limits and preferred format
- Instantiates `FXKGPUEngine` with a test canvas
- Runs 60 frames of the full pipeline (compute → smoke → sort → fire → smoke → light scatter)
- Displays frame timing, active particle count, and engine state
- Shows clear "WebGPU not available — fallback mode" message when running in the sandbox

This gives you a one-click diagnostic when you open the app in Chrome/Edge locally.

### Step 3 — Verify fallback path in sandbox
After the PWA fix, navigate to `/gpu-test` in the sandbox to confirm the fallback detection works correctly (engine state should report `fallback`).

## Technical Details
- The `main.tsx` PWA code already has a `.catch()` guard and skips registration in preview hosts, but the Vite transform-time resolution of `virtual:pwa-register` fails before the runtime guard can execute
- The diagnostic page will use the existing `FXKGPUEngine` class directly — no new dependencies
- Zero impact on production code; the test page can be excluded from production builds

