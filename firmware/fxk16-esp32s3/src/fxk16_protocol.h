// ─── FXK16 — ASCII protocol parser ────────────────────────────────
// Single-line commands terminated by '\n'. Same contract used by
// FireOneHardwareBridge in the FX Kontrol app.
#pragma once
#include <Arduino.h>

namespace fxk16 {

// Sink: caller-provided function to emit a response line (without trailing \n).
typedef void (*ResponseSink)(const char* line);

// Feed one byte from any transport (USB-CDC, BLE, Serial1...).
// When a complete line is received, the protocol handler runs and may
// invoke `sink` zero or more times.
void protocolFeedByte(uint8_t b, ResponseSink sink);

}  // namespace fxk16
