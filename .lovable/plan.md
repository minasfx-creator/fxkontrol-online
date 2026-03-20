

# Plan: Wireless IFMx-i32Q Support with RSSI + Wired Fallback + Full FireOne Integration

## Overview
Add wireless module detection, RSSI signal monitoring with visual indicators, automatic wired fallback, and unify all FireOne technologies (RS-485 wired, wireless bridge, DMX output, UltraFire CSV, ScriptMaker, Flames Launcher) into a single cohesive control system.

## Changes

### 1. Extend `src/lib/fireoneProtocol.ts` — Wireless Commands
Add wireless-specific protocol support:
- New commands: `WIRELESS_STATUS = 0x57` (query RSSI, channel, link quality), `WIRELESS_CONFIG = 0x56` (set channel, power, fallback mode)
- `buildWirelessStatusQuery(addr)` — request wireless telemetry (RSSI dBm, channel, packet loss %, link quality)
- `buildWirelessConfig(addr, config)` — set wireless channel (1-16), TX power, auto-fallback flag
- `parseWirelessStatus(payload)` — returns `{ rssiDbm, channel, packetLoss, linkQuality, mode: 'wireless'|'wired'|'fallback' }`
- Extend `FireOneModuleStatus` with: `rssiDbm?: number`, `wirelessChannel?: number`, `packetLoss?: number`, `linkQuality?: number`, `connectionMode: 'wired' | 'wireless' | 'fallback'`
- Add `'wireless-status'` and `'wireless-fallback'` to `FireOneEventType`
- Handle wireless status frames and auto-fallback detection in `handleFrame()`

### 2. Extend `src/hooks/useFireOneHardware.ts` — Wireless Polling + Fallback
- Add `queryWirelessStatus(addr)` — sends wireless status query
- Add periodic wireless polling: when connected, poll RSSI every 3s for wireless modules
- Detect RSSI threshold (-80 dBm) and emit fallback event when signal degrades
- Add `wirelessModuleCount` and `wiredModuleCount` computed from module status
- Track `connectionMode` per module in React state from hardware events

### 3. Edit `src/components/editor/live-firing/PyroFireOnePanel.tsx` — Wireless UI
Add wireless indicators and controls throughout the panel:

**Connection bar enhancements:**
- Wireless module count badge (e.g., "3 Wireless · 2 Wired")
- Global RSSI indicator bar showing worst-case signal across all wireless modules

**Module selector:**
- Wifi/Usb icon per module showing connection mode (wireless/wired/fallback)
- Color-coded RSSI: green (>-60dBm), amber (-60 to -75dBm), red (<-75dBm), flashing red (fallback triggered)

**Module info bar:**
- RSSI dBm readout with signal bars icon for wireless modules
- Connection mode badge: "WIRELESS" (cyan), "WIRED" (green), "FALLBACK" (amber flash)
- Packet loss % indicator
- Wireless channel number

**Fullscreen sidebar (desktop):**
- Per-module row shows connection mode icon + RSSI bar
- Fallback alert: when a module switches from wireless to wired fallback, flash the row amber and show toast

**New "Network" sub-section in Test mode:**
- Wireless channel scanner showing all 16 channels with noise levels
- Per-module RSSI history sparkline (last 30 readings)
- Bulk wireless config: set channel + TX power for all wireless modules

### 4. Edit `src/lib/fireoneScriptParser.ts` — ScriptMaker + Flames Integration
Extend the parser to support additional FireOne software formats:
- `parseScriptMakerSession(text)` — parse ScriptMaker Visual session files (.ses) with timing, product data, position info
- `parseFlamesLauncherCSV(text)` — parse Flames Launcher DMX choreography exports
- `exportFlamesLauncherCSV(cues)` — generate Flames-compatible CSV for DMX flame machines
- Map ScriptMaker product numbers to internal effect types

### 5. Edit `src/components/editor/live-firing/AutoFirePanel.tsx` — Unified Import
- Add "ScriptMaker" and "Flames" import options alongside existing FireOne CSV
- File picker accepts `.ses`, `.csv`, `.fir`, `.sem` with auto-detection
- Show source badge on imported cues ("UltraFire", "ScriptMaker", "Flames")

## Files Summary

| File | Action |
|------|--------|
| `src/lib/fireoneProtocol.ts` | Edit — wireless commands, extended status fields, fallback detection |
| `src/hooks/useFireOneHardware.ts` | Edit — wireless polling, RSSI tracking, fallback logic |
| `src/components/editor/live-firing/PyroFireOnePanel.tsx` | Edit — RSSI indicators, connection mode badges, wireless config UI |
| `src/lib/fireoneScriptParser.ts` | Edit — ScriptMaker + Flames Launcher format support |
| `src/components/editor/live-firing/AutoFirePanel.tsx` | Edit — unified multi-format import |

## Technical Notes
- RSSI polling uses 3s interval to avoid flooding RS-485 bus
- Auto-fallback: when RSSI drops below -80 dBm for 3 consecutive readings, controller sends `WIRELESS_CONFIG` with fallback flag; module switches to wired RS-485 automatically
- Fallback is non-destructive: module retains wireless config and will auto-reconnect wireless when signal recovers above -70 dBm (5 dB hysteresis)
- All wireless commands go through the same RS-485 serial path (wireless bridge transparently relays)

