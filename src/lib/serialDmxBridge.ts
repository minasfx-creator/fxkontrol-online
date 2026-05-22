/**
 * ─── Serial DMX Bridge ──────────────────────────────────────────────
 * Sincroniza o estado dos canais SFX (useSfxChannelStore) → buffer
 * DMX do serialDmxAdapter. Idle = todos os canais em 0; quando um
 * disparo é solicitado pelo Live Firing, o nível é elevado pelo
 * tempo do pulso e volta a 0.
 *
 * Esta camada NÃO arma pirotecnia; apenas espelha os níveis lógicos
 * que já passam pela SafetyStateMachine no caminho UI → ShowPlan →
 * CommandBus. É segura para fixtures genéricos (laser/dimmer).
 */

import { serialDmxAdapter } from "./serialDmxAdapter";
import { useSfxChannelStore } from "@/store/useSfxChannelStore";

let unsub: (() => void) | null = null;

export function startSerialDmxBridge(): void {
  if (unsub) return;
  const apply = () => {
    const stats = serialDmxAdapter.getStats();
    if (stats.state !== "connected") return;
    const channels = useSfxChannelStore.getState().channels;
    serialDmxAdapter.blackout();
    // Para cada canal SFX, escreve seu nível atual (default = 0; o motor
    // de disparo eleva temporariamente via setChannel).
    for (const c of channels) {
      // Apenas universe 0 vai pelo cabo USB-C; demais ficam em Art-Net.
      if (c.dmxUniverse !== 0) continue;
      // Sem nível persistente no store — mantemos blackout até disparo.
      // (O motor de disparo chamará serialDmxAdapter.setChannels diretamente.)
    }
  };
  unsub = useSfxChannelStore.subscribe(apply);
  apply();
}

export function stopSerialDmxBridge(): void {
  unsub?.();
  unsub = null;
}
