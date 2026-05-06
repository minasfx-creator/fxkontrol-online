// ─── FXK32Q — Art-Net / sACN listener implementation ────────────
#include "fxk32q_artnet.h"
#include "fxk32q_config.h"
#include "fxk32q_protocol.h"
#include "fxk32q_relay.h"
#include <WiFi.h>
#include <WiFiUdp.h>

namespace fxk32q {

static WiFiUDP s_artnet;
static WiFiUDP s_sacn;
static bool    s_armedDmx[FXK32Q_CHANNELS] = {false};
static const uint16_t DMX_PULSE_MS = 100;

// Header Art-Net "Art-Net\0" ID (8 bytes) + opcode 0x5000 (OpDmx) LE.
static bool isArtDmx(const uint8_t* p, size_t n) {
  return n >= 18 && memcmp(p, "Art-Net\0", 8) == 0
      && p[8] == 0x00 && p[9] == 0x50;
}
static uint16_t artUniverse(const uint8_t* p) {
  return (uint16_t)p[14] | ((uint16_t)p[15] << 8);
}
static const uint8_t* artData(const uint8_t* p) { return p + 18; }
static uint16_t       artLen (const uint8_t* p) { return ((uint16_t)p[16] << 8) | p[17]; }

static void processDmx(const uint8_t* dmx, uint16_t dmxLen) {
  const uint16_t start = cfg().artnetStartCh; // 1-based
  for (uint8_t ch = 0; ch < FXK32Q_CHANNELS; ch++) {
    const uint16_t idx = start + ch - 1; // 0-based no buffer DMX
    if (idx >= dmxLen) break;
    const uint8_t value = dmx[idx];
    const bool firing = value >= ARTNET_FIRE_THRESHOLD;
    if (firing && !s_armedDmx[ch]) {
      const char* err = nullptr;
      if (firePin(ch + 1, DMX_PULSE_MS, &err)) {
        s_armedDmx[ch] = true;
      }
    } else if (!firing && s_armedDmx[ch]) {
      s_armedDmx[ch] = false; // pronto para re-disparar na próxima borda
    }
  }
}

void artnetInit() {
  s_artnet.begin(ARTNET_UDP_PORT);
  s_sacn.begin(SACN_UDP_PORT);
}

void artnetService() {
  uint8_t buf[600];
  // Art-Net
  int n = s_artnet.parsePacket();
  if (n > 0 && n <= (int)sizeof(buf)) {
    const int read = s_artnet.read(buf, n);
    if (read > 0 && isArtDmx(buf, read)) {
      if (artUniverse(buf) == cfg().artnetUniverse) {
        processDmx(artData(buf), artLen(buf));
      }
    }
  }
  // sACN E1.31 — header básico: bytes 113..114 são universo (BE),
  // bytes 125..125+len são DMX start code + slots. Mantemos parsing
  // mínimo; threshold idêntico.
  n = s_sacn.parsePacket();
  if (n > 125 && n <= (int)sizeof(buf)) {
    const int read = s_sacn.read(buf, n);
    if (read > 125) {
      const uint16_t univ = ((uint16_t)buf[113] << 8) | buf[114];
      if (univ == cfg().artnetUniverse) {
        // DMX data inicia em offset 126 (após start code 0x00 em 125)
        const uint16_t dmxLen = (uint16_t)(read - 126);
        processDmx(&buf[126], dmxLen);
      }
    }
  }
}

}  // namespace fxk32q
