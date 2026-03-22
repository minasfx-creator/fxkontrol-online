

# FireOne Multi-Transport Communication Engine

## Current State

The system already has a solid `FireOneController` class (`fireoneProtocol.ts`) with full protocol support: ARM/FIRE/DISARM, UltraFire download, Priority Disable, IFMx-i32Q DMX output, wireless RSSI polling, and preset firing. The hook `useFireOneHardware.ts` bridges this to React with radio fallback via `useRadioLink`.

**However, the controller is locked to a single transport: WebSerial (wired RS-485).** To act as a true virtual XLII+ controller, it needs a **multi-transport abstraction** that routes commands through whichever path is available — Cable, Radio, Wi-Fi (WebSocket to local relay), or Art-Net (for IFMx-i32Q DMX ports).

## Gap Analysis

| Transport | Status | What's Missing |
|-----------|--------|----------------|
| **RS-485 Cable** | Working | Single transport, no abstraction layer |
| **Radio (CC1101/SX1276)** | Partial | `useRadioLink` wraps frames but `FireOneController` doesn't use it natively — hook has ad-hoc fallback code |
| **Wi-Fi** | Missing | XLII+ manual documents Wi-Fi operation via wireless transceivers; no WebSocket/HTTP relay to local network XLII+ |
| **Art-Net** | Partial | `artnet-bridge` edge function exists but only for DMX universes, not FireOne protocol frames. IFMx-i32Q has built-in DMX but no Art-Net bridge for the RS-485 commands |

## Architecture

```text
┌─────────────────────────────────────────────────┐
│           FireOneController (singleton)          │
│  ┌───────────────────────────────────────────┐   │
│  │        FireOneTransportManager            │   │
│  │   ┌─────────┐ ┌─────────┐ ┌───────────┐  │   │
│  │   │ Serial  │ │  Radio  │ │   WiFi    │  │   │
│  │   │ RS-485  │ │ CC1101  │ │ WebSocket │  │   │
│  │   └─────────┘ └─────────┘ └───────────┘  │   │
│  │   ┌─────────┐ ┌─────────────────────────┐ │   │
│  │   │ Art-Net │ │ Priority Router         │ │   │
│  │   │ DMX Out │ │ Cable > WiFi > Radio    │ │   │
│  │   └─────────┘ └─────────────────────────┘ │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Changes

### 1. `src/lib/fireoneTransport.ts` (NEW) — Transport Abstraction Layer

Create a `FireOneTransport` interface and implementations for each path:

```typescript
interface FireOneTransport {
  id: string;
  type: 'serial' | 'radio' | 'wifi' | 'artnet';
  priority: number; // lower = preferred (serial=1, wifi=2, radio=3)
  connected: boolean;
  latencyMs: number;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: Uint8Array): Promise<void>;
  onReceive(callback: (data: Uint8Array) => void): void;
}
```

**Implementations:**
- `SerialTransport` — wraps existing WebSerial logic from `FireOneController.connect()`
- `RadioTransport` — wraps `radioProtocol.ts` `wrapProtocolFrame()`, uses `useRadioLink` dongle connection
- `WiFiTransport` — WebSocket client connecting to a local relay (Node.js/Python on field laptop that bridges WebSocket↔RS-485)
- `ArtNetTransport` — for IFMx-i32Q DMX output only, routes `DMX_OUT` commands via Art-Net bridge

**Transport Manager:**
- `FireOneTransportManager` holds all transports, auto-selects best by priority
- E-STOP sends on ALL transports simultaneously (per XLII+ safety standard)
- Auto-fallback: if primary transport fails, seamlessly switch to next
- Heartbeat on all active transports

### 2. `src/lib/fireoneProtocol.ts` — Refactor Controller to use TransportManager

- Extract serial connect/disconnect/send/read logic into `SerialTransport`
- Replace `this.conn` with `TransportManager` instance
- `send()` delegates to manager's best transport
- `emergencyStop()` broadcasts on ALL transports
- Read loop runs on each transport independently, all feed into same `processIncoming()`
- Add `getTransportStatus()` method returning all transport states

### 3. `src/lib/fireoneWiFiRelay.ts` (NEW) — Wi-Fi Transport

Per XLII+ manual: wireless operation uses FHSS transceivers. Our virtual equivalent uses WebSocket to a local relay:

- `WiFiRelayTransport` connects to `ws://<relay-ip>:9485` (configurable)
- Relay protocol: JSON envelope `{ type: 'fireone-frame', data: base64(frame) }` or binary WebSocket frames
- Auto-discovery via mDNS-style broadcast (relay announces itself)
- Reconnect with exponential backoff
- Latency measurement via ping/pong

### 4. `src/lib/fireoneArtNetBridge.ts` (NEW) — Art-Net DMX for IFMx-i32Q

IFMx-i32Q modules have built-in DMX output ports. This transport:
- Routes only `DMX_OUT` commands via Art-Net (not firing commands)
- Uses existing `artnet4Engine.ts` packet builders
- Sends via `artnet-bridge` edge function or direct UDP (when local relay available)
- Maps module address to Art-Net universe (module N → universe N)

### 5. `src/hooks/useFireOneHardware.ts` — Expose transport layer

- Remove ad-hoc radio fallback code (now handled by TransportManager)
- Add `transports` state: array of `{ id, type, connected, latencyMs, priority }`
- Add `addTransport(type, config)` / `removeTransport(id)` methods
- Add `connectWiFi(relayIp)` convenience method
- Add `connectArtNet(targetIp)` convenience method
- `connectionPath` becomes multi-path: can have Cable+WiFi+Radio simultaneously

### 6. `src/components/editor/ConnectionManagerPanel.tsx` — Multi-Transport UI

Update FireOne connection entry to show multiple transports:
- Each transport as a sub-row with status indicator (green/yellow/red)
- "Add Wi-Fi Relay" button → prompts for relay IP
- "Add Art-Net Bridge" → prompts for Art-Net node IP
- Priority ordering visible (drag to reorder)
- E-STOP indicator showing "broadcasts on N transports"

### 7. DMX Relay R12 + Splitter 8 Integration

Add Showven DMX Relay R12 as a recognized device in the SFX channel system:
- 12 output channels, safety channel (CH-S), threshold 100-255 = ON
- Auto-configure DMX address when detected via Art-Net discovery
- Splitter 8 is transparent (no protocol changes needed)

## Files Summary

| File | Change |
|------|--------|
| `src/lib/fireoneTransport.ts` | NEW — Transport interface + SerialTransport + RadioTransport + TransportManager |
| `src/lib/fireoneWiFiRelay.ts` | NEW — WiFi WebSocket transport for local relay |
| `src/lib/fireoneArtNetBridge.ts` | NEW — Art-Net bridge for IFMx-i32Q DMX output |
| `src/lib/fireoneProtocol.ts` | Refactor FireOneController to use TransportManager |
| `src/hooks/useFireOneHardware.ts` | Remove ad-hoc fallback, expose multi-transport API |
| `src/components/editor/ConnectionManagerPanel.tsx` | Multi-transport UI per FireOne connection |

