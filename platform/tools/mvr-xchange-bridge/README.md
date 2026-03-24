# MVR-xchange Bridge

Node.js bridge that discovers grandMA3 consoles on the local network via **mDNS** (`_mvrxchange._tcp.local`) and relays **MVR-xchange** (ANSI E1.67) traffic between the TCP protocol and the browser via **WebSocket**.

## Architecture

```
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

## Usage

```bash
node mvr-xchange-bridge.js [options]
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `9004` | WebSocket listen port |
| `--bind` | `0.0.0.0` | Bind address |
| `--interface` | `0.0.0.0` | mDNS multicast interface |
| `--verbose` | `false` | Show all mDNS/MVR traffic |

### Health Check

```bash
curl http://localhost:9004/health
```

## WebSocket Protocol

### Browser → Bridge

```json
{ "type": "discover" }
{ "type": "connect_station", "uuid": "station-uuid" }
{ "type": "mvr_request", "stationUUID": "...", "fileUUID": "..." }
```

### Bridge → Browser

```json
{ "type": "mdns_service", "station": { "name": "MA3", "ip": "192.168.1.100", "port": 9100, "provider": "grandMA3 v2.1", "uuid": "..." } }
{ "type": "mvr_join", "stationName": "MA3", "stationUUID": "...", "provider": "grandMA3 v2.1", "ip": "192.168.1.100" }
{ "type": "mvr_commit", "stationName": "MA3", "fileUUID": "...", "fileName": "scene.mvr", "fileSize": 12345 }
{ "type": "mvr_leave", "stationUUID": "..." }
```

## Docker

```bash
docker compose up mvr-xchange-bridge
```

Requires `network_mode: host` for mDNS multicast support.
