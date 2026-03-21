

# Plan: Refine Remote Control — AnyDesk-Style + Hardware Bridge + Multi-Site

## Problems Found

1. **Duplicated command execution**: Both `RemoteControlPanel.tsx` (line 66-100) and `RemoteReceiverOverlay.tsx` (line 79-127) have identical `executeCommand` logic — DRY violation
2. **No hardware commands**: `CommandAction` only has 7 types — missing `'hardware'` for ARM/FIRE/DISARM/CONTINUITY via remote
3. **No `'panel'` action in slave UI**: The engine supports `'panel'` commands but the slave has no UI to open panels remotely
4. **No permissions system**: Any connected slave can do anything — no master-controlled permission flags
5. **No multi-site**: Can only connect to one session at a time
6. **RemoteReceiverOverlay is minimal**: Just a floating code widget — no slave device list, no permission controls, no "remote session active" banner
7. **No hardware status in RemoteState**: Slaves can't see FireOne module count, armed state, battery levels
8. **Missing QR code pairing**: Manual 6-digit code entry only — no fast QR scan option

## Changes

### 1. `src/lib/remoteCommandEngine.ts` — Expand types + permissions + multi-session

- Add `CommandAction`: `'hardware' | 'open-panel' | 'system-status'`
- Add `RemotePermissions` interface: `{ canFire, canArm, canEditTimeline, canAccessPanels, canPanic }`
- Add `HardwareCommandPayload`: `{ target: 'fireone'|'pbus'|'radio', action: 'arm'|'fire'|'disarm'|'continuity'|'scan', moduleAddr, cuePosition, duration }`
- Expand `RemoteState` with `hardwareStatus`: `{ fireoneModules, armedCount, pbusDevices, radioDevices, batteryAvg }`
- Add `MultiSessionManager` class: maintains `Map<string, RemoteSession>` for multi-site control from one slave
- Extract `executeRemoteCommand()` as a shared function (deduplicate from both components)
- Add permission broadcast: master sends permissions per slave, slave checks before executing hardware

### 2. `src/components/editor/RemoteControlPanel.tsx` — Full AnyDesk-style rewrite

**Pre-connection screen** (keep existing Cloud/WiFi/Role toggle — working well):
- Add QR code display for master (encode `{code, url}` as QR using a simple SVG generator)
- Add "Multi-Site" section: list of saved/active sites with "Add Site" button

**Slave connected view** — tabbed interface replacing current flat layout:
- **Tab: Dashboard** — System health mirror: hardware connections count, armed modules, battery avg, show state, latency graph (last 20 pings)
- **Tab: Transport** — Current transport + timeline scrubber (keep existing, refine sizing)
- **Tab: Hardware** — Remote hardware control:
  - Module list from `remoteState.hardwareStatus`
  - ARM ALL / DISARM ALL buttons (require `canArm` permission)
  - FIRE per module+cue (require `canFire` permission, safety confirm dialog)
  - Continuity check trigger
- **Tab: Panels** — Grid of panel icons to remotely open any panel on master (uses `'open-panel'` command)
- **Tab: SFX** — Current SFX grid (keep)
- PANIC bar always at bottom

**Master connected view** — enhanced from simple log:
- Connected slaves list with device name, role, latency, joined time
- Permission toggles per slave (canFire, canArm, canPanic, canAccessPanels)
- "Revoke" button per slave
- Command activity log (keep existing, refine)

### 3. `src/components/editor/RemoteReceiverOverlay.tsx` — Enhanced overlay

- Remove duplicate `executeCommand` — import shared `executeRemoteCommand` from engine
- Add hardware command bridge: when receiving `'hardware'` action, route to `useFireOneHardware` / `usePBusHardware` / `useRadioLink` stores
- Add "Remote Session Active" banner at top of screen (red strip with slave name)
- Show connected slave count and names in overlay
- Permission enforcement: check permission flags before executing hardware commands
- Expand state sync to include hardware status from FireOne/PBUS/Radio stores

### 4. No database changes needed

All remote control uses Supabase Realtime broadcast channels — no tables required.

## Files Summary

| File | Change |
|------|--------|
| `src/lib/remoteCommandEngine.ts` | Add hardware/panel command types, permissions, multi-session manager, shared executeCommand, expanded RemoteState |
| `src/components/editor/RemoteControlPanel.tsx` | Tabbed AnyDesk UI (Dashboard/Transport/Hardware/Panels/SFX), QR pairing, multi-site, permission display |
| `src/components/editor/RemoteReceiverOverlay.tsx` | Hardware bridge, shared executeCommand, permission enforcement, "Remote Active" banner, slave management |

