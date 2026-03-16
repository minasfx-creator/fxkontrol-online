/**
 * ─── Show Control Panel — FX Commander Style ──────────────────────
 * Inspired by Showven FX Commander hardware controller.
 * Skybrush workflow: Preflight → Upload → Authorize → Countdown → Running → Landing
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  Clock, Play, Pause, Square, Upload, Shield, AlertTriangle,
  CheckCircle2, Timer, Zap, RotateCcw, Loader2, XCircle,
  Plane, ChevronRight, AlertCircle, Radio, Target,
  Cpu, Wifi, Battery, Navigation, Lock, Unlock, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFleetStore } from '@/store/useFleetStore';
import { useProjectStore } from '@/store/useProjectStore';
import { showOrchestrator, type ShowPhase, type ShowWarning } from '@/lib/showOrchestrator';
import type { AuthorizationScope, StartMethod } from '@/lib/flockwaveProtocol';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Helpers ─────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'T-00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `T-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

function phaseLabel(phase: ShowPhase): string {
  const map: Record<ShowPhase, string> = {
    idle: 'STANDBY', preflight: 'PREFLIGHT', uploading: 'UPLOADING',
    uploaded: 'READY', authorized: 'ARMED', countdown: 'COUNTDOWN',
    running: 'LIVE', paused: 'HOLD', landing: 'LANDING',
    complete: 'COMPLETE', error: 'FAULT', aborted: 'ABORT',
  };
  return map[phase];
}

// ── Hook: subscribe to ShowOrchestrator ─────────────────────────────

function useOrchestratorState() {
  return useSyncExternalStore(
    (cb) => showOrchestrator.subscribe(cb),
    () => showOrchestrator.getState(),
  );
}

// ── Phase Step Indicator ────────────────────────────────────────────

const PHASES_SEQUENCE: { key: string; label: string; icon: typeof CheckCircle2 }[] = [
  { key: 'preflight', label: 'Check', icon: CheckCircle2 },
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'authorize', label: 'Arm', icon: Shield },
  { key: 'start', label: 'GO', icon: Play },
  { key: 'landing', label: 'Land', icon: Plane },
];

function PhaseIndicator({ currentPhase }: { currentPhase: ShowPhase }) {
  const phaseIndex = (() => {
    switch (currentPhase) {
      case 'idle': return -1;
      case 'preflight': return 0;
      case 'uploading': case 'uploaded': return 1;
      case 'authorized': return 2;
      case 'countdown': case 'running': case 'paused': return 3;
      case 'landing': case 'complete': return 4;
      default: return -1;
    }
  })();

  return (
    <div className="flex items-center gap-0.5 px-3 py-2">
      {PHASES_SEQUENCE.map((p, i) => {
        const isDone = i < phaseIndex;
        const isActive = i === phaseIndex;
        const Icon = p.icon;
        return (
          <div key={p.key} className="flex items-center flex-1">
            <div className={cn(
              "flex flex-col items-center gap-0.5 flex-1",
            )}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all",
                isDone ? "bg-success border-success text-success-foreground" :
                isActive ? "bg-primary border-primary text-primary-foreground animate-pulse" :
                "bg-surface-1 border-border/40 text-muted-foreground"
              )}>
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
              </div>
              <span className={cn(
                "text-[7px] font-bold tracking-wider",
                isDone ? "text-success" : isActive ? "text-primary" : "text-muted-foreground/50"
              )}>{p.label}</span>
            </div>
            {i < PHASES_SEQUENCE.length - 1 && (
              <div className={cn(
                "h-[2px] flex-1 rounded-full mx-0.5 -mt-3",
                i < phaseIndex ? "bg-success" : "bg-border/30"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── FX Commander Grid Button ────────────────────────────────────────

function CommanderButton({
  icon: Icon, label, sublabel, color, active, disabled, pulse, onClick, className,
}: {
  icon: typeof Play; label: string; sublabel?: string;
  color?: string; active?: boolean; disabled?: boolean;
  pulse?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 transition-all",
        "backdrop-blur-md select-none min-h-[60px]",
        active
          ? "bg-gradient-to-b from-primary/20 to-primary/5 border-primary/40 shadow-lg shadow-primary/15"
          : disabled
            ? "bg-surface-1/30 border-border/20 text-muted-foreground/40 cursor-not-allowed"
            : "bg-surface-1/60 border-border/30 hover:bg-surface-1/80 hover:border-border/50 active:scale-[0.97]",
        pulse && "animate-pulse",
        className,
      )}
      style={active && color ? { borderColor: color, boxShadow: `0 0 20px ${color}33` } : undefined}
    >
      <Icon className={cn("w-5 h-5", active ? "text-primary" : "")} style={color ? { color } : undefined} />
      <span className={cn("text-[9px] font-bold tracking-wider uppercase", active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      {sublabel && <span className="text-[7px] text-muted-foreground/60">{sublabel}</span>}
      {active && (
        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-success animate-pulse" />
      )}
    </button>
  );
}

// ── Component ───────────────────────────────────────────────────────

interface ShowControlPanelProps {
  onClose?: () => void;
}

export default function ShowControlPanel({ onClose }: ShowControlPanelProps) {
  const orc = useOrchestratorState();
  const { clockSync, connectionState, uavs } = useFleetStore();
  const { duration, projectName, positions, timelineItems } = useProjectStore();

  const [authScope, setAuthScope] = useState<AuthorizationScope>('live');
  const [startMethod, setStartMethod] = useState<StartMethod>('auto');
  const [countdownTarget, setCountdownTarget] = useState(30);
  const [scheduledTime, setScheduledTime] = useState('');
  const [localTime, setLocalTime] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setLocalTime(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { showOrchestrator.setShowDuration(duration); }, [duration]);
  useEffect(() => { showOrchestrator.setStartMethod(startMethod); }, [startMethod]);

  // ── Actions ───────────────────────────────────────────────────

  const handlePreflight = useCallback(async () => {
    setBusy(true);
    const ok = await showOrchestrator.startPreflight();
    setBusy(false);
    if (ok) {
      const st = showOrchestrator.getState();
      const failures = st.preflightResults.filter(r => !r.passed);
      if (failures.length > 0) toast.warning(`Preflight: ${failures.length} drone(s) with issues`);
      else toast.success(`Preflight passed — ${st.totalDrones} drones ready`);
    } else toast.error('Preflight failed');
  }, []);

  const handleUpload = useCallback(async () => {
    setBusy(true);
    const trajectories = positions.map((pos, i) => ({
      droneId: `drone-${i + 1}`,
      points: [
        { t: 0, x: pos.x, y: 0, z: pos.z },
        { t: duration * 0.1, x: pos.x, y: pos.y + 30, z: pos.z },
        { t: duration * 0.9, x: pos.x, y: pos.y + 30, z: pos.z },
        { t: duration, x: pos.x, y: 0, z: pos.z },
      ],
    }));
    const lightProgram = positions.map(() => [
      { t: 0, r: 0, g: 0, b: 0, w: 0 },
      { t: duration * 0.1, r: 255, g: 255, b: 255, w: 0 },
      { t: duration * 0.9, r: 255, g: 255, b: 255, w: 0 },
      { t: duration, r: 0, g: 0, b: 0, w: 0 },
    ]);
    const ok = await showOrchestrator.uploadShow({
      trajectories, lightProgram, startMethod,
      coordinateSystem: 'neu', origin: { lat: 0, lon: 0, altMSL: 0 },
    });
    setBusy(false);
    if (ok) toast.success(`Show uploaded — ${trajectories.length} drones`);
    else toast.error('Upload failed');
  }, [positions, duration, startMethod]);

  const handleAuthorize = useCallback(async () => {
    setBusy(true);
    const ok = await showOrchestrator.authorize(authScope);
    setBusy(false);
    if (ok) toast.success(`Authorized (${authScope})`);
    else toast.error('Authorization failed');
  }, [authScope]);

  const handleDeauthorize = useCallback(async () => {
    await showOrchestrator.deauthorize();
    toast.warning('Show deauthorized');
  }, []);

  const handleCountdown = useCallback(() => {
    showOrchestrator.startCountdown(countdownTarget);
    toast.info(`Countdown: T-${countdownTarget}s`);
  }, [countdownTarget]);

  const handlePause = useCallback(async () => { await showOrchestrator.pause(); toast.warning('Show paused'); }, []);
  const handleResume = useCallback(async () => { await showOrchestrator.resume(); toast.info('Show resumed'); }, []);
  const handleLand = useCallback(async () => { await showOrchestrator.startLanding(); toast.info('Landing sequence'); }, []);
  const handleAbort = useCallback(async () => { await showOrchestrator.abort('User emergency abort'); toast.error('🚨 EMERGENCY ABORT'); }, []);
  const handleReset = useCallback(() => { showOrchestrator.reset(); toast.info('Show control reset'); }, []);

  // ── Derived ───────────────────────────────────────────────────

  const serverTime = clockSync.synced ? localTime + clockSync.offset : null;
  const progress = showOrchestrator.getProgress();
  const phase = orc.phase;
  const isLive = phase === 'running' || phase === 'countdown' || phase === 'paused' || phase === 'landing';
  const canReset = phase === 'complete' || phase === 'aborted' || phase === 'error';
  const activeWarnings = orc.warnings.filter(w => !w.dismissed);

  const preflightDone = phase !== 'idle' && phase !== 'preflight';
  const uploadDone = ['uploaded', 'authorized', 'countdown', 'running', 'paused', 'landing', 'complete'].includes(phase);
  const authDone = ['authorized', 'countdown', 'running', 'paused', 'landing', 'complete'].includes(phase);

  const getPhaseGlow = (): string => {
    switch (phase) {
      case 'countdown': return 'shadow-[0_0_40px_hsl(var(--warning)/0.15)]';
      case 'running': return 'shadow-[0_0_40px_hsl(var(--success)/0.15)]';
      case 'aborted': case 'error': return 'shadow-[0_0_40px_hsl(var(--destructive)/0.15)]';
      default: return '';
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-surface-0/95 backdrop-blur-2xl border-l border-border/30", getPhaseGlow())}>
      {/* ── Header — FX Commander style top bar ────────────── */}
      <div className="px-3 py-2.5 border-b border-border/30 bg-gradient-to-b from-surface-1/80 to-surface-0/60">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full",
              phase === 'running' ? "bg-success animate-pulse" :
              phase === 'countdown' ? "bg-warning animate-pulse" :
              phase === 'error' || phase === 'aborted' ? "bg-destructive" :
              phase === 'authorized' ? "bg-success" :
              "bg-muted-foreground/30"
            )} />
            <span className="text-[11px] font-bold text-foreground tracking-[0.15em] font-display uppercase">Show Control</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn(
              "text-[8px] px-2 py-0.5 font-bold tracking-wider border-2",
              phase === 'running' ? "text-success border-success/40 bg-success/10" :
              phase === 'countdown' ? "text-warning border-warning/40 bg-warning/10 animate-pulse" :
              phase === 'authorized' ? "text-success border-success/30" :
              phase === 'error' || phase === 'aborted' ? "text-destructive border-destructive/40" :
              "text-muted-foreground border-border/40"
            )}>
              {phaseLabel(phase)}
            </Badge>
            {canReset && (
              <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground" onClick={handleReset}>
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Phase progress indicator */}
        <PhaseIndicator currentPhase={phase} />
      </div>

      {/* ── Master Clock / Status Display ────────────────── */}
      <div className={cn(
        "px-3 py-3 border-b border-border/20 text-center",
        phase === 'countdown' ? "bg-warning/5" :
        phase === 'running' ? "bg-success/5" :
        phase === 'landing' ? "bg-primary/5" :
        phase === 'aborted' || phase === 'error' ? "bg-destructive/5" : ""
      )}>
        {phase === 'countdown' ? (
          <div className="text-4xl font-mono font-black text-warning tracking-[0.2em] animate-pulse drop-shadow-lg">
            {formatCountdown(orc.countdown)}
          </div>
        ) : phase === 'running' || phase === 'paused' ? (
          <div className="text-3xl font-mono font-black text-foreground tracking-wider">
            {formatElapsed(orc.showElapsed)}
          </div>
        ) : (
          <div className="text-2xl font-mono font-bold text-foreground/80 tracking-wide">
            {formatTime(localTime)}
          </div>
        )}

        {/* Clock sync status */}
        <div className="flex items-center justify-center gap-1.5 mt-1">
          {clockSync.synced ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              <span className="text-[8px] text-muted-foreground font-mono">
                Sync: {serverTime ? formatTime(serverTime) : '---'} (Δ{clockSync.offset.toFixed(0)}ms)
              </span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
              <span className="text-[8px] text-muted-foreground/60">Clock not synced</span>
            </>
          )}
        </div>

        {/* Progress bars */}
        {phase === 'uploading' && (
          <div className="mt-2.5">
            <Progress value={orc.uploadProgress * 100} className="h-2 rounded-full" />
            <span className="text-[8px] text-muted-foreground mt-1 block">
              Uploading… {(orc.uploadProgress * 100).toFixed(0)}%
            </span>
          </div>
        )}
        {(phase === 'running' || phase === 'paused') && (
          <div className="mt-2.5">
            <Progress value={progress * 100} className="h-2 rounded-full" />
            <div className="flex justify-between text-[8px] text-muted-foreground mt-1">
              <span>{orc.showElapsed.toFixed(1)}s</span>
              <span className="font-bold text-foreground">{(progress * 100).toFixed(0)}%</span>
              <span>{orc.showDuration.toFixed(0)}s</span>
            </div>
          </div>
        )}
        {phase === 'landing' && (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Plane className="w-4 h-4 text-primary animate-bounce" />
            <span className="text-[10px] text-primary font-bold tracking-wider">LANDING IN PROGRESS</span>
          </div>
        )}
      </div>

      {/* ── Warnings & Errors ────────────────────────────── */}
      {activeWarnings.length > 0 && (
        <div className="px-2 py-1.5 border-b border-warning/20 bg-warning/5 max-h-20 overflow-y-auto">
          {activeWarnings.slice(0, 4).map(w => (
            <div key={w.id} className="flex items-center gap-1.5 text-[8px] py-0.5">
              {w.severity === 'critical' ? (
                <XCircle className="w-3 h-3 text-destructive shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-warning shrink-0" />
              )}
              <span className="text-foreground/80 flex-1 truncate">{w.message}</span>
              <button className="text-muted-foreground hover:text-foreground shrink-0 text-[10px]"
                onClick={() => showOrchestrator.dismissWarning(w.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      {orc.error && (
        <div className="px-3 py-2 border-b border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-1.5 text-[9px] text-destructive">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="font-bold">Error:</span>
            <span className="truncate">{orc.error}</span>
          </div>
        </div>
      )}

      {/* ── Show Info Strip ──────────────────────────────── */}
      <div className="px-3 py-2 border-b border-border/15 grid grid-cols-4 gap-1">
        {[
          { label: 'Fleet', value: `${orc.totalDrones > 0 ? orc.totalDrones : uavs.size}`, icon: Cpu },
          { label: 'Slots', value: `${positions.length}`, icon: Target },
          { label: 'Duration', value: `${duration}s`, icon: Clock },
          { label: 'Cues', value: `${timelineItems.length}`, icon: Radio },
        ].map(item => (
          <div key={item.label} className="flex flex-col items-center gap-0.5 py-1 rounded-lg bg-surface-1/40">
            <item.icon className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-[10px] font-bold text-foreground">{item.value}</span>
            <span className="text-[7px] text-muted-foreground/60 uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── FX Commander Grid — Main Actions ─────────────── */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">

          {/* Row 1: Preflight & Upload */}
          <div className="grid grid-cols-2 gap-2">
            <CommanderButton
              icon={CheckCircle2}
              label="Check Show"
              sublabel={preflightDone ? '✓ Passed' : 'Preflight'}
              active={phase === 'preflight'}
              disabled={phase !== 'idle' || busy}
              onClick={handlePreflight}
              color="hsl(var(--primary))"
            />
            <CommanderButton
              icon={Upload}
              label="Upload"
              sublabel={uploadDone ? '✓ Sent' : `${positions.length} slots`}
              active={phase === 'uploading'}
              disabled={phase !== 'preflight' || busy}
              pulse={phase === 'uploading'}
              onClick={handleUpload}
              color="hsl(var(--primary))"
            />
          </div>

          {/* Row 2: Authorize & Config */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <CommanderButton
                icon={Shield}
                label="Authorize"
                sublabel={authDone ? `✓ ${authScope}` : 'Arm show'}
                active={authDone}
                disabled={phase !== 'uploaded' || busy}
                onClick={handleAuthorize}
                color="hsl(var(--success))"
              />
              {phase === 'authorized' && (
                <button onClick={handleDeauthorize}
                  className="w-full text-[8px] text-warning/70 hover:text-warning py-0.5 tracking-wider uppercase">
                  Revoke Auth
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              <select
                value={authScope}
                onChange={(e) => setAuthScope(e.target.value as AuthorizationScope)}
                className="h-7 w-full text-[9px] bg-surface-1/40 border border-border/30 rounded-lg px-2 text-foreground"
              >
                <option value="live">🟢 Live Mode</option>
                <option value="rehearsal">🟡 Rehearsal</option>
              </select>
              <select
                value={startMethod}
                onChange={(e) => setStartMethod(e.target.value as StartMethod)}
                className="h-7 w-full text-[9px] bg-surface-1/40 border border-border/30 rounded-lg px-2 text-foreground"
              >
                <option value="auto">Manual Start</option>
                <option value="rc">RC Trigger</option>
                <option value="gps_time">GPS Time Sync</option>
              </select>
              {startMethod === 'gps_time' && (
                <Input type="time" step="1" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-7 text-[9px] bg-surface-1/40 border-border/30 rounded-lg" />
              )}
            </div>
          </div>

          {/* ── Countdown & GO ────────────────────────────── */}
          <div className="rounded-xl border border-border/20 bg-surface-1/30 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="number" value={countdownTarget}
                onChange={(e) => setCountdownTarget(parseInt(e.target.value) || 10)}
                className="h-8 text-[10px] w-16 bg-surface-0/60 border-border/30 rounded-lg font-mono text-center font-bold"
              />
              <Button
                className={cn(
                  "flex-1 h-10 text-[11px] font-bold tracking-[0.2em] uppercase rounded-xl transition-all",
                  phase === 'authorized'
                    ? "bg-gradient-to-b from-success to-success/80 text-success-foreground hover:from-success/90 hover:to-success/70 shadow-lg shadow-success/20"
                    : ""
                )}
                disabled={phase !== 'authorized'}
                onClick={handleCountdown}
              >
                <Clock className="w-4 h-4 mr-2" />
                START COUNTDOWN
              </Button>
            </div>
          </div>

          {/* ── Live Controls — visible during show ──────── */}
          {isLive && (
            <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-3 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-4 h-4 text-warning animate-pulse" />
                <span className="text-[10px] font-black text-warning tracking-[0.2em] uppercase">Live Controls</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {phase === 'running' && (
                  <CommanderButton icon={Pause} label="Pause" onClick={handlePause} color="hsl(var(--warning))" />
                )}
                {phase === 'paused' && (
                  <CommanderButton icon={Play} label="Resume" onClick={handleResume} color="hsl(var(--success))" active />
                )}
                {(phase === 'running' || phase === 'paused') && (
                  <CommanderButton icon={Plane} label="Land" onClick={handleLand} color="hsl(var(--primary))" />
                )}
              </div>

              {/* EMERGENCY ABORT — large, unmistakable */}
              <button
                onClick={handleAbort}
                className={cn(
                  "w-full h-12 rounded-xl font-black text-[12px] tracking-[0.25em] uppercase transition-all select-none",
                  "bg-gradient-to-b from-destructive to-destructive/80 text-destructive-foreground",
                  "hover:from-destructive/90 hover:to-destructive/70 active:scale-[0.97]",
                  "shadow-lg shadow-destructive/30 border-2 border-destructive/50",
                  "flex items-center justify-center gap-2"
                )}
              >
                <AlertTriangle className="w-5 h-5" />
                🚨 EMERGENCY ABORT
              </button>
            </div>
          )}

          {/* ── Drone Mapping Summary ────────────────────── */}
          {orc.droneMapping.length > 0 && (
            <div className="rounded-xl border border-border/20 bg-surface-1/30 p-2.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-foreground tracking-wider uppercase">Drone Mapping</span>
                <Badge variant="outline" className="text-[7px] px-1.5">
                  {orc.droneMapping.filter(Boolean).length}/{orc.droneMapping.length}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-1 max-h-24 overflow-y-auto">
                {orc.droneMapping.slice(0, 24).map((droneId, slot) => (
                  <div key={slot} className="flex items-center gap-1 bg-surface-0/50 rounded-md px-1.5 py-0.5">
                    <span className="text-[7px] font-mono text-muted-foreground">#{slot + 1}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full", droneId ? "bg-success" : "bg-muted-foreground/30")} />
                  </div>
                ))}
              </div>
              {orc.droneMapping.length > 24 && (
                <div className="text-[7px] text-muted-foreground/50 text-center mt-1">
                  +{orc.droneMapping.length - 24} more
                </div>
              )}
            </div>
          )}

          {/* ── Config Summary ───────────────────────────── */}
          <div className="rounded-xl border border-border/20 bg-surface-1/30 p-2.5 space-y-1.5">
            <span className="text-[9px] font-bold text-foreground tracking-wider uppercase block mb-1">Configuration</span>
            {[
              { label: 'Show', value: projectName },
              { label: 'Auth', value: orc.authorization.authorized ? `✅ ${orc.authorization.scope}` : '—' },
              { label: 'Method', value: startMethod === 'auto' ? 'Manual' : startMethod === 'rc' ? 'RC Trigger' : 'GPS Time' },
              { label: 'Clock', value: clockSync.synced ? `✅ Δ${clockSync.offset.toFixed(0)}ms` : '❌ Not synced' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-[8px]">
                <span className="text-muted-foreground/60">{item.label}</span>
                <span className="text-foreground/80 font-mono truncate max-w-[120px]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* ── Bottom Status Bar ────────────────────────────── */}
      <div className="px-3 py-2 border-t border-border/20 bg-surface-1/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Wifi className={cn("w-3 h-3", connectionState === 'connected' ? "text-success" : "text-muted-foreground/40")} />
          <span className="text-[7px] font-mono text-muted-foreground/60 uppercase tracking-wider">
            {connectionState === 'connected' ? 'Connected' : 'Offline'}
          </span>
        </div>
        <span className="text-[7px] font-mono text-muted-foreground/40">
          Skybrush · Flockwave v1.0
        </span>
      </div>
    </div>
  );
}
