// ─── FXK32Q — Relay driver + safety state (32 canais) ────────────
#pragma once
#include <Arduino.h>
#include "fxk32q_config.h"

namespace fxk32q {

void relayInit();
bool firePin(uint8_t pin1Based, uint16_t durationMs, const char** errOut);
bool fireMask32(uint32_t mask, uint16_t durationMs, const char** errOut = nullptr);
bool gpioSet(uint8_t pin1Based, bool high, const char** errOut);

void estopLatch();
void estopRelease();
bool isEstopLatched();

// ── ARM gate (defense-in-depth, espelha a gate client-side) ──────
// FIRE/BATCH retornam ERR:NOT_ARMED se !armed. ESTOP latch ⇒ disarm
// automático. ARM auto-expira em ARM_TIMEOUT_MS se nenhum comando
// válido chegar (defesa contra link-fantasma).
void     armSet(bool on);
bool     isArmed();
void     armNoteActivity();
void     armServiceTimeout();

uint32_t pinsMask32();
void serviceTimers();

}  // namespace fxk32q
