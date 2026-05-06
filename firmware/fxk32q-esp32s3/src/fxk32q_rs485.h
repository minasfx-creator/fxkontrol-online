// ─── FXK32Q — FireOne XLII+ RS-485 slave ─────────────────────────
// Espelha o frame `[STX][ADDR][CMD][PAYLOAD][CKSUM][ETX]` (9600 8N1)
// definido em `src/lib/fireoneProtocol.ts`. Permite que o FXK32Q seja
// endereçado por uma mesa XLII+ original (ou pelo app via cabo USB-RS-485)
// como se fosse um IFMx-i32Q nativo.
//
// Comandos respondidos:
//   ARM (0x41) → mantém estado armado interno; sem efeito físico
//   DISARM (0x44) → desarma + estopRelease() se latched? não — apenas flag
//   FIRE (0x46) PAYLOAD: pin(1) ms_hi(1) ms_lo(1) → firePin(...)
//   CONT (0x43) PAYLOAD: pin(1) → CONT:<pin>:<ohms>
//   STATUS (0x53) → resposta com PINS/BAT/RSSI
//   HEARTBEAT (0x48) → ACK
//   IDENTIFY (0x49) → MODEL/CH
//   ESTOP (0x58) (broadcast) → estopLatch()
//   RESET (0x52) → estopRelease()
#pragma once
#include <Arduino.h>

namespace fxk32q {

void rs485Init();
void rs485Service();   // chame em loop()

}  // namespace fxk32q
