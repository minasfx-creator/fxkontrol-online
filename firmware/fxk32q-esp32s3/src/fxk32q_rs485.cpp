// ─── FXK32Q — FireOne XLII+ RS-485 slave implementation ─────────
#include "fxk32q_rs485.h"
#include "fxk32q_config.h"
#include "fxk32q_protocol.h"
#include "fxk32q_relay.h"
#include <HardwareSerial.h>

namespace fxk32q {

static HardwareSerial s_uart(RS485_UART_NUM);

// Frame constants — mirror src/lib/fireoneProtocol.ts
static constexpr uint8_t STX = 0x02;
static constexpr uint8_t ETX = 0x03;
static constexpr uint8_t ACK = 0x06;
static constexpr uint8_t NAK = 0x15;
static constexpr uint8_t BCAST = 0x00;

enum FireOneCmd : uint8_t {
  CMD_ARM        = 0x41,
  CMD_DISARM     = 0x44,
  CMD_FIRE       = 0x46,
  CMD_ESTOP      = 0x58,
  CMD_STATUS     = 0x53,
  CMD_CONT       = 0x43,
  CMD_HEARTBEAT  = 0x48,
  CMD_IDENTIFY   = 0x49,
  CMD_RESET      = 0x52,
};

static bool s_armed = false;

// Buffer de recepção: STX + ADDR + CMD + PAYLOAD<= 64 + CKSUM + ETX
static uint8_t s_rx[80];
static uint8_t s_rxLen = 0;
static bool    s_inFrame = false;

static uint8_t computeChecksum(const uint8_t* data, uint8_t len) {
  uint8_t s = 0;
  for (uint8_t i = 0; i < len; i++) s ^= data[i];
  return s;
}

static void rs485Send(const uint8_t* data, uint8_t len) {
  digitalWrite(RS485_DE_PIN, HIGH);
  delayMicroseconds(50);
  s_uart.write(data, len);
  s_uart.flush();
  delayMicroseconds(50);
  digitalWrite(RS485_DE_PIN, LOW);
}

static void respondAck(uint8_t cmd) {
  uint8_t frame[6] = { STX, cfg().rs485Address, ACK, cmd, 0, ETX };
  frame[4] = computeChecksum(&frame[1], 3);
  rs485Send(frame, 6);
}

static void respondNak(uint8_t cmd, uint8_t reason) {
  uint8_t frame[7] = { STX, cfg().rs485Address, NAK, cmd, reason, 0, ETX };
  frame[5] = computeChecksum(&frame[1], 4);
  rs485Send(frame, 7);
}

static void respondData(uint8_t cmd, const uint8_t* payload, uint8_t plen) {
  uint8_t out[80];
  out[0] = STX;
  out[1] = cfg().rs485Address;
  out[2] = ACK;
  out[3] = cmd;
  for (uint8_t i = 0; i < plen; i++) out[4 + i] = payload[i];
  out[4 + plen] = computeChecksum(&out[1], 3 + plen);
  out[5 + plen] = ETX;
  rs485Send(out, 6 + plen);
}

static void handleFrame(const uint8_t* frame, uint8_t len) {
  // [STX][ADDR][CMD][PAYLOAD...][CKSUM][ETX]
  if (len < 5) return;
  const uint8_t addr = frame[1];
  const uint8_t cmd  = frame[2];
  const uint8_t plen = len - 5;
  const uint8_t* payload = &frame[3];
  const uint8_t cksum = frame[3 + plen];
  if (frame[4 + plen] != ETX) return;
  if (computeChecksum(&frame[1], 2 + plen) != cksum) return;

  // Filtra endereço — exceto E-STOP (broadcast 0x00) que TODOS escutam.
  const bool forUs = (addr == cfg().rs485Address) || (addr == BCAST && cmd == CMD_ESTOP);
  if (!forUs) return;

  switch (cmd) {
    case CMD_ARM:    s_armed = true;  respondAck(cmd); break;
    case CMD_DISARM: s_armed = false; respondAck(cmd); break;
    case CMD_FIRE: {
      if (plen < 3) { respondNak(cmd, 0x01); break; }
      const uint8_t  pin = payload[0];
      const uint16_t ms  = (uint16_t(payload[1]) << 8) | payload[2];
      if (!s_armed) { respondNak(cmd, 0x10); break; }
      const char* err = nullptr;
      if (firePin(pin, ms, &err)) respondAck(cmd);
      else                        respondNak(cmd, 0x20);
      break;
    }
    case CMD_ESTOP:
      estopLatch();
      s_armed = false;
      respondAck(cmd);
      break;
    case CMD_RESET:
      estopRelease();
      respondAck(cmd);
      break;
    case CMD_STATUS: {
      uint8_t pl[8];
      const uint32_t pins = pinsMask32();
      pl[0] = (uint8_t)(pins      & 0xFF);
      pl[1] = (uint8_t)((pins>>8) & 0xFF);
      pl[2] = (uint8_t)((pins>>16)& 0xFF);
      pl[3] = (uint8_t)((pins>>24)& 0xFF);
      pl[4] = isEstopLatched() ? 1 : 0;
      pl[5] = s_armed ? 1 : 0;
      pl[6] = FXK32Q_CHANNELS;
      pl[7] = 0; // RSSI placeholder
      respondData(cmd, pl, 8);
      break;
    }
    case CMD_CONT: {
      if (plen < 1) { respondNak(cmd, 0x01); break; }
      const uint8_t pin = payload[0];
      // Stub: 9999 ohms = open. Substituir por leitura ADC quando o
      // hardware de continuidade estiver presente.
      uint8_t pl[3] = { pin, 0x27, 0x0F }; // 9999 = 0x270F
      respondData(cmd, pl, 3);
      break;
    }
    case CMD_HEARTBEAT: respondAck(cmd); break;
    case CMD_IDENTIFY: {
      // Payload textual curtinha p/ o app reconhecer como IFMx-i32Q-replica.
      static const char* id = "FXK32Q";
      respondData(cmd, (const uint8_t*)id, 6);
      break;
    }
    default:
      respondNak(cmd, 0xFF);
      break;
  }
}

void rs485Init() {
  pinMode(RS485_DE_PIN, OUTPUT);
  digitalWrite(RS485_DE_PIN, LOW); // RX por padrão
  s_uart.begin(RS485_BAUD, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
}

void rs485Service() {
  while (s_uart.available()) {
    uint8_t b = (uint8_t)s_uart.read();
    if (!s_inFrame) {
      if (b == STX) {
        s_inFrame = true;
        s_rxLen = 0;
        s_rx[s_rxLen++] = b;
      }
      continue;
    }
    if (s_rxLen >= sizeof(s_rx)) { s_inFrame = false; s_rxLen = 0; continue; }
    s_rx[s_rxLen++] = b;
    if (b == ETX && s_rxLen >= 5) {
      handleFrame(s_rx, s_rxLen);
      s_inFrame = false;
      s_rxLen = 0;
    }
  }
}

}  // namespace fxk32q
