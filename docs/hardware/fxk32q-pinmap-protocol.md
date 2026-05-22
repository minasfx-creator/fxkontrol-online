# FXK32Q — Pinmap, Protocolo, Art-Net & RS-485

> Réplica melhorada do **FireOne IFMx-i32Q** (32 canais) usando **1× ESP32-S3 + 2× placas de relé 16ch**.
> Firmware ≥ v1.1 fala o **mesmo handshake ASCII do FXK16** + frame **XLII+** via RS-485.
> Toda integração reutiliza `FireOneHardwareBridge` + `realTransports.ts` — não há novo path inventado.
>
> **Operação real é canalizada por `uiCommandGateway` → `CommandBus` → `SafetyStateMachine` → `FieldBus`.**
> Este doc é para **bancada / replicação / calibração**, não substitui o app.

---

## 1. Hardware — visão geral

| Item | Valor |
|---|---|
| MCU | ESP32-S3 WROOM-1U (Wi-Fi 2.4 GHz + BLE 5 LE / Long Range) |
| Bancos de relé | 2× placas 16ch SSR/mecânico (total 32) |
| Identificação firmware | `MODEL:FXK32Q;CH:32` (resposta a `VERSION`) |
| Tensão de disparo | 12 V DC (igualador FireOne IFMx-i32Q) |
| Corrente por canal (pico) | 3 A SSR / 5 A mecânico |
| Range de pulso | 1 ms .. 5 000 ms (gate `FXK32Q_MIN/MAX_DURATION_MS`) |
| ARM gate físico | só via RS-485/XLII+. USB/BLE usam ARM **client-side** |

> Constantes canônicas: `src/lib/fxk32q/pinmap.ts` (não duplicar — sempre importar dali).

---

## 2. Pinmap ESP32-S3 → bancos de relé

| Função | GPIO ESP32-S3 | Banco | Observação |
|---|---|---|---|
| Bank A — `SR_DATA` (74HC595 SER) | GPIO 11 | A (ch 1..16) | shift-register data |
| Bank A — `SR_CLK` (SRCLK) | GPIO 12 | A | shift clock |
| Bank A — `SR_LATCH` (RCLK) | GPIO 13 | A | latch comum aos dois bancos via diodo |
| Bank A — `SR_OE` (active-low) | GPIO 14 | A | mantenha **HIGH no boot** (relés OFF) |
| Bank B — `SR_DATA` | GPIO 15 | B (ch 17..32) | |
| Bank B — `SR_CLK` | GPIO 16 | B | |
| Bank B — `SR_LATCH` | GPIO 13 | B | compartilhado com A |
| Bank B — `SR_OE` | GPIO 17 | B | HIGH no boot |
| Continuity ADC mux S0..S3 | GPIO 4..7 | comum | CD4051 dual |
| Continuity ADC IN | GPIO 1 (ADC1_CH0) | comum | divisor 10 kΩ + 1 kΩ |
| RS-485 DE/RE | GPIO 21 | comum | MAX485 driver enable |
| RS-485 TX/RX | GPIO 43/44 (UART1) | comum | 19200 8N1 |
| USB-CDC | GPIO 19/20 (D-/D+ nativo) | comum | 115200 8N1 |
| LED status | GPIO 38 (RGB nativo) | — | verde=READY, âmbar=ARM, vermelho=FIRING/FAULT |
| Botão E-STOP físico | GPIO 0 (BOOT) | — | pull-up interno; latch via SW |
| Watchdog ext (TPS3823) | EN GPIO 18 | — | reset hard se firmware travar >800 ms |

**Mapeamento canal → bit:**
```
canal 1..16  → Bank A bit (ch − 1)
canal 17..32 → Bank B bit (ch − 17)
máscara 32-bit (BATCH): bit (ch − 1) = 1
```
Helper: `channelsToMask32(channels: number[]): number` (sempre `>>> 0`).

---

## 3. Protocolo ASCII (USB-CDC, BLE-UART, WebSocket, Wi-Fi-TCP)

Mesmo wire-format do FXK16; framing por `\n`.

| Comando enviado | Resposta esperada | Notas |
|---|---|---|
| `VERSION\n` | `MODEL:FXK32Q;CH:32;FW:<x.y.z>\n` | usado pelo handshake do `discoveryRegistryBridge` |
| `STATUS\n` | `STATUS:READY|ARMED|FIRING;LINK:<rssi>;BAT:<mv>\n` | poll de saúde |
| `ARM\n` | `ACK:ARM\n` | client-side (USB/BLE não tem opcode físico de ARM) |
| `DISARM\n` | `ACK:DISARM\n` | |
| `FIRE:<ch>:<ms>\n` | `ACK:FIRE:<ch>\n` ou `ERR:<code>\n` | `ch ∈ 1..32`, `ms ∈ 1..5000` |
| `BATCH:<mask32hex>:<ms>\n` | `ACK:BATCH:<mask32hex>\n` | `mask` decimal **ou** hex `0x…`; ordem deterministica |
| `ESTOP\n` | `ACK:ESTOP\n` | bypassa ARM, força DISARM em todos os caminhos |

