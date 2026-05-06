/**
 * ─── FXK32Q Adapter Snapshot — read-only ──────────────────────────
 *
 * Pure forensic surface over `fxk32qModuleAdapter`:
 *   • snapshot (online/metrics)
 *   • provenance (integration_mode/transport/freshness)
 *   • capabilities (protocols + flags)
 *   • diagnostics (issues list)
 *   • channel matrix 4×8 (continuity color per pin)
 *
 * NEVER calls CommandBus / SafetyStateMachine / FieldBus.
 * NEVER mutates workMode. Polling 1s with useRef teardown.
 */
import { useEffect, useRef, useState } from 'react';
import { fxk32qModuleAdapter } from '@/core/hardware/adapters/FXK32QModuleAdapter';
import { ProvenanceBadge } from '@/components/safety/ProvenanceBadge';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface View {
  snap: ReturnType<typeof fxk32qModuleAdapter.getSnapshot>;
  prov: ReturnType<typeof fxk32qModuleAdapter.getProvenance>;
  caps: ReturnType<typeof fxk32qModuleAdapter.getCapabilities>;
  diag: ReturnType<typeof fxk32qModuleAdapter.runDiagnostics>;
  state: ReturnType<typeof fxk32qModuleAdapter.getState>;
  conn: ReturnType<typeof fxk32qModuleAdapter.getConnectionState>;
}

function readView(): View {
  return {
    snap: fxk32qModuleAdapter.getSnapshot(),
    prov: fxk32qModuleAdapter.getProvenance(),
    caps: fxk32qModuleAdapter.getCapabilities(),
    diag: fxk32qModuleAdapter.runDiagnostics(),
    state: fxk32qModuleAdapter.getState(),
    conn: fxk32qModuleAdapter.getConnectionState(),
  };
}

const CONTINUITY_CLASS: Record<string, string> = {
  ok:      'bg-[hsl(140_70%_42%)]/85 text-black',
  open:    'bg-[hsl(38_92%_55%)]/85 text-black',
  short:   'bg-[hsl(0_75%_55%)]/90 text-white',
  unknown: 'bg-muted/50 text-muted-foreground',
};

