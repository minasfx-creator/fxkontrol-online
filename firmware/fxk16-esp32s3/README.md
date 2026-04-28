# FXK16 — ESP32-S3 v1.3 + 16-Channel Relay Module

Firmware oficial do **módulo FXK16**: 1 ESP32-S3 v1.3 controlando 1 placa de 16 relés.
Mapeamento direto: **C1 → Relé 1, C2 → Relé 2, …, C16 → Relé 16**.

Reconhecido automaticamente pelo app FX Kontrol como `MODEL:FXK16`, `CH:16`.

## 1. Pinout (ESP32-S3 v1.3 → módulo de 16 relés)

| Canal | GPIO | Canal | GPIO |
|------:|:-----|------:|:-----|
|  C1   | 4    |  C9   | 17   |
|  C2   | 5    |  C10  | 18   |
|  C3   | 6    |  C11  | 8    |
|  C4   | 7    |  C12  | 9    |
|  C5   | 15   |  C13  | 10   |
|  C6   | 16   |  C14  | 11   |
|  C7   | 35   |  C15  | 12   |
|  C8   | 36   |  C16  | 13   |

Auxiliares:

| Função          | GPIO | Notas                                     |
|-----------------|:----:|-------------------------------------------|
| LED heartbeat   | 48   | LED on-board do DevKitC-1                 |
| ESTOP físico    | 14   | INPUT_PULLUP, ativa em LOW (opcional)     |
| Jumper UNSAFE_GPIO | 21 | INPUT_PULLUP, em LOW libera comando GPIO  |

> **Pinos evitados**: 0, 3, 19, 20 (USB-OTG), 26-32 (SPI flash), 45, 46 (strapping).
> Os relés são **ativos-baixos** (padrão JQC-3FF / Songle): `LOW = fechado/dispara`,
> `HIGH = aberto/seguro`. O firmware inicializa todos em `HIGH` *antes* de habilitar
> qualquer transporte.

## 2. Compilar e gravar

### PlatformIO (recomendado)

```bash
pio run -t upload
pio device monitor -b 115200
```

### Arduino IDE 2.x

1. Boards Manager → instale `esp32` (Espressif) ≥ 3.0.
2. Selecione `ESP32S3 Dev Module`, USB CDC On Boot = **Enabled**, Flash Size = 8MB.
3. Library Manager → instale `NimBLE-Arduino` (h2zero).
4. Abra `src/main.ino`, compile e grave.

## 3. Protocolo (compatível 1:1 com `FireOneHardwareBridge`)

Todos os comandos terminam em `\n` (ASCII 0x0A). Velocidade USB-CDC = 115200 8N1.
BLE expõe o serviço UART `0000ffe0` com TX `0000ffe1` e RX `0000ffe2`.

| Comando                       | Resposta                                         |
|-------------------------------|--------------------------------------------------|
| `HEARTBEAT`                   | `PONG`                                           |
| `VERSION`                     | `VER:FXK16-1.0.0`                                |
| `STATUS`                      | `BAT:<v>;PINS:<mask16>;RSSI:<dbm>;MODEL:FXK16;CH:16` |
| `FIRE:<pin>:<ms>`             | `OK:FIRE:<pin>` ou `ERR:FIRE:<pin>:<reason>`     |
| `BATCH:<mask16>:<ms>`         | `OK:BATCH:<mask16>`                              |
| `GPIO:<pin>:HIGH`/`LOW`       | `OK:GPIO:<pin>` (somente com jumper UNSAFE_GPIO) |
| `CONT:<pin>`                  | `CONT:<pin>:<ohms>` (stub: 9999 sem ADC)         |
| `CDS:<pin>`                   | `CDS:<pin>:<volts>` (stub)                       |
| `ESTOP`                       | `OK:ESTOP` (latch até `RESET` ou power-cycle)    |
| `RESET`                       | `OK:RESET` (libera ESTOP)                        |

### Limites de segurança gravados no firmware

- **Pulso máximo por canal**: 5000 ms — reforçado por timer FreeRTOS independente
  do parser. Se o host travar, o relé **abre sozinho**.
- **ESTOP latch**: corta os 16 relés em < 50 ms e fica travado até comando `RESET` ou ciclo de energia.
- **Watchdog (TWDT)**: 2 s, rearmado a cada iteração do loop.
- **Boot-safe**: todos os pinos vão para `OUTPUT` + `HIGH` *antes* de inicializar Serial/BLE.
- **Pin range**: `[1..16]`. Fora disso → `ERR:FIRE:<pin>:OUT_OF_RANGE`.

## 4. Identificação no app

- BLE advertising name: `FXK16-XXXXXX` (últimos 6 dígitos do MAC).
- USB-CDC: assim que o app envia `VERSION`/`STATUS`, recebe `MODEL:FXK16` e `CH:16`,
  e o registro promove o adapter para **FXK16 — 16ch (ESP32-S3)**.
- O Addressing Panel já lista `FXK16 — 16ch (ESP32-S3)` em "Module Spec".

## 5. Verificação rápida (bench)

```text
> VERSION
VER:FXK16-1.0.0
> STATUS
BAT:0.0;PINS:0;RSSI:-30;MODEL:FXK16;CH:16
> FIRE:1:50
OK:FIRE:1     # GPIO 4 vai LOW por 50ms e volta para HIGH
> ESTOP
OK:ESTOP
> FIRE:1:50
ERR:FIRE:1:ESTOP_LATCHED
> RESET
OK:RESET
```
