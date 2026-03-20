

# Plan: Radio Module Control via USB Antenna + Integration Refinement

## Overview
Create a dedicated **Radio Control Engine** that abstracts USB radio antenna dongles (CC1101-based 433/868MHz, SX1276 LoRa, nRF24L01+) connected via WebSerial as transparent bridges to field modules. This replaces the current assumption that PBUS/FireOne wireless goes through wired serial → host controller → RF. Instead, the PC/mobile connects a USB radio antenna directly and talks to field modules over the air — no ZK6200 or XL4+ host needed.

## Part A — Radio Antenna Engine

### 1. Create `src/lib/radioProtocol.ts` — Radio Link Layer
Low-level radio transceiver abstraction over WebSerial USB dongles:
- **Supported dongles**: CC1101 USB (TI 433/868MHz), SX1276 LoRa USB, nRF24L01+ USB, generic UART-RF bridges
- **Device profiles** with VID/PID auto-detection for known radio dongles
- **RadioTransceiver class**: `connect(port)`, `setFrequency(mhz)`, `setTxPower(dbm)`, `setDataRate(kbps)`, `send(addr, data)`, `onReceive(callback)`
- **Dual-band management**: switch between 433.92MHz and 868.35MHz channels, scan both bands for devices
- **Channel hopping**: configurable hop sequence for interference avoidance (8-channel pattern)
- **RSSI monitoring**: per-packet RSSI from dongle, running average per device address
- **Packet format**: `[SYNC 0xD5][LEN][DEST_ADDR][SRC_ADDR][SEQ][PAYLOAD...][CRC16]`
- **ACK/retry**: auto-retry 3x with 50ms backoff, track packet loss per device
- **Range test mode**: continuous ping to measure link quality at distance

### 2. Create `src/hooks/useRadioLink.ts` — Radio React Hook
High-level hook bridging `radioProtocol` + `pbusProtocol` + `fireoneProtocol`:
- `connectAntenna()` — open WebSerial to USB radio dongle, auto-detect type
- `scanDevices()` — broadcast discovery on both 433M and 868M, merge results
- `sendPBus(addr, cmd, payload)` — wrap PBUS frame in radio packet and transmit
- `sendFireOne(addr, cmd, payload)` — wrap FireOne frame in radio packet and transmit
- `setChannel(freq)` / `setBand(band)` / `setPower(dbm)`
- Expose: `antenna`, `devices`, `rssiMap`, `packetStats`, `isScanning`, `activeBand`
- Auto-route: if radio antenna connected, all PBUS/FireOne commands go via radio instead of wired serial
- Fallback: if radio fails, attempt wired serial path

### 3. Create `src/components/editor/RadioControlPanel.tsx` — Radio Dashboard
Dedicated panel for radio antenna management and field module control:
- **Antenna status**: dongle type, frequency, TX power (dBm slider: -10 to +20), data rate, channel
- **Band selector**: 433MHz / 868MHz / Auto / LoRa with visual frequency indicator
- **Device scanner**: "Scan" button with progress bar, discovered devices populate list
- **Device list**: each device shows address, type (C16/IFMx/PyroMote), RSSI bar, battery, armed state
- **Range test**: select device → continuous ping with RSSI graph (last 60 samples) + packet loss %
- **Channel hopping config**: enable/disable, hop interval, channel list editor
- **TX Power control**: slider with mW/dBm display, legal limit warning per region (EU 868: +14dBm, US 433: +10dBm)
- **Direct fire from radio**: when device selected, show cue grid with ARM/FIRE (same as PBusMonitorPanel but routed via radio)
- **Signal coverage map**: link to FieldMap2D with radio RSSI overlay
- Mobile: full-screen with large touch targets, simplified band/power controls

### 4. Edit `src/lib/usbEngine.ts` — Add Radio Dongle Profiles
- Add `'radio'` to `USBDeviceType`
- Add profiles for known USB radio dongles:
  - CC1101 USB: VID 0x1A86, PID 0x7523 (CH340), 38400 baud
  - SX1276 LoRa USB: VID 0x10C4, PID 0xEA60 (CP2102), 115200 baud
  - nRF24L01+ USB: VID 0x1A86, PID 0x7523, 57600 baud
  - Generic UART-RF: 9600 baud default

