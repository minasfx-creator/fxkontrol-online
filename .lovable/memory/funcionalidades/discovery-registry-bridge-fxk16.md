---
name: Discovery → Registry Bridge (Fase 0)
description: discoveryRegistryBridge promove FXK16ModuleAdapter para live_read_only no handshake real (USB/BLE) via singleton useFXK16Bridge; bootado em App.tsx; idempotente
type: feature
---

# Discovery → Registry Bridge

Elo entre a camada de discovery (`useFXK16Bridge` singleton, `FireOneHardwareBridge`) e o `unifiedHardwareRegistry`. Sem este bridge o `FXK16ModuleAdapter` ficava eternamente em `not_integrated` mesmo com hardware conectado.

## Componentes

- **`src/hooks/useFXK16Bridge.ts`** — exporta `subscribeFXK16Bridge(listener)` (não-React) que reaproveita o `_listeners` Set do singleton.
- **`src/core/hardware/adapters/FXK16ModuleAdapter.ts`** — métodos públicos `markHandshakeOk(transport)` e `markHandshakeLost()` que delegam para `provenance.ts`. `reset()` agora também demote provenance.
- **`src/core/hardware/discoveryRegistryBridge.ts`** — escuta status do bridge FXK16; quando `connected && deviceModel==='FXK16' && channelCount===16 && linkHealth==='healthy'`, chama `markHandshakeOk(transport mapeado)`. Quando perde, chama `markHandshakeLost()`. Idempotente, com `_lastVerified` para evitar transições duplicadas.
- **`src/App.tsx`** — `startDiscoveryRegistryBridge()` no boot do `App` componente.

## Mapeamento de transport

`status.transport` (string do bridge) → `TransportType` canônico:
- `/ble|bluetooth/i` → `'ble'`
- `/usb|serial|cdc/i` → `'serial_usb'`
- default → `'serial_usb'`

## Garantias

- **Honest Hardware Layer**: zero `Math.random`, zero dados sintéticos. Promoção só com `MODEL:FXK16;CH:16` reply verificado.
- **Read-only no boundary**: bridge só toca provenance + connection state. Nenhum comando físico.
- **Safety preserved**: AI nunca pode chamar este bridge — não está exposto via `uiCommandGateway`.

## Próximos adapters a wirear

- `artnet-node-01`: ArtPollReply válido → `markHandshakeOk('ethernet_udp')`.
- `battery-12v`: piggy-back via mesma sessão FXK16 quando firmware reportar VBAT.
- `mux-cd4051-dual` / `sr-74hc595-chain`: idem (host controller reporta).

## Testes

`src/core/hardware/__tests__/fxk16ModuleAdapter.handshake.test.ts` — 5 testes cobrindo promoção USB, promoção BLE, demote, reset.