**Códigos de erro do firmware** (mapeados em `commandApi.ts → mapBridgeCode`):

| Firmware | Cliente (`Fxk32qErrorCode`) |
|---|---|
| `ERR:NOT_ARMED` | `NOT_ARMED` |
| `ERR:RANGE` | `INVALID_CHANNEL` / `INVALID_DURATION` |
| `ERR:LINK` | `LINK_DEGRADED` |
| `ERR:TIMEOUT` | `TIMEOUT` |
| outros | `BRIDGE_REJECTED` |

### 3.1 BLE GATT (igual FXK16)
| UUID | Papel |
|---|---|
| `0000FFE0-0000-1000-8000-00805F9B34FB` | Service |
| `0000FFE1-0000-1000-8000-00805F9B34FB` | TX (notify) — frames ASCII do firmware |
| `0000FFE2-0000-1000-8000-00805F9B34FB` | RX (write w/o resp) — comandos para o firmware |
| MTU mínimo | 23 (default); negocia 185 quando central suporta |
| Long Range | ativar Coded PHY S=8 (firmware ≥ v1.1) |

### 3.2 USB-CDC
- 115 200 baud, 8N1, sem flow control.
- VID/PID padrão da Espressif: `303A:1001` (CDC nativo S3).
- Em iOS via cabo Lightning→USB-C, a porta aparece como `serial_usb` no `unifiedDiscovery`.

### 3.3 Wi-Fi
- AP-mode SSID padrão: `FXK32Q-<MAC4>`, senha exibida no LCD opcional.
- TCP raw: porta **23** (telnet-style ASCII).
- WebSocket: porta **81**, path `/`.
- mDNS: `_fxk32q._tcp.local`.

---

## 4. Mapa Art-Net (UDP 6454) e sACN (UDP 5568)

Universo e canais são configuráveis; default **universo 0, start channel 1**.

| Canal DMX (relativo a `start`) | Função | Notas |
|---|---|---|
| 1..32 | Disparo direto de cada canal de relé | nível ≥ 128 = pulso de `default_pulse_ms` (config no firmware, padrão 80 ms) |
| 33 | Global pulse duration (ms) | escala 0..255 → 1..2000 ms (linear) |
| 34 | Global ARM gate | ≥ 128 por ≥ 250 ms = ARM; <128 por ≥ 100 ms = DISARM |
| 35 | E-STOP | `255` por ≥ 100 ms = E-STOP (latched até comando ASCII `ESTOP-RESET` ou ciclo de power) |
| 36..40 | reservado (Showven future-compat) | manter em `0` |

**Regras importantes:**
- Frame Art-Net 4 (OpCode `0x5000` `ArtDmx`); aceita também `ArtSync` (`0x5200`) — usa double-buffer.
- ArtPoll (`0x2000`) responde `ArtPollReply` com `ShortName="FXK32Q"`, `Style=StNode`, oem `0x289B` (custom Showven-compat).
- sACN (E1.31): aceita prioridade ≥ 100; em empate o pacote mais novo vence; preview-data é ignorado em `ARMED`.
- Refresh máximo aceito: **44 Hz** (igual ao FireOne); >44 Hz é dropado e contado em `ERR:RATE`.
- Em `real_operation` o ARM via DMX **só vale** se a flag firmware `ALLOW_DMX_ARM=1` estiver setada (default OFF — segurança).

---

## 5. Mapa RS-485 — frame XLII+ (FireOne-compat)

Reutiliza o framing **XLII+** do FireOne, byte-a-byte, para que cabos e slaves existentes funcionem sem swap.

```
+------+------+------+----------+--------+--------+
| 0xAA | ADDR | OP   | LEN(1B)  | DATA   | CRC16  |
+------+------+------+----------+--------+--------+
  STX    1..40  ver §5.1  N bytes   N bytes  CCITT-FALSE big-endian
```

- **Baud:** 19 200, 8N1, half-duplex.
- **ADDR:** 1..40 (slot rotativo na chave DIP). Address `0x00` é broadcast (apenas E-STOP).
- **CRC16:** CCITT-FALSE, poly `0x1021`, init `0xFFFF`, no XOR-out.
- **Inter-frame gap:** ≥ 3,5 caracteres (≈ 1,8 ms a 19200).
- **Timeout slave→master:** 35 ms.

### 5.1 Opcodes XLII+

