

# Plan: Full FireOne Hardware Integration Across All System Modules

## Overview
Promote the FireOne IFMx-i32Q hardware integration from the Pyro panel into all related subsystems: **Addressing**, **Diagnostics**, **Show Control**, **DMX Panel**, **SMPTE/Timecode**, **Firing Export**, and **Safety Check**. This connects the real hardware state to every panel that deals with pyro, firing, or show execution.

## Changes

### 1. Edit `src/components/editor/AddressingPanel.tsx` — FireOne Hardware Sync
- Import `useFireOneHardware` hook
- When hardware connected: populate module list from real discovered IFMx-i32Q modules instead of static specs
- Add "Sync from Hardware" button that reads discovered module addresses and auto-maps them to the addressing table
- Show connection mode (wired/wireless) and RSSI per module in the address list
- Add `fireone-i32q` to `DEFAULT_MODULE_SPECS` in the addressing store (32 pins, 1 slat)

### 2. Edit `src/components/editor/DiagnosticPanel.tsx` — Hardware Diagnostics
- Import `useFireOneHardware` hook
- Add new diagnostic checks when hardware connected:
  - "FireOne Link" — verify RS-485 serial connection is active
  - "Module Discovery" — check how many modules respond on the bus
  - "Battery Check" — flag modules with voltage < 11.0V
  - "Continuity Summary" — run continuity on all modules, report open/short/good counts
  - "Wireless Signal" — flag modules with RSSI < -75 dBm
  - "Firmware Version" — list firmware versions, warn if mixed
- Show SIM mode warning when not connected to real hardware

### 3. Edit `src/components/editor/ShowControlPanel.tsx` — FireOne Orchestration
- Import `useFireOneHardware` hook
- During "Preflight" phase: include FireOne hardware checks (connection, module count, battery, continuity)
- During "Armed" phase: send ARM ALL to FireOne modules via `hardware.armAll()`
- During "Running" phase: sync timecode to modules via `hardware.syncTimecode(ms)`
- During "Abort" phase: send emergency stop to all modules via `hardware.emergencyStop()`
- Add FireOne status indicator in the phase dashboard showing module count, armed state, connection mode

### 4. Edit `src/components/editor/DMXPanel.tsx` — IFMx-i32Q DMX Output
- Import `useFireOneHardware` hook
- Add "FireOne DMX" output mode alongside Art-Net and USB Direct
- When selected, DMX frames route through `hardware.sendDmxOut(moduleAddr, startChannel, values)` to the IFMx-i32Q's built-in DMX output port
- Show which modules have DMX output capability in the output selector
- Map DMX universe to module address (universe 1 → module 1 DMX port, etc.)

### 5. Edit `src/components/editor/SMPTEPanel.tsx` — Timecode Sync to Modules
- Import `useFireOneHardware` hook
- Add "Sync to FireOne" toggle: when enabled, every timecode tick sends `hardware.syncTimecode(ms)` to all field modules
- Show sync status indicator (green when modules are receiving timecode, amber when no hardware)
- During external timecode chase mode, forward the received timecode to FireOne modules in real-time

### 6. Edit `src/lib/firingSystemExports.ts` — Enhanced FireOne Export
- Import types from `fireoneScriptParser`
- Replace the basic `exportFireOne()` with a version that uses the full FireOne CSV spec (matching UltraFire format)
- Include DMX commands in the export for IFMx-i32Q modules with DMX output assignments
- Add `exportFireOneUltraFire()` function that generates the complete UltraFire-compatible CSV with all fields

### 7. Edit `src/components/editor/FiringExportPanel.tsx` — Live Hardware Export
- Import `useFireOneHardware` hook
- Add "Upload to Hardware" button for FireOne: when hardware connected, sends the cue list directly to modules as a scripted sequence (using `FIRE_SEQUENCE` commands with timecode offsets)
- Show hardware connection status in the FireOne export row
- Add "Verify Addressing" action that cross-checks exported module/pin assignments against physically discovered modules

### 8. Edit `src/store/useAddressingStore.ts` — Add IFMx-i32Q Spec
- Add `{ id: 'fireone-i32q', name: 'FireOne IFMx-i32Q', slatCount: 1, pinsPerSlat: 32, firingSystem: 'Default' }` to `DEFAULT_MODULE_SPECS`

## Files Summary

| File | Action |
|------|--------|
| `src/store/useAddressingStore.ts` | Edit — add IFMx-i32Q module spec |
| `src/components/editor/AddressingPanel.tsx` | Edit — hardware sync, live module discovery |
| `src/components/editor/DiagnosticPanel.tsx` | Edit — hardware diagnostic checks |
| `src/components/editor/ShowControlPanel.tsx` | Edit — FireOne orchestration in show phases |
| `src/components/editor/DMXPanel.tsx` | Edit — IFMx-i32Q DMX output mode |
| `src/components/editor/SMPTEPanel.tsx` | Edit — timecode sync to field modules |
| `src/lib/firingSystemExports.ts` | Edit — enhanced UltraFire-compatible export |
| `src/components/editor/FiringExportPanel.tsx` | Edit — upload to hardware, verify addressing |

## Technical Notes
- All integrations use the existing `useFireOneHardware` hook — no new protocol code needed
- When hardware is not connected, all panels fall back to their existing behavior (no breaking changes)
- Hardware state is shared via the `FireOneController` singleton, so all panels see the same module list
- Timecode sync to modules uses the same frame format already implemented in `buildSyncTimecode()`

