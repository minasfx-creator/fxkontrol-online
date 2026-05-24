// ─── FXK32Q — Art-Net / sACN listener ────────────────────────────
// Recebe pacotes Art-Net (UDP 6454) e sACN E1.31 (UDP 5568) no universo
// configurado por SET_ARTNET. Cada canal DMX a partir de `startCh`
// mapeia para C1..C32. Threshold ARTNET_FIRE_THRESHOLD (>=128) dispara
// o relé com pulso fixo (FIRE_MAX_DURATION_MS / 50 = 100ms canônicos).
//
// Pass-through: o app já envia DMX via `ArtNetBridge.sendDmx(universe, bytes)`
// — o módulo vira uma saída pyro DMX equivalente ao IFMx-i32Q real.
#pragma once
#include <Arduino.h>

namespace fxk32q {

void artnetInit();    // chamada quando WiFi conecta
void artnetService(); // chame em loop()

}  // namespace fxk32q
