

# Plan: PBUS Protocol + Full FireOne/Showven Integration Completion

## Overview
Create the PBUS protocol engine for native communication with Showven PyroSlave C16 (dual-band 433M/868M), integrate it into the existing hardware control chain, and connect remaining unlinked panels (Safety Check, Laser Control, Geofence, Fleet Management) with FireOne and Showven hardware state.

## Changes

### 1. Create `src/lib/pbusProtocol.ts` — PBUS Protocol Engine
Native PBUS serial protocol for Showven PyroSlave devices:
- Frame format: `[PREAMBLE 0xAA][DEVICE_ADDR][CMD][LEN][PAYLOAD...][CRC16][TERM 0x55]`
- Commands: `DISCOVER (0x01)`, `ARM (0x10)`, `FIRE (0x20)`, `STATUS (0x30)`, `CUE_STATUS (0x31)`, `CONFIG (0x40)`, `ESTOP (0xFF)`
- `PBusCmd` enum + `buildPBusFrame()`, `parsePBusResponse()`, `calculateCRC16()`
- Types: `PBusDevice { address, type, channels, firmwareVersion, batteryV, rssi433, rssi868, cueStates[] }`, `PBusCueState { index, connected, fired, resistance }`, `PBusWirelessBand = '433M' | '868M' | 'dual'`
- Auto-discovery: scan addresses 1-64, identify device type (C16, X4, PyroMote)
- Dual-band signal handling: track RSSI for both 433MHz and 868MHz, auto-select best band
- WebSerial connection at 19200 baud (PBUS standard)

### 2. Create `src/hooks/usePBusHardware.ts` — PBUS React Hook
- `connect()` / `disconnect()` via WebSerial (19200 8N1)
- `discoverDevices(maxAddr)` — scan PBUS bus, populate `devices: Map<number, PBusDevice>`
- `armDevice(addr)` / `disarmDevice(addr)` / `armAll()` / `disarmAll()`
- `fireCue(addr, cueIndex)` — fire single cue with safety interlocks
- `requestCueStatus(addr)` — get all 16 cue continuity states
- `emergencyStop()` — broadcast ESTOP
- RSSI polling (dual-band) every 3s with band quality comparison
- Auto-fallback between 433M and 868M based on signal quality
- Expose `bestBand`, `devices`, `isConnected`, `scanning`

### 3. Create `src/components/editor/live-firing/PBusMonitorPanel.tsx` — PBUS Control UI
Dedicated sub-panel within FXcommander for Showven PBUS devices:
- Device list showing all discovered PyroSlave C16/X4 units with dual-band RSSI bars
- 16-cue grid per C16 with continuity color coding (green/red/orange)
- ARM/FIRE controls per device with deadman interlock
- Band selector (433M / 868M / Auto) per device
- Signal quality comparison chart (433 vs 868 MHz)
- Integration with existing LiveFiringPanel mode tabs

### 4. Edit `src/components/editor/SafetyCheckPanel.tsx` — Hardware Safety Gates
- Import `useFireOneHardware` and `usePBusHardware`
- Add hardware safety checks: FireOne module battery/continuity, PBUS device status, wireless signal thresholds
- Show hardware connection status in safety report (pass/fail per system)
- Block "PASS" if any connected hardware has critical issues (low battery, open igniters, weak signal)

### 5. Edit `src/components/editor/LaserControlPanel.tsx` — Showven Maiman Integration
- Import Showven laser presets from `showvenPresets.ts`
- Add "Showven Maiman" hardware selector linking to preset specs (30W/40W/60W)
- When Maiman selected: constrain pan/tilt/power to spec limits, show safety channel config
- Route DMX output through existing Art-Net or FireOne DMX out depending on active hardware

### 6. Edit `src/components/editor/GeofencePanel.tsx` — Hardware-Aware Geofence
- Import `useFireOneHardware` and `usePBusHardware`
- Auto-populate geofence exclusion zones around connected firing modules (safety radius)
- Show connected module positions on geofence map
- Link geofence violations to hardware ESTOP trigger

### 7. Edit `src/components/editor/FleetManagementPanel.tsx` — Unified Device Fleet
- Import `useFireOneHardware` and `usePBusHardware`
- Add "Firing Modules" and "SFX Controllers" sections alongside drone fleet
- Show all connected FireOne IFMx-i32Q modules + Showven PBUS devices in unified fleet view
- Display battery, signal, firmware, connection mode per device
- Bulk actions: firmware check, battery report, full continuity scan

### 8. Edit `src/components/editor/ShowvenEquipmentPanel.tsx` — Live Hardware Status
- Import `usePBusHardware`
- When PBUS connected: show live status badges on PyroSlave C16/X4 equipment cards
- Show real cue status (connected/fired) overlay on controller cards
- Add "Connect PBUS" button in Controllers section

### 9. Edit `src/components/editor/live-firing/constants.ts` — PBUS Device Profiles
- Add `PBUS_DEVICE_PROFILES` with C16 (16 cues, dual-band) and X4 (4 cues, wired) specs
- Add PBUS connection profile to `DEVICE_PROFILES` in `usbEngine.ts`

### 10. Edit `src/lib/usbEngine.ts` — PBUS Serial Profile
- Add `'pbus'` to `USBDeviceType`
- Add PBUS serial profile: 19200 baud, 8N1

## Files Summary

| File | Action |
|------|--------|
| `src/lib/pbusProtocol.ts` | Create — PBUS protocol engine |
| `src/hooks/usePBusHardware.ts` | Create — PBUS React hook |
| `src/components/editor/live-firing/PBusMonitorPanel.tsx` | Create — PBUS control UI |
| `src/components/editor/SafetyCheckPanel.tsx` | Edit — hardware safety gates |
| `src/components/editor/LaserControlPanel.tsx` | Edit — Showven Maiman integration |
| `src/components/editor/GeofencePanel.tsx` | Edit — hardware-aware exclusion zones |
| `src/components/editor/FleetManagementPanel.tsx` | Edit — unified device fleet |
| `src/components/editor/ShowvenEquipmentPanel.tsx` | Edit — live PBUS status |
| `src/components/editor/live-firing/constants.ts` | Edit — PBUS profiles |
| `src/lib/usbEngine.ts` | Edit — PBUS serial profile |

## Technical Notes
- PBUS uses 19200 baud (vs FireOne's 9600) — separate serial port connection
- Both hooks (`useFireOneHardware` + `usePBusHardware`) can be active simultaneously on different serial ports
- Dual-band RSSI: 433MHz has better range/penetration, 868MHz has better bandwidth — auto-select logic picks the band with better link quality
- CRC16 (CCITT) used for PBUS frames vs simple XOR checksum for FireOne
- All panels gracefully degrade when hardware not connected (existing behavior preserved)

