// ─── FXK32Q — Relay driver + safety state (32 canais) ────────────
#pragma once
#include <Arduino.h>
#include "fxk32q_config.h"

namespace fxk32q {

void relayInit();
bool firePin(uint8_t pin1Based, uint16_t durationMs, const char** errOut);
bool fireMask32(uint32_t mask, uint16_t durationMs);
bool gpioSet(uint8_t pin1Based, bool high, const char** errOut);

void estopLatch();
void estopRelease();
bool isEstopLatched();

uint32_t pinsMask32();
void serviceTimers();

}  // namespace fxk32q
