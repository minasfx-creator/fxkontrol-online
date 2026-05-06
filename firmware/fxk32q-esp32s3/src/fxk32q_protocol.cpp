// ─── FXK32Q — ASCII protocol parser implementation ───────────────
#include "fxk32q_protocol.h"
#include "fxk32q_config.h"
#include "fxk32q_pinmap.h"
#include "fxk32q_relay.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>

namespace fxk32q {

static RuntimeConfig s_cfg;
RuntimeConfig& cfg() { return s_cfg; }

static char    s_buf[160];
static uint8_t s_len = 0;

static void emitf(ResponseSink sink, const char* fmt, ...) {
  if (!sink) return;
  char out[128];
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(out, sizeof(out), fmt, ap);
  va_end(ap);
  sink(out);
}

static void handleLine(char* line, ResponseSink sink) {
  size_t n = strlen(line);
  while (n > 0 && (line[n-1] == '\r' || line[n-1] == ' ')) line[--n] = '\0';
  if (n == 0) return;

  // ── Lifecycle / identity ─────────────────────────────────────
  if (strcmp(line, "HEARTBEAT") == 0) { sink("PONG"); return; }
  if (strcmp(line, "VERSION")   == 0) {
    emitf(sink, "VER:%s-%s", FXK32Q_MODEL, FXK32Q_FW_VERSION);
    emitf(sink, "MODEL:%s;CH:%u;FW:%s",
          FXK32Q_MODEL, (unsigned)FXK32Q_CHANNELS, FXK32Q_FW_VERSION);
    return;
  }
  if (strcmp(line, "STATUS") == 0) {
    const uint32_t pins = pinsMask32();
    emitf(sink,
          "BAT:0.0;PINS:%lu;RSSI:-30;MODEL:%s;CH:%u;ART:%u;START:%u;RS485:%u;ARM:%u;ESTOP:%u",
          (unsigned long)pins, FXK32Q_MODEL, (unsigned)FXK32Q_CHANNELS,
          (unsigned)s_cfg.artnetUniverse, (unsigned)s_cfg.artnetStartCh,
          (unsigned)s_cfg.rs485Address,
          (unsigned)(isArmed() ? 1 : 0),
          (unsigned)(isEstopLatched() ? 1 : 0));
    return;
  }
  if (strcmp(line, "IDENTIFY") == 0) {
    emitf(sink, "MODEL:%s;CH:%u;FW:%s;ID:%s",
          FXK32Q_MODEL, (unsigned)FXK32Q_CHANNELS, FXK32Q_FW_VERSION, FXK32Q_MODEL);
    return;
  }

  // ── PINMAP — dump dos 32 canais ──────────────────────────────
  if (strcmp(line, "PINMAP") == 0) {
    for (uint8_t i = 0; i < FXK32Q_CHANNELS; i++) {
      const ChannelMap& row = CHANNEL_MAP[i];
      emitf(sink, "MAP:%u:GPIO%u:%s",
            (unsigned)row.channel, (unsigned)row.gpio, row.terminal);
    }
    sink("OK:PINMAP");
    return;
  }

  // ── ARM / DISARM (defense-in-depth firmware-side gate) ───────
  // ARM é negado se ESTOP estiver latched; DISARM sempre aceita.
  if (strcmp(line, "ARM") == 0) {
    if (isEstopLatched()) { sink("ERR:ARM:ESTOP_LATCHED"); return; }
    armSet(true);
    emitf(sink, "OK:ARM:%u", (unsigned)(isArmed() ? 1 : 0));
    return;
  }
  if (strcmp(line, "DISARM") == 0) {
    armSet(false);
    sink("OK:DISARM");
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

  // ── BATCH:<mask32>:<ms> ──────────────────────────────────────
  if (strncmp(line, "BATCH:", 6) == 0) {
    char* p = line + 6;
    char* sep = strchr(p, ':');
    if (!sep) { sink("ERR:BATCH:PARSE"); return; }
    *sep = '\0';
    unsigned long mask = strtoul(p, nullptr, 0);
    int ms = atoi(sep + 1);
    const char* err = nullptr;
    if (fireMask32((uint32_t)mask, (uint16_t)ms, &err)) {
      emitf(sink, "OK:BATCH:%lu", mask);
    } else {
      emitf(sink, "ERR:BATCH:%lu:%s", mask, err ? err : "REJECTED");
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

  // ── CONT:<pin> stub (sem ADC dedicado no v1.0) ──────────────
  if (strncmp(line, "CONT:", 5) == 0) {
    int pin = atoi(line + 5);
    emitf(sink, "CONT:%d:9999", pin);
    return;
  }

  // ── SET_ARTNET:<universe>:<startCh> ──────────────────────────
  if (strncmp(line, "SET_ARTNET:", 11) == 0) {
    int u = -1, s = -1;
    if (sscanf(line + 11, "%d:%d", &u, &s) == 2 &&
        u >= 0 && u <= 32767 && s >= 1 && s <= (513 - FXK32Q_CHANNELS)) {
      s_cfg.artnetUniverse = (uint16_t)u;
      s_cfg.artnetStartCh  = (uint16_t)s;
      emitf(sink, "OK:ART:%d:%d", u, s);
    } else {
      sink("ERR:ART:PARSE");
    }
    return;
  }

  // ── SET_RS485:<addr1..40> ────────────────────────────────────
  if (strncmp(line, "SET_RS485:", 10) == 0) {
    int addr = atoi(line + 10);
    if (addr >= 1 && addr <= 40) {
      s_cfg.rs485Address = (uint8_t)addr;
      emitf(sink, "OK:RS485:%d", addr);
    } else {
      sink("ERR:RS485:OUT_OF_RANGE");
    }
    return;
  }

  // Comando desconhecido — silêncio (mesmo comportamento do FireOne).
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
    s_len = 0;
  }
}

}  // namespace fxk32q
