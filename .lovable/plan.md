

# Plan: Virtual Controllers + Mobile PBUS + 2D Field Map — Revised with Improvements

## Overview
Create virtual replicas of all physical controllers (FireOne XL4+, Showven ZK6200/6300, PyroSlave C16, FXbutton, PyroMote), add mobile-optimized PBUS panel with touch deadman, create a 2D field map with live hardware overlay, and add missing integration features: connection manager hub, haptic safety interlocks, and a unified hardware dashboard.

## Changes

### 1. Create `src/components/editor/VirtualControllerHub.tsx` — Central Hardware Dashboard
Unified panel listing all virtual and real controllers with connection management:
- Grid of controller cards: **FireOne XL4+**, **ZK6200**, **ZK6300**, **PyroSlave C16**, **FXbutton**, **PyroMote**, **DMX Splitter 8**, **DMX Relay R12**
- Each card: name, status badge (SIM/LIVE), connection type icon (USB/ArtNet/Wireless/PBUS), battery, signal
- Connection toolbar with 4 connection modes: USB Serial (WebSerial), Art-Net (WebSocket relay), Wireless 433/868M (PBUS bridge), Wired RS-485
- Click card → opens its dedicated virtual controller panel
- Mobile: vertical stack with large 56px touch targets, swipe left to disconnect

### 2. Create `src/components/editor/VirtualZK6200.tsx` — ZK6200/6300 Host Controller Replica
Full virtual replica of Showven ZK6200 (20 zones) and ZK6300 (30 zones):
- Zone grid with DMX addressing per zone (base address display)
- ARM key switch (toggle with confirmation dialog) + DEADMAN (hold-to-activate)
- Zone fire buttons with visual ripple + haptic feedback (`navigator.vibrate([30])`)
- Status bar: LTC timecode input, DMX output universe, wireless link status to slaves
- Mode selector: Manual / Timecode / Sequence / Test
- Connection routing: commands go to real hardware when USB/PBUS connected, SIM mode otherwise
- Mobile: 4-column zone grid, full-screen with bottom sheet for settings

### 3. Create `src/components/editor/VirtualFXButton.tsx` — Wireless Remote Replica
Virtual FXbutton with 1/4/8 channel modes:
- Large colored fire buttons matching real hardware layout
- Safety interlock: slide-to-unlock gesture before firing enabled
- Signal strength indicator to paired controller (RSSI from PBUS)
- Wired/wireless mode toggle
- Mobile-first: full-screen button grid, each button min 80px, haptic on fire
- Pair to any ZK6200/C16 controller in the system

### 4. Create `src/components/editor/FieldMap2D.tsx` — 2D Site Map with Live Hardware Overlay
Canvas-based field visualization layered on SiteLayoutPanel zones:
- Renders site zones (audience, pyro, safety perimeter) from `SiteLayoutPanel` data
- FireOne modules: numbered squares, color = armed state (green OK, amber low battery, red fault)
- PBUS devices: circles with dual-band RSSI rings (433M=blue inner, 868M=cyan outer)
- Hover/tap module → mini cue grid popup showing 16/32 igniters (green/red/grey)
- RSSI heatmap toggle: gradient background showing wireless signal coverage
- Drag modules to set field positions; snap to grid (5m)
- Distance rulers between modules and audience zones (auto-calculated safety distances)
- Real-time 3Hz updates from `useFireOneHardware` + `usePBusHardware`
- Mobile: pinch-zoom + pan via touch, tap for detail bottom-sheet
- Legend panel: color codes for signal quality, continuity, armed state

### 5. Edit `src/components/editor/live-firing/PBusMonitorPanel.tsx` — Mobile Responsive + Touch Deadman
- Detect mobile via `useIsMobile()`
- Mobile layout: single-column cards, 4x4 cue grid (vs 8x2 desktop)
- **Touch DEADMAN**: `onTouchStart` → 800ms `setTimeout` to activate + `navigator.vibrate([100])`, `onTouchEnd`/`onTouchCancel` to release; visual countdown ring during press
- ARM/FIRE/ESTOP buttons: `min-h-14` on mobile with larger text
- Horizontal swipe between devices (CSS scroll-snap)
- E-STOP: full-width red button with long-press confirmation (500ms hold to trigger, prevents accidental taps)
- Connection stats footer: TX/RX in KB, worst battery across fleet

