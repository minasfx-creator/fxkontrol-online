

# Plan: Add WiFi Direct Control Mode to Remote Command System

## Summary

Add a **WiFi Direct** connection mode alongside the existing cloud-based (Supabase Realtime) mode. When devices are on the same local network, they can connect via `BroadcastChannel` API (same browser/device) or a local WebSocket-like approach using the app's own URL as rendezvous. Since this is a web app (no native sockets), the practical same-WiFi approach is: **both devices open the same app URL and use Supabase Realtime but with an auto-discovered local session** — OR we use `BroadcastChannel` for same-device tabs.

**Realistic approach for a web app**: True peer-to-peer WiFi requires WebRTC or a local server, which a browser can't host. The best UX is:
1. **Auto-detect same network** via a lightweight check (compare public IP or use a shared beacon)
2. **Use Supabase Realtime regardless** (it already works on any network) but label the connection as "WiFi" when latency < 50ms, giving users confidence
3. **Add a "Scan WiFi" auto-pair** feature that skips the 6-digit code by broadcasting a discovery beacon on the Realtime channel

## Changes

### 1. `src/lib/remoteCommandEngine.ts` — Add WiFi auto-discovery mode

- Add `createWifiDiscoverySession()` that subscribes to a well-known channel `remote:wifi-discover` with presence
- When both devices join, they auto-exchange session codes and connect without manual entry
- Add `ConnectionMode` type: `'cloud' | 'wifi-auto'`
- The underlying transport is still Supabase Realtime (works on any network), but WiFi-auto skips the code entry

### 2. `src/components/editor/RemoteControlPanel.tsx` — Add connection mode selector + WiFi scan

- Add a **connection mode toggle** before the code input: "Cloud (Any Network)" vs "WiFi (Same Network)"
- **Cloud mode**: existing 6-digit code flow
- **WiFi mode**: shows "Scanning..." with a radar animation, auto-pairs when another device is found on the discovery channel
- Show connection quality indicator (latency badge: green < 30ms, yellow < 100ms, red > 100ms)
- Add Master/Slave role selector (from previous approved plan) with auto-default by device type
- Show network info when connected (WiFi name if available via `navigator.connection`)

### 3. `src/pages/Dashboard.tsx` — Update Mobile Command card

- Add "WiFi" and "Cloud" quick-select badges to the Mobile Command launcher
- WiFi option navigates to `/editor?panel=remotecontrol&mode=wifi`
- Cloud option navigates to `/editor?panel=remotecontrol&mode=cloud`

### 4. `src/pages/Index.tsx` — Parse `mode` param

- Read `searchParams.get('mode')` alongside `panel` and pass it as initial state to RemoteControlPanel

## Files Summary

| File | Change |
|------|--------|
| `src/lib/remoteCommandEngine.ts` | Add WiFi auto-discovery via shared beacon channel, `ConnectionMode` type |
| `src/components/editor/RemoteControlPanel.tsx` | Add mode selector (Cloud/WiFi), WiFi scan UI, Master/Slave selector, latency indicator |
| `src/pages/Dashboard.tsx` | Add WiFi/Cloud quick-select to Mobile Command card |
| `src/pages/Index.tsx` | Parse `mode` query param for remote control |

