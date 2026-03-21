

# Plan: Orphaned Position Cleanup + Mobile Enhancements

## Summary

Two combined improvements:
1. **Auto-delete orphaned positions** when their last linked effect is removed from timeline
2. **Mobile-specific refinements** for position labels, remote control module mirroring, and LiveFX relay

## Changes

### 1. `src/store/useProjectStore.ts` — Auto-Clean Orphaned Positions

**`removeTimelineItem(id)`** (line 453): After filtering the timeline item, collect its `positionId`. Check if any remaining timeline items still reference that position. If none do, also remove the position from `positions[]`.

**`removeMultipleTimelineItems(ids)`** (line 457): Same logic in batch — collect all `positionId`s from removed items, check each against remaining items, remove orphans.

### 2. `src/components/editor/PositionPins.tsx` — Compact Mobile Labels

- Add `occlude` prop to `Html` labels so they hide behind 3D geometry instead of always rendering on top
- Add `distanceFactor={8}` so labels shrink when camera is far
- On mobile (`window.innerWidth < 768`): hide labels entirely unless the position is selected — show only the 3D pin model with selection ring
- Remove SNAP badge and emoji from label — show only position name in bold
- Reduce padding from `px-2.5 py-1` to `px-1.5 py-0.5`

### 3. `src/lib/remoteCommandEngine.ts` — New Command Actions for Module Relay

Add new `CommandAction` values: `'livefx'` | `'sfx-channel'` | `'store-sync'`

Add corresponding cases in `executeRemoteCommand`:
- `'livefx'`: dispatch `CustomEvent('remote-livefx', { detail: payload })` — for CUE fires, scene changes, channel adjustments
- `'sfx-channel'`: call `deps.sfxStore.fireEffect()` with the relayed effect data
- `'store-sync'`: apply partial state delta to `deps.projectStore` via spread

### 4. `src/components/editor/LiveFiringPanel.tsx` — Listen for Remote LiveFX

Add a `useEffect` that listens for `'remote-livefx'` CustomEvent:
- `{ type: 'fire-cue', scene, cueIndex }` → fire the CUE
- `{ type: 'scene-change', scene }` → switch active scene
- `{ type: 'channel-adjust', channelId, field, value }` → adjust SFX channel

### 5. `src/components/editor/RemoteControlPanel.tsx` — Slave Module Mirroring

When slave is connected and opens a panel (via Panels Quick-Launch), wrap the `send()` calls to also relay:
- SFX trigger buttons → send `'livefx'` command with effect type + action
- Panel open → already sends `'open-panel'`, now also relay subsequent interactions within that panel via `'livefx'` commands
- Add a visual indicator badge "🔴 LIVE RELAY" next to the connection status when slave is actively mirroring

### 6. `src/hooks/useRemoteRelay.ts` — NEW: Auto-Relay Hook

A hook that, when a remote session is active as slave:
- Provides `relayAction(action, payload)` wrapper that calls `session.sendCommand()` 
- Exposes `isRelaying: boolean` for UI indicators
- Used by LiveFiringPanel and RemoteControlPanel to automatically forward interactions

## Files

| File | Change |
|------|--------|
| `src/store/useProjectStore.ts` | Orphan cleanup in `removeTimelineItem` and `removeMultipleTimelineItems` |
| `src/components/editor/PositionPins.tsx` | Compact labels, occlude, distance scaling, mobile-hide unless selected |
| `src/lib/remoteCommandEngine.ts` | New actions: `livefx`, `sfx-channel`, `store-sync` + executor cases |
| `src/components/editor/LiveFiringPanel.tsx` | Listen for `remote-livefx` events |
| `src/components/editor/RemoteControlPanel.tsx` | Slave relay indicator + interaction forwarding |
| `src/hooks/useRemoteRelay.ts` | NEW — relay hook for session-aware action mirroring |

