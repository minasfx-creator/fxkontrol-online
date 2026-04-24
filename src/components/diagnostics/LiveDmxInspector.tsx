/**
 * ─── Live DMX Inspector ─────────────────────────────────────────────
 * Visualiza em tempo real o payload de 512 canais por universe.
 * Combina:
 *   • Buffer DMX serial (USB-C → DMX) quando conectado
 *   • Buffer Art-Net via dmxUniverseManager para outros universes
 *   • Mapa de canais SFX (useSfxChannelStore) para identificar ranges
 *
 * Cada célula mostra o valor 0–255 mapeado para opacidade.
 * Realça em vermelho ranges fora de 1–512 ou universes inválidos
 * e em ciano os endereços ocupados por fixtures SFX.
 */

import { useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSfxChannelStore } from "@/store/useSfxChannelStore";
import { dmxUniverseManager } from "@/core/protocols/DMXUniverseManager";
import { serialDmxAdapter } from "@/lib/serialDmxAdapter";

const REFRESH_MS = 100; // 10 Hz UI refresh

function valueToColor(v: number): string {
  // 0 → escuro, 255 → ciano vivo
  if (v === 0) return "rgba(255,255,255,0.04)";
  const a = (v / 255) * 0.95 + 0.05;
  return `hsl(190 95% 55% / ${a})`;
}

function getBufferForUniverse(universe: number, serialActive: boolean, serialUniverse = 0): Uint8Array | null {
  // Universe 0 sai pelo cabo USB-C quando conectado
  if (serialActive && universe === serialUniverse) {
    const stats = serialDmxAdapter.getStats();
    if (stats.state === "connected") {
      // O adapter mantém o buffer interno; usamos o snapshot público
      return serialDmxAdapter.snapshotBuffer();
    }
  }
  const buf = dmxUniverseManager.getBuffer(universe);
  return buf ? new Uint8Array(buf) : null;
}

export default function LiveDmxInspector() {
  const channels = useSfxChannelStore((s) => s.channels);
  const [tick, setTick] = useState(0);
  const [serialState, setSerialState] = useState(() => serialDmxAdapter.getStats().state);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), REFRESH_MS);
    const off = serialDmxAdapter.onChange(() => setSerialState(serialDmxAdapter.getStats().state));
    return () => { clearInterval(iv); off(); };
  }, []);

  const universes = useMemo(() => {
    const set = new Set<number>(channels.map((c) => c.dmxUniverse).filter((u) => u >= 0 && u <= 32767));
    if (serialState === "connected") set.add(0);
    if (set.size === 0) set.add(1);
    return [...set].sort((a, b) => a - b);
  }, [channels, serialState]);

  const [selected, setSelected] = useState<number>(universes[0] ?? 1);
  useEffect(() => {
    if (!universes.includes(selected)) setSelected(universes[0] ?? 1);
  }, [universes, selected]);

  // Mapa: address → { channel, isStart } para o universe selecionado
  const addressMap = useMemo(() => {
    const map = new Map<number, { name: string; type: string; isStart: boolean; isInvalid: boolean }>();
    for (const c of channels) {
      if (c.dmxUniverse !== selected) continue;
      const start = c.dmxAddress;
      const end = c.dmxAddress + c.dmxChannels - 1;
      const invalid = start < 1 || end > 512;
      for (let a = start; a <= end; a++) {
        if (a < 1 || a > 512) continue;
        map.set(a, { name: c.name, type: String(c.type ?? "—"), isStart: a === start, isInvalid: invalid });
      }
    }
    return map;
  }, [channels, selected]);

  const buffer = useMemo(() => {
    void tick; // depende do tick para refresh
    return getBufferForUniverse(selected, serialState === "connected");
  }, [selected, tick, serialState]);

  const liveCount = useMemo(() => {
    if (!buffer) return 0;
    let n = 0;
    for (let i = 1; i <= 512; i++) if (buffer[i] > 0) n++;
    return n;
  }, [buffer]);

  return (
    <section className="rounded border border-border/30 bg-card/40">
      <header className="px-3 py-2 border-b border-border/20 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          <Activity className="w-3.5 h-3.5" />
          Live DMX Inspector
          <span className="ml-2 text-emerald-400">{liveCount} ch ativos</span>
        </div>
        <div className="flex items-center gap-1">
          {universes.map((u) => {
            const invalid = u < 0 || u > 32767;
            return (
              <button
                key={u}
                onClick={() => setSelected(u)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono border transition-colors",
                  selected === u
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/30 text-muted-foreground/70 hover:text-foreground",
                  invalid && "border-red-500/60 text-red-400",
                )}
              >
                U{u}
              </button>
            );
          })}
        </div>
      </header>

      <div className="p-3">
        {!buffer ? (
          <div className="text-xs font-mono text-muted-foreground/60 py-4 text-center">
            Universe U{selected} sem buffer ativo. Conecte o cabo USB-C ou inicie a saída Art-Net.
          </div>
        ) : (
          <>
            <div className="grid gap-px" style={{ gridTemplateColumns: "repeat(32, minmax(0, 1fr))" }}>
              {Array.from({ length: 512 }, (_, i) => {
                const addr = i + 1;
                const value = buffer[addr] ?? 0;
                const meta = addressMap.get(addr);
                const isStart = meta?.isStart;
                const isAllocated = !!meta;
                const isInvalid = meta?.isInvalid;
                return (
                  <div
                    key={addr}
                    title={`Ch ${addr} = ${value}${meta ? ` · ${meta.name} (${meta.type})` : ""}${isInvalid ? " · RANGE INVÁLIDO" : ""}`}
                    className={cn(
                      "aspect-square rounded-[1px] border",
                      isInvalid
                        ? "border-red-500/70"
                        : isStart
                        ? "border-cyan-400/70"
                        : isAllocated
                        ? "border-cyan-400/30"
                        : "border-transparent",
                    )}
                    style={{ background: valueToColor(value) }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              <LegendSwatch color="hsl(190 95% 55% / 0.9)" label="Valor ao vivo (0–255)" />
              <LegendSwatch border="border-cyan-400/70" label="Start address SFX" />
              <LegendSwatch border="border-cyan-400/30" label="Endereço alocado" />
              <LegendSwatch border="border-red-500/70" label="Range inválido" />
            </div>

            {/* Stats por universe */}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
              <Stat label="Universe" value={`U${selected}`} />
              <Stat label="Fixtures" value={String(new Set([...addressMap.values()].map((m) => m.name)).size)} />
              <Stat label="Endereços alocados" value={`${addressMap.size}/512`} />
              <Stat
                label="Fonte"
                value={selected === 0 && serialState === "connected" ? "USB-C Serial" : "Art-Net"}
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function LegendSwatch({ color, border, label }: { color?: string; border?: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn("w-3 h-3 rounded-[2px] border", border ?? "border-transparent")}
        style={{ background: color ?? "transparent" }}
      />
      {label}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/30 bg-background/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/50">{label}</div>
      <div className="text-xs font-bold mt-0.5">{value}</div>
    </div>
  );
}
