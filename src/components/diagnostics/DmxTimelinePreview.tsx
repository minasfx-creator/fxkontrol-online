/**
 * ─── DMX Timeline Preview ───────────────────────────────────────────
 * Linha do tempo de baixo do painel /diagnostics/dmx-pyro.
 *
 * Layout:
 *   • Eixo Y = faixas (uma por canal SFX, agrupadas por universe).
 *   • Eixo X = tempo (janela rolante de 10 s).
 *   • Cada faixa mostra:
 *       - Rótulo "Uxx · 001-008  NOME (TYPE)"
 *       - Range de canais ocupado em barra de fundo (estático)
 *       - Pulso animado por `duration` quando o canal está "firing"
 *   • Pulsos vivos vêm de:
 *       (a) flag `firing` no SFXChannel (quando setado pelo motor)
 *       (b) qualquer canal cujo valor no buffer DMX (Art-Net ou
 *           USB-C Serial) suba acima de 0 — captura disparos reais.
 *
 * Visual-only: não dispara nada, não muda o ShowPlan.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSfxChannelStore } from "@/store/useSfxChannelStore";
import { dmxUniverseManager } from "@/core/protocols/DMXUniverseManager";
import { serialDmxAdapter } from "@/lib/serialDmxAdapter";
import type { SFXChannel } from "@/components/editor/live-firing/types";

const WINDOW_MS = 10_000;       // 10 s visíveis
const SAMPLE_HZ = 20;           // 20 Hz amostragem live
const SAMPLE_MS = 1000 / SAMPLE_HZ;
const ROW_H = 18;
const LABEL_W = 168;

interface Pulse {
  id: string;
  channelId: string;
  start: number;     // timestamp ms
  end: number;       // timestamp ms
  source: "firing-flag" | "buffer";
}

function getBufferFor(universe: number): Uint8Array | null {
  if (universe === 0) {
    const stats = serialDmxAdapter.getStats();
    if (stats.state === "connected") return serialDmxAdapter.snapshotBuffer();
  }
  const buf = dmxUniverseManager.getBuffer(universe);
  return buf ? new Uint8Array(buf) : null;
}

function isAnyChannelActive(buf: Uint8Array | null, start: number, count: number): boolean {
  if (!buf) return false;
  const end = Math.min(512, start + count - 1);
  for (let a = start; a <= end; a++) {
    if ((buf[a] ?? 0) > 0) return true;
  }
  return false;
}

export default function DmxTimelinePreview() {
  const channels = useSfxChannelStore((s) => s.channels);
  const [now, setNow] = useState(() => Date.now());
  const pulsesRef = useRef<Pulse[]>([]);
  const liveStateRef = useRef(new Map<string, boolean>());

  // amostragem viva
  useEffect(() => {
    const iv = setInterval(() => {
      const t = Date.now();

      // 1) firing flag no store
      for (const c of channels) {
        const wasLive = liveStateRef.current.get(`${c.id}|flag`) ?? false;
        if (c.firing && !wasLive) {
          pulsesRef.current.push({
            id: `p-${c.id}-${t}-f`,
            channelId: c.id,
            start: t,
            end: t + Math.max(50, c.duration ?? 200),
            source: "firing-flag",
          });
        }
        liveStateRef.current.set(`${c.id}|flag`, !!c.firing);
      }

      // 2) buffer DMX live (captura disparos reais)
      const bufCache = new Map<number, Uint8Array | null>();
      for (const c of channels) {
        if (c.dmxUniverse < 0 || c.dmxUniverse > 32767) continue;
        if (!bufCache.has(c.dmxUniverse)) bufCache.set(c.dmxUniverse, getBufferFor(c.dmxUniverse));
        const active = isAnyChannelActive(bufCache.get(c.dmxUniverse) ?? null, c.dmxAddress, c.dmxChannels);
        const wasLive = liveStateRef.current.get(`${c.id}|buf`) ?? false;
        if (active && !wasLive) {
          pulsesRef.current.push({
            id: `p-${c.id}-${t}-b`,
            channelId: c.id,
            start: t,
            end: t + Math.max(80, c.duration ?? 150),
            source: "buffer",
          });
        }
        liveStateRef.current.set(`${c.id}|buf`, active);
      }

      // GC: descartar pulsos fora da janela
      const cutoff = t - WINDOW_MS - 500;
      pulsesRef.current = pulsesRef.current.filter((p) => p.end >= cutoff);
      setNow(t);
    }, SAMPLE_MS);
    return () => clearInterval(iv);
  }, [channels]);

  // Agrupa por universe
  const grouped = useMemo(() => {
    const m = new Map<number, SFXChannel[]>();
    for (const c of channels) {
      const arr = m.get(c.dmxUniverse) ?? [];
      arr.push(c);
      m.set(c.dmxUniverse, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.dmxAddress - b.dmxAddress);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [channels]);

  const totalRows = useMemo(
    () => grouped.reduce((s, [, list]) => s + list.length, 0),
    [grouped],
  );

  const tStart = now - WINDOW_MS;
  const xFor = (t: number, w: number) => ((t - tStart) / WINDOW_MS) * w;

  // Largura do gráfico (responsivo via parent)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [graphW, setGraphW] = useState(800);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth - LABEL_W - 16;
      setGraphW(Math.max(320, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Ticks de tempo
  const ticks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let s = 0; s <= 10; s += 2) {
      out.push({ x: (s / 10) * graphW, label: `-${10 - s}s` });
    }
    return out;
  }, [graphW]);

  return (
    <section className="rounded border border-border/30 bg-card/40">
      <header className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          <Clock className="w-3.5 h-3.5" />
          DMX Timeline Preview
          <span className="text-muted-foreground/50 normal-case">· janela {WINDOW_MS / 1000}s · {SAMPLE_HZ} Hz</span>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/60">
          {totalRows} faixas · {grouped.length} universe(s)
        </div>
      </header>

      <div ref={wrapRef} className="p-3 overflow-x-auto">
        {totalRows === 0 ? (
          <div className="text-xs font-mono text-muted-foreground/60 py-4 text-center">
            Sem canais SFX para visualizar.
          </div>
        ) : (
          <div className="relative" style={{ minWidth: LABEL_W + graphW }}>
            {/* Régua de tempo */}
            <div className="flex" style={{ marginLeft: LABEL_W }}>
              <div className="relative" style={{ width: graphW, height: 14 }}>
                {ticks.map((t, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/20"
                    style={{ left: t.x }}
                  >
                    <span className="text-[8px] font-mono text-muted-foreground/50 ml-1">{t.label}</span>
                  </div>
                ))}
                {/* "Agora" */}
                <div
                  className="absolute top-0 bottom-0 border-l border-emerald-400/70"
                  style={{ left: graphW - 1 }}
                >
                  <span className="text-[8px] font-mono text-emerald-400 ml-1">now</span>
                </div>
              </div>
            </div>

            {/* Faixas agrupadas por universe */}
            {grouped.map(([universe, list]) => (
              <div key={universe} className="mt-2">
                <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
                  Universe U{universe} · {list.length} canais
                </div>
                {list.map((c) => {
                  const start = c.dmxAddress;
                  const end = c.dmxAddress + c.dmxChannels - 1;
                  const invalid = start < 1 || end > 512;
                  const pulses = pulsesRef.current.filter((p) => p.channelId === c.id);
                  return (
                    <div key={c.id} className="flex items-center" style={{ height: ROW_H }}>
                      <div
                        className={cn(
                          "shrink-0 truncate text-[10px] font-mono pr-2",
                          invalid ? "text-red-400" : "text-muted-foreground/80",
                        )}
                        style={{ width: LABEL_W }}
                        title={`${c.name} · U${universe} · ${start}–${end} · ${c.type ?? "—"}`}
                      >
                        <span className="text-muted-foreground/50">{String(start).padStart(3, "0")}-{String(end).padStart(3, "0")}</span>{" "}
                        {c.name} <span className="text-muted-foreground/40">({String(c.type ?? "—")})</span>
                      </div>
                      <div
                        className={cn(
                          "relative h-[12px] rounded-[2px] overflow-hidden border",
                          invalid
                            ? "border-red-500/60 bg-red-500/10"
                            : "border-cyan-400/20 bg-cyan-400/[0.04]",
                        )}
                        style={{ width: graphW }}
                      >
                        {/* fundo: range estático = canal alocado o tempo todo */}
                        {/* pulsos */}
                        {pulses.map((p) => {
                          const x1 = xFor(Math.max(p.start, tStart), graphW);
                          const x2 = xFor(Math.min(p.end, now), graphW);
                          const w = Math.max(2, x2 - x1);
                          return (
                            <div
                              key={p.id}
                              className={cn(
                                "absolute top-0 bottom-0 rounded-[1px]",
                                p.source === "firing-flag"
                                  ? "bg-amber-400/80"
                                  : "bg-cyan-400/80",
                              )}
                              style={{ left: x1, width: w }}
                              title={`${c.name} · ${new Date(p.start).toLocaleTimeString()}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Legenda */}
            <div className="mt-3 flex flex-wrap gap-3 text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              <Swatch color="bg-cyan-400/[0.18]" border="border-cyan-400/40" label="Range alocado" />
              <Swatch color="bg-cyan-400/80" label="Pulso (buffer DMX live)" />
              <Swatch color="bg-amber-400/80" label="Pulso (firing flag)" />
              <Swatch color="bg-red-500/30" border="border-red-500/60" label="Range inválido" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Swatch({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-3 h-3 rounded-[2px] border", color, border ?? "border-transparent")} />
      {label}
    </div>
  );
}