| OP   | Nome         | Payload                        | ACK do slave |
|------|--------------|--------------------------------|--------------|
| 0x10 | `PING`       | — | `0x90` + `MODEL:FXK32Q` (≤16B) |
| 0x11 | `STATUS`     | — | `0x91` + `state(1) rssi(1) bat(2) mask32(4)` |
| 0x20 | `ARM`        | `key(2)` rolling-code | `0xA0` |
| 0x21 | `DISARM`     | — | `0xA1` |
| 0x30 | `FIRE_CH`    | `ch(1) ms(2)` | `0xB0` ou `ERR(0xE0+code)` |
| 0x31 | `FIRE_MASK`  | `mask32(4) ms(2)` | `0xB1` |
| 0x40 | `CONTINUITY` | `ch(1)` (`0` = todos) | `0xC0` + `n(1) {ch,Ω(2)}*n` |
| 0x7F | `ESTOP`      | — | `0xFF` (broadcast também aceito) |

> Diferença vs IFMx-i32Q original: opcodes `0x50`/`0x51` (proprietários FireOne de telemetria de bateria) **não** são implementados; use `STATUS` (0x11) que inclui `bat(2)` em mV.

### 5.2 Endereçamento físico
- Chave DIP de 6 bits (1..40 efetivos; 41..63 reservados).
- Endereço `0` = factory default → primeiro `PING` faz auto-bind sequencial.
- Reset: hold `BOOT (GPIO0)` por 5 s → volta a addr `0`.

---

## 6. Calibração

### 6.1 Continuidade
- Threshold de **OPEN**: > 200 Ω (datasheet do squib + e-match Talon).
- Threshold de **SHORT**: < 0,5 Ω.
- ADC samples: média de 8 leituras a 1 kHz por canal (ruído típico ±0,3 Ω).
- Ajuste fino por canal: tabela `cal_offset_ohms[32]` em NVS (`nvs_namespace=fxk32q`, key `cal_v1`).

### 6.2 Latência alvo (bench)
| Caminho | Alvo | Limite hard |
|---|---|---|
| ASCII `FIRE` USB-CDC | < 8 ms | 25 ms |
| ASCII `FIRE` BLE | < 35 ms | 80 ms |
| ASCII `BATCH` USB-CDC (32 ch) | < 12 ms | 30 ms |
| Art-Net pacote → relé | < 18 ms | 40 ms |
| RS-485 `FIRE_CH` | < 10 ms | 22 ms |
| E-STOP de **qualquer** transport até relés OFF | < 50 ms | **50 ms (regra crítica)** |

### 6.3 Procedimento de bench
1. Conectar via USB-CDC e rodar `node scripts/fxk32q-diagnose.mjs --transport=usb --port=<port> --no-fire`.
2. Confirmar `MODEL:FXK32Q;CH:32;FW≥1.1.0`.
3. `--transport=all` cobre USB + Wi-Fi + Art-Net + WS + RS-485 + BLE em sequência (pula o que faltar config).
4. Para calibrar continuidade: comando `CAL` ASCII (firmware ≥ v1.1) salva `cal_offset_ohms` por canal a partir de leitura curta-circuito conhecida.

---

## 7. Mapa rápido transporte → camada do app

| Transport firmware | `TransportType` | Adapter / Bridge |
|---|---|---|
| USB-CDC | `serial_usb` | `FireOneHardwareBridge` (USB) |
| BLE / BLE-LR | `ble` | `FireOneHardwareBridge` (BLE) |
| Wi-Fi TCP/WebSocket | `wifi` / `ethernet_tcp` | `FireOneHardwareBridge` (WS) |
| Art-Net / sACN | `ethernet_udp` | `discoveryRegistryBridge` (ArtPoll → live_read_only) |
| RS-485 XLII+ via USB↔RS485 | `serial_usb` | `FireOneHardwareBridge` (XLII+ frame) |

`FXK32QModuleAdapter` é **read-only no boundary** — toda escrita real passa por `uiCommandGateway`.

---

## 8. Referências cruzadas

- Constantes: `src/lib/fxk32q/pinmap.ts`
- API tipada: `src/lib/fxk32q/commandApi.ts`
- Adapter: `src/core/hardware/adapters/FXK32QModuleAdapter.ts`
- Bridge: `src/lib/fireoneModuleHardwareBridge.ts`
- Hook React: `src/hooks/useFXK32QBridge.ts`
- CLI bench: `scripts/fxk32q-diagnose.mjs` + `scripts/README-fxk32q-diagnose.md`
- Roadmap: `docs/ROADMAP_MASTER.md` §2 (hardware) + §3 (Fase 3 bench)
- Compat FireOne IFMx-i32Q: `mem://hardware/fireone-system`

---

_Atualizado: replicação do firmware v1.1.x sobre ESP32-S3. Qualquer divergência entre este doc e `src/lib/fxk32q/*.ts` → o **código é a fonte da verdade**; abrir PR para realinhar este arquivo._
