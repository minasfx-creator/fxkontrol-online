/**
 * ─── DMX / Pyro Fire Diagnostics ────────────────────────────────────
 * Read-only health & configuration validator for the Live Firing
 * Super DMX and Pyro Fire modes. Surfaces:
 *   • SFX channel inventory + universe / DMX address mapping
 *   • Art-Net bridge link state + universe occupancy
 *   • Link failover + active transport
 *   • Validation rules (overlaps, out-of-range addresses, duplicate IDs)
 *
 * No commands are sent — strictly observational.
 */
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Activity, Wifi, Cable, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSfxChannelStore } from "@/store/useSfxChannelStore";
import { artNetBridge, type ArtNetState } from "@/core/protocols/ArtNetBridge";
import { linkFailoverPolicy, type ProtocolLink } from "@/core/protocols/LinkFailoverPolicy";
import { dmxUniverseAdapter } from "@/core/hardware/adapters/DMXUniverseAdapter";

type Severity = "ok" | "warn" | "fail";

interface Finding {
  id: string;
  severity: Severity;
  message: string;
  hint?: string;
}

const ARTNET_LINK_LABEL: Record<ArtNetState, { label: string; sev: Severity }> = {
  connected: { label: "CONNECTED", sev: "ok" },
  connecting: { label: "CONNECTING…", sev: "warn" },
  disconnected: { label: "DISCONNECTED", sev: "fail" },
  error: { label: "ERROR", sev: "fail" },
};

function validateChannels(channels: ReturnType<typeof useSfxChannelStore.getState>["channels"]): Finding[] {
  const findings: Finding[] = [];

  if (channels.length === 0) {
    findings.push({
      id: "no-channels",
      severity: "warn",
      message: "Nenhum canal SFX configurado.",
      hint: "Adicione canais no painel Showven Equipment ou em Super DMX.",
    });
    return findings;
  }

  // Duplicate IDs (would crash list renderers).
  const idCounts = new Map<string, number>();
  for (const c of channels) idCounts.set(c.id, (idCounts.get(c.id) ?? 0) + 1);
  for (const [id, n] of idCounts) {
    if (n > 1) {
      findings.push({
        id: `dup-id-${id}`,
        severity: "fail",
        message: `ID de canal duplicado: ${id} (${n}×)`,
        hint: "IDs duplicados causam keys repetidas no React e podem mascarar canais.",
      });
    }
  }

  // Address range checks.
  for (const c of channels) {
    const start = c.dmxAddress;
    const end = c.dmxAddress + c.dmxChannels - 1;
    if (start < 1 || end > 512) {
      findings.push({
        id: `range-${c.id}`,
        severity: "fail",
        message: `${c.name}: faixa DMX ${start}–${end} fora do intervalo 1–512.`,
        hint: "Reduza dmxChannels ou ajuste o startAddress.",
      });
    }
    if (c.dmxUniverse < 0 || c.dmxUniverse > 32767) {
      findings.push({
        id: `universe-${c.id}`,
        severity: "fail",
        message: `${c.name}: universe ${c.dmxUniverse} fora do range Art-Net 0–32767.`,
      });
    }
  }

  // Overlap detection within the same universe.
  const byUniverse = new Map<number, typeof channels>();
  for (const c of channels) {
    const arr = byUniverse.get(c.dmxUniverse) ?? [];
    arr.push(c);
    byUniverse.set(c.dmxUniverse, arr);
  }
  for (const [universe, list] of byUniverse) {
    const sorted = [...list].sort((a, b) => a.dmxAddress - b.dmxAddress);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const prevEnd = prev.dmxAddress + prev.dmxChannels - 1;
      if (cur.dmxAddress <= prevEnd) {
        findings.push({
          id: `overlap-${universe}-${prev.id}-${cur.id}`,
          severity: "warn",
          message: `Sobreposição em U${universe}: ${prev.name} (${prev.dmxAddress}–${prevEnd}) ↔ ${cur.name} (a partir de ${cur.dmxAddress}).`,
          hint: "Realoque um dos canais para evitar conflitos de barramento.",
        });
      }
    }
  }

  return findings;
}

