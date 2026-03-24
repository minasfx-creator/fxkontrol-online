# Art-Net UDP Relay

Bridge between the FXcommander web app and Art-Net hardware/software on your local network.

## How it works

```
Browser (FXcommander) ──WebSocket──→ Relay ──UDP──→ Art-Net Devices
                                                    (ArtNetominator, QLC+, DMXControl, etc.)
```

## Quick Start

```bash
# No dependencies required — uses only Node.js built-in modules
node artnet-relay.js
```

## Options

| Flag        | Default             | Description                     |
|-------------|---------------------|---------------------------------|
| `--port`    | `9001`              | WebSocket listen port           |
| `--target`  | `255.255.255.255`   | Art-Net target IP (broadcast)   |
| `--artnet`  | `6454`              | Art-Net UDP port                |
| `--bind`    | `0.0.0.0`           | Local bind address              |
| `--verbose` | off                 | Show hex dumps of each packet   |

## Examples

```bash
# Broadcast to all devices on the network
node artnet-relay.js

# Send to a specific Art-Net node
node artnet-relay.js --target 192.168.1.100

# Verbose mode with custom port
node artnet-relay.js --port 9002 --verbose

# Send to specific subnet
node artnet-relay.js --target 192.168.15.255
```

## WebSocket Protocol

Connect to `ws://localhost:9001` and send JSON messages:

### Send DMX Data
```json
{
  "action": "dmx",
  "universe": 0,
  "subnet": 0,
  "net": 0,
  "channels": [255, 128, 0, 0, 255, ...]
}
```

### Batch Send (multiple universes)
```json
{
  "action": "dmx-batch",
  "universes": [
    { "universe": 0, "subnet": 0, "net": 0, "channels": [255, ...] },
    { "universe": 1, "subnet": 0, "net": 0, "channels": [128, ...] }
  ]
}
```

### Health Check
```json
{ "action": "ping" }
```
→ Response: `{ "action": "pong", "packetsSent": 42, "uptime": 120.5 }`

## Testing with ArtNetominator

1. Start the relay: `node artnet-relay.js`
2. Open ArtNetominator on the same machine
3. Set ArtNetominator port to `6454`, adapter to your network interface
4. In the FXcommander app, connect the DMX panel to `ws://localhost:9001`
5. Fire a cue — you should see activity in ArtNetominator's DMX Data grid

## Troubleshooting

- **No activity detected**: Check Windows Firewall — allow Node.js through UDP port 6454
- **Permission denied**: Run as administrator on Windows, or use `sudo` on Linux/Mac
- **Broadcast not working**: Try using the subnet broadcast address instead (e.g., `192.168.15.255`)
