

# Plan: Refine Remote Control — Transparent Command Relay + Hardware Integration

## Core Insight

The current slave UI is over-engineered with 5 tabs (Dashboard, Transport, Hardware, Panels, SFX) duplicating master functionality. The AnyDesk model means: **mobile connects, sends commands, and they just happen on the PC**. Mobile doesn't need its own dashboard — it's a transparent remote. The PC (master) should clearly show what the remote is doing.

## Problems Found

1. **Slave UI too heavy**: 5-tab interface with redundant state display. Mobile should be a simple command pad — connect and go
2. **Master doesn't mirror slave actions visually**: When slave sends a command, master should show it happening (panel opens, transport moves, etc.) with visual feedback of "who did what"
3. **Hardware status in master state sync uses hardcoded zeros** (lines 150-155 in RemoteControlPanel): Master sends `fireoneModules: 0` instead of real values from hardware hooks
4. **Master panel doesn't use real hardware hooks**: Unlike ReceiverOverlay, RemoteControlPanel master mode doesn't import `useFireOneHardware`/`usePBusHardware` for live status
5. **No "mirror indicator"**: PC doesn't show that a remote action is happening in real-time (e.g., "Remote user opened Safety panel")

## Changes

### 1. `src/components/editor/RemoteControlPanel.tsx` — Simplify slave, enhance master

**Slave connected view** — replace 5-tab interface with single flat command pad:
- Top: connection status bar (code, latency, permissions badges)
- Transport row: Play/Pause/Stop/Seek (large touch targets, single row)
- Quick Actions grid: 2x4 grid of most-used commands (ARM ALL, DISARM ALL, FIRE, CONTINUITY, SCAN, PANIC, Undo, Redo)
- Panels quick-launch: horizontal scrollable row of panel icons (not a full tab)
- SFX triggers: single row of 4 icons (Flame, CO2, Spark, Haze)
- Camera orbit pad stays (useful on mobile)
- PANIC bar at bottom (always)
- Remove Dashboard tab entirely (slave doesn't need to mirror master state — it just controls)
- Remove Hardware tab (merge ARM/FIRE into quick actions grid)

**Master connected view** — add real hardware status:
- Import `useFireOneHardware` and `usePBusHardware` hooks
- Replace hardcoded zeros in state sync with real hardware values from hooks
- Add "Action Mirror" section: shows last 5 actions from slaves with visual feedback ("🎮 Slave opened Safety panel", "🎮 Slave pressed PLAY")
- Show hardware connection paths (USB/Radio/PBUS) in status area

### 2. `src/components/editor/RemoteReceiverOverlay.tsx` — Add action mirror toast

- When executing a remote command, dispatch a visual indicator on master screen showing what the slave just did (toast with slave name + action)
- Add `remote-action-mirror` custom event so other components can show what's happening

### 3. `src/lib/remoteCommandEngine.ts` — No changes needed

Engine already supports all required command types and permissions.

## Files Summary

| File | Change |
|------|--------|
| `src/components/editor/RemoteControlPanel.tsx` | Flatten slave to single command pad, add real hardware hooks to master, action mirror |
| `src/components/editor/RemoteReceiverOverlay.tsx` | Add action mirror visual feedback on command execution |

