

# Plan: Fix All Gaps + Deep Integration Refinement

## Confirmed Gaps

1. **`fireChannel()` ART-NET ONLY** — line 381-402: only calls `sendArtNetPacket()`, never routes to `fireone.fireIgniter()` or `pbus.fireCue()`. No hardware hooks imported.
2. **`handlePanic()` ART-NET ONLY** — line 365-378: only stops Art-Net + resets local state. Never calls `fireone.emergencyStop()` or `pbus.emergencyStop()`.
3. **`SFXChannel` missing `hardwareBinding`** — no way to map a software channel to a specific hardware cue/pin.
4. **`VirtualZK6200.fireZone()` SIM-ONLY** — line 63-75: imports `usePBusHardware` but never calls any PBUS method. No slave pairing.
5. **`VirtualFXButton.handleFire()` SIM-ONLY** — line 59-67: imports `usePBusHardware` but only does local state + toast. No hardware routing.
6. **`PBusMonitorPanel` DEADMAN BUG** — line 57: `(progress / 800) * 100 * 50` = reaches 312% at step 16. Should be `(progress / 80) * 100`.
7. **`DiagnosticPanel` NO PBUS CHECKS** — imports `useFireOneHardware` only. Zero PBUS diagnostics (battery, signal, continuity).
8. **`FleetManagementPanel` UNUSED HARDWARE** — imports both hooks (line 21-22, 128-129), computes `fireoneModules`/`pbusDevices` (line 137-139), but NEVER renders them. Only 3 tabs (Fleet/Preflight/Commands), all UAV-only.
9. **`ShowvenEquipmentPanel` NO LIVE STATUS** — imports `usePBusHardware` but only for a connect button concept; controller cards show no live cue/battery/RSSI from real hardware.
10. **`FieldMap2D` NO RADIO LAYER** — imports `useFireOneHardware` + `usePBusHardware` but not `useRadioLink`. No click-to-fire, no measurement tool.
11. **`VirtualControllerHub` STATIC** — no live battery/signal from hooks, no manufacturer grouping.

## Changes

### 1. Edit `src/components/editor/live-firing/types.ts`
- Add `HardwareBinding` type and optional `hardwareBinding` field to `SFXChannel`

### 2. Edit `src/components/editor/LiveFiringPanel.tsx` — CRITICAL: Unified Fire Path
- Import `useFireOneHardware` and `usePBusHardware`
- In `fireChannel()`: after Art-Net send, check `ch.hardwareBinding` → route to `fireone.fireIgniter()` or `pbus.fireCue()`
- In `handlePanic()`: also call `fireone.emergencyStop()` and `pbus.emergencyStop()` when connected
- In ARM logic: call `fireone.armAll()` / `pbus.armAll()` when connected

### 3. Edit `src/components/editor/VirtualZK6200.tsx` — Real PBUS Routing
- Add `slavePairing` state: `Record<number, { addr: number; cue: number }>`
- In `fireZone()`: when `pbus.isConnected` and zone paired, call `pbus.fireCue()`
- In `handleArm()`: call `pbus.armAll()` / `pbus.disarmAll()`
- In `handlePanic()`: call `pbus.emergencyStop()`
- Add "Pair Slaves" dialog mapping zones to discovered PBUS devices
- Show live RSSI/battery from PBUS on zone cards

### 4. Edit `src/components/editor/VirtualFXButton.tsx` — Hardware Routing
- Add pairing state per button → `{ deviceAddr, cueIndex }`
- In `handleFire()`: when PBUS connected + paired, call `pbus.fireCue()`
- Add "Pair" button per channel with PBUS device selector
- Show paired device label + signal strength per button

### 5. Edit `src/components/editor/live-firing/PBusMonitorPanel.tsx` — Fix Bug
- Fix line 57: change `(progress / 800) * 100 * 50` to `(progress / 80) * 100`
- Add "Bind to CUE" button per cue slot linking to SFXChannel via hardwareBinding

### 6. Edit `src/components/editor/DiagnosticPanel.tsx` — Add PBUS Section
- Import `usePBusHardware`
- After FireOne section, add: PBUS link status, device count, battery check (<3.3V), dual-band signal quality, cue continuity summary

### 7. Edit `src/components/editor/FleetManagementPanel.tsx` — Add Hardware Tab
- Add 4th tab "Hardware" rendering `fireoneModules` and `pbusDevices` (already computed but never shown)
- Each row: address, type, battery, RSSI, cue count, firmware
- Bulk actions: "Scan Continuity", "Battery Report"

### 8. Edit `src/components/editor/VirtualControllerHub.tsx` — Live Telemetry
- Group cards by manufacturer (FireOne / Showven / Infrastructure) with collapsible sections
- Show real battery/RSSI from hooks on connected device cards

### 9. Edit `src/components/editor/ShowvenEquipmentPanel.tsx` — Live Overlay
- When PBUS connected: show battery + cue status badge on controller/remote cards
- Show RSSI indicator on PyroSlave C16/X4 cards

### 10. Edit `src/components/editor/FieldMap2D.tsx` — Radio + Click-to-Fire
- Import `useRadioLink`
- Add radio RSSI overlay per device when radio connected
- Add click-to-fire: tap module marker → mini popup with ARM/FIRE
- Add distance measurement tool (click two points → meters)

### 11. Edit `src/components/editor/ConnectionManagerPanel.tsx` — Summary
- Add summary header: "X FireOne, Y PBUS, Z Radio"
- Add "Test All" button pinging all connections

## Files

| File | Key Fix |
|------|---------|
| `live-firing/types.ts` | Add `HardwareBinding` to `SFXChannel` |
| `LiveFiringPanel.tsx` | Unified fire/panic/arm → real hardware |
| `VirtualZK6200.tsx` | PBUS fire + slave pairing |
| `VirtualFXButton.tsx` | Hardware fire + pairing |
| `PBusMonitorPanel.tsx` | Fix deadman 312% bug + CUE bind |
| `DiagnosticPanel.tsx` | Add PBUS diagnostics |
| `FleetManagementPanel.tsx` | Add Hardware tab (data already computed) |
| `VirtualControllerHub.tsx` | Live telemetry + grouping |
| `ShowvenEquipmentPanel.tsx` | Live cue/battery overlay |
| `FieldMap2D.tsx` | Radio layer + click-to-fire |
| `ConnectionManagerPanel.tsx` | Summary + Test All |

## Impact
After these changes: a single CUE KEY fires Art-Net + FireOne + PBUS simultaneously. PANIC broadcasts E-STOP to all systems. Virtual controllers route to real hardware. The deadman bug is fixed. Fleet panel finally shows firing hardware.

