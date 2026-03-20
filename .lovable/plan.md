

# Plan: Gap Fix + MA3 Deep Integration + UI/UX Polish

## Confirmed Gaps

### MA3 Integration Gaps
1. **MA3 not in SWIPE_MODES** — Line 265 of LiveFiringPanel: `SWIPE_MODES` array does not include `'ma3'`, so mobile swipe navigation skips the MA3 panel
2. **MA3 not in mode bar** — Line 814-826: The renderSceneModeBar modes list has no MA3 entry — users can only reach MA3 through the mode router but have no tab button for it
3. **MA3 no sACN→DMX bridge** — sACN data received from MA3 is displayed but never fed into the DMX engine or SFX channels — the "monitoring" is display-only with no actual control loop
4. **MA3 OSC no bidirectional feedback** — Executor faders receive no feedback from MA3 (e.g., if someone moves a fader on the console, the UI doesn't update)
5. **MA3 no Cue List display** — No visual cue list showing MA3 sequences/cues — just quick buttons for Seq 1-4 hardcoded
6. **MA3 no sACN→fixture mapping** — sACN universe data has no way to map to actual fixtures in the show

### Showven/FireOne Gaps
7. **ShowvenEquipmentPanel no live cue overlay** — PBUS hook imported but controller cards never show live cue count, fired state, or battery from real hardware data
8. **VirtualControllerHub no manufacturer grouping** — All 9 controllers in a flat list, no collapsible sections by manufacturer (FireOne/Showven/Infrastructure)
9. **SMPTE Panel no PBUS sync** — Only imports `useFireOneHardware`, never sends timecode sync to PBUS devices
10. **ShowControlPanel no PBUS integration** — Only imports `useFireOneHardware`, never manages PBUS arm/fire phases during show orchestration

### UI/UX Gaps
11. **Mode bar overflow on desktop** — 12 modes crammed into a horizontal scroll; MA3 would be 13th. Need better mode organization
12. **No connection health indicator** — Status bar shows DMX/UDP LEDs but no indicator for FireOne/PBUS/Radio connection health
13. **No show-wide hardware summary** — No quick view showing "total devices connected across all systems"

## Changes

### 1. Edit `src/components/editor/LiveFiringPanel.tsx` — Add MA3 to Mode System + Status Bar
- Add `'ma3'` to `SWIPE_MODES` array (line 265)
- Add MA3 entry to mode bar in `renderSceneModeBar` (line 814-826): `{ key: 'ma3', label: '🎛 MA3' }`
- Add hardware connection indicators in status bar: show FireOne/PBUS/Radio connection dots alongside DMX/UDP
- Group mode tabs into categories with subtle separators: `[DMX modes | Fire modes | Hardware | Settings]`

### 2. Edit `src/components/editor/MA3ControlPanel.tsx` — Deep MA3 Enhancements
- **sACN→DMX Engine bridge**: Add toggle "Route sACN to DMX Engine" — when enabled, feed sACN channel data into the SFX channel store so MA3 console actually controls show effects
- **OSC bidirectional fader sync**: Update fader values from incoming OSC messages (match `/gma3/exec/{page}.{fader}` address)
- **Dynamic Cue List**: Add "Cue List" section in OSC tab showing sequences with Go/Pause/GoBack buttons, driven from OSC feedback
- **MA3 Macro Buttons**: Add configurable macro buttons (Go, Blackout, Full, Panic) that send common MA3 commands
- **Executor Page selector**: Currently hardcoded to Page 1 — add page selector (1-8)
- **sACN channel detail view**: Click on a universe to expand full 512-channel grid with channel values

### 3. Edit `src/components/editor/ShowvenEquipmentPanel.tsx` — Live Hardware Overlay
- When PBUS connected: show live battery badge and cue status (X/16 connected, Y fired) on PyroSlave C16/X4 controller cards
- Show RSSI quality indicator (signal bars) on wireless device cards
- Add "Scan All" button that triggers PBUS device discovery
- Show connection path badge (WIRED/RADIO) on each card when connected

### 4. Edit `src/components/editor/VirtualControllerHub.tsx` — Manufacturer Grouping + Live Data
- Group controllers with collapsible sections: FireOne (1 card) / Showven (6 cards) / Infrastructure (2 cards)
- Show real battery voltage and RSSI from hooks on connected device cards (currently static)
- Add firmware version display when available from hardware data
- Add total hardware summary header: "3 connected / 9 available"

### 5. Edit `src/components/editor/ShowControlPanel.tsx` — PBUS Integration
- Import `usePBusHardware`
- In Arm phase: also call `pbus.armAll()` alongside `fireone.armAll()`
- In E-STOP: call `pbus.emergencyStop()` alongside `fireone.emergencyStop()`
- Show PBUS device count in hardware summary during preflight

### 6. Edit `src/components/editor/SMPTEPanel.tsx` — PBUS Timecode Sync
- Import `usePBusHardware`
- Add "Sync to PBUS" toggle alongside existing "Sync to FireOne" toggle
- When enabled, send timecode data to PBUS devices for synchronized firing

### 7. Create `src/lib/sacnDmxBridge.ts` — sACN to DMX Engine Bridge
- Bridge class that maps sACN universe/channel data to SFX channels
- Configurable universe→channel mapping table
- `startBridge()` / `stopBridge()` / `setMapping(universe, startChannel, sfxChannelId)`
- Consumes `SACNReceiver` data and writes to `useSfxChannelStore`

## Files Summary

| File | Action | Key Change |
|------|--------|------------|
| `LiveFiringPanel.tsx` | Edit | MA3 in SWIPE_MODES + mode bar, status indicators |
| `MA3ControlPanel.tsx` | Edit | sACN→DMX bridge, bidirectional faders, cue list, macros |
| `ShowvenEquipmentPanel.tsx` | Edit | Live cue/battery/RSSI overlay on cards |
| `VirtualControllerHub.tsx` | Edit | Manufacturer grouping + live telemetry |
| `ShowControlPanel.tsx` | Edit | PBUS arm/estop integration |
| `SMPTEPanel.tsx` | Edit | PBUS timecode sync |
| `src/lib/sacnDmxBridge.ts` | Create | sACN→DMX Engine mapping bridge |

## Technical Notes
- The sACN→DMX bridge is the most impactful MA3 change: it allows the grandMA3 console to actually control the SFX channels in real-time, not just display data
- Mode bar reorganization uses CSS gap/border separators between mode groups — no structural change to mode routing
- All PBUS integration in ShowControlPanel mirrors existing FireOne patterns for consistency

