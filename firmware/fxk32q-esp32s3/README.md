# FXK32Q — Réplica melhorada do FireOne IFMx-i32Q

Firmware oficial do **módulo FXK32Q**: 1 ESP32-S3 v1.3 + 2 placas de relé 16 canais (32 relés totais), com **integração real** a todos os transportes do stack FireOne já implantados no app FX Kontrol.

## Por que "réplica melhorada"

| Recurso                          | IFMx-i32Q original | **FXK32Q (esta réplica)**                 |
|----------------------------------|--------------------|-------------------------------------------|
| Canais pyro                      | 32                 | **32**                                    |
| Entrada DMX/Art-Net              | sim                | **Art-Net + sACN E1.31 simultâneos**      |
| RS-485 FireOne XLII+ slave       | sim                | **sim (mesmo frame, endereço 1..40)**     |
| USB-CDC ASCII (handshake direto) | não                | **sim (compat 1:1 com FireOneHardwareBridge)** |
| BLE NimBLE (UUIDs `0000ffe0/ffe1/ffe2`) | não         | **sim (mesmo perfil do FXK16)**           |
| Wi-Fi AP de bench/preflight      | não                | **sim (SSID `FXK32Q-XXXXXX`)**            |
| OTA over-the-air                 | não                | sim (pendente release)                    |
| ESTOP latency                    | depende do bus     | **<50ms (latch interno + watchdog 2s)**   |
| Auto-open por canal              | não                | **sim (timer FreeRTOS por relé)**         |
| Custo BOM aproximado             | alto               | **baixo (ESP32 + 2 placas Songle)**       |

## 1. Pinout (ESP32-S3 v1.3 → 2× placas de 16 relés)

Veja `docs/PINMAP.md` para a tabela completa. Resumo:

- **Banco A (C1..C16)** — espelho exato do FXK16 (paridade elétrica entre placas).
- **Banco B (C17..C32)** — GPIOs estendidos do S3, evitando strapping (0,3,45,46), USB-OTG (19,20) e flash (26-32).

Auxiliares:

| Função            | GPIO | Notas                                  |
|-------------------|:----:|----------------------------------------|
| ESTOP físico      | 14   | INPUT_PULLUP, ativo LOW (compartilha C32) |
| Jumper UNSAFE     | 21   | INPUT_PULLUP, LOW libera GPIO raw      |
| LED heartbeat     | 48   | RGB on-board                           |
| RS-485 TX/RX/DE   | 43/44/3 | MAX485 transceiver                  |

> Relés são **ativos-baixos** (JQC-3FF / Songle): `LOW = fechado/dispara`, `HIGH = aberto/seguro`. O firmware inicializa todos em `HIGH` *antes* de ligar qualquer transporte.

## 2. Compilar e gravar

### PlatformIO (recomendado)

```bash
cd firmware/fxk32q-esp32s3
pio run -t upload
pio device monitor -b 115200
```

### Arduino IDE 2.x

1. Boards Manager → instale `esp32` (Espressif) ≥ 3.0.
2. Selecione `ESP32S3 Dev Module`, USB CDC On Boot = **Enabled**, Flash Size = 8MB.
3. Library Manager → instale `NimBLE-Arduino` (h2zero).
4. Abra `src/main.ino`, compile e grave.

## 3. Protocolo ASCII (compat 1:1 com `FireOneHardwareBridge`)

Mesmas regras do FXK16 + comandos de configuração:

| Comando                                    | Resposta                                                                          |
|--------------------------------------------|-----------------------------------------------------------------------------------|
| `HEARTBEAT`                                | `PONG`                                                                            |
| `VERSION`                                  | `VER:FXK32Q-1.1.0` + `MODEL:FXK32Q;CH:32;FW:1.1.0`                                |
| `STATUS`                                   | `BAT:<v>;PINS:<mask32>;RSSI:<dbm>;MODEL:FXK32Q;CH:32;ART:<u>;START:<s>;RS485:<a>;ARM:<0\|1>;ESTOP:<0\|1>` |
| `IDENTIFY`                                 | `MODEL:FXK32Q;CH:32;FW:1.1.0;ID:FXK32Q`                                           |
| `PINMAP`                                   | 32× `MAP:<n>:GPIO<g>:<terminal>` + `OK:PINMAP`                                    |
| `ARM` / `DISARM`                           | `OK:ARM:1` (ou `ERR:ARM:ESTOP_LATCHED`) / `OK:DISARM`                             |
| `FIRE:<1..32>:<ms>`                        | `OK:FIRE:<n>` ou `ERR:FIRE:<n>:<NOT_ARMED\|ESTOP_LATCHED\|OUT_OF_RANGE\|BAD_DURATION>` |
| `BATCH:<mask32>:<ms>`                      | `OK:BATCH:<mask32>` ou `ERR:BATCH:<mask>:<NOT_ARMED\|ESTOP_LATCHED\|EMPTY_MASK\|BAD_DURATION>` |
| `CONT:<1..32>`                             | `CONT:<n>:<ohms>` (stub 9999 — open) ou `ERR:CONT:<n>:OUT_OF_RANGE`               |
| `GPIO:<n>:HIGH\|LOW`                       | `OK:GPIO:<n>` (apenas com jumper UNSAFE)                                          |
| `SET_ARTNET:<universe>:<startCh>`          | `OK:ART:<u>:<s>`                                                                  |
| `SET_RS485:<addr1..40>`                    | `OK:RS485:<addr>`                                                                 |
| `ESTOP` / `RESET`                          | `OK:ESTOP` (latch + DISARM) / `OK:RESET` (libera; ARM precisa ser refeito)        |

