

# Plan: MVR-xchange Bridge + sACN Real-Time Monitor + MA3 Completion

## What's Missing

1. **No MVR-xchange Node.js bridge** — `mvrXchange.ts` connects to `ws://localhost:9004` but there's no bridge script. The browser can never discover real grandMA3 consoles.
2. **sACN monitoring is basic** — only shows a 64-channel mini bar and a flat 512-grid. No activity sparkline, no color-coded heat, no per-channel hover detail with DMX %.
3. **MVR-xchange has no mDNS discovery** — the bridge needs to use DNS-SD/mDNS to find `_mvrxchange._tcp` services on the LAN (how grandMA3 announces itself per ANSI E1.67).

## Changes

### 1. Create `platform/tools/mvr-xchange-bridge/mvr-xchange-bridge.js`
Zero-dependency Node.js bridge on **port 9004**:
- **mDNS listener** on UDP 5353 for `_mvrxchange._tcp.local` service announcements (grandMA3 broadcasts these)
- **TCP client** connects to discovered MA3 stations on their advertised port (typically 9100)
- **MVR-xchange protocol**: send/receive JSON messages (mvr_join, mvr_leave, mvr_commit, mvr_request) per ANSI E1.67
- **WebSocket server** on port 9004 relaying discovered stations + messages to the browser
- When MVR commit received from MA3: accept the file transfer, parse fixture list, forward `mvr_fixtures` event to browser
- Health endpoint at `/health`

### 2. Create `platform/tools/mvr-xchange-bridge/README.md`

### 3. Edit `platform/docker-compose.yml`
- Add `mvr-xchange-bridge` service on port 9004, `network_mode: host` (needed for mDNS multicast)

### 4. Create `src/components/editor/SACNMonitorPanel.tsx` — Full sACN Real-Time Monitor
Dedicated panel (also usable as a tab or standalone):
- **Universe selector** with auto-discovered universes from bridge
- **512-channel grid** with color-coded cells (black→blue→cyan→white heat ramp based on value)
- **Channel hover tooltip**: shows Ch number, DMX value (0-255), percentage, and mapped SFX channel name if any
- **Activity sparkline** per universe: rolling 60-second graph showing channel change rate (packets/sec)
- **Channel bar chart**: horizontal bars for first 64 channels with labels (like a mini DMX monitor)
- **Source info**: priority, sequence, source name, FPS counter, merge mode indicator
- **Highlight active**: channels with value > 0 pulse subtly; channels that changed in last 500ms have a flash border
- **Group view**: toggle between flat 512 grid and 32×16 block layout grouped by fixture type

### 5. Edit `src/components/editor/MA3ControlPanel.tsx` — Integrate sACN Monitor
- Add 4th tab: **"Monitor"** that renders `SACNMonitorPanel` inline
- In MVR tab: show mDNS discovery status badge ("Scanning LAN...") and auto-discovered console details (IP, port, firmware version from provider string)
- Add "Auto-Connect" toggle in MVR that attempts to connect to the first discovered MA3 station automatically

### 6. Edit `src/lib/mvrXchange.ts` — mDNS Discovery Events
- Add new event type `'mdns-discovered'` with discovered service info (name, ip, port, provider)
- Add `handleMessage` case for `'mdns_service'` messages from the bridge
- Add `requestDiscovery()` method that sends `{ type: 'discover' }` to the bridge to trigger a fresh mDNS scan

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `platform/tools/mvr-xchange-bridge/mvr-xchange-bridge.js` | Create | mDNS + MVR-xchange TCP ↔ WS bridge |
| `platform/tools/mvr-xchange-bridge/README.md` | Create | Docs |
| `platform/docker-compose.yml` | Edit | Add mvr-xchange-bridge service |
| `src/components/editor/SACNMonitorPanel.tsx` | Create | Full 512-ch real-time monitor |
| `src/components/editor/MA3ControlPanel.tsx` | Edit | Add Monitor tab + mDNS status |
| `src/lib/mvrXchange.ts` | Edit | mDNS discovery events + methods |

## Architecture
```text
┌──────────┐  mDNS 5353   ┌─────────────────┐  TCP 9100    ┌──────────┐
│ LAN      │ ◄──────────► │ MVR-xchange     │ ◄──────────► │ grandMA3 │
│ multicast│              │ Bridge :9004    │  MVR JSON    │ Console  │
└──────────┘              └────────┬────────┘              └──────────┘
                                   │ WS JSON
                          ┌────────▼────────┐
                          │ Browser         │
                          │ mvrXchange.ts   │
                          └─────────────────┘
```

