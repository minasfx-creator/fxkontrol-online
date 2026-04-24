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
import { CheckCircle2, AlertTriangle, XCircle, Activity, Wifi, Cable, RefreshCw, Trash2, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSfxChannelStore } from "@/store/useSfxChannelStore";
import { SFX_TYPES } from "@/components/editor/live-firing/constants";
import { artNetBridge, type ArtNetState } from "@/core/protocols/ArtNetBridge";
import { linkFailoverPolicy, type ProtocolLink } from "@/core/protocols/LinkFailoverPolicy";
import { dmxUniverseAdapter } from "@/core/hardware/adapters/DMXUniverseAdapter";
import {
  getCapturedEntries,
  clearCapturedEntries,
  subscribeCapturedEntries,
  type CapturedEntry,
} from "@/lib/consoleCapture";
import SerialDmxPairingPanel from "./SerialDmxPairingPanel";
import LiveDmxInspector from "./LiveDmxInspector";
import DmxTimelinePreview from "./DmxTimelinePreview";
import { useDiagnosticsThresholds, DEFAULT_THRESHOLDS } from "@/store/useDiagnosticsThresholds";
import { compactUniverse, resolveOverlaps, repackAll } from "@/lib/dmx/repackChannels";
import { toast } from "sonner";

const LIVE_FIRING_KEYWORDS = [
  "live firing",
  "pyro",
  "dmx",
  "super dmx",
  "fxc",
  "fire",
  "artnet",
  "art-net",
  "bridgephysical",
  "ignition",
  "tdz",
  "referenceerror",
];

function isLiveFiringRelated(e: CapturedEntry): boolean {
  const haystack = `${e.message} ${e.stack ?? ""} ${e.source ?? ""}`.toLowerCase();
  return LIVE_FIRING_KEYWORDS.some((k) => haystack.includes(k));
}

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

function fmtNum(v: unknown, digits = 1): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "—";
}

const VALID_SFX_TYPES = new Set<string>(SFX_TYPES.map((t) => t.key));

