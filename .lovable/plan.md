# FXK32Q — Réplica Melhorada do IFMx-i32Q

Réplica do módulo **FireOne IFMx-i32Q** (32 canais DMX→pyro) usando **ESP32-S3 + 2× placas de relé 16ch**, com **integração real** a todo o stack FireOne já existente no app (XLII+ RS-485, Art-Net/DMX, USB-CDC, BLE, Wi-Fi Direct).

## 1. Hardware-alvo

```text
ESP32-S3 DevKitC-1 (v1.3, 8MB)
 ├── Relay Bank A (IN1..IN16)  → GPIOs canônicos (mesmo mapa do FXK16)
 ├── Relay Bank B (IN17..IN32) → GPIOs estendidos (38,39,40,41,42, 47, 1,2)
 ├── RS-485 transceiver (MAX485) UART1: GPIO 43 TX / 44 RX / DE+RE comum
 ├── LED status RGB (GPIO 48)
 ├── E-STOP físico (GPIO 14, INPUT_PULLUP)
 ├── Jumper UNSAFE_GPIO (GPIO 21)
 └── Sensor de continuidade ADC (GPIO 6 via mux) — opcional
```

Activos-baixos (JQC-3FF). Boot-safe: todos os 32 pinos vão `OUTPUT`+`HIGH` antes de qualquer transporte subir.

## 2. Firmware novo: `firmware/fxk32q-esp32s3/`

Estrutura espelha `fxk16-esp32s3/` com:

- `src/fxk32q_config.h` — `#define FXK32Q_CHANNELS 32`, limites duros (`FIRE_MAX_DURATION_MS=5000`, `WATCHDOG_TIMEOUT_S=2`).
- `src/fxk32q_pinmap.h` — Tabela `CHANNEL_MAP[32]` com `static_assert` de unicidade de GPIO (padrão herdado do FXK16).
- `src/fxk32q_relay.{h,cpp}` — `arm/disarm/fire(pin,ms)/batch(mask32,ms)/eStopLatch/reset`. Timer FreeRTOS por canal força open após `ms` mesmo se host travar.
- `src/fxk32q_protocol.{h,cpp}` — Parser ASCII (compat 1:1 com `FireOneHardwareBridge`) **+** modo binário `FireOnePbus` para Art-Net pass-through.
- `src/fxk32q_artnet.{h,cpp}` — Listener UDP 6454 (Art-Net) e sACN E1.31 (5568); mapeia universos configuráveis → canais 1..32; thresholds DMX>=128 disparam pulso configurado.
- `src/fxk32q_rs485.{h,cpp}` — Slave do protocolo FireOne XLII+ (`fireoneProtocol.ts`): responde a `ARM/DISARM/FIRE/CONT/STATUS/HEARTBEAT/ESTOP/IDENTIFY` no endereço configurado (1..40). Frame `[STX][ADDR][CMD][PAYLOAD][CKSUM][ETX]` 9600 8N1.
- `src/fxk32q_ble.cpp` — NimBLE service `0000ffe0` TX `ffe1` RX `ffe2` (mesmo do FXK16).
- `src/fxk32q_wifi.cpp` — STA/AP, OTA, WebSocket relay (`/fireone-bridge`) compatível com `fireoneWifiDirectTransport.ts`.
- `src/main.ino` — Boot-safe init, watchdog, loop multiplexa: Serial USB-CDC, BLE, Wi-Fi WS, Art-Net UDP, RS-485.
- `docs/PINMAP.md`, `docs/ARTNET_MAP.md`, `README.md`.

### Comandos ASCII suportados

Mesmos do FXK16 + estendidos:
| Comando | Resposta |
|---|---|
| `VERSION` | `VER:FXK32Q-1.0.0` |
| `STATUS` | `BAT:<v>;PINS:<mask32>;RSSI:<dbm>;MODEL:FXK32Q;CH:32;ART:<u>` |
| `FIRE:<1..32>:<ms>` | `OK:FIRE:<n>` / `ERR:FIRE:<n>:<reason>` |
| `BATCH:<mask32>:<ms>` | `OK:BATCH:<mask32>` |
| `CONT:<1..32>` | `CONT:<n>:<ohms>` |
| `SET_ARTNET:<universe>:<startCh>` | `OK:ART:<u>:<s>` |
| `SET_RS485:<addr1..40>` | `OK:RS485:<addr>` |
| `ESTOP` / `RESET` | `OK:ESTOP` (latch) / `OK:RESET` |

## 3. Integração host (TypeScript)

### 3.1 Identificação automática
- `src/lib/fxk16BleHandshake.ts` e `unifiedDiscovery` já fazem handshake `VERSION/STATUS`. Adicionar reconhecimento `MODEL:FXK32Q` → registra adapter como `FXK32Q — 32ch (ESP32-S3 IFMx-replica)`.
- Bridge promove para `live_read_only` no **mesmo único handshake** (regra Discovery→Registry Bridge).

