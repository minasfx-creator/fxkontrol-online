/**
 * ─── Hardware Overview Dashboard ───────────────────────────────────
 * Top-level hardware supervision console. Shows system health,
 * device summary, readiness status, discovery, and active warnings.
 * Command-grade industrial aesthetic.
 */

import { useEffect, useState, useCallback } from 'react';
import { useHardwareRegistry } from '@/core/hardware/useHardwareRegistry';
import { hardwareHealthMonitor, type HealthReport } from '@/core/hardware/HardwareHealthMonitor';
import { telemetryPoller } from '@/core/hardware/TelemetryPoller';
import { deviceDiscovery, type DiscoveryResult } from '@/core/hardware/DeviceDiscovery';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { getProvenanceBadge } from '@/core/hardware/provenance';
import { cn } from '@/lib/utils';
import {
  Activity, Cpu, Battery, Radio, Wifi, AlertTriangle,
  CheckCircle2, XCircle, Zap, Shield, RefreshCw, Search, Gauge, Satellite, RotateCw,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { DiscoveryGrid } from './hardware/DiscoveryGrid';
import { TransportFilterChips } from './hardware/TransportFilterChips';
import { ReopenMatchPolicySelector } from './hardware/ReopenMatchPolicySelector';
import { PersistedDevicesPanel } from './hardware/PersistedDevicesPanel';
import { unifiedDiscovery } from '@/core/discovery/UnifiedDiscoveryService';
import {
  buildDiscoveryReports, notifyDiscoveryReports, getRetryableTransports,
} from '@/core/discovery/discoveryToasts';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  connected: 'text-emerald-400',
  disconnected: 'text-muted-foreground/40',
  degraded: 'text-amber-400',
  error: 'text-red-400',
};

const DEVICE_ICONS: Record<string, typeof Cpu> = {
  controller: Cpu,
  'shift-register': Zap,
  multiplexer: Radio,
  'relay-bank': Activity,
  battery: Battery,
  'artnet-node': Wifi,
  'dmx-interface': Radio,
  'fireone-profile': Shield,
};

