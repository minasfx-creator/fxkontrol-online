---
name: Discovery → Registry Bridge (Fase 0)
description: discoveryRegistryBridge promove FXK16ModuleAdapter (USB/BLE via useFXK16Bridge) e ArtNetNodeAdapter (host via mdnsArtnetDiscoverer.watch) para live_read_only no handshake real; bootado em App.tsx; idempotente
type: feature
---

# Discovery → Registry Bridge

Elo entre as camadas de discovery e o `unifiedHardwareRegistry`. Sem este bridge, adapters ficam eternamente em `not_integrated` mesmo com hardware real conectado.

## Adapters wirados

### FXK16 (USB / BLE)
- Fonte: `subscribeFXK16Bridge` (singleton de `useFXK16Bridge`).
- Critério: `connected && deviceModel==='FXK16' && channelCount===16 && linkHealth==='healthy'`.
- Promove via `fxk16ModuleAdapter.markHandshakeOk(transport mapeado)`.
- Demote em disconnect/heartbeat timeout.
- `_lastVerified` evita transições duplicadas.

### Art-Net (UDP via edge ArtPoll)
- Fonte: `mdnsArtnetDiscoverer.watch()` (proxy via edge `artnet-bridge` action `poll`).
- Critério: `event.device.family==='artnet-node' && device.host`.
- Promove no PRIMEIRO host descoberto via `artNetNodeAdapter.markHandshakeOk(host)`.
- `_artnetOnline: Set<host>` rastreia hosts vivos; demote quando o set esvazia (`type==='lost'`).

## Pendentes

- `battery-12v`, `mux-cd4051-dual`, `sr-74hc595-chain`: piggy-back no controlador host (FXK16/Arduino) — promovem juntos quando firmware reportar VBAT/continuity.
- `dmx-universe-1`: promove via `webSerialDiscoverer` quando interface USB-DMX (Enttec/USBDMX) for autorizada e identificada.

## Garantias

- **Honest Hardware Layer**: zero `Math.random`, zero dados sintéticos.
- **Read-only no boundary**: bridge só toca provenance + connection state.
- **Safety preserved**: AI nunca pode chamar — não exposto via `uiCommandGateway`.
- **Idempotente**: `startDiscoveryRegistryBridge()` 2x é no-op; `stopDiscoveryRegistryBridge()` libera ambos os subs e limpa `_artnetOnline`.

## Componentes

- `src/hooks/useFXK16Bridge.ts` — `subscribeFXK16Bridge(listener)` não-React.
- `src/core/hardware/adapters/FXK16ModuleAdapter.ts` — `markHandshakeOk(transport)` / `markHandshakeLost()`.
- `src/core/hardware/adapters/ArtNetNodeAdapter.ts` — `markHandshakeOk(host)` / `markHandshakeLost()`.
- `src/core/hardware/discoveryRegistryBridge.ts` — orquestrador.
- `src/App.tsx` — `startDiscoveryRegistryBridge()` no boot.

## Testes

- `fxk16ModuleAdapter.handshake.test.ts` (5)
- `artNetNodeAdapter.handshake.test.ts` (4)
