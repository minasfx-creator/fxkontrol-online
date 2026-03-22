

# Fix Build Error + Confirm Trajectories

## Problem

The app is not rendering at all because of a **build error in `LiveFiringPanel.tsx`** — a floating JSX block at line 1007 is missing its function declaration wrapper. This prevents the entire app from compiling, which is why the trajectory gizmos appear to have "disappeared."

The trajectory system (`PyroLaunchAngle.tsx`) and its rendering in `SkyCanvas.tsx` are **fully intact** — they just can't load because the app won't build.

## Fix

### LiveFiringPanel.tsx — Line 1007

Add the missing function declaration. The block at lines 1007-1067 contains the scene buttons (S0-S3) and mode tabs, which is called as `renderSceneModeBar(fs)` on lines 1426 and 1448.

**Change**: Insert `const renderSceneModeBar = (fs: boolean) => (` before line 1007.

This single fix will restore the entire app including all trajectory visualizations.

## Files

1. `src/components/editor/LiveFiringPanel.tsx` — add missing `const renderSceneModeBar` declaration at line 1007