export default function HardwareOverview() {
  const { devices, snapshots, health, readiness, events, refresh, evaluateReadiness, startPolling, isPolling } = useHardwareRegistry();
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [discoveryResults, setDiscoveryResults] = useState<DiscoveryResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    refresh();
    evaluateReadiness();
    setHealthReport(hardwareHealthMonitor.evaluate());
  }, []);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    const unsub = deviceDiscovery.onChange(() => setDiscoveryResults(deviceDiscovery.getResults()));
    await deviceDiscovery.scan();
    unsub();
    setIsScanning(false);
    refresh();
    notifyDiscoveryReports(buildDiscoveryReports(), 'light');
  }, [refresh]);

  const handleDeepScan = useCallback(async () => {
    setIsScanning(true);
    const unsub = deviceDiscovery.onChange(() => setDiscoveryResults(deviceDiscovery.getResults()));
    await deviceDiscovery.scan({ deep: true });
    unsub();
    setIsScanning(false);
    refresh();
    notifyDiscoveryReports(buildDiscoveryReports(), 'deep');
  }, [refresh]);

  const handleRetryFailed = useCallback(async () => {
    const failed = getRetryableTransports();
    if (failed.length === 0) {
      toast.info('Nada para repetir', {
        description: 'Nenhum transporte falho no último scan. Rode SCAN ou DEEP primeiro.',
      });
      return;
    }
    setIsScanning(true);
    const unsub = unifiedDiscovery.watch(() => setDiscoveryResults(deviceDiscovery.getResults()));
    try {
      await unifiedDiscovery.scanTransports(failed);
    } finally {
      unsub();
      setIsScanning(false);
      refresh();
      const mode = failed.includes('mdns-artnet') ? 'deep' : 'light';
      notifyDiscoveryReports(buildDiscoveryReports(), mode);
    }
  }, [refresh]);

  const handleStartPoller = useCallback(() => {
    telemetryPoller.start();
    startPolling();
  }, [startPolling]);

  const allWarnings = snapshots.flatMap(s => s.warnings.map(w => ({ device: s.device_id, msg: w })));
  const allErrors = snapshots.flatMap(s => s.errors.map(e => ({ device: s.device_id, msg: e })));
  const mode = operationalModeGuard.mode;

  return (
    <div className="flex flex-col h-full bg-background/80 p-3 gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase">Hardware Overview</span>
          <span className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">{mode}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] font-mono gap-1"
            onClick={handleScan} disabled={isScanning}>
            <Search className="w-3 h-3" /> {isScanning ? 'SCANNING…' : 'SCAN'}
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] font-mono gap-1 text-amber-400"
            onClick={handleDeepScan} disabled={isScanning}
            title="Inclui ArtPoll broadcast via bridge (descobre nós Art-Net na rede)">
            <Satellite className="w-3 h-3" /> DEEP
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] font-mono gap-1 text-sky-400"
            onClick={handleRetryFailed} disabled={isScanning}
            title="Repete apenas os transportes que falharam (permission denied / erro / vazio) no último scan">
            <RotateCw className="w-3 h-3" /> RETRY
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] font-mono"
            onClick={() => { refresh(); evaluateReadiness(); setHealthReport(hardwareHealthMonitor.evaluate()); }}>
            <RefreshCw className="w-3 h-3 mr-1" /> POLL
          </Button>
          {!isPolling && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[8px] font-mono text-cyan-400"
              onClick={handleStartPoller}>AUTO</Button>
          )}
          {isPolling && (
            <span className="text-[7px] font-mono text-cyan-400 flex items-center gap-1">
              <Gauge className="w-3 h-3" /> {telemetryPoller.frequencyMs}ms
            </span>
          )}
        </div>
      </div>

      {/* Health Summary Bar — now includes weighted score */}
      <div className="grid grid-cols-6 gap-2">
        <HealthCard label="WEIGHTED" value={healthReport ? `${healthReport.overallScore}%` : '—'}
          color={healthReport ? (healthReport.level === 'HEALTHY' ? 'emerald' : healthReport.level === 'DEGRADED' ? 'amber' : 'red') : 'cyan'} />
        <HealthCard label="SCORE" value={`${health.score}%`} color={health.score > 70 ? 'emerald' : health.score > 40 ? 'amber' : 'red'} />
        <HealthCard label="ONLINE" value={`${health.online}/${health.total}`} color={health.online === health.total ? 'emerald' : 'amber'} />
        <HealthCard label="WARNINGS" value={`${health.warnings}`} color={health.warnings > 0 ? 'amber' : 'emerald'} />
        <HealthCard label="ERRORS" value={`${health.errors}`} color={health.errors > 0 ? 'red' : 'emerald'} />
        <HealthCard label="READINESS" value={readiness?.status.replace(/_/g, ' ').replace('READY FOR ', '') ?? 'N/A'}
          color={readiness?.status === 'BLOCKED' ? 'red' : readiness?.status === 'READY_FOR_HARDWARE_SYNC' ? 'emerald' : 'amber'} />
      </div>

      {/* Health breakdown */}
      {healthReport && (
        <div className="flex items-center gap-3 text-[7px] font-mono text-muted-foreground">
          <span>Safety: <span className={healthReport.safetyScore > 70 ? 'text-emerald-400' : 'text-red-400'}>{healthReport.safetyScore}%</span></span>
          <span>Hardware: <span className={healthReport.hardwareScore > 70 ? 'text-emerald-400' : 'text-amber-400'}>{healthReport.hardwareScore}%</span></span>
          <span>Network: <span className={healthReport.networkScore > 70 ? 'text-emerald-400' : 'text-amber-400'}>{healthReport.networkScore}%</span></span>
          <span className="text-muted-foreground/30">|</span>
          <span>Level: <span className={cn(
            healthReport.level === 'HEALTHY' ? 'text-emerald-400' : healthReport.level === 'DEGRADED' ? 'text-amber-400' : 'text-red-400'
          )}>{healthReport.level}</span></span>
        </div>
      )}

      {/* Allowed Operations */}
      {readiness && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[7px] font-mono text-muted-foreground/50 uppercase mr-1">Allowed:</span>
          {readiness.allowed_operations.map(op => (
            <span key={op} className="px-1.5 py-0.5 rounded text-[7px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{op}</span>
          ))}
          {readiness.blocked_operations.map(op => (
            <span key={op} className="px-1.5 py-0.5 rounded text-[7px] font-mono bg-red-500/10 text-red-400/50 border border-red-500/10 line-through">{op}</span>
          ))}
        </div>
      )}

      {/* Real Discovery Grid (Serial / USB / BLE / Art-Net) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[7px] font-mono text-muted-foreground/50 uppercase tracking-wider">Real Discovery — transports</span>
          <div className="flex items-center gap-3 flex-wrap">
            <ReopenMatchPolicySelector />
            <TransportFilterChips />
          </div>
        </div>
        <DiscoveryGrid />
        <PersistedDevicesPanel />
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 flex-1 overflow-auto">
        {devices.map(dev => {
          const Icon = DEVICE_ICONS[dev.type] ?? Cpu;
          const snap = snapshots.find(s => s.device_id === dev.id);
          const disc = discoveryResults.find(d => d.deviceId === dev.id);
          return (
            <div key={dev.id} className="rounded border border-border/20 bg-card/30 p-2 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Icon className={cn('w-3.5 h-3.5', STATUS_COLORS[dev.connection_state])} />
                <span className="text-[9px] font-mono font-bold text-foreground truncate flex-1">{dev.label}</span>
                {(() => {
                  const prov = unifiedHardwareRegistry.getProvenance(dev.id);
                  if (!prov) return null;
                  const badge = getProvenanceBadge(prov.integration_mode);
                  const badgeColors: Record<string, string> = {
                    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
                    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
                    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                    red: 'bg-red-500/15 text-red-400 border-red-500/20',
                  };
                  return <span className={cn('text-[6px] font-mono px-1 py-0.5 rounded border shrink-0', badgeColors[badge.color])}>{badge.label}</span>;
                })()}
              </div>
              <div className="flex items-center gap-1">
                <div className={cn('w-1.5 h-1.5 rounded-full', {
                  'bg-emerald-400': dev.connection_state === 'connected',
                  'bg-amber-400': dev.connection_state === 'degraded',
                  'bg-red-400': dev.connection_state === 'error',
                  'bg-muted-foreground/30': dev.connection_state === 'disconnected',
                })} />
                <span className="text-[7px] font-mono text-muted-foreground uppercase">{dev.connection_state}</span>
                {disc && (
                  <span className={cn('text-[6px] font-mono ml-auto', {
                    'text-emerald-400': disc.status === 'found',
                    'text-amber-400': disc.status === 'scanning',
                    'text-red-400': disc.status === 'not_found',
                  })}>{disc.status === 'scanning' ? '⟳' : disc.status === 'found' ? `${disc.scanDuration_ms}ms` : '—'}</span>
                )}
              </div>
              {snap && (snap.warnings.length > 0 || snap.errors.length > 0) && (
                <div className="mt-1 space-y-0.5">
                  {snap.errors.map((e, i) => (
                    <div key={i} className="text-[7px] font-mono text-red-400 flex items-center gap-1">
                      <XCircle className="w-2.5 h-2.5 shrink-0" />{e}
                    </div>
                  ))}
                  {snap.warnings.map((w, i) => (
                    <div key={i} className="text-[7px] font-mono text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5 shrink-0" />{w}
                    </div>
                  ))}
                </div>
              )}
              {snap && Object.keys(snap.metrics).length > 0 && (
                <div className="mt-auto pt-1 border-t border-border/10 grid grid-cols-2 gap-x-2">
                  {Object.entries(snap.metrics).slice(0, 4).map(([k, v]) => (
                    <div key={k} className="text-[6px] font-mono text-muted-foreground/50">
                      <span className="uppercase">{k}:</span>{' '}
                      <span className="text-foreground/70">{typeof v === 'number' ? (Number.isInteger(v) ? v : (v as number).toFixed(1)) : String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Issues & Event Log */}
      <div className="grid grid-cols-2 gap-2 max-h-32">
        <div className="rounded border border-border/20 bg-card/20 p-2">
          <span className="text-[7px] font-mono text-muted-foreground/50 uppercase">Active Issues ({allErrors.length + allWarnings.length})</span>
          <ScrollArea className="h-20 mt-1">
            {allErrors.map((e, i) => (
              <div key={`e-${i}`} className="text-[7px] font-mono text-red-400">⬤ [{e.device}] {e.msg}</div>
            ))}
            {allWarnings.map((w, i) => (
              <div key={`w-${i}`} className="text-[7px] font-mono text-amber-400">▲ [{w.device}] {w.msg}</div>
            ))}
            {allErrors.length === 0 && allWarnings.length === 0 && (
              <div className="text-[7px] font-mono text-emerald-400/50">No active issues</div>
            )}
          </ScrollArea>
        </div>
        <div className="rounded border border-border/20 bg-card/20 p-2">
          <span className="text-[7px] font-mono text-muted-foreground/50 uppercase">Event Log ({events.length})</span>
          <ScrollArea className="h-20 mt-1">
            {events.slice().reverse().slice(0, 20).map(evt => (
              <div key={evt.id} className={cn('text-[7px] font-mono', {
                'text-red-400': evt.type === 'error',
                'text-amber-400': evt.type === 'warning',
                'text-cyan-400': evt.type === 'telemetry',
                'text-muted-foreground/60': evt.type === 'state_change' || evt.type === 'connected' || evt.type === 'disconnected',
              })}>
                {new Date(evt.timestamp).toLocaleTimeString()} [{evt.device_id}] {evt.message}
              </div>
            ))}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  };
  return (
    <div className={cn('rounded border p-2 text-center', colorMap[color] ?? colorMap.cyan)}>
      <div className="text-[7px] font-mono uppercase opacity-60">{label}</div>
      <div className="text-sm font-mono font-bold">{value}</div>
    </div>
  );
}
