

# Plan: Fix Viewport — Add Maximize Toggle

## Problem

The 3D viewport has no way to maximize. The toolbar (top), left dock, right dock, and timeline (bottom at 25vh) all overlay the canvas, leaving the effective visible area small. There's no toggle to hide all chrome and reclaim the full viewport.

## Solution

### 1. Add `viewportMaximized` state to Index.tsx

A boolean toggle that hides all overlay chrome (left dock, right dock, floating panels, timeline) when active. The canvas remains `absolute inset-0` — we just hide the UI layers on top.

### 2. Add maximize button to toolbar

Add a `Maximize2` / `Minimize2` icon button in the Toolbar, next to the existing night mode toggle. When clicked, toggles `viewportMaximized`. Keyboard shortcut: `F` key (standard 3D viewport convention).

### 3. When `viewportMaximized` is true:

- Hide Layer 2 (Right Dock / PanelTabBar)
- Hide Layer 3 (Floating Panel)
- Hide Layer 4 (Left Dock)
- Hide Layer 5 (PerformanceHUD)
- Hide Layer 6 (ViewportNavControls) 
- Collapse Layer 7 (Timeline) to `0px` height
- Keep Toolbar visible but semi-transparent (so user can un-maximize)

### 4. Start timeline collapsed by default

Change `timelineCollapsed` initial state from `false` to `true` so viewport starts with maximum visible area.

### 5. Keyboard shortcut

Add `F` key listener to toggle maximize. `Escape` exits maximize mode.

## Files to Change

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add `viewportMaximized` state; conditionally hide layers 2-7; default `timelineCollapsed` to `true`; add `F` key listener |
| `src/components/editor/Toolbar.tsx` | Add maximize toggle button; accept `onToggleMaximize` + `isMaximized` props |

