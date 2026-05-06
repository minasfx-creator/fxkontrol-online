// ─── FXK32Q — Build-time configuration ────────────────────────────
// Réplica melhorada do FireOne IFMx-i32Q (32 canais DMX→pyro):
//   • 1× ESP32-S3 v1.3 (DevKitC-1 / 8MB)
//   • 2× placas de relé 16ch ativas-baixas (JQC-3FF / Songle)
//   • USB-CDC + BLE NimBLE + Wi-Fi (STA + AP) + Art-Net UDP +
//     RS-485 slave compatível com FireOne XLII+ (rota cabo)
//
// Compatibilidade:
//   • Mesmo handshake ASCII do FXK16 (`MODEL:`, `CH:`) — host promove
//     o adapter automaticamente assim que recebe `MODEL:FXK32Q;CH:32`.
//   • Mesmas UUIDs BLE (`0000ffe0/ffe1/ffe2`) — funciona com o pareamento
//     genérico já implantado em `fxk16BleHandshake.ts`.
//   • Slave RS-485 fala o frame XLII+ (`fireoneProtocol.ts`) no endereço
//     configurado, então o host enxerga o módulo como um IFMx-i32Q nativo.
#pragma once
#include <Arduino.h>

#ifndef FXK32Q_FW_VERSION
#define FXK32Q_FW_VERSION "1.1.0"
#endif

#define FXK32Q_MODEL          "FXK32Q"
#define FXK32Q_CHANNELS       32
#define FXK32Q_BLE_NAME_PREFIX "FXK32Q"

// Mapa direto C1..C32 → GPIO. Os 16 primeiros espelham o FXK16 (paridade
// elétrica entre placas). Os 16 seguintes usam GPIOs estendidos do S3
// evitando strapping (0,3,45,46), USB-OTG (19,20) e flash (26-32).
//
//   Banco A (C1..C16)   → mesmo do FXK16
//   Banco B (C17..C32)  → GPIOs 38,39,40,41,42,47, 1,2 + headers extras
static constexpr uint8_t RELAY_PINS[FXK32Q_CHANNELS] = {
  // Banco A — espelho exato do FXK16
   4,  5,  6,  7,   // C1..C4
  15, 16, 35, 36,   // C5..C8
  17, 18,  8,  9,   // C9..C12
  10, 11, 12, 13,   // C13..C16
  // Banco B — extensão de 16 canais
  38, 39, 40, 41,   // C17..C20
  42, 47,  1,  2,   // C21..C24
  37, 33, 34, 45,   // C25..C28 (45 é strapping — usar com pull-up dedicado)
  46, 48, 21, 14    // C29..C32 (compartilha LED/jumper/ESTOP em headers livres)
};

// Active-LOW relays (JQC-3FF / Songle modules):
//   LOW  = relay closed (fires)
//   HIGH = relay open   (safe)
#define RELAY_ACTIVE_LEVEL    LOW
#define RELAY_INACTIVE_LEVEL  HIGH

// Auxiliary GPIOs (compartilhados com os pinos de canal apenas no protótipo —
// na placa final o LED heartbeat sai num GPIO dedicado de status; aqui
// reaproveitamos para caber no DevKitC-1 sem expansor).
#define LED_HEARTBEAT_PIN     48   // on-board RGB do DevKitC-1 (também C30)
#define ESTOP_BUTTON_PIN      14   // INPUT_PULLUP, ativo LOW (também C32)
#define UNSAFE_GPIO_JUMPER    21   // INPUT_PULLUP, LOW libera comando GPIO (também C31)

// RS-485 (UART1) — MAX485 transceiver compartilhado DE/RE
#define RS485_UART_NUM        1
#define RS485_TX_PIN          43
#define RS485_RX_PIN          44
#define RS485_DE_PIN          3    // OUTPUT — HIGH = transmit, LOW = receive
#define RS485_BAUD            9600 // FireOne XLII+ canonical

// Art-Net / sACN
#define ARTNET_UDP_PORT       6454
#define SACN_UDP_PORT         5568
// Threshold a partir do qual um canal DMX dispara o relé (compat IFMx-i32Q).
#define ARTNET_FIRE_THRESHOLD 128

// Safety limits (hardcoded — do not weaken at runtime)
#define FIRE_MAX_DURATION_MS  5000
#define WATCHDOG_TIMEOUT_S    2
#define HEARTBEAT_BLINK_MS    500

#ifndef FXK32Q_SELFTEST_PULSE_MS
#define FXK32Q_SELFTEST_PULSE_MS  30
#endif
#ifndef FXK32Q_SELFTEST_GAP_MS
#define FXK32Q_SELFTEST_GAP_MS    70
#endif
