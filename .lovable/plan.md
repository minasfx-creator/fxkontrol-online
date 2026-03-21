
# Plan: Orphaned Position Cleanup + Mobile Enhancements — COMPLETED ✅

## Implemented

1. **Auto-Clean Orphaned Positions** — `removeTimelineItem` and `removeMultipleTimelineItems` now detect and remove positions with no remaining linked effects
2. **Compact Mobile Labels** — Position labels use `occlude`, `distanceFactor={8}`, smaller padding, removed emoji/SNAP/effects count. Mobile hides labels unless selected
3. **`showPositionLabels` Toggle** — Added to `EnvironmentState` in `useSceneStore` (default: `true`)
4. **Remote Command Engine Expanded** — New actions: `livefx`, `sfx-channel`, `store-sync` with corresponding executor cases
5. **LiveFX Remote Listener** — `LiveFiringPanel` listens for `remote-livefx` events (fire-cue, scene-change, arm, channel-adjust)
6. **LIVE RELAY Badge** — `RemoteControlPanel` shows `🔴 LIVE RELAY` badge when slave is connected
7. **useRemoteRelay Hook** — New hook for session-aware action mirroring (`relayAction`, `relayLiveFx`, `relaySfxChannel`)

## Architecture

```text
Remote Control Flow:
  Slave (Mobile)
    ├─ useRemoteRelay hook → wraps actions
    ├─ Sends 'livefx' commands → CUE fires, scene changes
    ├─ Sends 'sfx-channel' → effect triggers
    └─ Sends 'store-sync' → state deltas
  
  Master (Desktop)
    ├─ executeRemoteCommand() → dispatches CustomEvents
    ├─ LiveFiringPanel → listens 'remote-livefx'
    └─ Actions mirrored in real-time
```
