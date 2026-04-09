

# Ciclo #63 — Sprint 10: Network Health Monitor

## What Exists

| Component | Status |
|---|---|
| `FieldBus` singleton | Multi-transport (wifi/rs485/relay), heartbeat monitoring, failover |
| `RealtimeClient` singleton | WebSocket with exponential backoff reconnect (max 10 retries) |
| `CommandRelay` | Supabase Realtime broadcast for command sync |
| `MultiSiteCoordinator` | Presence-based site tracking with latency estimation |
| `ShowCommanderPanel` | 5 tabs (Overview, Cue Stack, Systems, Safety, Profiler) |
| `Sparkline` component | Reusable SVG trend line |
| `blackbox` recorder | Event logging for reliability |

## Deliverables

### 1. NetworkHealthService — `src/core/network/NetworkHealthService.ts`

Module-level singleton that tracks network quality metrics:

- **RTT History**: Ring buffer of 300 samples (~5min at 1Hz ping), stores `{ timestamp, rttMs, transport }`. Pings via `fieldBus.heartbeat()` round-trip measurement
- **Packet Loss Tracking**: Sliding window (60s) counting sent vs acknowledged packets. Loss % = `(sent - acked) / sent * 100`
- **Transport Health**: Per-transport (wifi/rs485/relay) status with individual RTT and loss stats
- **Reconnection Manager**: Exponential backoff (1s → 30s, max 10 retries) with jitter. Hooks into `fieldBus` and `realtimeClient` for auto-reconnect
- **Alert Thresholds**:
  - RTT > 100ms sustained 5s → `LATENCY_HIGH`
  - Packet loss > 5% → `PACKET_LOSS_WARNING`
  - Packet loss > 15% → `PACKET_LOSS_CRITICAL`
  - All transports down → `NETWORK_DOWN`
- API: `getRTTHistory()`, `getPacketLossPercent()`, `getTransportHealth()`, `getActiveAlerts()`, `getReconnectState()`

### 2. NetworkHealthTab — `src/components/editor/network/NetworkHealthTab.tsx`

New tab in ShowCommander with three sections:

**A. RTT Timeline** — SVG line chart (Sparkline-style, expanded):
- Last 300 samples, color gradient (green <50ms, amber 50-100ms, red >100ms)
- Current RTT + p50/p95 badges
- 100ms budget line (dashed)

**B. Transport Status Grid** — Card per transport:
- Transport name + alive/dead badge
- Individual RTT + packet loss %
- Failover count from FieldBus
- Active transport highlighted

**C. Connection Status** — Live feed:
- Reconnection attempts with backoff timer
- Active alerts (color-coded)
- Total messages sent / bytes transferred from FieldBus state
- Uptime percentage

### 3. Integration — ShowCommanderPanel

Add "Network" tab (6th) with `Wifi` icon, lazy-load NetworkHealthTab.

## Files

| Action | File |
|--------|------|
| Create | `src/core/network/NetworkHealthService.ts` |
| Create | `src/components/editor/network/NetworkHealthTab.tsx` |
| Edit | `src/components/editor/ShowCommanderPanel.tsx` (add Network tab) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create NetworkHealthService |
| 2 | Create NetworkHealthTab component |
| 3 | Add Network tab to ShowCommanderPanel |
| 4 | Build verification |

