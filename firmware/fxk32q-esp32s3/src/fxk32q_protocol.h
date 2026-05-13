// ─── FXK32Q — ASCII protocol parser ──────────────────────────────
// Compatível 1:1 com `FireOneHardwareBridge` (mesmo do FXK16),
// estendido para 32 canais e com comandos extras de configuração:
//   SET_ARTNET:<universe>:<startCh>
//   SET_RS485:<addr1..40>
#pragma once
#include <Arduino.h>

namespace fxk32q {

typedef void (*ResponseSink)(const char* line);

// Configuração persistida (em RAM por enquanto; flash em release).
struct RuntimeConfig {
  uint16_t artnetUniverse = 0;
  uint16_t artnetStartCh  = 1;     // canal DMX (1..512) que mapeia para C1
  uint8_t  rs485Address   = 1;     // endereço FireOne XLII+ (1..40)
};
RuntimeConfig& cfg();

void protocolFeedByte(uint8_t b, ResponseSink sink);

}  // namespace fxk32q
