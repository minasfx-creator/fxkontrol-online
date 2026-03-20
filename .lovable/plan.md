

# Plan: IFMx-i32Q Field Module Integration — Real Hardware Control

## Overview
Extend the FireOne protocol and PyroFireOnePanel to support real **IFMx-i32Q** field modules (32 firing cues + DMX output, wired/wireless) via the existing `FireOneController` RS-485 serial bridge, plus a new `useFireOneHardware` React hook and a `fireoneScriptParser` for UltraFire CSV interchange.

## Architecture

```text
PyroFireOnePanel (UI)
  ├─ SIM mode (current) — local state simulation
  └─ HARDWARE mode (new) — via useFireOneHardware hook
        │
        ▼
  useFireOneHardware (new hook)
        │ wraps FireOneController singleton
        ▼
  fireoneProtocol.ts (existing + extended)
        │ WebSerial RS-485 (9600 8N1)
        ▼
  IFMx-i32Q Field Modules (1-99)
    ├─ 32 firing cues (e-match igniters)
    ├─ DMX output (universe per module)
    └─ Wired RS-485 or Wireless bridge
```

## Changes

### 1. Create `src/hooks/useFireOneHardware.ts`
React hook bridging `FireOneController` → component state:
- `connect()` / `disconnect()` — WebSerial lifecycle
- `isConnected`, `modules` (Map synced from controller events), `connectionError`
- `armModule(addr)` / `disarmModule(addr)` / `armAll()` / `disarmAll()`
- `fireIgniter(addr, pin, durationMs)` — with safety gate (masterKey + deadman + armed)
- `requestContinuity(addr)` — triggers low-current test, updates igniter Ω from ACK
- `discoverModules(maxAddr)` — scans RS-485 bus, populates module list
- `emergencyStop()` — 3× broadcast STOP
- `syncTimecode(ms)` — forwards timecode to all modules
- TX/RX byte counters, last heartbeat timestamp
- Subscribes to controller events (`status-update`, `fire-confirm`, `continuity-result`, `module-discovered`, `error`) and maps them to React state updates

### 2. Extend `src/lib/fireoneProtocol.ts`
Add IFMx-i32Q specific commands:
- `FireOneCmd.DMX_OUT = 0x4F` — send DMX values to module's built-in DMX output port
- `buildDmxOutCommand(moduleAddr, startChannel, values)` — frame builder for DMX output on the IFMx-i32Q
- `FireOneCmd.MODULE_CONFIG = 0x47` — query/set module config (wireless mode, DMX universe, firing delay)
- `buildModuleConfigQuery(addr)` / `buildModuleConfigSet(addr, config)` — frame builders
- `parseModuleConfig(payload)` — parse config response (wireless flag, DMX universe, firmware, serial number)
- Add `serialNumber` and `dmxUniverse` fields to `FireOneModuleStatus`
- Add `'dmx-out-confirm'` and `'config-response'` to `FireOneEventType`
- Handle new response types in `handleFrame()`

### 3. Create `src/lib/fireoneScriptParser.ts`
UltraFire CSV interchange:
- `parseFireOneCSV(text): AutoFireCue[]` — parse official FireOne CSV (Row ID, Launch Time, Module, Cue, DMX Channel, DMX Value, etc.)
- `exportFireOneCSV(cues: AutoFireCue[]): string` — generate CSV from internal cues
- `parseFireOneFIR(text): AutoFireCue[]` — read pipe-delimited FIR exports
- Maps between FireOne Slat/Cue numbering and our Module/Igniter addressing

### 4. Edit `src/components/editor/live-firing/PyroFireOnePanel.tsx`
Wire real hardware via hook:
- Import and use `useFireOneHardware` hook
- **Connection bar** (top of panel): CONNECT / DISCONNECT button, SIM↔HARDWARE toggle, signal indicator (🟢 HARDWARE / 🟡 SIM), TX/RX counters
- **SCAN button**: calls `hook.discoverModules()`, replaces static sim modules with real discovered IFMx-i32Q modules
- When HARDWARE mode active: ARM/DISARM/FIRE/CONTINUITY commands route through hook → serial; module grid shows real telemetry (battery V, signal %, temp °C, igniter Ω)
- **Misfire detection**: if fire sent but no ACK within 2s, mark igniter orange
- **DMX output**: per-module DMX send button for IFMx-i32Q's built-in DMX port
- **Import/Export toolbar**: "Import FireOne CSV" file picker + "Export to FireOne" download using `fireoneScriptParser`
- **Module info tooltip**: shows serial number, firmware version, wireless status from real hardware response

### 5. Edit `src/components/editor/live-firing/AutoFirePanel.tsx`
- Add "Import FireOne CSV" and "Export to FireOne CSV" buttons using `fireoneScriptParser`

## Files Summary

| File | Action |
|------|--------|
| `src/hooks/useFireOneHardware.ts` | Create — React hook bridging UI ↔ FireOneController |
| `src/lib/fireoneProtocol.ts` | Edit — add IFMx-i32Q DMX out + config commands |
| `src/lib/fireoneScriptParser.ts` | Create — FireOne CSV/FIR parser and exporter |
| `src/components/editor/live-firing/PyroFireOnePanel.tsx` | Edit — wire hardware hook, connection UI, DMX out, import/export |
| `src/components/editor/live-firing/AutoFirePanel.tsx` | Edit — add FireOne CSV import/export buttons |

