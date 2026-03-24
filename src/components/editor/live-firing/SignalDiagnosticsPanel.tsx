/**
 * SignalDiagnosticsPanel — Advanced RF/Mesh diagnostics, PTP clock sync,
 * impedance readings, and environmental telemetry for field modules.
 * Simulated data animates at 1Hz for a "live hardware" feel.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Wifi, Radio, Thermometer, Zap, Clock, Activity, AlertTriangle, Signal, Battery, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface ModuleTelemetry {
  id: number;
  label: string;
  rssi: number;          // dBm
  snr: number;           // dB
  link1: { type: string; active: boolean };
  link2: { type: string; active: boolean };
  failover: boolean;
  rtt: number;           // ms
  jitter: number;        // ms
  clockOffset: number;   // µs
  temperature: number;   // °C
  voltage: number;       // V
  voltageUnderLoad: number;
  igniters: IgniterReading[];
}

interface IgniterReading {
  pin: number;
  resistance: number | null; // null = open
  status: 'normal' | 'risk' | 'open' | 'short';
}

// ═══════════════════════════════════════════════════════════
// DATA GENERATOR
// ═══════════════════════════════════════════════════════════
function generateModules(count: number, tick: number): ModuleTelemetry[] {
  return Array.from({ length: count }, (_, i) => {
    const baseRssi = -45 - i * 6 + Math.sin(tick * 0.3 + i) * 4;
    const rssi = Math.round(baseRssi * 10) / 10;
    const snr = Math.round((25 + rssi * 0.3 + Math.random() * 3) * 10) / 10;
    const link1Active = rssi > -85;
    const failover = !link1Active;
    const rtt = Math.round((1.0 + i * 0.4 + Math.random() * 2) * 100) / 100;
    const jitter = Math.round((0.1 + Math.random() * 0.8) * 100) / 100;
    const clockOffset = Math.round((Math.sin(tick * 0.5 + i) * 50 + Math.random() * 20) * 10) / 10;
    const temp = Math.round((32 + i * 3 + Math.sin(tick * 0.2) * 5 + Math.random() * 4) * 10) / 10;
    const voltage = Math.round((24.2 - i * 0.15 + Math.sin(tick * 0.1) * 0.3) * 100) / 100;
    const voltageUnderLoad = Math.round((voltage - 0.6 - Math.random() * 0.4) * 100) / 100;

    const igniters: IgniterReading[] = Array.from({ length: 32 }, (_, p) => {
      const r = Math.random();
      if (r < 0.05) return { pin: p, resistance: null, status: 'open' as const };
      if (r < 0.08) return { pin: p, resistance: 0.1, status: 'short' as const };
      if (r < 0.15) return { pin: p, resistance: Math.round((5 + Math.random() * 3) * 10) / 10, status: 'risk' as const };
      return { pin: p, resistance: Math.round((0.8 + Math.random() * 1.2) * 100) / 100, status: 'normal' as const };
    });

    return {
      id: i,
      label: `MOD-${String(i + 1).padStart(2, '0')}`,
      rssi, snr,
      link1: { type: 'LAN/WiFi', active: link1Active },
      link2: { type: 'RF 900MHz', active: true },
      failover,
      rtt, jitter, clockOffset,
      temperature: temp,
      voltage, voltageUnderLoad,
      igniters,
    };
  });
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function rssiColor(rssi: number) {
  if (rssi > -60) return 'text-emerald-400';
  if (rssi > -80) return 'text-yellow-400';
  return 'text-red-400';
}
function rssiBg(rssi: number) {
  if (rssi > -60) return 'bg-emerald-500';
  if (rssi > -80) return 'bg-yellow-500';
  return 'bg-red-500';
}
function rssiLevel(rssi: number) {
  return Math.max(0, Math.min(100, ((rssi + 100) / 50) * 100));
}

function impedanceColor(ig: IgniterReading) {
  switch (ig.status) {
    case 'normal': return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400';
    case 'risk': return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    case 'open': return 'bg-red-500/20 border-red-500/40 text-red-400';
    case 'short': return 'bg-red-500/30 border-red-400/60 text-red-300 animate-pulse';
  }
}

function impedanceLabel(ig: IgniterReading) {
  if (ig.status === 'open') return 'OPEN';
  if (ig.status === 'short') return 'SHORT';
  return `${ig.resistance}Ω`;
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function SignalDiagnosticsPanel() {
  const [tick, setTick] = useState(0);
  const [selectedModule, setSelectedModule] = useState(0);
  const [selectedPin, setSelectedPin] = useState<number | null>(null);
  const moduleCount = 6;

  // 1Hz telemetry tick
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const modules = useMemo(() => generateModules(moduleCount, tick), [moduleCount, tick]);
  const mod = modules[selectedModule];

  return (
    <div className="space-y-2 text-[9px] font-mono overflow-y-auto max-h-[600px] pr-1">
      {/* ─── SECTION 1: Signal Diagnostics ─── */}
      <SectionHeader icon={Signal} label="SIGNAL DIAGNOSTICS" sub="RF / MESH / RSSI" />
      <div className="space-y-1">
        {modules.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setSelectedModule(i)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded border transition-all",
              selectedModule === i
                ? "border-primary/40 bg-primary/5"
                : "border-border/10 bg-card/30 hover:bg-card/50"
            )}
          >
            <span className="text-muted-foreground/60 w-12 text-left">{m.label}</span>
            {/* RSSI bar */}
            <div className="flex-1 h-2 bg-muted/10 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", rssiBg(m.rssi))} style={{ width: `${rssiLevel(m.rssi)}%` }} />
            </div>
            <span className={cn("w-14 text-right font-bold", rssiColor(m.rssi))}>{m.rssi.toFixed(1)} dBm</span>
            <span className="text-muted-foreground/40 w-10 text-right">SNR {m.snr.toFixed(0)}</span>
            {/* Link indicators */}
            <div className="flex gap-1">
              <div className={cn("w-1.5 h-3 rounded-sm", m.link1.active ? 'bg-emerald-500' : 'bg-red-500/50')} title={m.link1.type} />
              <div className={cn("w-1.5 h-3 rounded-sm", m.link2.active ? 'bg-emerald-500' : 'bg-muted/20')} title={m.link2.type} />
            </div>
            {m.failover && (
              <Badge variant="outline" className="text-[6px] px-1 py-0 border-amber-500/40 text-amber-400">
                FAILOVER
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* ─── SECTION 2: Clock Sync & Latency ─── */}
      <SectionHeader icon={Clock} label="CLOCK SYNC & LATENCY" sub="PTP / NTP" />
      <div className="grid grid-cols-3 gap-1.5">
        {modules.map(m => {
          const syncWarn = m.rtt > 10;
          return (
            <div key={m.id} className={cn(
              "rounded border px-2 py-1.5 space-y-0.5",
              syncWarn ? "border-red-500/30 bg-red-950/10" : "border-border/10 bg-card/30"
            )}>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground/50">{m.label}</span>
                {syncWarn && <AlertTriangle className="w-2.5 h-2.5 text-red-400 animate-pulse" />}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/40">RTT</span>
                <span className={cn("font-bold", syncWarn ? 'text-red-400' : 'text-emerald-400')}>{m.rtt.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/40">Jitter</span>
                <span className={cn(m.jitter > 0.5 ? 'text-yellow-400' : 'text-muted-foreground/60')}>{m.jitter.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground/40">Offset</span>
                <span className="text-muted-foreground/60">{m.clockOffset.toFixed(1)}µs</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── SECTION 3: Impedance (selected module) ─── */}
      <SectionHeader icon={Zap} label={`IMPEDÂNCIA — ${mod.label}`} sub="OHMS / CONTINUIDADE" />
      <div className="grid grid-cols-8 gap-0.5">
        {mod.igniters.map(ig => (
          <button
            key={ig.pin}
            onClick={() => setSelectedPin(selectedPin === ig.pin ? null : ig.pin)}
            className={cn(
              "rounded border text-center py-1 transition-all text-[7px]",
              impedanceColor(ig),
              selectedPin === ig.pin && "ring-1 ring-primary/60"
            )}
          >
            <div className="font-bold">{String(ig.pin + 1).padStart(2, '0')}</div>
            <div className="text-[6px]">{impedanceLabel(ig)}</div>
          </button>
        ))}
      </div>
      {selectedPin !== null && (
        <ImpedanceDetail ig={mod.igniters[selectedPin]} moduleName={mod.label} />
      )}

      {/* ─── SECTION 4: Environmental ─── */}
      <SectionHeader icon={Thermometer} label="MONITORAMENTO AMBIENTAL" sub="TEMP / TENSÃO" />
      <div className="grid grid-cols-3 gap-1.5">
        {modules.map(m => {
          const tempWarn = m.temperature > 60;
          return (
            <div key={m.id} className={cn(
              "rounded border px-2 py-1.5 space-y-0.5",
              tempWarn ? "border-amber-500/30 bg-amber-950/10" : "border-border/10 bg-card/30"
            )}>
              <span className="text-muted-foreground/50">{m.label}</span>
              <div className="flex items-center justify-between">
                <Thermometer className={cn("w-2.5 h-2.5", tempWarn ? 'text-amber-400' : 'text-muted-foreground/40')} />
                <span className={cn("font-bold", tempWarn ? 'text-amber-400' : 'text-emerald-400')}>{m.temperature.toFixed(1)}°C</span>
              </div>
              <div className="flex items-center justify-between">
                <Battery className="w-2.5 h-2.5 text-muted-foreground/40" />
                <span className="text-muted-foreground/60">{m.voltage.toFixed(2)}V</span>
              </div>
              <div className="flex items-center justify-between">
                <Zap className="w-2.5 h-2.5 text-muted-foreground/40" />
                <span className={cn("text-[7px]", m.voltageUnderLoad < 22 ? 'text-red-400' : 'text-muted-foreground/50')}>
                  Load: {m.voltageUnderLoad.toFixed(2)}V
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-1 border-t border-border/10 text-[7px] text-muted-foreground/30">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> &gt;-60dBm</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> -60~-80</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> &lt;-80dBm</span>
        <span className="ml-auto">1Hz telemetry</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════
function SectionHeader({ icon: Icon, label, sub }: { icon: typeof Signal; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-0.5">
      <Icon className="w-3 h-3 text-primary/60" />
      <span className="text-[8px] font-bold tracking-[0.15em] text-primary/80">{label}</span>
      <span className="text-[6px] text-muted-foreground/30">{sub}</span>
    </div>
  );
}

function ImpedanceDetail({ ig, moduleName }: { ig: IgniterReading; moduleName: string }) {
  return (
    <div className={cn("rounded border px-3 py-2 space-y-1", impedanceColor(ig))}>
      <div className="flex justify-between items-center">
        <span className="font-bold text-[10px]">{moduleName} · Pin {String(ig.pin + 1).padStart(2, '0')}</span>
        <Badge variant="outline" className={cn("text-[7px] px-1.5 py-0", 
          ig.status === 'normal' ? 'border-emerald-500/40 text-emerald-400' :
          ig.status === 'risk' ? 'border-yellow-500/40 text-yellow-400' :
          'border-red-500/40 text-red-400'
        )}>
          {ig.status.toUpperCase()}
        </Badge>
      </div>
      <div className="text-[8px]">
        {ig.status === 'normal' && <span>Resistência: <strong>{ig.resistance}Ω</strong> — Ignitor OK (0.5–2.0Ω)</span>}
        {ig.status === 'risk' && <span>Resistência: <strong>{ig.resistance}Ω</strong> — ⚠ Risco de falha / Fio danificado (&gt;5Ω)</span>}
        {ig.status === 'open' && <span>Circuito aberto — Ignitor não conectado</span>}
        {ig.status === 'short' && <span>Curto-circuito detectado — <strong>PERIGO</strong> — Verificar cablagem</span>}
      </div>
    </div>
  );
}
