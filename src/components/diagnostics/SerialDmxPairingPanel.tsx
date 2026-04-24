/**
 * ─── USB-C → DMX Pairing Panel ──────────────────────────────────────
 * Painel embutido em /diagnostics/dmx-pyro para autorizar uma porta
 * Web Serial e iniciar transmissão DMX para o equipamento conectado.
 */

import { useEffect, useState } from "react";
import { Cable, Plug, Power, RefreshCw, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { serialDmxAdapter, type SerialDmxMode, type SerialDmxStats } from "@/lib/serialDmxAdapter";
import { startSerialDmxBridge, stopSerialDmxBridge } from "@/lib/serialDmxBridge";

function vidPid(stats: SerialDmxStats): string {
  if (stats.vendorId == null && stats.productId == null) return "—";
  const v = stats.vendorId?.toString(16).padStart(4, "0") ?? "????";
  const p = stats.productId?.toString(16).padStart(4, "0") ?? "????";
  return `${v}:${p}`;
}

export default function SerialDmxPairingPanel() {
  const [stats, setStats] = useState<SerialDmxStats>(() => serialDmxAdapter.getStats());
  const [mode, setMode] = useState<SerialDmxMode>("open");
  const [busy, setBusy] = useState(false);
  const [testCh, setTestCh] = useState(1);
  const supported = serialDmxAdapter.isSupported();

  useEffect(() => serialDmxAdapter.onChange(() => setStats(serialDmxAdapter.getStats())), []);

  const onConnect = async () => {
    setBusy(true);
    try {
      await serialDmxAdapter.requestAndConnect(mode);
      startSerialDmxBridge();
    } catch { /* erro já capturado em stats.lastError */ }
    setBusy(false);
  };

  const onDisconnect = async () => {
    stopSerialDmxBridge();
    await serialDmxAdapter.disconnect();
  };

  const onTestPulse = async () => {
    if (stats.state !== "connected") return;
    serialDmxAdapter.setChannel(testCh, 255);
    setTimeout(() => serialDmxAdapter.setChannel(testCh, 0), 500);
  };

  const onBlackout = () => serialDmxAdapter.blackout();

  const stateColor =
    stats.state === "connected" ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
    : stats.state === "opening" ? "text-amber-400 border-amber-500/30 bg-amber-500/5"
    : stats.state === "error"   ? "text-red-400 border-red-500/30 bg-red-500/5"
    : "text-muted-foreground border-border/30 bg-card/30";

  return (
    <section className="rounded border border-border/30 bg-card/40">
      <header className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
          <Cable className="w-3.5 h-3.5" />
          USB-C → DMX (Web Serial)
        </div>
        <div className={cn("text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border", stateColor)}>
          {stats.state}
        </div>
      </header>

      <div className="p-3 space-y-3">
        {!supported && (
          <div className="text-xs font-mono text-amber-400 border border-amber-500/30 bg-amber-500/5 rounded px-3 py-2">
            ⚠ Web Serial não está disponível. Use Chrome/Edge sobre HTTPS (não funciona no Safari/Firefox/iOS).
          </div>
        )}

        {/* Mode selector */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-muted-foreground/60">Modo:</span>
          {(["open", "pro"] as SerialDmxMode[]).map((m) => (
            <button
              key={m}
              disabled={stats.state === "connected"}
              onClick={() => setMode(m)}
              className={cn(
                "px-2 py-1 rounded border text-[10px] uppercase tracking-wider",
                mode === m
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/30 text-muted-foreground/70 hover:text-foreground",
                stats.state === "connected" && "opacity-50 cursor-not-allowed",
              )}
            >
              {m === "open" ? "FTDI / Open DMX" : "Enttec Pro"}
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground/50 ml-auto">
            {mode === "open" ? "250000 8N2 + BREAK" : "57600 8N1 wrapper 0x7E"}
          </span>
        </div>

        {/* Connection controls */}
        <div className="flex items-center gap-2">
          {stats.state !== "connected" ? (
            <Button onClick={onConnect} disabled={!supported || busy} size="sm" className="gap-1.5">
              <Plug className="w-3.5 h-3.5" />
              {busy ? "Abrindo…" : "Selecionar porta USB"}
            </Button>
          ) : (
            <Button onClick={onDisconnect} variant="outline" size="sm" className="gap-1.5">
              <Power className="w-3.5 h-3.5" />
              Desconectar
            </Button>
          )}
          <Button
            onClick={() => setStats(serialDmxAdapter.getStats())}
            variant="ghost"
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
          <Stat label="VID:PID" value={vidPid(stats)} />
          <Stat label="Mode" value={stats.mode ?? "—"} />
          <Stat label="Frames" value={stats.framesSent.toString()} />
          <Stat label="Refresh" value={stats.refreshHz ? `${stats.refreshHz} Hz` : "—"} />
        </div>

        {stats.lastError && (
          <div className="text-[11px] font-mono text-red-400 border border-red-500/30 bg-red-500/5 rounded px-3 py-1.5">
            {stats.lastError}
          </div>
        )}

        {/* Quick test */}
        <div className="border-t border-border/20 pt-3 space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
            Teste de saída (pulso 500 ms a 100%)
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono text-muted-foreground/70">Canal</label>
            <input
              type="number"
              min={1}
              max={512}
              value={testCh}
              onChange={(e) => setTestCh(Math.max(1, Math.min(512, parseInt(e.target.value || "1", 10))))}
              className="w-20 bg-background border border-border/40 rounded px-2 py-1 text-xs font-mono"
            />
            <Button onClick={onTestPulse} disabled={stats.state !== "connected"} size="sm" className="gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              Disparar pulso
            </Button>
            <Button onClick={onBlackout} disabled={stats.state !== "connected"} variant="outline" size="sm">
              Blackout
            </Button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/50">
            Para fixture genérico (laser/dimmer): canal 1 normalmente é dimmer/intensidade.
            Para Showven/pyro, mantenha o sistema DESARMADO até validar continuidade.
          </p>
        </div>
      </div>
    </section>
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
