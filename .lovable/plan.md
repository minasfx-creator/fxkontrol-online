

# Plan: Multi-Transport Control System — Radio, Bluetooth, NFC, Apple Tech, Art-Net 4, USB-C DMX

## Summary

Expand the connection infrastructure with 5 new transport layers: Web Bluetooth (BLE for wireless DMX/firing), Web NFC (instant device pairing), Art-Net 4 full compliance (RDM, targeted mode, ArtPoll), USB-C/Lightning wired DMX output for iPhone, and Supabase Realtime remote control. All transports register into the existing ConnectionManagerPanel as unified entries.

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│              Connection Manager (Hub)                │
├──────────┬──────────┬────────┬─────────┬────────────┤
│ WebSerial│ Bluetooth│  NFC   │ Art-Net │  Realtime  │
│ USB/Radio│   BLE    │ Pairing│  4/RDM  │  Remote    │
│ PBUS/F1  │ DMX/Fire │ Config │  sACN   │  Mobile→PC │
└──────────┴──────────┴────────┴─────────┴────────────┘
          ↓ all route through ↓
     Unified CommandPacket Protocol
```

## Changes

### 1. New: `src/lib/bluetoothEngine.ts` — Web Bluetooth BLE Transport

- **BLE DMX Profile**: Service UUID for wireless DMX controllers (e.g., Luminair, LumenRadio CRMX BLE, Blackout BLE-DMX)
- `scanBluetoothDevices()` — calls `navigator.bluetooth.requestDevice()` with filters for DMX/pyro service UUIDs
- `connectBLEDevice(device)` — establishes GATT connection, discovers services/characteristics
- `sendBLEDMX(channels[])` — writes DMX data to BLE characteristic (512 bytes max per write, chunked)
- `sendBLEFireCommand(module, cue)` — writes firing packet to BLE-connected firing module
- `BLEDeviceProfile` type with known devices: CRMX BLE, ShowBaby, Astera ART7, generic BLE-DMX
- `onBLENotification(callback)` — subscribes to characteristic notifications for telemetry/status
- `isWebBluetoothSupported()` check
- Apple-compatible: Web Bluetooth works on Chrome/Edge; for native iOS via Capacitor, uses `@capacitor-community/bluetooth-le` plugin

### 2. New: `src/lib/nfcEngine.ts` — Web NFC Instant Pairing

- `isWebNFCSupported()` — checks `'NDEFReader' in window`
- `startNFCScan()` — creates `NDEFReader`, calls `scan()`, returns device config from NDEF records
- `writeNFCConfig(deviceConfig)` — writes device address, channel, frequency config to NFC tag
- Use cases:
  - **Tap to pair**: Tap phone on C16/X4 module NFC tag → auto-reads address, cue map, band config
  - **Tap to configure**: Write new address/channel to module's NFC tag
  - **Tap to arm**: Security NFC tag scan required before arming (2FA-style)
- `NFCDeviceRecord` type: `{ deviceType, address, band, channelMap, customerId }`
- Note: Web NFC only works on Android Chrome. For iOS, requires Capacitor native plugin (`@nicoherbigerat/capacitor-nfc`)

### 3. New: `src/lib/artnet4Engine.ts` — Art-Net 4 Full Compliance

Current `artnet-bridge` edge function only supports ArtDmx. Expand to full Art-Net 4:
- **ArtPoll / ArtPollReply**: Node discovery on the network — broadcast ArtPoll, parse replies to discover Art-Net nodes (IP, ports, universe config, firmware version)
- **ArtRdm / ArtRdmSub**: RDM over Art-Net — device identification, DMX address assignment, lamp commands
- **ArtSync**: Frame synchronization — send ArtSync after all universe ArtDmx packets for glitch-free output
- **ArtAddress**: Remote universe/port configuration of nodes
- **Targeted Mode**: Send ArtDmx only to nodes that responded to ArtPoll (unicast vs broadcast)
- **ArtInput**: Enable/disable input ports on nodes
- OpCode constants for all Art-Net 4 packet types
- `buildArtPollPacket()`, `buildArtSyncPacket()`, `buildArtRdmPacket()`, `parseArtPollReply()`
- Art-Net 4 uses protocol version 14, port 6454 UDP — same as current, but with extended feature flags

### 4. New: `src/lib/wiredDmxEngine.ts` — USB-C / Lightning DMX Output

- Supports iPhone/iPad connected to DMX via USB-C adapter + ENTTEC/Eurolite interface
- Uses WebSerial API (same as existing `usbEngine.ts`) but with specific profiles for:
  - **ENTTEC Open DMX USB** (FTDI @ 250kbaud, break timing)
  - **ENTTEC DMX USB Pro** (widget protocol with packet framing)
  - **Eurolite USB-DMX512 Pro MK2**
  - **DMXking ultraDMX Micro**
- `openDMXOutput(port)` — configures serial port for DMX timing (250kbaud, 8N2)
- `sendDMXFrame(channels[])` — builds DMX512 frame with break, MAB, and channel data
- `startDMXStream(universeData, fps)` — continuous output at configurable frame rate (default 44fps)
- For iOS native app (Capacitor): wraps `@nicoherbigerat/capacitor-usb-serial` for direct serial access
- Adds these as new `USBDeviceProfile` entries in `usbEngine.ts`

### 5. `src/lib/remoteCommandEngine.ts` — Core Remote Protocol (New)

As previously planned:
- `CommandPacket` type, `generateSessionCode()`, `createRemoteSession()`
- Supabase Realtime broadcast channel `remote:{code}`
- Actions: `transport`, `panel`, `camera`, `effect`, `undo`, `redo`, `panic`
- Presence tracking for connected devices
- State sync every 500ms from PC → mobile

### 6. New: `src/components/editor/RemoteControlPanel.tsx` — Mobile Controller

- Connection section with 6-digit code entry
- Large transport buttons (Play/Pause/Stop/Seek)
- Panel switcher grid
- Camera orbit touch pad (throttled 20/sec)
- SFX fire triggers
- Full-width PANIC button

### 7. New: `src/components/editor/RemoteReceiverOverlay.tsx` — Desktop Receiver

- Floating overlay showing session code
- Connected device count
- Command log (last 8)
- Executes commands via store actions
- Green pulse when connected

### 8. `src/components/editor/ConnectionManagerPanel.tsx` — Add new transports

Add connection entries for:
- **Bluetooth BLE** — scan, connect, status, RSSI
- **NFC** — scan status, last scanned tag
- **Art-Net 4 Network** — discovered nodes count, RDM status
- **USB-C DMX** — wired DMX output status, universe, FPS
- **Remote Control** — session code, connected mobiles

### 9. `src/components/editor/PanelTabBar.tsx` — Register new panels

Add to `PanelId` union: `'bluetooth'`, `'nfc'`, `'remotecontrol'`, `'dmxoutput'`

Add to Conexoes section:
- `{ id: 'bluetooth', label: 'Bluetooth BLE', icon: Bluetooth }`
- `{ id: 'nfc', label: 'NFC Pair', icon: Nfc }`
- `{ id: 'remotecontrol', label: 'Remote Control', icon: Smartphone }`
- `{ id: 'dmxoutput', label: 'DMX Output', icon: Cable }`

### 10. `src/components/editor/MobileTabBar.tsx` — Add remote tab

Add `'remote'` tab with Smartphone icon → opens `remotecontrol` panel

### 11. `src/pages/Index.tsx` — Wire new panels

- Import and render `BluetoothPanel`, `NFCPairPanel`, `RemoteControlPanel`, `RemoteReceiverOverlay`, `DMXOutputPanel`
- `RemoteReceiverOverlay` always mounted on desktop

### 12. New: `src/components/editor/BluetoothPanel.tsx` — BLE Dashboard

- Scan button, discovered devices list with RSSI bars
- Connect/disconnect per device
- Service/characteristic browser
- DMX channel preview for connected BLE-DMX devices
- Battery level display (if BLE Battery Service available)

### 13. New: `src/components/editor/NFCPairPanel.tsx` — NFC Pairing UI

- "Tap to Scan" large button with phone NFC animation
- Last scanned device info card
- Write config form (address, channel, band)
- Scan history log
- Compatibility notice (Android only for web, iOS via native app)

### 14. New: `src/components/editor/DMXOutputPanel.tsx` — Wired DMX Dashboard

- Port selector (WebSerial device picker)
- Universe selector (1-16)
- FPS slider (1-44)
- Live channel monitor (512 channels grid)
- Start/Stop streaming toggle
- Adapter auto-detection (ENTTEC Open vs Pro vs Eurolite)

### 15. `supabase/functions/artnet-bridge/index.ts` — Art-Net 4 extensions

Add handlers for:
- `action: 'poll'` → build and return ArtPoll packet
- `action: 'sync'` → build ArtSync packet
- `action: 'rdm'` → build ArtRdm packet with device UID and RDM command
- `action: 'discover'` → return parsed ArtPollReply data from local network scan

## Apple Technology Compatibility Matrix

| Technology | Safari/iOS Web | Capacitor Native | Status |
|-----------|---------------|-----------------|--------|
| Web Bluetooth | Not supported | `@capacitor-community/bluetooth-le` | Native only |
| Web NFC | Not supported | `@nicoherbigerat/capacitor-nfc` | Native only |
| WebSerial (USB-C DMX) | Not supported | `capacitor-usb-serial` | Native only |
| Supabase Realtime | Full support | Full support | Works everywhere |
| Art-Net (UDP) | Edge function relay | Native UDP socket | Both |
| AirDrop-style | Not available | Multipeer Connectivity | Future |

For full Apple device support, the Capacitor native app path is required for BLE, NFC, and USB-C DMX. The web version works for Supabase Realtime remote control and Art-Net via edge function relay.

## Files Summary

| File | Change |
|------|--------|
| `src/lib/bluetoothEngine.ts` | New — Web Bluetooth BLE transport |
| `src/lib/nfcEngine.ts` | New — Web NFC pairing engine |
| `src/lib/artnet4Engine.ts` | New — Art-Net 4 full protocol (Poll, Sync, RDM, Address) |
| `src/lib/wiredDmxEngine.ts` | New — USB-C/Lightning DMX output engine |
| `src/lib/remoteCommandEngine.ts` | New — Supabase Realtime remote protocol |
| `src/components/editor/BluetoothPanel.tsx` | New — BLE device dashboard |
| `src/components/editor/NFCPairPanel.tsx` | New — NFC pairing UI |
| `src/components/editor/DMXOutputPanel.tsx` | New — Wired DMX output dashboard |
| `src/components/editor/RemoteControlPanel.tsx` | New — Mobile remote controller |
| `src/components/editor/RemoteReceiverOverlay.tsx` | New — Desktop command receiver |
| `src/components/editor/ConnectionManagerPanel.tsx` | Add BLE, NFC, Art-Net 4, DMX Out, Remote entries |
| `src/components/editor/PanelTabBar.tsx` | Add bluetooth, nfc, remotecontrol, dmxoutput panels |
| `src/components/editor/MobileTabBar.tsx` | Add remote tab |
| `src/pages/Index.tsx` | Wire all new panels + receiver overlay |
| `supabase/functions/artnet-bridge/index.ts` | Add Art-Net 4 poll/sync/rdm handlers |