export default function DmxPyroDiagnostics() {
  const channels = useSfxChannelStore((s) => s.channels);
  const [tick, setTick] = useState(0);
  const [artnetState, setArtnetState] = useState<ArtNetState>(() => artNetBridge.getState());
  const [activeLink, setActiveLink] = useState<ProtocolLink>(() => linkFailoverPolicy.getActiveLink());
  const [universeSnap, setUniverseSnap] = useState(() => dmxUniverseAdapter.getSnapshot());

  useEffect(() => {
    const iv = setInterval(() => {
      dmxUniverseAdapter.pollTelemetry();
      setArtnetState(artNetBridge.getState());
      setActiveLink(linkFailoverPolicy.getActiveLink());
      setUniverseSnap(dmxUniverseAdapter.getSnapshot());
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const findings = useMemo(() => validateChannels(channels), [channels, tick]);
  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, fail: 0 };
    for (const f of findings) c[f.severity]++;
    return c;
  }, [findings]);

  const universeMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const ch of channels) m.set(ch.dmxUniverse, (m.get(ch.dmxUniverse) ?? 0) + ch.dmxChannels);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [channels]);

  const linkInfo = ARTNET_LINK_LABEL[artnetState];
  const overallSev: Severity = counts.fail > 0 ? "fail" : counts.warn > 0 ? "warn" : "ok";

  return (
    <div className="flex flex-col gap-4 p-4 bg-background min-h-[100dvh] text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border/30 pb-3">
        <div>
          <h1 className="text-base font-mono font-bold tracking-widest uppercase">DMX / Pyro Fire — Diagnóstico</h1>
          <p className="text-xs font-mono text-muted-foreground/70">
            Validação de configuração, transporte e link · somente leitura
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          Re-validar
        </Button>
      </header>

      {/* Overall verdict */}
      <section
        className={cn(
          "rounded border p-3 flex items-center gap-3",
          overallSev === "ok" && "border-emerald-500/30 bg-emerald-500/5",
          overallSev === "warn" && "border-amber-500/30 bg-amber-500/5",
          overallSev === "fail" && "border-red-500/30 bg-red-500/5",
        )}
      >
        <SeverityIcon severity={overallSev} className="w-5 h-5" />
        <div className="flex-1">
          <div className="text-xs font-mono font-bold uppercase tracking-widest">
            {overallSev === "ok" && "Configuração válida"}
            {overallSev === "warn" && "Atenção — avisos detectados"}
            {overallSev === "fail" && "Falha — corrija antes de armar"}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/70">
            {counts.fail} falhas · {counts.warn} avisos · {channels.length} canais analisados
          </div>
        </div>
      </section>

      {/* Transport status */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatusCard
          icon={<Wifi className="w-4 h-4" />}
          label="Art-Net Link"
          value={linkInfo.label}
          severity={linkInfo.sev}
          detail={`State: ${artnetState}`}
        />
        <StatusCard
          icon={<Activity className="w-4 h-4" />}
          label="Active Transport"
          value={activeLink.toUpperCase()}
          severity={activeLink === "artnet" ? "ok" : "warn"}
          detail={activeLink === "artnet" ? "Primary path online" : "Fallback in use"}
        />
        <StatusCard
          icon={<Cable className="w-4 h-4" />}
          label="Universe Telemetry"
          value={`${fmtNum(universeSnap.metrics.refresh_hz, 0)} Hz`}
          severity={universeSnap.online ? (universeSnap.warnings.length ? "warn" : "ok") : "fail"}
          detail={`Latência ${fmtNum(universeSnap.metrics.latency_ms, 1)} ms · U${universeSnap.metrics.universe}`}
        />
      </section>

      {/* Universe inventory */}
      <section className="rounded border border-border/30 bg-card/40">
        <header className="px-3 py-2 border-b border-border/20 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          Universe / Channel Map
        </header>
        {universeMap.length === 0 ? (
          <div className="p-4 text-xs font-mono text-muted-foreground/60">Nenhum universe em uso.</div>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead className="text-[9px] uppercase tracking-wider text-muted-foreground/50 border-b border-border/20">
              <tr>
                <th className="text-left px-3 py-1.5">Universe</th>
                <th className="text-left px-3 py-1.5">Canais alocados</th>
                <th className="text-left px-3 py-1.5">Ocupação</th>
                <th className="text-left px-3 py-1.5">Dispositivos</th>
              </tr>
            </thead>
            <tbody>
              {universeMap.map(([universe, used]) => {
                const devices = channels.filter((c) => c.dmxUniverse === universe);
                const pct = Math.min(100, Math.round((used / 512) * 100));
                return (
                  <tr key={universe} className="border-b border-border/10">
                    <td className="px-3 py-2 font-bold">U{universe}</td>
                    <td className="px-3 py-2">{used} / 512</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted/30 rounded overflow-hidden">
                          <div
                            className={cn(
                              "h-full",
                              pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground/70">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground/80">{devices.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Channel detail */}
      <section className="rounded border border-border/30 bg-card/40">
        <header className="px-3 py-2 border-b border-border/20 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          SFX Channels ({channels.length})
        </header>
        {channels.length === 0 ? (
          <div className="p-4 text-xs font-mono text-muted-foreground/60">Sem canais configurados.</div>
        ) : (
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead className="text-[9px] uppercase tracking-wider text-muted-foreground/50 border-b border-border/20 sticky top-0 bg-card/95 backdrop-blur">
                <tr>
                  <th className="text-left px-3 py-1.5">ID</th>
                  <th className="text-left px-3 py-1.5">Nome</th>
                  <th className="text-left px-3 py-1.5">Universe</th>
                  <th className="text-left px-3 py-1.5">Range DMX</th>
                  <th className="text-left px-3 py-1.5">Ch</th>
                  <th className="text-left px-3 py-1.5">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => {
                  const start = c.dmxAddress;
                  const end = c.dmxAddress + c.dmxChannels - 1;
                  const bad = start < 1 || end > 512;
                  return (
                    <tr key={c.id} className={cn("border-b border-border/10", bad && "bg-red-500/5")}>
                      <td className="px-3 py-1.5 text-muted-foreground/60">{c.id}</td>
                      <td className="px-3 py-1.5 font-bold">{c.name}</td>
                      <td className="px-3 py-1.5">U{c.dmxUniverse}</td>
                      <td className="px-3 py-1.5">
                        {start}–{end}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground/70">{c.dmxChannels}</td>
                      <td className="px-3 py-1.5 text-muted-foreground/70">{c.type ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Findings */}
      <section className="rounded border border-border/30 bg-card/40">
        <header className="px-3 py-2 border-b border-border/20 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          Validações ({findings.length})
        </header>
        {findings.length === 0 ? (
          <div className="p-4 text-xs font-mono text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Tudo verificado. Nenhum problema de configuração detectado.
          </div>
        ) : (
          <ul className="divide-y divide-border/10">
            {findings.map((f) => (
              <li key={f.id} className="px-3 py-2 flex items-start gap-2">
                <SeverityIcon severity={f.severity} className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs font-mono">{f.message}</div>
                  {f.hint && <div className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{f.hint}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  if (severity === "ok") return <CheckCircle2 className={cn("text-emerald-400", className)} />;
  if (severity === "warn") return <AlertTriangle className={cn("text-amber-400", className)} />;
  return <XCircle className={cn("text-red-400", className)} />;
}

function StatusCard({
  icon,
  label,
  value,
  severity,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  severity: Severity;
  detail?: string;
}) {
  const ringColor =
    severity === "ok" ? "border-emerald-500/30" : severity === "warn" ? "border-amber-500/30" : "border-red-500/30";
  const dotColor = severity === "ok" ? "bg-emerald-400" : severity === "warn" ? "bg-amber-400" : "bg-red-400";
  return (
    <div className={cn("rounded border bg-card/30 p-3 flex flex-col gap-1.5", ringColor)}>
      <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full", dotColor)} />
        <span className="text-sm font-mono font-bold">{value}</span>
      </div>
      {detail && <div className="text-[10px] font-mono text-muted-foreground/60">{detail}</div>}
    </div>
  );
}
