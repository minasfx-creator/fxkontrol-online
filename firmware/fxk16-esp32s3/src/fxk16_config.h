// ─── FXK16 — Build-time configuration ─────────────────────────────
#pragma once
#include <Arduino.h>

#ifndef FXK16_FW_VERSION
#define FXK16_FW_VERSION "1.0.0"
#endif

#define FXK16_MODEL          "FXK16"
#define FXK16_CHANNELS       16
#define FXK16_BLE_NAME_PREFIX "FXK16"

// Direct mapping: C1->RELAY_PINS[0], C2->RELAY_PINS[1], ..., C16->RELAY_PINS[15].
// Avoids strapping pins (0, 3, 45, 46) and USB-OTG pins (19, 20).
static const uint8_t RELAY_PINS[FXK16_CHANNELS] = {
   4,  5,  6,  7,   // C1..C4
  15, 16, 35, 36,   // C5..C8
  17, 18,  8,  9,   // C9..C12
  10, 11, 12, 13    // C13..C16
};

// Active-LOW relays (JQC-3FF / Songle modules):
//   LOW  = relay closed (fires)
//   HIGH = relay open   (safe)
#define RELAY_ACTIVE_LEVEL    LOW
#define RELAY_INACTIVE_LEVEL  HIGH

// Auxiliary GPIOs
#define LED_HEARTBEAT_PIN     48   // on-board RGB on DevKitC-1
#define ESTOP_BUTTON_PIN      14   // INPUT_PULLUP, active LOW
#define UNSAFE_GPIO_JUMPER    21   // INPUT_PULLUP, LOW unlocks raw GPIO command

// Safety limits (hardcoded — do not weaken at runtime)
#define FIRE_MAX_DURATION_MS  5000
#define WATCHDOG_TIMEOUT_S    2
#define HEARTBEAT_BLINK_MS    500

// ── Optional boot self-test ───────────────────────────────────────
// Define FXK16_BOOT_SELFTEST at compile time (e.g. via platformio.ini
// `build_flags = -DFXK16_BOOT_SELFTEST`) to pulse each relay sequentially
// at boot. Intended for bench bring-up ONLY — the routine refuses to run
// unless the UNSAFE_GPIO_JUMPER is shorted to GND, so an unattended unit
// in the field will NEVER fire ignitors at power-on even if the flag was
// left enabled by mistake. Pulse width and inter-channel gap are tunable.
#ifndef FXK16_SELFTEST_PULSE_MS
#define FXK16_SELFTEST_PULSE_MS  30
#endif
#ifndef FXK16_SELFTEST_GAP_MS
#define FXK16_SELFTEST_GAP_MS    70
#endif
