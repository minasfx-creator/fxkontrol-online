import { useMemo, useState } from 'react';
import { ClaimBadge } from './ClaimBadge';
import {
  createSeedTwin,
  evaluateReadiness,
  setMode,
  togglePeripheralHealth,
  type DockMode,
  type DockTwinProfile,
  type Health,
} from '@/lib/dockTwin';
import { Wrench, ShieldCheck, Battery, Cpu, Plug, Radio, Activity, CheckCircle2, AlertTriangle, XCircle, Lock } from 'lucide-react';

const MODE_LABEL: Record<DockMode, string> = {
  serviceability: 'Serviceability',
  bench: 'Bench / Dummy load',
  'field-readiness': 'Field readiness',
};

const HEALTH_TONE: Record<Health, string> = {
  ok: 'border-green-500/40 bg-green-500/5 text-green-400',
  degraded: 'border-amber-500/40 bg-amber-500/5 text-amber-400',
  fault: 'border-red-500/40 bg-red-500/5 text-red-400',
  unknown: 'border-border bg-background/40 text-muted-foreground',
};

const HEALTH_ICON: Record<Health, React.ComponentType<{ className?: string }>> = {
  ok: CheckCircle2,
  degraded: AlertTriangle,
  fault: XCircle,
  unknown: Activity,
};

export function DockTwinPilotPanel() {
  const [twin, setTwin] = useState<DockTwinProfile>(() => createSeedTwin());
  const readiness = useMemo(() => evaluateReadiness(twin), [twin]);

  const cycleHealth = (id: string, current: Health) => {
    const order: Health[] = ['ok', 'degraded', 'fault', 'unknown'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    setTwin((t) => togglePeripheralHealth(t, id, next));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-background/30 p-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Wrench className="h-4 w-4 text-primary" />
          <h4 className="text-xs font-semibold">{twin.model}</h4>
          <span className="text-[10px] ds-mono text-muted-foreground">fw {twin.firmware}</span>
          <ClaimBadge status="pilot" className="ml-auto" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Physical–digital twin inspired by XLR control language. <strong>Bench mode never fires real commands</strong>.
          Field readiness is evaluated locally; real operations remain gated upstream by the Safety State Machine.
        </p>
      </div>

      {/* Mode + Battery + Limits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="rounded-md border border-border bg-background/30 p-3">
          <p className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground mb-2">Mode</p>
          <div className="flex flex-col gap-1">
            {(['serviceability', 'bench', 'field-readiness'] as DockMode[]).map((m) => {
              const active = twin.mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTwin((t) => setMode(t, m))}
                  className={`text-left text-[11px] ds-mono px-2 py-1.5 rounded border transition-colors ${
                    active ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-background/40 text-foreground hover:border-border-strong'
                  }`}
                >
                  {MODE_LABEL[m]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-border bg-background/30 p-3">
          <p className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground mb-2">Battery</p>
          <div className="flex items-center gap-2">
            <Battery className={`h-5 w-5 ${twin.battery.percent < 40 ? 'text-amber-400' : 'text-green-400'}`} />
            <p className="ds-mono text-2xl font-semibold">{twin.battery.percent}%</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{twin.battery.voltage.toFixed(1)} V · {twin.battery.charging ? 'charging' : 'idle'}</p>
        </div>

        <div className="rounded-md border border-border bg-background/30 p-3">
          <p className="text-[9px] ds-mono uppercase tracking-wider text-muted-foreground mb-2">Limits</p>
          <ul className="space-y-1 text-[11px]">
            <li className="flex justify-between"><span className="text-muted-foreground">Channels</span><span className="ds-mono">{twin.limits.maxChannels}</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Sustained</span><span className="ds-mono">{twin.limits.maxSustainedAmps} A</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Ingress</span><span className="ds-mono">{twin.limits.ipRating}</span></li>
          </ul>
        </div>
      </div>

      {/* Peripherals */}
      <div>
        <h5 className="text-[10px] ds-mono uppercase tracking-wider text-muted-foreground mb-2">Peripherals · click to cycle health</h5>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {twin.peripherals.map((p) => {
            const Icon = HEALTH_ICON[p.health];
            const PIcon = p.type.startsWith('comm') ? Radio : p.type.startsWith('dmx') || p.type.startsWith('artnet') ? Plug : Cpu;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => cycleHealth(p.id, p.health)}
                className="text-left rounded-md border border-border bg-background/30 p-2.5 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start gap-2">
                  <PIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{p.label}</span>
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[9px] ds-mono uppercase ${HEALTH_TONE[p.health]}`}>
                        <Icon className="h-2.5 w-2.5" />{p.health}
                      </span>
                      {p.evidenceRequired && (
                        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border border-cyan-500/40 bg-cyan-500/5 text-cyan-400 text-[9px] ds-mono uppercase">
                          <Lock className="h-2.5 w-2.5" />evidence
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {p.type} · {p.version} · {p.replaceable ? 'swappable' : 'fixed'}
                    </p>
                    {p.notes && <p className="text-[10px] text-amber-400/80 mt-1">{p.notes}</p>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Readiness verdict */}
      <div className={`rounded-md border p-3 ${readiness.decision === 'GO' ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5'}`}>
        <div className="flex items-center gap-2">
          <ShieldCheck className={`h-4 w-4 ${readiness.decision === 'GO' ? 'text-green-400' : 'text-red-400'}`} />
          <h4 className="text-xs font-semibold ds-mono uppercase tracking-wider">DockTwin Readiness · {readiness.decision}</h4>
          <span className="ml-auto text-[10px] text-muted-foreground">{readiness.peripheralsOk}/{readiness.peripheralsTotal} ok</span>
        </div>
        {readiness.reasons.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px]">
            {readiness.reasons.map((r, i) => (
              <li key={i} className="text-foreground/90">• {r}</li>
            ))}
          </ul>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          DockTwin verdict is independent from the Go-Live Center. Field operations require both to be GO.
        </p>
      </div>
    </div>
  );
}
