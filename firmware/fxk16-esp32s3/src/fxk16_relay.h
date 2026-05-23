// ─── FXK16 — Relay driver + safety state ──────────────────────────
#pragma once
#include <Arduino.h>
#include "fxk16_config.h"

namespace fxk16 {

void relayInit();              // boot-safe: all pins HIGH (open) before any I/O
bool firePin(uint8_t pin1Based, uint16_t durationMs, const char** errOut);
bool fireMask(uint16_t mask, uint16_t durationMs);
bool gpioSet(uint8_t pin1Based, bool high, const char** errOut);

void estopLatch();             // open all relays, latch until reset
void estopRelease();           // operator-initiated unlatch
bool isEstopLatched();

uint16_t pinsMask();           // current snapshot of channel states (1=closed)
void serviceTimers();          // call every loop() — auto-opens expired pulses

}  // namespace fxk16
