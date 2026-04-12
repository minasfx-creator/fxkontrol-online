/**
 * CurrentStateMatrix — Updated with all hardware adapters and subsystems.
 * 14 rows matching the required specification.
 */
import { useMemo, useEffect } from 'react';
import { showPlanManager } from '@/core/showplan/ShowPlanManager';
import { useVerificationEngine } from '@/core/verification/useVerificationEngine';
import { useHardwareRegistry } from '@/core/hardware/useHardwareRegistry';
import { cn } from '@/lib/utils';
import { Activity, CheckCircle2, AlertTriangle, MinusCircle, XCircle } from 'lucide-react';

type MatrixStatus = 'exists' | 'partial' | 'placeholder' | 'absent';

interface MatrixRow { label: string; status: MatrixStatus; detail: string; }

const STATUS_CONFIG: Record<MatrixStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  exists:      { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/15', label: 'EXISTS' },
  partial:     { icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/15',   label: 'PARTIAL' },
  placeholder: { icon: MinusCircle,   color: 'text-cyan-400',    bg: 'bg-cyan-500/15',     label: 'PLACEHOLDER' },
  absent:      { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/15',      label: 'ABSENT' },
};

export default function CurrentStateMatrix() {
  const sp = showPlanManager.current;
  const { level } = useVerificationEngine();
  const { devices, snapshots, refresh } = useHardwareRegistry();

  useEffect(() => { refresh(); }, []);

  const getDeviceStatus = (id: string): MatrixStatus => {
    const dev = devices.find(d => d.id === id);
    if (!dev) return 'absent';
    if (dev.connection_state === 'connected') return 'exists';
    if (dev.connection_state === 'degraded') return 'partial';
    return 'placeholder';
  };

  const getDeviceDetail = (id: string): string => {
    const snap = snapshots.find(s => s.device_id === id);
    if (!snap) return 'Not registered';
    if (snap.online) return snap.errors.length > 0 ? `Online — ${snap.errors[0]}` : `Online — ${Object.entries(snap.metrics).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
    return 'Offline';
  };

  const rows = useMemo((): MatrixRow[] => {
    const hasContent = sp.pyroCues.length > 0 || sp.dmxCues.length > 0 || sp.dronePaths.length > 0;
    return [
      { label: 'ShowPlan', status: hasContent ? 'exists' : 'absent', detail: hasContent ? `${sp.pyroCues.length}P + ${sp.dmxCues.length}D + ${sp.dronePaths.length}Dr` : 'No content' },
      { label: 'VerificationPass', status: level !== 'BLOCKED' ? 'exists' : hasContent ? 'partial' : 'absent', detail: level.replace(/_/g, ' ') },
      { label: 'HardwareRegistry', status: devices.length > 0 ? 'exists' : 'absent', detail: `${devices.length} adapters, ${devices.filter(d => d.connection_state === 'connected').length} online` },
      { label: 'Arduino Adapter', status: getDeviceStatus('arduino-nano-01'), detail: getDeviceDetail('arduino-nano-01') },
      { label: '74HC595 Adapter', status: getDeviceStatus('sr-74hc595-chain'), detail: getDeviceDetail('sr-74hc595-chain') },
      { label: 'CD4051 Adapter', status: getDeviceStatus('mux-cd4051-dual'), detail: getDeviceDetail('mux-cd4051-dual') },
      { label: 'Relay Bank Monitor', status: getDeviceStatus('relay-bank-32ch'), detail: getDeviceDetail('relay-bank-32ch') },
      { label: 'Battery Monitor', status: getDeviceStatus('battery-12v'), detail: getDeviceDetail('battery-12v') },
      { label: 'Art-Net Monitor', status: getDeviceStatus('artnet-node-01'), detail: getDeviceDetail('artnet-node-01') },
      { label: 'DMX Universe', status: getDeviceStatus('dmx-universe-1'), detail: getDeviceDetail('dmx-universe-1') },
      { label: 'DMX Patch Export', status: sp.dmxCues.length > 0 ? 'exists' : 'absent', detail: sp.dmxCues.length > 0 ? `${sp.dmxCues.length} cues` : 'No DMX cues' },
      { label: 'FireOne Export', status: sp.pyroCues.length > 0 ? 'exists' : 'absent', detail: sp.pyroCues.length > 0 ? `${sp.pyroCues.length} pyro cues` : 'No pyro cues' },
      { label: 'ExportCoordinator', status: hasContent ? 'exists' : 'absent', detail: hasContent ? 'Pipeline active' : 'No data to export' },
      { label: 'AuditTrail', status: 'exists', detail: 'SafetyAuditTrail + BlackBox + DeviceEventLog' },
      { label: 'Unreal Integration', status: 'placeholder', detail: 'Contract defined, runtime pending' },
      { label: 'BP_SwarmManager Contract', status: sp.dronePaths.length > 0 ? 'partial' : 'placeholder', detail: sp.dronePaths.length > 0 ? `${sp.dronePaths.length} paths` : 'Awaiting Unreal' },
    ];
  }, [sp, level, devices, snapshots]);

  const counts = useMemo(() => {
    const c = { exists: 0, partial: 0, placeholder: 0, absent: 0 };
    rows.forEach(r => c[r.status]++);
    return c;
  }, [rows]);

  return (
    <div className="flex flex-col h-full p-4 gap-4 bg-background/80">
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

      <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-1 text-[7px] font-mono text-muted-foreground/50 tracking-widest px-2">
        <span>SUBSYSTEM</span>
        <span className="text-center">EXISTS</span>
        <span className="text-center">PARTIAL</span>
        <span className="text-center">PLACEHOLDER</span>
        <span className="text-center">ABSENT</span>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {rows.map(row => {
          const cfg = STATUS_CONFIG[row.status];
          return (
            <div key={row.label} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-1 items-center rounded border border-border/10 px-2 py-2 hover:bg-muted/5 transition-colors">
              <div>
                <div className="text-[10px] font-mono font-medium text-foreground">{row.label}</div>
                <div className="text-[8px] font-mono text-muted-foreground/50">{row.detail}</div>
              </div>
              {(['exists', 'partial', 'placeholder', 'absent'] as MatrixStatus[]).map(col => (
                <div key={col} className="flex justify-center">
                  {row.status === col ? <cfg.icon className={cn('w-4 h-4', cfg.color)} /> : <div className="w-4 h-4 rounded-full border border-border/10" />}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
