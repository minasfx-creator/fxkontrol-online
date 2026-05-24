// ─── FXK16 — Canonical channel↔GPIO↔relay-terminal mapping ────────
// SINGLE SOURCE OF TRUTH for the wiring contract between:
//   • Host app channel index   (1..16, what the show plan addresses)
//   • ESP32-S3 v1.3 GPIO pin   (what the firmware drives)
//   • 16-relay module terminal (IN1..IN16, where the wire is screwed)
//
// Rule: channel N controls EXACTLY one relay (IN<N>) via EXACTLY one
// GPIO. No multiplexing, no shift registers, no shared lines.
//
// If you change a row here, update docs/PINMAP.md in the same commit.
#pragma once
#include <Arduino.h>
#include "fxk16_config.h"

namespace fxk16 {

struct ChannelMap {
  uint8_t     channel;     // 1-based (C1..C16) — what the app addresses
  uint8_t     gpio;        // ESP32-S3 GPIO number — what the firmware drives
  const char* terminal;    // Silkscreen label on the 16-relay board (IN1..IN16)
};

// Canonical table. Order matches RELAY_PINS[] in fxk16_config.h — index N
// in RELAY_PINS == row N here, so they cannot drift.
static constexpr ChannelMap CHANNEL_MAP[FXK16_CHANNELS] = {
  { 1,   4, "IN1"  },
  { 2,   5, "IN2"  },
  { 3,   6, "IN3"  },
  { 4,   7, "IN4"  },
  { 5,  15, "IN5"  },
  { 6,  16, "IN6"  },
  { 7,  35, "IN7"  },
  { 8,  36, "IN8"  },
  { 9,  17, "IN9"  },
  { 10, 18, "IN10" },
  { 11,  8, "IN11" },
  { 12,  9, "IN12" },
  { 13, 10, "IN13" },
  { 14, 11, "IN14" },
  { 15, 12, "IN15" },
  { 16, 13, "IN16" },
};

// Compile-time guarantees: 1-to-1 channel↔relay binding.
static_assert(sizeof(CHANNEL_MAP) / sizeof(CHANNEL_MAP[0]) == FXK16_CHANNELS,
              "CHANNEL_MAP must have exactly FXK16_CHANNELS rows");

// Verify the map matches the runtime RELAY_PINS array used by the driver.
// (Constexpr loop runs at compile time — any mismatch fails the build.)
constexpr bool _pinmapMatchesRelayPins() {
  for (uint8_t i = 0; i < FXK16_CHANNELS; i++) {
    if (CHANNEL_MAP[i].channel != (uint8_t)(i + 1)) return false;
    if (CHANNEL_MAP[i].gpio    != RELAY_PINS[i])   return false;
  }
  return true;
}
static_assert(_pinmapMatchesRelayPins(),
              "CHANNEL_MAP rows must mirror RELAY_PINS[] order");

// Verify GPIO uniqueness — no two channels can share a pin.
constexpr bool _pinmapGpiosUnique() {
  for (uint8_t i = 0; i < FXK16_CHANNELS; i++) {
    for (uint8_t j = i + 1; j < FXK16_CHANNELS; j++) {
      if (CHANNEL_MAP[i].gpio == CHANNEL_MAP[j].gpio) return false;
    }
  }
  return true;
}
static_assert(_pinmapGpiosUnique(),
              "Each channel must drive a UNIQUE GPIO (no shared lines)");

// Lookup helpers (host code never needs to peek at the table directly).
inline uint8_t gpioForChannel(uint8_t channel1Based) {
  if (channel1Based < 1 || channel1Based > FXK16_CHANNELS) return 0xFF;
  return CHANNEL_MAP[channel1Based - 1].gpio;
}
inline const char* terminalForChannel(uint8_t channel1Based) {
  if (channel1Based < 1 || channel1Based > FXK16_CHANNELS) return "?";
  return CHANNEL_MAP[channel1Based - 1].terminal;
}

}  // namespace fxk16
