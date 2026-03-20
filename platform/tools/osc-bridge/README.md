# OSC Bridge — grandMA3

Bidirectional bridge between the FXcommander web app and a real grandMA3 console via OSC (Open Sound Control).

## How it works

```
Browser (oscEngine.ts) ──WS binary──► Bridge ──UDP──► grandMA3 :8000
Browser (oscEngine.ts) ◄──WS binary── Bridge ◄──UDP── grandMA3 :9000
```

## Quick Start

```bash
# Zero dependencies — uses only Node.js built-in modules
node osc-bridge.js
```

## Options

| Flag         | Default           | Description                        |
|--------------|-------------------|------------------------------------|
| `--port`     | `9002`            | WebSocket listen port              |
| `--target`   | `192.168.1.100`   | MA3 console IP                     |
| `--tx-port`  | `8000`            | OSC send port (to MA3)             |
| `--rx-port`  | `9000`            | OSC receive port (from MA3)        |
| `--bind`     | `0.0.0.0`         | Local bind address                 |
| `--verbose`  | off               | Show packet hex dumps              |

## Examples

```bash
# Default — connect to MA3 at 192.168.1.100
node osc-bridge.js

# Specific MA3 console IP
node osc-bridge.js --target 10.0.0.50

# Custom ports matching MA3 config
node osc-bridge.js --target 192.168.1.100 --tx-port 8000 --rx-port 9000

# Verbose mode for debugging
node osc-bridge.js --verbose
```

## WebSocket Protocol

Connect to `ws://localhost:9002`.

### Configuration (Text frame, JSON)
```json
{ "type": "config", "host": "192.168.1.100", "txPort": 8000, "rxPort": 9000 }
```
→ Response: `{ "type": "config-ack", "host": "...", "txPort": 8000, "rxPort": 9000 }`

### OSC Messages (Binary frames)
Send raw OSC-encoded binary → forwarded as UDP to MA3.
Receive raw OSC binary from MA3 → forwarded to all WS clients.

### Health Check
```json
{ "type": "ping" }
```
→ Response: `{ "type": "pong", "txCount": 42, "rxCount": 18, "uptime": 120.5 }`

## grandMA3 Setup

1. On the MA3 console: **Setup → Network → Protocols → OSC**
2. Enable OSC Input/Output
3. Set **Output IP** to the machine running this bridge
4. Set **Output Port** to `9000` (matches `--rx-port`)
5. Set **Input Port** to `8000` (matches `--tx-port`)
6. In FXcommander, connect the MA3 panel to `ws://localhost:9002`

## Troubleshooting

- **No packets received**: Check MA3 OSC output settings and firewall rules (UDP 8000/9000)
- **Connection refused**: Ensure bridge is running on the correct network interface
- **High latency**: Use wired Ethernet, not WiFi, between bridge and MA3