### 6. Create `src/components/editor/ConnectionManagerPanel.tsx` — Unified Connection Hub
Central panel for managing all hardware connections simultaneously:
- Lists all active connections: FireOne RS-485, PBUS 19200, Art-Net WebSocket, USB DMX
- Each row: protocol name, baud/port, TX/RX counters, latency, status badge
- "Add Connection" button → serial port picker with auto-detect (reads VID/PID → matches to DEVICE_PROFILES)
- Multi-port support: can have FireOne + PBUS + DMX on separate serial ports simultaneously
- Auto-reconnect toggle per connection
- Connection health monitor: packet loss %, latency ms, uptime
- Mobile: simplified list view with swipe-to-disconnect

### 7. Edit `src/components/editor/LiveFiringPanel.tsx` — New Mode Tabs
- Add `'controllers'`, `'field_map'`, `'pbus'`, `'connections'` to mode router in `renderModeContent()`
- Import and render: `VirtualControllerHub`, `FieldMap2D`, `PBusMonitorPanel`, `ConnectionManagerPanel`
- Add corresponding entries in the mode bar with icons

### 8. Edit `src/components/editor/live-firing/types.ts` — Extended Types
- Add `'controllers' | 'field_map' | 'pbus' | 'connections'` to `FXCMode`

### 9. Edit `src/components/editor/MobileTabBar.tsx` — Quick Access Tabs
- Add "Controllers" tab (Cpu icon) → opens `VirtualControllerHub` via panelId
- Add "Field Map" tab (Map icon) → opens `FieldMap2D` via panelId
- Reorder tabs: LiveFX, Controllers, Field Map, Mobile Link, More

### 10. Edit `src/components/editor/PanelTabBar.tsx` — Register New Panels
- Add `'controllers'`, `'fieldmap'`, `'connections'` to `PanelId` type
- Add entries in Hardware section of `PANEL_SECTIONS`

## Files Summary

| File | Action |
|------|--------|
| `src/components/editor/VirtualControllerHub.tsx` | Create — controller selection dashboard |
| `src/components/editor/VirtualZK6200.tsx` | Create — ZK6200/6300 virtual replica |
| `src/components/editor/VirtualFXButton.tsx` | Create — FXbutton wireless remote |
| `src/components/editor/FieldMap2D.tsx` | Create — 2D field map with live telemetry |
| `src/components/editor/ConnectionManagerPanel.tsx` | Create — unified connection hub |
| `src/components/editor/live-firing/PBusMonitorPanel.tsx` | Edit — mobile responsive + touch deadman |
| `src/components/editor/LiveFiringPanel.tsx` | Edit — add 4 new mode tabs |
| `src/components/editor/live-firing/types.ts` | Edit — extend FXCMode |
| `src/components/editor/MobileTabBar.tsx` | Edit — add controller/map tabs |
| `src/components/editor/PanelTabBar.tsx` | Edit — register new panel IDs |

## Key Improvements Over Previous Plan
1. **ConnectionManagerPanel** — missing from original; needed to manage multiple simultaneous serial connections (FireOne 9600 + PBUS 19200 + DMX 250000 on different ports)
2. **E-STOP long-press confirmation** — prevents accidental emergency stops from stray taps on mobile
3. **DEADMAN visual countdown ring** — 800ms press-and-hold with animated ring feedback so operator knows exactly when deadman activates
4. **FXbutton slide-to-unlock** — gesture-based safety interlock prevents accidental mobile fires
5. **Field Map distance rulers** — auto-calculated safety distances from modules to audience zones
6. **Auto-detect device profiles** — serial port VID/PID matching to auto-identify connected hardware type
7. **Connection health monitoring** — packet loss %, latency, auto-reconnect per connection

## Technical Notes
- All virtual controllers work in SIM mode by default; when hardware connected, commands route to real serial ports
- Touch DEADMAN uses `onTouchStart` with 800ms `setTimeout` + `navigator.vibrate([100])`, release on `onTouchEnd`/`onTouchCancel`
- Field Map 2D uses HTML Canvas for performance (60+ markers at 3Hz refresh)
- Multiple serial ports supported simultaneously via separate `WebSerial` port instances
- WebSerial requires published URL (not iframe preview) for full functionality; Art-Net relay mode works in preview

