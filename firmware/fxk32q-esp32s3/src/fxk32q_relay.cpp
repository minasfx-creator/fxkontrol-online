// ─── FXK32Q — Relay driver implementation (32 canais) ────────────
#include "fxk32q_relay.h"

namespace fxk32q {

#ifndef FXK32Q_ARM_TIMEOUT_MS
#define FXK32Q_ARM_TIMEOUT_MS 30000  // 30 s sem atividade ⇒ auto-disarm
#endif

static volatile bool s_estopLatched = false;
static volatile bool s_armed        = false;
static uint32_t      s_armActivityMs = 0;
static uint32_t      s_pulseEndMs[FXK32Q_CHANNELS] = {0};
static bool          s_pinClosed[FXK32Q_CHANNELS]  = {false};

static inline void writeRelay(uint8_t idx, bool closed) {
  digitalWrite(RELAY_PINS[idx], closed ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
  s_pinClosed[idx] = closed;
}

void relayInit() {
  for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
    digitalWrite(RELAY_PINS[i], RELAY_INACTIVE_LEVEL);
    pinMode(RELAY_PINS[i], OUTPUT);
    digitalWrite(RELAY_PINS[i], RELAY_INACTIVE_LEVEL);
    s_pinClosed[i]  = false;
    s_pulseEndMs[i] = 0;
  }
  s_estopLatched = false;
  s_armed        = false;
  s_armActivityMs = 0;
}

void armSet(bool on) {
  // ESTOP latched: ARM ignorado (fail-safe).
  if (on && s_estopLatched) { s_armed = false; return; }
  s_armed = on;
  s_armActivityMs = millis();
}
bool isArmed() { return s_armed && !s_estopLatched; }
void armNoteActivity() { s_armActivityMs = millis(); }
void armServiceTimeout() {
  if (!s_armed) return;
  if ((uint32_t)(millis() - s_armActivityMs) > FXK32Q_ARM_TIMEOUT_MS) s_armed = false;
}

bool firePin(uint8_t pin1Based, uint16_t durationMs, const char** errOut) {
  if (s_estopLatched) { if (errOut) *errOut = "ESTOP_LATCHED"; return false; }
  if (!s_armed)       { if (errOut) *errOut = "NOT_ARMED";     return false; }
  if (pin1Based < 1 || pin1Based > FXK32Q_CHANNELS) {
    if (errOut) *errOut = "OUT_OF_RANGE"; return false;
  }
  if (durationMs == 0 || durationMs > FIRE_MAX_DURATION_MS) {
    if (errOut) *errOut = "BAD_DURATION"; return false;
  }
  const uint8_t idx = pin1Based - 1;
  writeRelay(idx, true);
  s_pulseEndMs[idx] = millis() + durationMs;
  armNoteActivity();
  return true;
}

bool fireMask32(uint32_t mask, uint16_t durationMs, const char** errOut) {
  if (s_estopLatched) { if (errOut) *errOut = "ESTOP_LATCHED"; return false; }
  if (!s_armed)       { if (errOut) *errOut = "NOT_ARMED";     return false; }
  if (mask == 0)      { if (errOut) *errOut = "EMPTY_MASK";    return false; }
  if (durationMs == 0 || durationMs > FIRE_MAX_DURATION_MS) {
    if (errOut) *errOut = "BAD_DURATION"; return false;
  }
  const uint32_t endAt = millis() + durationMs;
  for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
    if (mask & (1u << i)) {
      writeRelay(i, true);
      s_pulseEndMs[i] = endAt;
    }
  }
  armNoteActivity();
  return true;
}

bool gpioSet(uint8_t pin1Based, bool high, const char** errOut) {
  if (digitalRead(UNSAFE_GPIO_JUMPER) == HIGH) {
    if (errOut) *errOut = "LOCKED";
    return false;
  }
  if (pin1Based < 1 || pin1Based > FXK32Q_CHANNELS) {
    if (errOut) *errOut = "OUT_OF_RANGE";
    return false;
  }
  const uint8_t idx = pin1Based - 1;
  digitalWrite(RELAY_PINS[idx], high ? HIGH : LOW);
  s_pinClosed[idx] = (high ? HIGH : LOW) == RELAY_ACTIVE_LEVEL;
  s_pulseEndMs[idx] = 0;
  return true;
}

void estopLatch() {
  s_estopLatched = true;
  s_armed = false;  // ESTOP sempre desarma
  for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
    writeRelay(i, false);
    s_pulseEndMs[i] = 0;
  }
}

void estopRelease() { s_estopLatched = false; }
bool isEstopLatched() { return s_estopLatched; }

uint32_t pinsMask32() {
  uint32_t mask = 0;
  for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
    if (s_pinClosed[i]) mask |= (1u << i);
  }
  return mask;
}

void serviceTimers() {
  const uint32_t now = millis();
  for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
    if (s_pulseEndMs[i] != 0 && (int32_t)(now - s_pulseEndMs[i]) >= 0) {
      writeRelay(i, false);
      s_pulseEndMs[i] = 0;
    }
  }
}

}  // namespace fxk32q
