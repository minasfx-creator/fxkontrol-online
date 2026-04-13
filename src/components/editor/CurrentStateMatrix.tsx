/**
 * CurrentStateMatrix v3 — Expanded with Integration Mode, Evidence Level, Source.
 * 16 rows. Provenance-aware. Honest architectural truth.
 */
import { useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { useVerificationEngine } from '@/core/verification/useVerificationEngine';
import { useHardwareRegistry } from '@/core/hardware/useHardwareRegistry';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { getProvenanceBadge, type IntegrationMode, type EvidenceLevel } from '@/core/hardware/provenance';
import { cn } from '@/lib/utils';
import { Activity, CheckCircle2, AlertTriangle, MinusCircle, XCircle } from 'lucide-react';

type MatrixStatus = 'exists' | 'partial' | 'placeholder' | 'absent';

interface MatrixRow {
  label: string;
  status: MatrixStatus;
  integrationMode: IntegrationMode;
  evidenceLevel: EvidenceLevel;
  source: string;
  detail: string;
  drillDown?: string; // CommandCenter mode to navigate to
}

const STATUS_CONFIG: Record<MatrixStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  exists:      { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'EXISTS' },
  partial:     { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/15',   label: 'PARTIAL' },
  placeholder: { icon: MinusCircle,   color: 'text-cyan-400',    bg: 'bg-cyan-500/15',     label: 'PLACEHOLDER' },
  absent:      { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/15',      label: 'ABSENT' },
};

const MODE_COLORS: Record<IntegrationMode, string> = {
  simulated: 'text-blue-400 bg-blue-500/10',
  replay: 'text-amber-400 bg-amber-500/10',
  live_read_only: 'text-emerald-400 bg-emerald-500/10',
  not_integrated: 'text-red-400 bg-red-500/10',
};

const EVIDENCE_COLORS: Record<EvidenceLevel, string> = {
  ui_only: 'text-muted-foreground/50',
  adapter_only: 'text-cyan-400',
  telemetry_verified: 'text-emerald-400',
  operator_confirmed: 'text-emerald-300',
};

export default function CurrentStateMatrix() {
  const sp = showPlanManager.current;
  const { level } = useVerificationEngine();
  const { devices, snapshots, refresh } = useHardwareRegistry();
  const navigate = useNavigate();

  useEffect(() => { refresh(); }, []);

  const handleDrillDown = useCallback((mode?: string) => {
    if (mode) navigate(`/command-center?mode=${mode}`);
  }, [navigate]);

  const getAdapterInfo = (id: string): { status: MatrixStatus; mode: IntegrationMode; evidence: EvidenceLevel; source: string; detail: string } => {
    const dev = devices.find(d => d.id === id);
    const prov = unifiedHardwareRegistry.getProvenance(id);
    const snap = snapshots.find(s => s.device_id === id);

    if (!dev || !prov) return { status: 'absent', mode: 'not_integrated', evidence: 'ui_only', source: 'none', detail: 'Not registered' };

    const status: MatrixStatus = dev.connection_state === 'connected' ? 'exists' : dev.connection_state === 'degraded' ? 'partial' : 'placeholder';
    const source = prov.transport_type === 'none' || prov.transport_type === 'logical' ? prov.provenance : prov.transport_type;
    const detail = snap?.online
      ? snap.errors.length > 0 ? `Online — ${snap.errors[0]}` : `Online — ${Object.entries(snap.metrics).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')}`
      : 'Offline';

    return { status, mode: prov.integration_mode, evidence: prov.evidence_level, source, detail };
  };

  const rows = useMemo((): MatrixRow[] => {
    const hasContent = sp.pyroCues.length > 0 || sp.dmxCues.length > 0 || sp.dronePaths.length > 0;

    const adapterRows = [
      ['Arduino Adapter', 'arduino-nano-01'],
      ['74HC595 Adapter', 'sr-74hc595-chain'],
      ['CD4051 Adapter', 'mux-cd4051-dual'],
      ['Relay Bank Monitor', 'relay-bank-32ch'],
      ['Battery Monitor', 'battery-12v'],
      ['Art-Net Monitor', 'artnet-node-01'],
      ['DMX Monitor', 'dmx-universe-1'],
      ['FireOne Export', 'fireone-profile'],
    ].map(([label, id]) => {
      const info = getAdapterInfo(id);
      return { label, status: info.status, integrationMode: info.mode, evidenceLevel: info.evidence, source: info.source, detail: info.detail };
    });

    return [
      { label: 'ShowPlan', status: hasContent ? 'exists' : 'absent', integrationMode: 'simulated' as IntegrationMode, evidenceLevel: 'adapter_only' as EvidenceLevel, source: 'ShowPlanManager', detail: hasContent ? `${sp.pyroCues.length}P + ${sp.dmxCues.length}D + ${sp.dronePaths.length}Dr` : 'No content', drillDown: 'show_control' },
      { label: 'VerificationPass', status: level !== 'BLOCKED' ? 'exists' : hasContent ? 'partial' : 'absent', integrationMode: 'simulated' as IntegrationMode, evidenceLevel: 'adapter_only' as EvidenceLevel, source: 'VerificationEngine', detail: level.replace(/_/g, ' '), drillDown: 'verification' },
      { label: 'ExportCoordinator', status: hasContent ? 'exists' : 'absent', integrationMode: 'simulated' as IntegrationMode, evidenceLevel: 'adapter_only' as EvidenceLevel, source: 'ExportCoordinator', detail: hasContent ? 'Pipeline active' : 'No data', drillDown: 'export_readiness' },
      ...adapterRows,
      { label: 'AuditTrail', status: 'exists' as MatrixStatus, integrationMode: 'simulated' as IntegrationMode, evidenceLevel: 'adapter_only' as EvidenceLevel, source: 'DeviceEventLog+BlackBox', detail: 'Active — logging events', drillDown: 'audit_blackbox' },
      { label: 'Unreal Integration', status: 'placeholder' as MatrixStatus, integrationMode: 'not_integrated' as IntegrationMode, evidenceLevel: 'ui_only' as EvidenceLevel, source: 'none', detail: 'Contract defined, runtime pending', drillDown: 'unreal_status' },
      { label: 'BP_SwarmManager', status: sp.dronePaths.length > 0 ? 'partial' as MatrixStatus : 'placeholder' as MatrixStatus, integrationMode: 'not_integrated' as IntegrationMode, evidenceLevel: 'ui_only' as EvidenceLevel, source: 'none', detail: sp.dronePaths.length > 0 ? `${sp.dronePaths.length} paths` : 'Awaiting Unreal', drillDown: 'swarm_contract' },
    ];
  }, [sp, level, devices, snapshots]);

  const counts = useMemo(() => {
    const c = { exists: 0, partial: 0, placeholder: 0, absent: 0 };
    rows.forEach(r => c[r.status]++);
    return c;
  }, [rows]);

  const simCount = rows.filter(r => r.integrationMode === 'simulated').length;
  const liveCount = rows.filter(r => r.integrationMode === 'live_read_only').length;

  return (
    <div className="flex flex-col h-full p-4 gap-3 bg-background/80">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Current State Matrix</span>
        </div>
        <div className="flex items-center gap-2 text-[8px] font-mono">
          {(Object.entries(counts) as [MatrixStatus, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return <span key={status} className={cn('px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>{count} {cfg.label}</span>;
          })}
        </div>
      </div>

      {/* Integration summary */}
      <div className="flex items-center gap-3 text-[7px] font-mono text-muted-foreground">
        <span className="text-blue-400">{simCount} SIMULATED</span>
        <span className="text-emerald-400">{liveCount} LIVE</span>
        <span className="text-red-400">{rows.filter(r => r.integrationMode === 'not_integrated').length} NOT INTEGRATED</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_90px_90px_80px_120px] gap-1 text-[7px] font-mono text-muted-foreground/50 tracking-widest px-2">
        <span>SUBSYSTEM</span>
        <span className="text-center">STATUS</span>
        <span className="text-center">INT. MODE</span>
        <span className="text-center">EVIDENCE</span>
        <span>SOURCE</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {rows.map(row => {
          const cfg = STATUS_CONFIG[row.status];
          const badge = getProvenanceBadge(row.integrationMode);
          return (
            <div key={row.label} onClick={() => handleDrillDown(row.drillDown)} className={cn("grid grid-cols-[1fr_90px_90px_80px_120px] gap-1 items-center rounded border border-border/10 px-2 py-1.5 hover:bg-muted/5 transition-colors", row.drillDown && "cursor-pointer hover:border-primary/30")}>
              <div>
                <div className="text-[9px] font-mono font-medium text-foreground">{row.label}</div>
                <div className="text-[7px] font-mono text-muted-foreground/50">{row.detail}</div>
              </div>
              <div className="flex justify-center">
                <span className={cn('text-[7px] font-mono px-1.5 py-0.5 rounded', cfg.bg, cfg.color)}>{cfg.label}</span>
              </div>
              <div className="flex justify-center">
                <span className={cn('text-[7px] font-mono px-1.5 py-0.5 rounded', MODE_COLORS[row.integrationMode])}>{badge.label}</span>
              </div>
              <div className="flex justify-center">
                <span className={cn('text-[7px] font-mono', EVIDENCE_COLORS[row.evidenceLevel])}>{row.evidenceLevel.replace(/_/g, ' ')}</span>
              </div>
              <div className="text-[7px] font-mono text-muted-foreground/60 truncate">{row.source}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