function validateChannels(
  channels: ReturnType<typeof useSfxChannelStore.getState>["channels"],
  thresholds: import("@/store/useDiagnosticsThresholds").DiagnosticsThresholds,
): Finding[] {
  const ADDRESS_GAP_THRESHOLD = thresholds.addressGap;
  const UNIVERSE_GAP_THRESHOLD = thresholds.universeGap;
  const UNIVERSE_CAP = thresholds.universeCapPct / 100;
  const UNIVERSE_START_HINT = thresholds.universeStartHint;
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

  // Per-channel sanity: range, universe range, type, dmxChannels, intensity.
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
    if (!Number.isInteger(c.dmxChannels) || c.dmxChannels < 1 || c.dmxChannels > 64) {
      findings.push({
        id: `chcount-${c.id}`,
        severity: "fail",
        message: `${c.name}: dmxChannels=${c.dmxChannels} inválido (esperado inteiro 1–64).`,
        hint: "Verifique o perfil do fixture.",
      });
    }
    if (!c.type || !VALID_SFX_TYPES.has(c.type as string)) {
      findings.push({
        id: `type-${c.id}`,
        severity: "fail",
        message: `${c.name}: type "${c.type ?? "—"}" não é um SFXType válido.`,
        hint: `Valores aceitos: ${[...VALID_SFX_TYPES].join(", ")}.`,
      });
    }
    if (typeof c.intensity === "number" && (c.intensity < 0 || c.intensity > 255)) {
      findings.push({
        id: `intensity-${c.id}`,
        severity: "warn",
        message: `${c.name}: intensity=${c.intensity} fora do range DMX 0–255.`,
      });
    }
    if (typeof c.duration === "number" && c.duration < 0) {
      findings.push({
        id: `duration-${c.id}`,
        severity: "warn",
        message: `${c.name}: duration negativa (${c.duration} ms).`,
      });
    }
  }

  // Group per universe for overlap + gap analysis.
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
      } else {
        const gap = cur.dmxAddress - prevEnd - 1;
        if (gap >= ADDRESS_GAP_THRESHOLD) {
          findings.push({
            id: `gap-${universe}-${prev.id}-${cur.id}`,
            severity: "warn",
            message: `Gap grande em U${universe}: ${gap} canais livres entre ${prev.name} (fim ${prevEnd}) e ${cur.name} (início ${cur.dmxAddress}).`,
            hint: "Compacte o endereçamento para liberar espaço contínuo no universe.",
          });
        }
      }
    }

    // Universe quase cheio
    const totalUsed = sorted.reduce((s, c) => s + c.dmxChannels, 0);
    if (totalUsed > UNIVERSE_CAP * 512) {
      findings.push({
        id: `crowded-${universe}`,
        severity: "warn",
        message: `U${universe} está ${Math.round((totalUsed / 512) * 100)}% ocupado (${totalUsed}/512), acima do limite ${thresholds.universeCapPct}%.`,
        hint: "Considere migrar fixtures para um universe adicional.",
      });
    }
  }

  // Universes não usados / gaps entre universes
  const usedUniverses = [...byUniverse.keys()].sort((a, b) => a - b);
  for (let i = 1; i < usedUniverses.length; i++) {
    const prev = usedUniverses[i - 1];
    const cur = usedUniverses[i];
    const skipped = cur - prev - 1;
    if (skipped > UNIVERSE_GAP_THRESHOLD) {
      const missing: number[] = [];
      for (let u = prev + 1; u < cur && missing.length < 8; u++) missing.push(u);
      findings.push({
        id: `uni-gap-${prev}-${cur}`,
        severity: "warn",
        message: `Universes não usados entre U${prev} e U${cur}: ${missing.map((u) => `U${u}`).join(", ")}${skipped > missing.length ? "…" : ""}.`,
        hint: "Reagrupe fixtures em universes contíguos para simplificar o patch Art-Net.",
      });
    }
  }

  // Aviso se o endereçamento começa fora do limite configurado
  if (usedUniverses.length > 0 && usedUniverses[0] > UNIVERSE_START_HINT) {
    findings.push({
      id: "uni-start",
      severity: "warn",
      message: `Primeiro universe em uso é U${usedUniverses[0]} — esperado ≤ U${UNIVERSE_START_HINT}.`,
      hint: "Maioria das consoles inicia no universe 1; verifique se isto é intencional.",
    });
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

  const thresholds = useDiagnosticsThresholds();
  const findings = useMemo(
    () => validateChannels(channels, thresholds),
    [channels, tick, thresholds.addressGap, thresholds.universeGap, thresholds.universeCapPct, thresholds.universeStartHint],
  );
  const counts = useMemo(() => {
    const c = { ok: 0, warn: 0, fail: 0 };
    for (const f of findings) c[f.severity]++;
    return c;
  }, [findings]);

  // Live console capture
  const [capTick, setCapTick] = useState(0);
  const [onlyLiveFiring, setOnlyLiveFiring] = useState(false);
  useEffect(() => {
    return subscribeCapturedEntries(() => setCapTick((t) => t + 1));
  }, []);
  const captured = useMemo(() => {
    const all = getCapturedEntries();
    return onlyLiveFiring ? all.filter(isLiveFiringRelated) : all;
  }, [capTick, onlyLiveFiring]);
  const capCounts = useMemo(() => {
    const c = { error: 0, warn: 0, unhandled: 0, rejection: 0 };
    for (const e of captured) c[e.level]++;
    return c;
  }, [captured]);

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

      {/* USB-C → DMX pairing */}
      <SerialDmxPairingPanel />

      {/* Live DMX channel-level inspector */}
      <LiveDmxInspector />

      {/* Bottom timeline preview of universes/channels */}
      <DmxTimelinePreview />

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

      {/* Threshold configuration */}
      <ThresholdsConfig />

      {/* Repack actions */}
      <RepackActions />

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

      {/* Live console capture */}
      <section className="rounded border border-border/30 bg-card/40">
        <header className="px-3 py-2 border-b border-border/20 flex items-center justify-between gap-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
            Live Console ({captured.length})
            <span className="ml-3 text-red-400">err {capCounts.error + capCounts.unhandled + capCounts.rejection}</span>
            <span className="ml-2 text-amber-400">warn {capCounts.warn}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={onlyLiveFiring ? "default" : "outline"}
              size="sm"
              className="h-6 gap-1 text-[10px]"
              onClick={() => setOnlyLiveFiring((v) => !v)}
              title="Filtrar apenas eventos relacionados a Live Firing / DMX / Pyro"
            >
              <Filter className="w-3 h-3" />
              {onlyLiveFiring ? "Live Firing" : "Todos"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 gap-1 text-[10px]"
              onClick={() => clearCapturedEntries()}
            >
              <Trash2 className="w-3 h-3" />
              Limpar
            </Button>
          </div>
        </header>
        {captured.length === 0 ? (
          <div className="p-4 text-xs font-mono text-muted-foreground/60">
            Nenhum erro/aviso capturado. Reproduza a falha (abra Live Firing → Pyro Fire) para popular o log.
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto divide-y divide-border/10">
            {[...captured].reverse().map((e) => (
              <div key={e.id} className="px-3 py-2 font-mono text-[11px] leading-snug">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                      e.level === "warn"
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-red-500/15 text-red-400",
                    )}
                  >
                    {e.level}
                  </span>
                  <span className="text-muted-foreground/50 text-[10px]">
                    {new Date(e.ts).toLocaleTimeString("pt-BR", { hour12: false })}
                  </span>
                  {e.source && <span className="text-muted-foreground/40 text-[10px] truncate">{e.source}</span>}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-foreground/90">{e.message}</div>
                {e.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[10px] text-muted-foreground/60 hover:text-muted-foreground">
                      stack trace
                    </summary>
                    <pre className="mt-1 text-[10px] text-muted-foreground/70 whitespace-pre-wrap break-words">
                      {e.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
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

function ThresholdsConfig() {
  const t = useDiagnosticsThresholds();
  const isDefault =
    t.addressGap === DEFAULT_THRESHOLDS.addressGap &&
    t.universeGap === DEFAULT_THRESHOLDS.universeGap &&
    t.universeCapPct === DEFAULT_THRESHOLDS.universeCapPct &&
    t.universeStartHint === DEFAULT_THRESHOLDS.universeStartHint;

  return (
    <section className="rounded border border-border/30 bg-card/40">
      <header className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          Limites de validação
        </span>
        <button
          onClick={() => t.reset()}
          disabled={isDefault}
          className={cn(
            "text-[10px] font-mono px-2 py-0.5 rounded border",
            isDefault
              ? "opacity-40 cursor-not-allowed border-border/20"
              : "border-border/40 hover:bg-muted/30",
          )}
        >
          Restaurar padrões
        </button>
      </header>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <ThresholdField
          label="Gap de endereços (≥)"
          suffix="canais"
          hint="Aviso quando há esse número de endereços DMX livres entre dois fixtures contíguos."
          min={1} max={511} step={1}
          value={t.addressGap}
          onChange={(v) => t.set("addressGap", v)}
        />
        <ThresholdField
          label="Gap de universes (>)"
          suffix="universes"
          hint="Aviso quando esse número de universes consecutivos não está sendo usado entre dois universes ativos."
          min={0} max={32} step={1}
          value={t.universeGap}
          onChange={(v) => t.set("universeGap", v)}
        />
        <ThresholdField
          label="Universe cheio (≥)"
          suffix="%"
          hint="Aviso quando a ocupação de canais (de 512) atingir esse percentual."
          min={50} max={100} step={1}
          value={t.universeCapPct}
          onChange={(v) => t.set("universeCapPct", v)}
        />
        <ThresholdField
          label="Universe inicial esperado (≤)"
          suffix="universe"
          hint="Aviso quando o primeiro universe em uso for maior que esse valor."
          min={0} max={32} step={1}
          value={t.universeStartHint}
          onChange={(v) => t.set("universeStartHint", v)}
        />
      </div>
    </section>
  );
}

function ThresholdField({
  label, suffix, hint, value, min, max, step, onChange,
}: {
  label: string;
  suffix: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v / step) * step));
  return (
    <div className="rounded border border-border/30 bg-background/40 p-2 flex flex-col gap-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value || "0")))}
          className="w-20 bg-background border border-border/40 rounded px-2 py-1 text-xs font-mono"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(clamp(parseFloat(e.target.value)))}
          className="flex-1 accent-primary"
        />
        <span className="text-[10px] font-mono text-muted-foreground/60 w-14 text-right">{suffix}</span>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground/50 leading-snug">{hint}</p>
    </div>
  );
}

function RepackActions() {
  const channels = useSfxChannelStore((s) => s.channels);
  const setChannels = useSfxChannelStore((s) => s.setChannels);

  const universes = useMemo(
    () => Array.from(new Set(channels.map((c) => c.dmxUniverse))).sort((a, b) => a - b),
    [channels],
  );
  const [targetUni, setTargetUni] = useState<number | "all">("all");

  const lockedCount = useMemo(() => channels.filter((c) => c.locked).length, [channels]);

  const apply = (
    label: string,
    fn: () => { channels: typeof channels; changed: number; overflow: typeof channels },
  ) => {
    const before = channels;
    const result = fn();
    if (result.changed === 0 && result.overflow.length === 0) {
      toast.info(`${label}: nada para alterar.`);
      return;
    }
    setChannels(result.channels);
    const parts = [`${result.changed} canal(is) movido(s)`];
    if (result.overflow.length > 0) parts.push(`${result.overflow.length} sem espaço`);
    toast.success(`${label}: ${parts.join(", ")}.`, {
      action: {
        label: "Desfazer",
        onClick: () => setChannels(before),
      },
    });
  };

  const doCompact = () => {
    if (targetUni === "all") {
      apply("Re-empacotar tudo", () => repackAll(channels));
    } else {
      apply(`Compactar U${targetUni}`, () => compactUniverse(channels, targetUni));
    }
  };

  const doResolveOverlaps = () => apply("Resolver overlaps", () => resolveOverlaps(channels));

  const disabled = channels.length === 0;

  return (
    <section className="rounded border border-border/30 bg-card/40">
      <header className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          Ações de endereçamento
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/50">
          {channels.length} canais · {lockedCount} locked · {universes.length} universe(s)
        </span>
      </header>

      <div className="p-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            Alvo
          </label>
          <select
            value={String(targetUni)}
            onChange={(e) => setTargetUni(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="bg-background border border-border/40 rounded px-2 py-1 text-xs font-mono"
            disabled={disabled}
          >
            <option value="all">Todos os universes</option>
            {universes.map((u) => (
              <option key={u} value={u}>
                U{u}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={doCompact}
            disabled={disabled}
            className="font-mono text-xs"
          >
            {targetUni === "all" ? "Re-empacotar tudo" : `Compactar U${targetUni}`}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={doResolveOverlaps}
            disabled={disabled}
            className="font-mono text-xs"
          >
            Resolver overlaps
          </Button>
        </div>

        <p className="text-[10px] font-mono text-muted-foreground/50 leading-snug">
          Compactar remove gaps mantendo a ordem por endereço. Resolver overlaps shifta fixtures sobrepostos
          para o próximo slot livre. Canais <span className="text-amber-400">locked</span> e desabilitados
          são preservados. Use <span className="text-foreground">Desfazer</span> no toast para reverter.
        </p>
      </div>
    </section>
  );
}
