/**
 * ─── Mission Control Panel ──────────────────────────────────────────
 * Aviation-grade system health dashboard.
 * Shows: module status, latency, errors, health score, diagnostics.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Download, Cpu, Wifi, Clock, Zap, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  diagnostic,
  feedDiagnosticFps,
  blackbox,
  emergency,
  autoScaler,
  lockstep,
  predictive,
  type DiagnosticReport,
  type DiagnosticCheck,
  type CheckStatus,
} from '@/core/reliability';

// ── Status Icon ─────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CheckStatus }) {
  switch (status) {
    case 'pass': return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />;
    case 'warn': return <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />;
    case 'fail': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    default:     return <Activity className="w-3.5 h-3.5 text-muted-foreground" />;
  }
}

function statusColor(status: CheckStatus): string {
  switch (status) {
    case 'pass': return 'text-green-400';
    case 'warn': return 'text-yellow-400';
    case 'fail': return 'text-red-400';
    default:     return 'text-muted-foreground';
  }
}

// ── Health Score Badge ──────────────────────────────────────────────

function HealthScore({ report }: { report: DiagnosticReport | null }) {
  if (!report) return <Badge variant="outline" className="text-muted-foreground">NO DATA</Badge>;

  const total = report.checks.length;
  const score = total > 0 ? Math.round((report.passed / total) * 100) : 0;

  const color = score >= 90 ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : score >= 70 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/20 text-red-400 border-red-500/30';

  return (
    <Badge className={`${color} font-mono text-xs`}>
      {score}%
    </Badge>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

export function MissionControlPanel() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [running, setRunning] = useState(false);
  const [bbRecording, setBbRecording] = useState(blackbox.isRecording());
  const fpsRef = useRef(0);

  // Track FPS
  useEffect(() => {
    let raf: number;
    let lastTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      if (dt > 0) fpsRef.current = Math.round(1000 / dt);
      feedDiagnosticFps();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    const r = await diagnostic.runFullCheck();
    setReport(r);
    setRunning(false);
  }, []);

  const toggleBlackBox = useCallback(() => {
    if (blackbox.isRecording()) {
      blackbox.stop();
    } else {
      blackbox.start();
    }
    setBbRecording(blackbox.isRecording());
  }, []);

  const exportBlackBox = useCallback(() => {
    const blob = blackbox.exportBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fxk-blackbox-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const emergencyState = emergency.getState();
  const scalerState = autoScaler.getState();
  const lockstepRunning = lockstep.isRunning();
  const predictStats = predictive.getStats();

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Mission Control
          </span>
        </div>
        <HealthScore report={report} />
      </div>

      {/* Emergency Status */}
      {emergencyState.level > 0 && (
        <div className={`p-2 rounded border ${
          emergencyState.level >= 3 ? 'bg-red-500/20 border-red-500/50' :
          emergencyState.level >= 2 ? 'bg-orange-500/20 border-orange-500/50' :
          'bg-yellow-500/20 border-yellow-500/50'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 animate-pulse" />
            <span className="text-xs font-bold text-red-400">
              EMERGENCY L{emergencyState.level}: {emergencyState.reason}
            </span>
          </div>
        </div>
      )}

      {/* System Status Grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <StatusCard icon={<Cpu className="w-3 h-3" />} label="Quality Tier" value={scalerState.tier.toUpperCase()} ok />
        <StatusCard icon={<Activity className="w-3 h-3" />} label="Lockstep" value={lockstepRunning ? 'ACTIVE' : 'IDLE'} ok={lockstepRunning} />
        <StatusCard icon={<Clock className="w-3 h-3" />} label="Latency" value={`${predictStats.avgLatencyMs}ms`} ok={predictStats.avgLatencyMs < 100} />
        <StatusCard icon={<Zap className="w-3 h-3" />} label="Jitter" value={`${predictStats.jitterMs}ms`} ok={predictStats.jitterMs < 20} />
        <StatusCard icon={<Wifi className="w-3 h-3" />} label="Pending Cmds" value={`${predictStats.pending}`} ok />
        <StatusCard icon={<Heart className="w-3 h-3" />} label="BlackBox" value={bbRecording ? 'REC' : 'OFF'} ok={bbRecording} />
      </div>

      {/* Diagnostics */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] flex-1"
            onClick={runDiagnostics}
            disabled={running}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Scanning...' : 'Run Pre-Show Check'}
          </Button>
        </div>

        {report && (
          <ScrollArea className="h-32">
            <div className="space-y-0.5">
              {report.checks.map((check, i) => (
                <CheckRow key={i} check={check} />
              ))}
            </div>
          </ScrollArea>
        )}

        {report && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="text-green-400">✓ {report.passed}</span>
            <span className="text-yellow-400">⚠ {report.warned}</span>
            <span className="text-red-400">✕ {report.failed}</span>
            <span className="ml-auto">{report.duration_ms.toFixed(0)}ms</span>
          </div>
        )}
      </div>

      {/* BlackBox Controls */}
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant={bbRecording ? 'destructive' : 'outline'}
          className="h-7 text-[10px] flex-1"
          onClick={toggleBlackBox}
        >
          {bbRecording ? '⏹ Stop Recording' : '⏺ Start BlackBox'}
        </Button>
        {blackbox.getEntryCount() > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            onClick={exportBlackBox}
          >
            <Download className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Auto-Scaler Info */}
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <div className="flex justify-between">
          <span>Particles</span>
          <span>{Math.round(scalerState.particleScale * 100)}%</span>
        </div>
        <Progress value={scalerState.particleScale * 100} className="h-1" />
        <div className="flex justify-between">
          <span>Max Bursts</span>
          <span>{scalerState.maxBursts}</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {scalerState.bloomEnabled && <Badge variant="outline" className="text-[8px] h-4">Bloom</Badge>}
          {scalerState.ssrEnabled && <Badge variant="outline" className="text-[8px] h-4">SSR</Badge>}
          {scalerState.shadowsEnabled && <Badge variant="outline" className="text-[8px] h-4">Shadows</Badge>}
          {scalerState.smokeEnabled && <Badge variant="outline" className="text-[8px] h-4">Smoke</Badge>}
          {scalerState.postProcessing && <Badge variant="outline" className="text-[8px] h-4">Post</Badge>}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function StatusCard({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) {
  return (
    <div className={`p-1.5 rounded border text-[10px] ${
      ok ? 'border-border/50 bg-card/30' : 'border-yellow-500/30 bg-yellow-500/5'
    }`}>
      <div className="flex items-center gap-1 text-muted-foreground">{icon} {label}</div>
      <div className={`font-mono font-bold ${ok ? 'text-foreground' : 'text-yellow-400'}`}>{value}</div>
    </div>
  );
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-accent/20">
      <StatusIcon status={check.status} />
      <span className="text-[10px] text-foreground flex-1 truncate">{check.name}</span>
      <span className={`text-[9px] font-mono ${statusColor(check.status)}`}>{check.message}</span>
    </div>
  );
}
