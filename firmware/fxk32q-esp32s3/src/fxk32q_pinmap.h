// ─── FXK32Q — Canonical channel↔GPIO↔relay-terminal mapping ──────
// SINGLE SOURCE OF TRUTH para a fiação dos 32 canais entre:
//   • índice de canal do app  (1..32, o que o show plan endereça)
//   • GPIO da ESP32-S3        (o que o firmware aciona)
//   • terminal IN1..IN32 das duas placas de relé 16ch (Banco A IN1..16,
//     Banco B IN17..32)
//
// Regra: canal N controla EXATAMENTE um relé via EXATAMENTE um GPIO.
// Sem multiplex, sem shift register, sem linhas compartilhadas.
#pragma once
#include <Arduino.h>
#include "fxk32q_config.h"

namespace fxk32q {

struct ChannelMap {
  uint8_t     channel;
  uint8_t     gpio;
  const char* terminal;
};

static constexpr ChannelMap CHANNEL_MAP[FXK32Q_CHANNELS] = {
  // Banco A
  { 1,   4, "A:IN1"  }, { 2,   5, "A:IN2"  }, { 3,   6, "A:IN3"  }, { 4,   7, "A:IN4"  },
  { 5,  15, "A:IN5"  }, { 6,  16, "A:IN6"  }, { 7,  35, "A:IN7"  }, { 8,  36, "A:IN8"  },
  { 9,  17, "A:IN9"  }, {10,  18, "A:IN10" }, {11,   8, "A:IN11" }, {12,   9, "A:IN12" },
  {13,  10, "A:IN13" }, {14,  11, "A:IN14" }, {15,  12, "A:IN15" }, {16,  13, "A:IN16" },
  // Banco B
  {17,  38, "B:IN1"  }, {18,  39, "B:IN2"  }, {19,  40, "B:IN3"  }, {20,  41, "B:IN4"  },
  {21,  42, "B:IN5"  }, {22,  47, "B:IN6"  }, {23,   1, "B:IN7"  }, {24,   2, "B:IN8"  },
  {25,  37, "B:IN9"  }, {26,  33, "B:IN10" }, {27,  34, "B:IN11" }, {28,  45, "B:IN12" },
  {29,  46, "B:IN13" }, {30,  48, "B:IN14" }, {31,  21, "B:IN15" }, {32,  14, "B:IN16" },
};

static_assert(sizeof(CHANNEL_MAP)/sizeof(CHANNEL_MAP[0]) == FXK32Q_CHANNELS,
              "CHANNEL_MAP must have exactly FXK32Q_CHANNELS rows");

constexpr bool _pinmapMatchesRelayPins() {
  for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
    if (CHANNEL_MAP[i].channel != (uint8_t)(i + 1)) return false;
    if (CHANNEL_MAP[i].gpio    != RELAY_PINS[i])   return false;
  }
  return true;
}
static_assert(_pinmapMatchesRelayPins(),
              "CHANNEL_MAP rows must mirror RELAY_PINS[] order");

constexpr bool _pinmapGpiosUnique() {
  for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
    for (uint8_t j = i + 1; j < FXK32Q_CHANNELS; j++) {
      if (CHANNEL_MAP[i].gpio == CHANNEL_MAP[j].gpio) return false;
    }
  }
  return true;
}
static_assert(_pinmapGpiosUnique(),
              "Each channel must drive a UNIQUE GPIO (no shared lines)");

inline uint8_t gpioForChannel(uint8_t channel1Based) {
  if (channel1Based < 1 || channel1Based > FXK32Q_CHANNELS) return 0xFF;
  return CHANNEL_MAP[channel1Based - 1].gpio;
}
inline const char* terminalForChannel(uint8_t channel1Based) {
  if (channel1Based < 1 || channel1Based > FXK32Q_CHANNELS) return "?";
  return CHANNEL_MAP[channel1Based - 1].terminal;
}

}  // namespace fxk32q
