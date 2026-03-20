# sACN Bridge — E1.31 Multicast

Receives sACN (E1.31) DMX data from grandMA3 or any sACN source via UDP multicast and forwards it to the FXcommander browser app via WebSocket.

## How it works

```
grandMA3 sACN Output ──UDP multicast 239.255.x.x:5568──► Bridge ──WS JSON──► Browser (sacnEngine.ts)
```

## Quick Start

```bash
# Zero dependencies — uses only Node.js built-in modules
node sacn-bridge.js
```

## Options

| Flag          | Default       | Description                          |
|---------------|---------------|--------------------------------------|
| `--port`      | `9003`        | WebSocket listen port                |
| `--bind`      | `0.0.0.0`    | Local bind address                   |
| `--interface` | `0.0.0.0`    | Multicast interface IP               |
| `--verbose`   | off           | Show packet info per sACN frame      |

## Examples

```bash
# Default
node sacn-bridge.js

# Specify multicast interface (useful with multiple NICs)
node sacn-bridge.js --interface 192.168.1.50

# Verbose mode
node sacn-bridge.js --verbose
```

## WebSocket Protocol

Connect to `ws://localhost:9003` and send JSON messages.

### Subscribe to Universes
```json
{ "type": "subscribe", "universes": [1, 2, 3] }
```
→ Response: `{ "type": "subscribed", "universes": [1, 2, 3] }`

### Unsubscribe
```json
{ "type": "unsubscribe", "universes": [2] }
```

### Receive sACN Data
The bridge sends JSON for every received sACN frame:
```json
{
  "type": "sacn_data",
  "universe": 1,
  "priority": 100,
  "sequence": 42,
  "sourceName": "grandMA3",
  "channels": [255, 128, 0, 0, 255, ...]
}
```

### Universe Discovery
```json
{ "type": "discover" }
```
→ Response: `{ "type": "discovery", "universes": [1, 2, 5] }`

On connect, the bridge automatically sends a discovery message with all previously seen universes.

## grandMA3 Setup

1. On the MA3 console: **Setup → Network → Protocols → sACN**
2. Enable sACN Output
3. Configure output universes (1-based)
4. Ensure the bridge machine is on the same network segment (multicast requires L2 connectivity)

## Network Requirements

- **Multicast**: The bridge must be on the same LAN segment as the MA3 console, or use an IGMP-capable router/switch
- **Port**: UDP 5568 must be allowed through any firewalls
- **Docker**: Use `network_mode: host` for the container to receive multicast traffic

## Troubleshooting

- **No packets**: Verify MA3 sACN output is enabled and universes are configured
- **Multicast not working**: Try specifying `--interface` with your NIC's IP address
- **Docker**: Must use host networking for multicast; bridge networking won't forward multicast