### 3.2 Novo arquivo `src/lib/fxk32q/`
- `commandApi.ts` — Tipado, com `CommandResponse` discriminada (segue padrão `fxk16/commandApi.ts`): `arm/disarm/fire/batch/continuity/status/setArtnet/setRs485Addr/eStop/reset`. ARM gate client-side; auto-disarm em link loss.
- `pinmap.ts` — Espelho TypeScript do `CHANNEL_MAP` para o Module Roster.
- `syncStore.ts` — Ring buffer de eventos, similar ao `fxk16/syncStore.ts`.

### 3.3 Wiring nos transportes existentes
- **USB-CDC + BLE** → `useFXK32QBridge` (clone do `useFXK16Bridge`, mas 32 canais; máscara 32-bit em `BATCH`).
- **RS-485 (cabo XLII+)** → registrar via `registerCableLink` em `realTransports.ts`. O firmware responde como módulo XLII+ no endereço configurado, então **nenhuma mudança de protocolo no host** é necessária — o `fireoneProtocol.ts` já fala com ele.
- **Wi-Fi Direct** → `fireoneWifiDirectTransport.ts` aponta para o WS do firmware.
- **Art-Net** → `ArtNetBridge.sendDmx(universe, bytes)` já chega ao firmware (universo configurável via `SET_ARTNET`). Pass-through: o módulo vira saída pyro DMX equivalente ao IFMx-i32Q real.

### 3.4 UI
- **FXK32QPanel** em `src/components/hardware/` (clone enxuto do `FXK16ConnectionPanel`): conexão USB/BLE, seletor de transporte preferido (cabo XLII+/Art-Net/Wi-Fi/BLE), indicador per-link, batch test 1..32 com Hold-to-Confirm 800ms.
- **FXK32QStatusBar** + **ActivityFeed** (espelho dos componentes FXK16) montados em FieldOps, FieldTest harness e Live Firing.
- Adicionar entrada no **Module Roster** (`/dev/module-roster`) com chip `IFMx-REPLICA · 32CH`.

### 3.5 Safety (sem alteração de SSM)
- `pyroTransportPolicy.PYRO_FIRE_PRIORITY = ['serial','usb','artnet']`; BLE banido em `real_operation` (regra existente).
- Todo dispatch passa por `uiCommandGateway.fire()` → CommandBus → SSM → `evaluatePyroDispatchVerdict` → `safetyBlackBox`.
- E-STOP global cobre o módulo via broadcast nos 4 transportes simultaneamente (FieldBus já faz fan-out).

## 4. Testes

- `firmware/fxk32q-esp32s3/test/` — emulator ASCII (espelho do `fxk16AsciiEmulator.test.ts`) cobrindo `FIRE/BATCH/CONT/SET_ARTNET/SET_RS485/ESTOP latch/RESET`.
- `src/lib/fxk32q/__tests__/commandApi.spec.ts` — ARM gate, máscara 32-bit, auto-disarm on link loss.
- `src/lib/__tests__/fxk32qDiscovery.spec.ts` — handshake `MODEL:FXK32Q` → adapter promovido.
- `src/lib/__tests__/fxk32qRs485Slave.spec.ts` — fala `fireoneProtocol` com o emulator e valida ACK/NAK em ARM/FIRE/CONT.
- `src/lib/__tests__/fxk32qArtnetMap.spec.ts` — universo+startCh → canal correto, threshold 128.

## 5. Documentação

- `firmware/fxk32q-esp32s3/README.md` — pinout, gravação, protocolo, IFMx-i32Q parity matrix.
- `docs/hardware/FXK32Q_VS_IFMX_I32Q.md` — diferenças e melhorias (4 transportes simultâneos vs DMX único; per-channel timer FreeRTOS; ESTOP <50ms latch; OTA; custo).
- Atualizar `docs/architecture/entry-points.md` com a entrada FXK32Q.

## 6. Arquivos

**Novos**
- `firmware/fxk32q-esp32s3/{platformio.ini, README.md, docs/PINMAP.md, docs/ARTNET_MAP.md, src/*}`
- `src/lib/fxk32q/{commandApi.ts, pinmap.ts, syncStore.ts}`
- `src/hooks/useFXK32QBridge.ts`, `src/hooks/useFXK32QSync.ts`, `src/hooks/useFXK32QCommands.ts`
- `src/components/hardware/FXK32QConnectionPanel.tsx`, `FXK32QStatusBar.tsx`, `FXK32QActivityFeed.tsx`
- Suítes de teste listadas na §4
- `docs/hardware/FXK32Q_VS_IFMX_I32Q.md`

**Editados**
- `src/lib/discovery/...` — reconhecer `MODEL:FXK32Q`
- `src/pages/dev/ModuleRoster.tsx` — exibir famílias FXK32Q
- `src/pages/FieldOps.tsx` / `src/pages/dev/FXK16Hub.tsx` — montar FXK32QStatusBar
- `docs/architecture/entry-points.md`

## 7. Restrições respeitadas

- **Zero alteração** em `safetyStateMachine`, `commandBus`, `uiCommandGateway`, `workMode`.
- **Honest Hardware**: sem ACKs sintéticos; `isAlive()` reflete handshake real.
- **Vantablack/cyan-dessat** mantidos; sem emojis nos componentes.
- Adapters honestos (default `disconnected/unknown`); simulação só sob `dev_hardware_simulator`.
