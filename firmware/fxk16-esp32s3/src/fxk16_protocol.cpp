// ─── FXK16 — ASCII protocol parser implementation ────────────────
#include "fxk16_protocol.h"
#include "fxk16_config.h"
#include "fxk16_relay.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

namespace fxk16 {

static char    s_buf[128];
static uint8_t s_len = 0;

static void emitf(ResponseSink sink, const char* fmt, ...) {
  if (!sink) return;
  char out[96];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(out, sizeof(out), fmt, ap);
  va_end(ap);
  sink(out);
}

static void handleLine(char* line, ResponseSink sink) {
  // Strip CR if any
  size_t n = strlen(line);
  while (n > 0 && (line[n-1] == '\r' || line[n-1] == ' ')) line[--n] = '\0';
  if (n == 0) return;

  // ── Lifecycle ────────────────────────────────────────────────
  if (strcmp(line, "HEARTBEAT") == 0) { sink("PONG"); return; }
  if (strcmp(line, "VERSION")   == 0) {
    // Reply 1: classic VER: token (consumed by handshake `waitForHandshake`).
    emitf(sink, "VER:%s-%s", FXK16_MODEL, FXK16_FW_VERSION);
    // Reply 2: identification banner — parsed by FireOneHardwareBridge's
    // generic token loop (split by ';'), so the app captures MODEL/CH on the
    // very first round-trip without needing a follow-up STATUS call.
    emitf(sink, "MODEL:%s;CH:%u;FW:%s",
          FXK16_MODEL, (unsigned)FXK16_CHANNELS, FXK16_FW_VERSION);
    return;
  }
  if (strcmp(line, "STATUS") == 0) {
    emitf(sink, "BAT:0.0;PINS:%u;RSSI:-30;MODEL:%s;CH:%u",
          (unsigned)pinsMask(), FXK16_MODEL, (unsigned)FXK16_CHANNELS);
    return;
  }
  // Explicit IDENTIFY alias — some discovery flows query this instead of
  // STATUS to avoid pulling battery/RSSI noise. Returns ONLY identification
  // tokens, in a single semicolon-separated line.
  if (strcmp(line, "IDENTIFY") == 0) {
    emitf(sink, "MODEL:%s;CH:%u;FW:%s;ID:%s",
          FXK16_MODEL, (unsigned)FXK16_CHANNELS, FXK16_FW_VERSION, FXK16_MODEL);
    return;
  }

  // ── ESTOP / RESET ────────────────────────────────────────────
  if (strcmp(line, "ESTOP") == 0) { estopLatch();   sink("OK:ESTOP"); return; }
  if (strcmp(line, "RESET") == 0) { estopRelease(); sink("OK:RESET"); return; }

  // ── FIRE:<pin>:<ms> ──────────────────────────────────────────
  if (strncmp(line, "FIRE:", 5) == 0) {
    int pin = 0, ms = 0;
    if (sscanf(line + 5, "%d:%d", &pin, &ms) == 2) {
      const char* err = nullptr;
      if (firePin((uint8_t)pin, (uint16_t)ms, &err)) {
        emitf(sink, "OK:FIRE:%d", pin);
      } else {
        emitf(sink, "ERR:FIRE:%d:%s", pin, err ? err : "UNKNOWN");
      }
    } else {
      sink("ERR:FIRE:0:PARSE");
    }
    return;
  }

  // ── BATCH:<mask>:<ms> (mask up to 16 bits, decimal or 0x...) ─
  if (strncmp(line, "BATCH:", 6) == 0) {
    char* p = line + 6;
    char* sep = strchr(p, ':');
    if (!sep) { sink("ERR:BATCH:PARSE"); return; }
    *sep = '\0';
    unsigned long mask = strtoul(p, nullptr, 0);
    int ms = atoi(sep + 1);
    if (fireMask((uint16_t)mask, (uint16_t)ms)) {
      emitf(sink, "OK:BATCH:%lu", mask);
    } else {
      emitf(sink, "ERR:BATCH:%lu:REJECTED", mask);
    }
    return;
  }

  // ── GPIO:<pin>:HIGH|LOW ──────────────────────────────────────
  if (strncmp(line, "GPIO:", 5) == 0) {
    int pin = 0;
    char level[8] = {0};
    if (sscanf(line + 5, "%d:%7s", &pin, level) == 2) {
      const bool high = (strcmp(level, "HIGH") == 0);
      const char* err = nullptr;
      if (gpioSet((uint8_t)pin, high, &err)) emitf(sink, "OK:GPIO:%d", pin);
      else                                   emitf(sink, "ERR:GPIO:%d:%s", pin, err ? err : "UNKNOWN");
    } else {
      sink("ERR:GPIO:PARSE");
    }
    return;
  }

  // ── CONT:<pin> / CDS:<pin> stubs (no ADC hardware in v1.0) ──
  if (strncmp(line, "CONT:", 5) == 0) {
    int pin = atoi(line + 5);
    emitf(sink, "CONT:%d:9999", pin);
    return;
  }
  if (strncmp(line, "CDS:", 4) == 0) {
    int pin = atoi(line + 4);
    emitf(sink, "CDS:%d:0.0", pin);
    return;
  }

  // Unknown command — stay quiet (mirrors FireOne behavior).
}

void protocolFeedByte(uint8_t b, ResponseSink sink) {
  if (b == '\n') {
    s_buf[s_len] = '\0';
    handleLine(s_buf, sink);
    s_len = 0;
    return;
  }
  if (s_len < sizeof(s_buf) - 1) {
    s_buf[s_len++] = (char)b;
  } else {
    // overflow → drop buffer to avoid wedge
    s_len = 0;
  }
}

}  // namespace fxk16