> **ARM gate firmware-side** (defense-in-depth): o app já gateia ARM em `fxk32q/commandApi.ts`, mas o firmware **também** exige `ARM` antes de aceitar `FIRE`/`BATCH`. ESTOP latch desarma automaticamente; ARM auto-expira após 30s sem comando válido (proteção contra link-fantasma). Art-Net e RS-485 também respeitam o gate.

## 4. Transportes simultâneos

O firmware roda os 5 transportes em paralelo no mesmo loop, todos sujeitos ao mesmo `serviceTimers()` (auto-open) e ao mesmo `estopLatch()`:

1. **USB-CDC** (115200 8N1) — dev/preflight, comandos ASCII.
2. **BLE NimBLE** — UUIDs `0000ffe0/ffe1/ffe2` (mesmo handshake do FXK16).
3. **Wi-Fi AP** — SSID `FXK32Q-<MAC>` para bench; STA/OTA em release.
4. **Art-Net (UDP 6454) + sACN E1.31 (UDP 5568)** — universo configurável; threshold DMX≥128 dispara o relé com pulso de 100ms.
5. **RS-485 FireOne XLII+ slave** — endereço 1..40, fala o frame canônico do `fireoneProtocol.ts`. Permite que uma mesa XLII+ ou o transporte cabo do app enxergue o FXK32Q como se fosse um IFMx-i32Q nativo.

Ver `docs/ARTNET_MAP.md` para o mapa universo→canal.

## 5. Limites de segurança gravados no firmware

- **Pulso máximo por canal**: 5000 ms — reforçado por timer `serviceTimers()` independente do parser. Se o host travar, o relé **abre sozinho**.
- **ESTOP latch**: corta os 32 relés em < 50 ms e fica travado até comando `RESET` ou ciclo de energia. Broadcast RS-485 (`addr=0x00`, `cmd=0x58`) também latcha.
- **Watchdog (TWDT)**: 2 s, rearmado a cada iteração do loop.
- **Boot-safe**: todos os 32 pinos vão para `OUTPUT` + `HIGH` *antes* de inicializar Serial/BLE/Wi-Fi/RS-485.
- **Pin range**: `[1..32]`. Fora disso → `ERR:FIRE:<n>:OUT_OF_RANGE`.

## 6. Identificação no app

- BLE advertising name: `FXK32Q-XXXXXX` (últimos 6 dígitos do MAC).
- USB-CDC: ao receber `VERSION` ou `STATUS`, devolve `MODEL:FXK32Q` e `CH:32`. O `discoveryRegistryBridge` promove o adapter para **FXK32Q — 32ch (ESP32-S3 IFMx-replica)** automaticamente.
- O Module Roster (`/dev/module-roster`) lista o módulo com chip `IFMx-REPLICA · 32CH`.

## 7. Verificação rápida (bench)

```text
> VERSION
VER:FXK32Q-1.1.0
MODEL:FXK32Q;CH:32;FW:1.1.0
> STATUS
BAT:0.0;PINS:0;RSSI:-30;MODEL:FXK32Q;CH:32;ART:0;START:1;RS485:1;ARM:0;ESTOP:0
> FIRE:1:50
ERR:FIRE:1:NOT_ARMED              # gate firmware-side
> ARM
OK:ARM:1
> SET_ARTNET:1:1
OK:ART:1:1
> FIRE:17:50
OK:FIRE:17                        # GPIO 38 vai LOW por 50ms (Banco B IN1)
> BATCH:0xFFFF0000:80
OK:BATCH:4294901760               # dispara C17..C32 simultâneos
> ESTOP
OK:ESTOP
> FIRE:1:50
ERR:FIRE:1:ESTOP_LATCHED
> ARM
ERR:ARM:ESTOP_LATCHED
> RESET
OK:RESET
> ARM
OK:ARM:1
```
