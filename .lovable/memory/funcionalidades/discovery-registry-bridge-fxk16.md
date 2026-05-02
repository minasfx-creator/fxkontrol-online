---
name: Discovery → Registry Bridge (Fase 0)
description: discoveryRegistryBridge promove FXK16+Battery-12V+CD4051 Mux+74HC595 SR (piggy-back único handshake), Art-Net (UDP ArtPoll) e DMXUniverse (USB-DMX) para live_read_only no handshake real; bootado em App.tsx; idempotente; honest-hardware
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

### Battery-12V (piggy-back FXK16)
- Fonte: mesma assinatura `subscribeFXK16Bridge` — telemetria de bateria vem do mesmo controlador host.
- Critério: idêntico ao FXK16 (verified handshake).
- Promove via `batteryMonitorAdapter.markHandshakeOk(transport)` no mesmo edge de subida.
- Demote junto com o FXK16 quando o link cai.
- Read-only por construção (`canWrite=false`).
- **Required for sync**: sim — `low_battery_alarm` bloqueia `READY_FOR_HARDWARE_SYNC`.

### CD4051 Mux + 74HC595 SR (piggy-back FXK16)
- Fonte: mesma assinatura `subscribeFXK16Bridge` — leitura ADC do mux e estado da cadeia SR são reportados pelo mesmo controlador host.
- Critério: idêntico ao FXK16 (verified handshake).
- Promove via `muxReaderAdapter.markHandshakeOk(transport)` e `shiftRegisterAdapter.markHandshakeOk(transport)` no mesmo edge de subida.
- Demote junto com o FXK16 quando o link cai.
- Read-only por construção (`canWrite=false`).
- **Required for sync**: não — opcionais; ausentes não bloqueiam Fase 0.

## Pendentes

- `arduino-nano-01`, `fireone-profile`, `relay-bank-32ch`: classificados `NOT_INTEGRATED_EXPECTED` no triage — não precisam de bridge.

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
- `src/core/hardware/adapters/BatteryMonitorAdapter.ts` — `markHandshakeOk(transport)` / `markHandshakeLost()`.
- `src/core/hardware/adapters/MuxReaderAdapterCD4051.ts` — `markHandshakeOk(transport)` / `markHandshakeLost()`.
- `src/core/hardware/adapters/ShiftRegisterAdapter74HC595.ts` — `markHandshakeOk(transport)` / `markHandshakeLost()`.
- `src/core/hardware/discoveryRegistryBridge.ts` — orquestrador: FXK16+Battery+Mux+SR num único edge; Art-Net e DMX independentes.
- `src/App.tsx` — `startDiscoveryRegistryBridge()` no boot.

## Testes

- `fxk16ModuleAdapter.handshake.test.ts` (5)
- `artNetNodeAdapter.handshake.test.ts` (4)
- `dmxUniverseAdapter.handshake.test.ts` (4)
- `batteryMonitorAdapter.handshake.test.ts` (5)
- `piggybackAdapters.handshake.test.ts` (6 — Mux + SR)
