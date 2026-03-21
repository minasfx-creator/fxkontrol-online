

# Plan: Bug Fixes — Timeline SFX Drop, Trajectories Default, Panel onClose, Mobile Tab Flow

## Issues Found

### 1. SFX effects blocked from timeline drop (CRITICAL)
In `Timeline.tsx` line 168-169, the drop handler has:
```tsx
if (effect.type === 'firework' && trackIndex !== 0) return;
if (effect.type === 'drone' && trackIndex !== 1) return;
```
SFX effects (`type: 'sfx'`) are silently rejected on track 0 because of the first condition — `effect.type` is `'sfx'` not `'firework'`, so it passes the firework check, but there's no track that explicitly accepts SFX. The logic is inverted: it rejects fireworks on non-0 tracks and drones on non-1 tracks, meaning SFX can technically drop on any track EXCEPT 0 and 1 — but there IS no track 2+ for SFX. Users dragging SFX to PYRO SYS (track 0) get nothing.

**Fix**: Allow `type === 'sfx'` on track 0 alongside fireworks.

### 2. `showTrajectories` still defaults to `false` (from approved but unimplemented plan)
Line 428 in `useProjectStore.ts`: `showTrajectories: false`. Waypoints never appear until manually toggled.

**Fix**: Change to `true`.

### 3. Four panels missing `onClose` prop (connections, radio, ma3, sacnmonitor)
In `Index.tsx` lines 377-380:
```tsx
{activePanel === 'connections' && <ConnectionManagerPanel />}
{activePanel === 'radio' && <RadioControlPanel />}
{activePanel === 'ma3' && <MA3ControlPanel />}
{activePanel === 'sacnmonitor' && <SACNMonitorPanel />}
```
These don't pass `onClose`, so users cannot close these panels. `ConnectionManagerPanel` doesn't even have an onClose prop in its interface. `RadioControlPanel` also lacks it. `MA3ControlPanel` has no close button. `SACNMonitorPanel` same.

**Fix**: Add close button headers to all 4 panels, pass `onClose` from Index.tsx.

### 4. Mobile tab-panel flow conflict
When `MobileTabBar` calls `onOpenPanel` (which maps to `handleTogglePanel`), it sets `activePanel` via toggle. Then calls `onTabChange(tab)` setting `mobileTab` to e.g. `'controllers'`. The floating panel renders via the fallback path `{mobileTab && !['timeline','assets','properties','more'].includes(mobileTab) && activePanel && ...}`. BUT if user taps the same tab again, `handleTogglePanel` sets `activePanel(null)` (toggle off), while `handleTabClick` detects `activeTab === tab` and cycles panel height. The `activePanel` becomes null but `mobileTab` stays set → the fallback condition `activePanel &&` fails → panel disappears unexpectedly.

**Fix**: In `MobileTabBar.handleTabClick`, for panel-based tabs, don't toggle — always set the panel, use height cycling for dismiss.

## Changes

### 1. `src/components/editor/Timeline.tsx` — Allow SFX on track 0
Line 168: Change to `if (effect.type === 'firework' && trackIndex !== 0) return;` → `if ((effect.type === 'firework' || effect.type === 'sfx') && trackIndex !== 0) return;`

Wait — the logic is: "if it's a firework and NOT on track 0, reject." We want SFX on track 0 too. The current code already allows SFX on track 0 because it only blocks fireworks on non-0 and drones on non-1. Let me re-read...

Line 168: `if (effect.type === 'firework' && trackIndex !== 0) return;` — blocks fireworks on tracks != 0. SFX passes this.
Line 169: `if (effect.type === 'drone' && trackIndex !== 1) return;` — blocks drones on tracks != 1. SFX passes this.

So SFX SHOULD be droppable on track 0. But the PYRO SYS track is hardcoded as `trackIndex={0}`. Let me check if there's another issue...

The `TimelineTrackRow` on line 759 uses `trackIndex={0}`. SFX should drop there. But line 177 filters `positions.find(p => p.id === id)?.type === 'pyro'` — it only creates cues for `type === 'pyro'` positions. If no pyro position is selected, it falls to the else branch on line 193 which creates a random position. So SFX drops should work on track 0 technically. The issue might be elsewhere — let me look at the handleDragOver.

Actually line 146-155 has handleDragOver:
```tsx
const handleDragOver = useCallback((e: React.DragEvent) => {
  const effectId = e.dataTransfer.getData('application/effect-id');
  ...
  if (trackIndex === 0 && effect?.type !== 'firework') return;
```

THIS is the bug. `handleDragOver` rejects non-firework effects on track 0, preventing the drop entirely.

### Updated fix for Timeline.tsx
Line ~150: Change `if (trackIndex === 0 && effect?.type !== 'firework') return;` to `if (trackIndex === 0 && effect?.type !== 'firework' && effect?.type !== 'sfx') return;`

### 2. `src/store/useProjectStore.ts` — Default showTrajectories to true
Line 428: `showTrajectories: true`

### 3. `src/pages/Index.tsx` — Pass onClose to 4 panels
Lines 377-380: Add `onClose={() => setActivePanel(null)}` to all four.

### 4. `src/components/editor/MobileTabBar.tsx` — Fix tab-panel toggle conflict
In `handleTabClick`, for panel-based tabs, if already active, cycle height instead of toggling panel off. Replace lines 41-46 with:
```tsx
if (tabDef?.panelId) {
  if (activeTab === tab) {
    // Cycle height instead of toggling panel off
    if (panelHeight === 'full') {
      onTabChange(null);
      onPanelHeightChange('collapsed');
    } else {
      onPanelHeightChange('full');
    }
  } else {
    onOpenPanel(tabDef.panelId);
    onTabChange(tab);
    onPanelHeightChange('full');
  }
  return;
}
```

## Files Summary

| File | Change |
|------|--------|
| `src/components/editor/Timeline.tsx` | Allow SFX drops on track 0 (handleDragOver fix) |
| `src/store/useProjectStore.ts` | `showTrajectories: true` |
| `src/pages/Index.tsx` | Pass onClose to connections/radio/ma3/sacnmonitor panels |
| `src/components/editor/MobileTabBar.tsx` | Fix panel-tab toggle cycle conflict |