export default function FXK32QAdapterPanel() {
  const [view, setView] = useState<View>(() => readView());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setView(readView()), 1000);
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const { snap, prov, caps, diag, state, conn } = view;
  const adapterLabel = fxk32qModuleAdapter.label;
  const isSimulated = prov.integration_mode === 'simulated';

  const connBadgeClass =
    conn === 'connected'
      ? 'ds-status-ok'
      : conn === 'connecting' || conn === 'reconnecting'
        ? 'ds-status-warn'
        : 'ds-status-fail';

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-md border border-border/40 bg-card/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="ds-h4 font-bold tracking-wide">{adapterLabel}</h2>
          <Badge className={cn('ds-mono text-[10px] uppercase tracking-widest', connBadgeClass)}>
            {conn}
          </Badge>
          <ProvenanceBadge mode={prov.integration_mode} compact />
        </div>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 ds-mono text-[11px] text-muted-foreground">
          <div><span className="opacity-60">device_id:</span> {fxk32qModuleAdapter.deviceId}</div>
          <div><span className="opacity-60">model:</span> {fxk32qModuleAdapter.firmwareModel}</div>
          <div><span className="opacity-60">family:</span> {fxk32qModuleAdapter.protocolFamily}</div>
          <div><span className="opacity-60">compat:</span> {fxk32qModuleAdapter.compatibleWith}</div>
        </div>
      </div>

      {isSimulated && (
        <div className="rounded-md border border-[hsl(38_92%_55%)]/40 bg-[hsl(38_92%_55%)]/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-[hsl(38_92%_60%)] shrink-0" />
          <div className="text-[12px] text-[hsl(38_92%_75%)]">
            Provenance is <strong>SIMULATED</strong>. Connect via <code>/dev/fxk32q?tab=control</code> to promote the
            adapter to <strong>LIVE READ-ONLY</strong> after the FXK32Q handshake.
          </div>
        </div>
      )}

      {/* Provenance */}
      <div className="rounded-md border border-border/40 bg-card/40 p-4 space-y-2">
        <h3 className="ds-label uppercase tracking-widest text-muted-foreground">Provenance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 ds-mono text-[11px]">
          <div><span className="opacity-60">mode:</span> {prov.integration_mode}</div>
          <div><span className="opacity-60">data:</span> {prov.provenance}</div>
          <div><span className="opacity-60">evidence:</span> {prov.evidence_level}</div>
          <div><span className="opacity-60">transport:</span> {prov.transport_type}</div>
          <div><span className="opacity-60">last_seen:</span> {prov.last_seen_at ? new Date(prov.last_seen_at).toLocaleTimeString() : '—'}</div>
          <div><span className="opacity-60">freshness_ms:</span> {prov.data_freshness_ms}</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="rounded-md border border-border/40 bg-card/40 p-4">
        <h3 className="ds-label uppercase tracking-widest text-muted-foreground mb-3">Snapshot Metrics</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 ds-mono text-[12px]">
          {[
            ['total',   snap.metrics.total],
            ['healthy', snap.metrics.healthy],
            ['ok',      snap.metrics.ok],
            ['open',    snap.metrics.open],
            ['short',   snap.metrics.short],
            ['faults',  snap.metrics.faults],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded border border-border/30 bg-background/40 px-2 py-1.5 text-center">
              <div className="opacity-60 uppercase text-[9px] tracking-widest">{k}</div>
              <div className="font-bold text-[14px]">{String(v)}</div>
            </div>
          ))}
        </div>
        {snap.warnings.length > 0 && (
          <div className="mt-2 ds-mono text-[11px] text-[hsl(38_92%_70%)]">
            {snap.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
        {snap.errors.length > 0 && (
          <div className="mt-2 ds-mono text-[11px] text-[hsl(0_75%_70%)]">
            {snap.errors.map((e, i) => <div key={i}>✕ {e}</div>)}
          </div>
        )}
      </div>

      {/* Capabilities */}
      <div className="rounded-md border border-border/40 bg-card/40 p-4 space-y-2">
        <h3 className="ds-label uppercase tracking-widest text-muted-foreground">Capabilities</h3>
        <div className="flex flex-wrap gap-1.5">
          {(['canRead','canWrite','canDiagnose','canSimulate','canExport','supportsTelemetry','supportsContinuity'] as const).map((k) => (
            <Badge
              key={k}
              variant="outline"
              className={cn(
                'ds-mono text-[10px] uppercase tracking-wider',
                caps[k] ? 'border-[hsl(140_70%_42%)]/60 text-[hsl(140_70%_70%)]' : 'border-border/40 text-muted-foreground/60'
              )}
            >
              {caps[k] ? '✓' : '·'} {k.replace(/^(can|supports)/, '').toLowerCase()}
            </Badge>
          ))}
          <Badge variant="outline" className="ds-mono text-[10px] border-border/40">
            maxCh {caps.maxChannels}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {caps.protocols.map((p) => (
            <span
              key={p}
              className="ds-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-[hsl(190_70%_58%)]/30 text-[hsl(190_70%_75%)] bg-[hsl(190_70%_58%)]/5"
            >
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Diagnostics */}
      <div className="rounded-md border border-border/40 bg-card/40 p-4 space-y-2">
        <h3 className="ds-label uppercase tracking-widest text-muted-foreground">Diagnostics</h3>
        {diag.healthy ? (
          <div className="flex items-center gap-2 text-[hsl(140_70%_70%)] text-[12px]">
            <CheckCircle2 className="w-4 h-4" /> All clear
          </div>
        ) : (
          <ul className="ds-mono text-[11px] text-[hsl(38_92%_70%)] space-y-0.5">
            {diag.issues.map((iss, i) => <li key={i}>• {iss}</li>)}
          </ul>
        )}
      </div>

      {/* Channel matrix */}
      <div className="rounded-md border border-border/40 bg-card/40 p-4">
        <h3 className="ds-label uppercase tracking-widest text-muted-foreground mb-3">Channel Matrix (4×8)</h3>
        <div className="grid grid-cols-8 gap-1">
          {state.channel_states.map((c) => (
            <div
              key={c.channel}
              title={`ch ${c.channel + 1} • ${c.continuity} • ${c.resistance_ohms.toFixed(2)}Ω`}
              className={cn(
                'aspect-square rounded ds-mono text-[10px] font-bold flex items-center justify-center',
                CONTINUITY_CLASS[c.continuity] ?? CONTINUITY_CLASS.unknown
              )}
            >
              {c.channel + 1}
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2 ds-mono text-[10px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm align-middle bg-[hsl(140_70%_42%)]/85 mr-1" />ok</span>
          <span><span className="inline-block w-2 h-2 rounded-sm align-middle bg-[hsl(38_92%_55%)]/85 mr-1" />open</span>
          <span><span className="inline-block w-2 h-2 rounded-sm align-middle bg-[hsl(0_75%_55%)]/90 mr-1" />short</span>
          <span><span className="inline-block w-2 h-2 rounded-sm align-middle bg-muted mr-1" />unknown</span>
        </div>
      </div>
    </div>
  );
}