### 5. Edit `src/hooks/usePBusHardware.ts` — Radio Fallback
- Import `useRadioLink`
- When radio antenna is connected and PBUS wired serial is not: route all PBUS commands through radio link
- Add `connectionPath: 'wired' | 'radio' | 'artnet'` to state
- Discovery uses radio scan when antenna available

### 6. Edit `src/hooks/useFireOneHardware.ts` — Radio Fallback
- Import `useRadioLink`
- When radio antenna is connected and FireOne wired serial is not: route commands through radio link
- Add `connectionPath: 'wired' | 'radio'` to state

## Part B — Integration Refinement

### 7. Edit `src/components/editor/VirtualControllerHub.tsx` — Radio Connection Mode
- Add "Radio (USB Antenna)" as 5th connection type alongside USB/ArtNet/Wireless/Serial
- Show antenna status badge (connected/scanning/idle) in header
- When radio connected: all controller cards show "RADIO" badge, direct control without host controller

### 8. Edit `src/components/editor/ConnectionManagerPanel.tsx` — Radio Connection Entry
- Add radio antenna as a connection type with its own status card
- Show: frequency, TX power, channel, packet stats, device count
- "Scan Devices" button directly in connection card

### 9. Edit `src/components/editor/FieldMap2D.tsx` — Radio Coverage Overlay
- Add radio signal heatmap layer: visualize RSSI from radio antenna to each module
- Add antenna position marker (draggable) showing coverage radius
- Color gradient: green (>-60dBm) → amber (-60 to -80) → red (<-80dBm)

### 10. Edit `src/components/editor/LiveFiringPanel.tsx` — Add Radio Mode Tab
- Add `'radio'` to mode router, import and render `RadioControlPanel`
- Add Radio icon in mode bar

### 11. Edit `src/components/editor/live-firing/types.ts` — Add Radio Mode
- Add `'radio'` to `FXCMode` union type

## Files Summary

| File | Action |
|------|--------|
| `src/lib/radioProtocol.ts` | Create — radio transceiver engine |
| `src/hooks/useRadioLink.ts` | Create — radio React hook |
| `src/components/editor/RadioControlPanel.tsx` | Create — radio antenna dashboard |
| `src/lib/usbEngine.ts` | Edit — add radio dongle profiles |
| `src/hooks/usePBusHardware.ts` | Edit — radio fallback routing |
| `src/hooks/useFireOneHardware.ts` | Edit — radio fallback routing |
| `src/components/editor/VirtualControllerHub.tsx` | Edit — radio connection mode |
| `src/components/editor/ConnectionManagerPanel.tsx` | Edit — radio connection entry |
| `src/components/editor/FieldMap2D.tsx` | Edit — radio coverage overlay |
| `src/components/editor/LiveFiringPanel.tsx` | Edit — add radio mode tab |
| `src/components/editor/live-firing/types.ts` | Edit — add radio to FXCMode |

## Architecture

```text
┌─────────────┐    WebSerial     ┌──────────────┐    433/868 MHz    ┌─────────────┐
│  Browser     │ ──────────────► │  USB Radio   │ ◄──────────────► │ PyroSlave   │
│  (PC/Mobile) │    38400 baud   │  Dongle      │    OOK/FSK/LoRa  │ C16 / X4    │
│              │                 │  CC1101/SX127x│                  │ IFMx-i32Q   │
│  radioProto  │                 │              │                  │ PyroMote    │
│  → pbusProto │                 └──────────────┘                  │ FXbutton    │
│  → fireoneP  │                                                   └─────────────┘
└─────────────┘
     │ fallback
     ▼
┌─────────────┐    RS-485/PBUS   ┌──────────────┐
│  Wired Serial│ ──────────────► │ Host Ctrl    │
│  9600/19200  │                 │ XL4+/ZK6200  │
└─────────────┘                  └──────────────┘
```

## Technical Notes
- USB radio dongles present as serial ports (CH340/CP2102 chips) — WebSerial works directly
- Radio packet wraps the existing PBUS/FireOne frame as payload — field devices don't know the difference
- CC1101 supports both 433MHz and 868MHz via register config (single chip, dual-band)
- TX power legal limits enforced in UI: EU 868MHz = +14dBm (25mW), US 433MHz = +10dBm (10mW)
- Channel hopping pattern syncs with field devices via a known seed — prevents interference
- Range test sends 10-byte pings at 1Hz, measures round-trip RSSI and packet loss
- All existing wired serial paths remain functional — radio is an additional transport layer

