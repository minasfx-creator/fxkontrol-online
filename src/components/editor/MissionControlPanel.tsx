/**
 * ─── Mission Control Panel ──────────────────────────────────────────
 * Aviation-grade system health dashboard.
 * Shows: module status, latency, errors, health score, diagnostics,
 *        validation results, field bus status, execution bridge state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Activity, AlertTriangle, CheckCircle2, XCircle, RefreshCw, Download, Cpu, Wifi, Clock, Zap, Heart, Radio, Crosshair, Play } from 'lucide-react';
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
  fieldBus,
  executionBridge,
  simulationValidator,
  deterministicClock,
  globalClock,
  globalSync,
  type DiagnosticReport,
  type DiagnosticCheck,
  type CheckStatus,
  type ValidationReport,
  type ClockSyncState,
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

// ── Main Panel ──────────────────────────────────────────────────────

export function MissionControlPanel() {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [bbRecording, setBbRecording] = useState(blackbox.isRecording());
  const [clockSync, setClockSync] = useState<ClockSyncState>(globalClock.getState());
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

  // Track global clock sync state
  useEffect(() => {
    const unsub = globalClock.onStatusChange(setClockSync);
    const poll = setInterval(() => setClockSync(globalClock.getState()), 1000);
    return () => { unsub(); clearInterval(poll); };
  }, []);

  const runDiagnostics = useCallback(async () => {
    setRunning(true);
    const r = await diagnostic.runFullCheck();
    setReport(r);
    setRunning(false);
  }, []);

  const runValidation = useCallback(() => {
    // Run with empty cues for now — real integration would pull from timeline
    const vr = simulationValidator.validate([], 180);
    setValidationReport(vr);
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
  const busState = fieldBus.getState();
  const bridgeStats = executionBridge.getStats();
  const clockState = deterministicClock.getState();

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
        <StatusCard icon={<Clock className="w-3 h-3" />} label="Clock Drift" value={`${(clockState.drift * 1000).toFixed(1)}ms`} ok={Math.abs(clockState.drift) < 0.005} />
        <StatusCard icon={<Zap className="w-3 h-3" />} label="Jitter" value={`${predictStats.jitterMs}ms`} ok={predictStats.jitterMs < 20} />
        <StatusCard icon={<Radio className="w-3 h-3" />} label="FieldBus" value={busState.activeTransport.toUpperCase()} ok={busState.localBufferSize === 0} />
        <StatusCard icon={<Play className="w-3 h-3" />} label="Bridge" value={executionBridge.isArmed() ? 'ARMED' : 'SAFE'} ok />
        <StatusCard icon={<Crosshair className="w-3 h-3" />} label="Cues" value={`${bridgeStats.firedCues}/${bridgeStats.totalCues}`} ok />
        <StatusCard icon={<Heart className="w-3 h-3" />} label="BlackBox" value={bbRecording ? 'REC' : 'OFF'} ok={bbRecording} />
      </div>

      {/* Diagnostics + Validation */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={runDiagnostics} disabled={running}>
            <RefreshCw className={`w-3 h-3 mr-1 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Scanning...' : 'Pre-Show Check'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={runValidation}>
            <Crosshair className="w-3 h-3 mr-1" />
            Validate
          </Button>
        </div>

        {report && (
          <ScrollArea className="h-28">
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

        {/* Validation Report */}
        {validationReport && (
          <div className={`p-1.5 rounded border text-[10px] ${
            validationReport.passed
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-red-500/30 bg-red-500/5'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`font-bold ${validationReport.passed ? 'text-green-400' : 'text-red-400'}`}>
                {validationReport.passed ? '✓ VALIDATION PASS' : '✕ VALIDATION FAIL'}
              </span>
              <span className="text-muted-foreground">{validationReport.duration_ms.toFixed(0)}ms</span>
            </div>
            <div className="flex gap-2 text-muted-foreground">
              <span>{validationReport.totalCues} cues</span>
              <span className="text-yellow-400">{validationReport.warnings}W</span>
              <span className="text-red-400">{validationReport.criticals}C</span>
            </div>
            {validationReport.issues.length > 0 && (
              <ScrollArea className="h-16 mt-1">
                {validationReport.issues.map((issue, i) => (
                  <div key={i} className={`text-[9px] ${issue.severity === 'critical' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {issue.severity === 'critical' ? '✕' : '⚠'} {issue.message}
                  </div>
                ))}
              </ScrollArea>
            )}
          </div>
        )}
      </div>

      {/* FieldBus Detail */}
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <div className="flex justify-between">
          <span>Messages Sent</span>
          <span className="font-mono">{busState.messagesSent}</span>
        </div>
        <div className="flex justify-between">
          <span>Failovers</span>
          <span className={`font-mono ${busState.failoverCount > 0 ? 'text-yellow-400' : ''}`}>{busState.failoverCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Local Buffer</span>
          <span className={`font-mono ${busState.localBufferSize > 0 ? 'text-red-400' : ''}`}>{busState.localBufferSize}</span>
        </div>
      </div>

      {/* BlackBox Controls */}
      <div className="flex gap-1.5">
        <Button size="sm" variant={bbRecording ? 'destructive' : 'outline'} className="h-7 text-[10px] flex-1" onClick={toggleBlackBox}>
          {bbRecording ? '⏹ Stop Recording' : '⏺ Start BlackBox'}
        </Button>
        {blackbox.getEntryCount() > 0 && (
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={exportBlackBox}>
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
