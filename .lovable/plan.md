

# Plan: OSC & sACN Node.js Bridges + Remaining Integration Gaps

## Analysis Summary

After thorough review, the FireOne integration is **solid** — ARM/FIRE/PANIC routes to hardware, diagnostics include PBUS+FireOne, FleetManagementPanel has a Hardware tab, etc. The MA3 panel is well-built with OSC control, sACN bridge, and MVR-xchange tabs.

**Remaining gaps are primarily the missing Node.js bridge scripts** that the browser-side engines (oscEngine.ts, sacnEngine.ts) connect to via WebSocket. Without these, the MA3 integration is non-functional on real hardware.

## Changes

### 1. Create `platform/tools/osc-bridge/osc-bridge.js` — OSC UDP ↔ WebSocket Bridge (port 9002)
Following the same architecture as `artnet-relay.js` (raw HTTP + RFC 6455 minimal frame parser, zero npm deps):
- **WebSocket server** on port 9002 accepting browser connections
- **UDP socket** for sending OSC packets to MA3 console (default: 192.168.1.100:8000)
- **UDP listener** on port 9000 to receive OSC responses from MA3
- On WS connect, client sends JSON `{ type: 'config', host, txPort, rxPort }` to configure target
- **WS → UDP path**: Receive raw binary OSC from browser, forward as UDP to MA3 IP:txPort
- **UDP → WS path**: Receive UDP OSC packets on rxPort, forward raw binary to all connected WS clients
- CLI args: `--port 9002`, `--target 192.168.1.100`, `--tx-port 8000`, `--rx-port 9000`, `--bind 0.0.0.0`
- Health endpoint at `/health` showing packet stats, connected clients, target IP

### 2. Create `platform/tools/osc-bridge/README.md` — Usage documentation

### 3. Create `platform/tools/sacn-bridge/sacn-bridge.js` — sACN E1.31 UDP Multicast → WebSocket Bridge (port 9003)
Zero-dependency Node.js script:
- **Multicast listener** joining sACN multicast groups (239.255.{hi}.{lo} per E1.31 spec, derived from universe number)
- **WebSocket server** on port 9003 accepting browser connections
- On WS connect, client sends JSON `{ type: 'subscribe', universes: [1, 2, ...] }` to select universes
- On `subscribe`: join corresponding multicast groups, start forwarding
- On `unsubscribe`: leave multicast groups
- **UDP → WS path**: Parse E1.31 packet headers, extract universe/priority/sequence/sourceName/channels, forward as either:
  - Raw binary (full E1.31 packet) for clients that parse it themselves
  - JSON `{ type: 'sacn_data', universe, priority, sequence, sourceName, channels: [...] }` for easy consumption
- **Universe auto-discovery**: Listen on all sACN multicast range, report new universes to clients
- CLI args: `--port 9003`, `--bind 0.0.0.0`, `--interface 0.0.0.0` (multicast interface)
- Health endpoint at `/health`

### 4. Create `platform/tools/sacn-bridge/README.md` — Usage documentation

### 5. Edit `platform/docker-compose.yml` — Add OSC & sACN bridge services
- Add `osc-bridge` service on port 9002 with configurable MA3 IP
- Add `sacn-bridge` service on port 9003 with host network mode (needed for multicast)

### 6. Edit `src/components/editor/MA3ControlPanel.tsx` — MA3 Integration Enhancements
- Add **sACN universe auto-discovery**: show newly detected universes from bridge
- Add **connection status tooltips** showing bridge URLs and packet rates
- Add **OSC address filter** in the log view (filter by address pattern)
- Add **sACN channel value inspector**: hover on a channel cell in the 512-grid to show value + DMX %
- Add **MA3 fixture type presets** in settings: common MA3 fixture mappings (dimmer, RGB, RGBW) for quick sACN channel mapping
- Add **Export/Import mappings** button to save/restore sACN→SFX channel mapping configurations

### 7. Edit `src/lib/oscEngine.ts` — Add MA3 Feedback Helpers
- Add `buildMA3TimecodeSync(hours, minutes, seconds, frames)` for SMPTE→MA3 timecode sync via OSC
- Add `parseMA3FeedbackMessage(msg)` helper to decode common MA3 feedback addresses

### 8. Edit `src/components/editor/SMPTEPanel.tsx` — MA3 Timecode Sync
- Add "Sync to MA3" toggle alongside existing FireOne/PBUS toggles
- When enabled, send timecode to MA3 via OSC `/gma3/cmd` with `SetUserVar "tc" "{timecode}"` at 10Hz
- This allows MA3 macros to follow the show timeline

## Files Summary

| File | Action | Key Purpose |
|------|--------|-------------|
| `platform/tools/osc-bridge/osc-bridge.js` | Create | OSC UDP ↔ WS bridge (port 9002) |
| `platform/tools/osc-bridge/README.md` | Create | Usage docs |
| `platform/tools/sacn-bridge/sacn-bridge.js` | Create | sACN multicast → WS bridge (port 9003) |
| `platform/tools/sacn-bridge/README.md` | Create | Usage docs |
| `platform/docker-compose.yml` | Edit | Add bridge services |
| `src/components/editor/MA3ControlPanel.tsx` | Edit | UI enhancements + auto-discovery |
| `src/lib/oscEngine.ts` | Edit | MA3 timecode + feedback helpers |
| `src/components/editor/SMPTEPanel.tsx` | Edit | MA3 timecode sync toggle |

## Architecture

```text
┌─────────────┐    WebSocket     ┌──────────────┐    UDP 8000/9000   ┌──────────────┐
│  Browser     │ ──────────────► │  OSC Bridge  │ ◄────────────────► │  grandMA3    │
│  oscEngine   │    port 9002    │  Node.js     │    OSC packets     │  Console     │
└─────────────┘                  └──────────────┘                    └──────────────┘

┌─────────────┐    WebSocket     ┌──────────────┐    UDP Multicast   ┌──────────────┐
│  Browser     │ ◄────────────── │  sACN Bridge │ ◄──────────────── │  grandMA3    │
│  sacnEngine  │    port 9003    │  Node.js     │  239.255.x.x:5568 │  sACN Output │
└─────────────┘                  └──────────────┘                    └──────────────┘
```

## Technical Notes
- Both bridges follow the exact same zero-dependency pattern as `artnet-relay.js` (raw HTTP upgrade, RFC 6455 framing)
- sACN multicast requires the bridge to run on the same network segment as the MA3 console (or use a multicast router)
- The OSC bridge is fully bidirectional — browser sends OSC to MA3, MA3 responses come back to browser
- sACN bridge supports both raw binary forwarding (for sacnEngine.ts `handleSACNData`) and JSON mode (for `processUniverseData`)
- Docker compose uses `network_mode: host` for sACN bridge to receive multicast traffic

