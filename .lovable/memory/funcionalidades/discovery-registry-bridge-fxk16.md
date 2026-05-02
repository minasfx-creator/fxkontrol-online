---
name: Discovery → Registry Bridge (Fase 0)
description: discoveryRegistryBridge promove FXK16 (USB/BLE), ArtNet (UDP ArtPoll) e DMXUniverse (USB-DMX) para live_read_only no handshake real; bootado em App.tsx; idempotente; honest-hardware
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
- `_artnetOnline: Set<host>` rastreia hosts vivos; demote quando o set esvazia.

### DMX Universe (USB-DMX via Web Serial)
- Fonte: `webSerialDiscoverer.watch()`.
- Critério: `event.device.family==='dmx' && device.online` (Enttec, USBDMX, uDMX classificados via DEVICE_PROFILES).
- Promove no PRIMEIRO port autorizado via `dmxUniverseAdapter.markHandshakeOk(label)`.
- `_dmxSerialOnline: Set<deviceId>` rastreia ports vivos; demote quando o set esvazia.

## Pendentes

- `battery-12v`, `mux-cd4051-dual`, `sr-74hc595-chain`: piggy-back no controlador host (FXK16/Arduino) — promovem juntos quando firmware reportar VBAT/continuity.

## Garantias

- **Honest Hardware Layer**: zero `Math.random`, zero dados sintéticos. Promoção só com evidência real.
- **Read-only no boundary**: bridge só toca provenance + connection state.
- **Safety preserved**: AI nunca pode chamar — não exposto via `uiCommandGateway`.
- **Idempotente**: `startDiscoveryRegistryBridge()` 2x é no-op; `stopDiscoveryRegistryBridge()` libera todos os subs e limpa sets.

## Componentes

- `src/hooks/useFXK16Bridge.ts` — `subscribeFXK16Bridge(listener)` não-React.
- `src/core/hardware/adapters/FXK16ModuleAdapter.ts` — `markHandshakeOk(transport)` / `markHandshakeLost()`.
- `src/core/hardware/adapters/ArtNetNodeAdapter.ts` — `markHandshakeOk(host)` / `markHandshakeLost()`.
- `src/core/hardware/adapters/DMXUniverseAdapter.ts` — `markHandshakeOk(label?)` / `markHandshakeLost()`.
- `src/core/hardware/discoveryRegistryBridge.ts` — orquestrador de 3 fontes.
- `src/App.tsx` — `startDiscoveryRegistryBridge()` no boot.

## Testes

- `fxk16ModuleAdapter.handshake.test.ts` (5)
- `artNetNodeAdapter.handshake.test.ts` (4)
- `dmxUniverseAdapter.handshake.test.ts` (4)
