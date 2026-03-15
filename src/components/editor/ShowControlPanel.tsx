/**
 * ─── Show Control Panel v3 ─────────────────────────────────────────
 * Integrated with ShowOrchestrator state machine for real
 * preflight → upload → authorize → countdown → running → landing flow.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  Clock, Play, Pause, Square, Upload, Shield, AlertTriangle,
  CheckCircle2, Timer, Zap, RotateCcw, Loader2, XCircle,
  Plane, ChevronRight, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    idle: 'IDLE', preflight: 'PREFLIGHT', uploading: 'UPLOADING',
    uploaded: 'UPLOADED', authorized: 'AUTHORIZED', countdown: 'COUNTDOWN',
    running: 'RUNNING', paused: 'PAUSED', landing: 'LANDING',
    complete: 'COMPLETE', error: 'ERROR', aborted: 'ABORTED',
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
  const [autoMapping, setAutoMapping] = useState(true);
  const [localTime, setLocalTime] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setLocalTime(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  // Sync duration to orchestrator
  useEffect(() => {
    showOrchestrator.setShowDuration(duration);
  }, [duration]);

  // Sync start method
  useEffect(() => {
    showOrchestrator.setStartMethod(startMethod);
  }, [startMethod]);

  // ── Actions using real orchestrator ───────────────────────────

  const handlePreflight = useCallback(async () => {
    setBusy(true);
    const ok = await showOrchestrator.startPreflight();
    setBusy(false);
    if (ok) {
      const st = showOrchestrator.getState();
      const failures = st.preflightResults.filter(r => !r.passed);
      if (failures.length > 0) {
        toast.warning(`Preflight: ${failures.length} drone(s) with issues`);
      } else {
        toast.success(`Preflight passed — ${st.totalDrones} drones ready`);
      }
    } else {
      toast.error('Preflight failed');
    }
  }, []);

  const handleUpload = useCallback(async () => {
    setBusy(true);
    // Build upload data from project store
    const trajectories = positions.map((pos, i) => ({
      droneId: `drone-${i + 1}`,
      points: [
        { t: 0, x: pos.x, y: 0, z: pos.z },
        { t: duration * 0.1, x: pos.x, y: pos.y + 30, z: pos.z },
        { t: duration * 0.9, x: pos.x, y: pos.y + 30, z: pos.z },
        { t: duration, x: pos.x, y: 0, z: pos.z },
      ],
    }));
    const lights = positions.map((pos, i) => ({
      droneId: `drone-${i + 1}`,
      keyframes: [
        { t: 0, r: 0, g: 0, b: 0 },
        { t: duration * 0.1, r: 255, g: 255, b: 255 },
        { t: duration * 0.9, r: 255, g: 255, b: 255 },
        { t: duration, r: 0, g: 0, b: 0 },
      ],
    }));

    const ok = await showOrchestrator.uploadShow({
      trajectories,
      lights,
      cues: [],
      geofence: null,
    });
    setBusy(false);

    if (ok) {
      toast.success(`Show uploaded — ${trajectories.length} drones`);
    } else {
      toast.error('Upload failed');
    }
  }, [positions, duration]);

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

  const handlePause = useCallback(async () => {
    await showOrchestrator.pause();
    toast.warning('Show paused');
  }, []);

  const handleResume = useCallback(async () => {
    await showOrchestrator.resume();
    toast.info('Show resumed');
  }, []);

  const handleLand = useCallback(async () => {
    await showOrchestrator.startLanding();
    toast.info('Landing sequence initiated');
  }, []);

  const handleAbort = useCallback(async () => {
    await showOrchestrator.abort('User emergency abort');
    toast.error('🚨 EMERGENCY ABORT — ALL DRONES RTH');
  }, []);

  const handleReset = useCallback(() => {
    showOrchestrator.reset();
    toast.info('Show control reset');
  }, []);

  // ── Derived state ─────────────────────────────────────────────

  const serverTime = clockSync.synced ? localTime + clockSync.offset : null;
  const progress = showOrchestrator.getProgress();
  const phase = orc.phase;

  const isLive = phase === 'running' || phase === 'countdown' || phase === 'paused' || phase === 'landing';
  const canReset = phase === 'complete' || phase === 'aborted' || phase === 'error';
  const activeWarnings = orc.warnings.filter(w => !w.dismissed);

  const getPhaseColor = (): string => {
    switch (phase) {
      case 'idle': return 'text-muted-foreground';
      case 'preflight': return 'text-primary';
      case 'uploading': return 'text-primary animate-pulse';
      case 'uploaded': return 'text-primary';
      case 'authorized': return 'text-success';
      case 'countdown': return 'text-warning animate-pulse';
      case 'running': return 'text-success animate-pulse';
      case 'paused': return 'text-warning';
      case 'landing': return 'text-primary animate-pulse';
      case 'complete': return 'text-success';
      case 'error': return 'text-destructive';
      case 'aborted': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getPhaseBg = (): string => {
    switch (phase) {
      case 'countdown': return 'bg-warning/5 border-warning/30';
      case 'running': return 'bg-success/5 border-success/30';
      case 'landing': return 'bg-primary/5 border-primary/30';
      case 'aborted': case 'error': return 'bg-destructive/5 border-destructive/30';
      default: return 'bg-background border-border';
    }
  };

  // Step completion helpers
  const preflightDone = phase !== 'idle' && phase !== 'preflight';
  const uploadDone = ['uploaded', 'authorized', 'countdown', 'running', 'paused', 'landing', 'complete'].includes(phase);
  const authDone = ['authorized', 'countdown', 'running', 'paused', 'landing', 'complete'].includes(phase);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-electric" />
            <span className="text-xs font-bold text-foreground tracking-wide">SHOW CONTROL</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className={cn("text-[8px]", getPhaseColor())}>
              {phaseLabel(phase)}
            </Badge>
            {canReset && (
              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={handleReset}>
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Clock / Status Display */}
      <div className={cn("p-2 border-b transition-colors", getPhaseBg())}>
        <div className="text-center">
          {phase === 'countdown' ? (
            <div className="text-3xl font-mono font-bold text-warning animate-pulse tracking-wider">
              {formatCountdown(orc.countdown)}
            </div>
          ) : phase === 'running' || phase === 'paused' ? (
            <div className="text-2xl font-mono font-bold text-foreground">
              {formatElapsed(orc.showElapsed)}
            </div>
          ) : (
            <div className="text-xl font-mono font-bold text-foreground">
              {formatTime(localTime)}
            </div>
          )}

          <div className="flex items-center justify-center gap-1 mt-0.5">
            {clockSync.synced ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[8px] text-muted-foreground">
                  Server: {serverTime ? formatTime(serverTime) : '---'}
                </span>
                <span className="text-[7px] text-muted-foreground">
                  (Δ{clockSync.offset.toFixed(0)}ms)
                </span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span className="text-[8px] text-muted-foreground">Clock not synced</span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar for running/paused/uploading */}
        {phase === 'uploading' && (
          <div className="mt-2">
            <Progress value={orc.uploadProgress * 100} className="h-2" />
            <div className="text-center text-[8px] text-muted-foreground mt-0.5">
              Uploading… {(orc.uploadProgress * 100).toFixed(0)}%
            </div>
          </div>
        )}

        {(phase === 'running' || phase === 'paused') && (
          <div className="mt-2">
            <Progress value={progress * 100} className="h-2" />
            <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
              <span>{orc.showElapsed.toFixed(1)}s</span>
              <span className="font-bold">{(progress * 100).toFixed(0)}%</span>
              <span>{orc.showDuration.toFixed(0)}s</span>
            </div>
          </div>
        )}

        {phase === 'landing' && (
          <div className="mt-2 flex items-center justify-center gap-1">
            <Plane className="w-3.5 h-3.5 text-primary animate-bounce" />
            <span className="text-[9px] text-primary font-bold">Landing in progress…</span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {activeWarnings.length > 0 && (
        <div className="p-1.5 border-b border-border bg-warning/5 max-h-24 overflow-y-auto">
          {activeWarnings.slice(0, 5).map(w => (
            <div key={w.id} className="flex items-start gap-1 text-[8px] mb-0.5">
              {w.severity === 'critical' ? (
                <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
              ) : w.severity === 'warning' ? (
                <AlertCircle className="w-3 h-3 text-warning shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <span className="text-foreground">{w.message}</span>
              <button
                className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => showOrchestrator.dismissWarning(w.id)}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Error display */}
      {orc.error && (
        <div className="p-2 border-b border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-1 text-[9px] text-destructive">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-bold">Error:</span>
            <span>{orc.error}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="workflow" className="flex-1 flex flex-col">
        <TabsList className="h-7 mx-2 mt-1">
          <TabsTrigger value="workflow" className="text-[9px] h-5">Workflow</TabsTrigger>
          <TabsTrigger value="mapping" className="text-[9px] h-5">Mapping</TabsTrigger>
          <TabsTrigger value="config" className="text-[9px] h-5">Config</TabsTrigger>
        </TabsList>

        {/* ── Workflow Tab ─────────────────────────────────────── */}
        <TabsContent value="workflow" className="flex-1 flex flex-col p-2 mt-0 overflow-y-auto">
          <div className="space-y-2">
            {/* Show Info */}
            <div className="grid grid-cols-2 gap-1 text-[8px]">
              <div className="bg-background rounded px-1.5 py-1">
                <div className="text-muted-foreground">Show</div>
                <div className="text-foreground font-bold truncate">{projectName}</div>
              </div>
              <div className="bg-background rounded px-1.5 py-1">
                <div className="text-muted-foreground">Duration</div>
                <div className="text-foreground font-bold">{duration}s</div>
              </div>
              <div className="bg-background rounded px-1.5 py-1">
                <div className="text-muted-foreground">Fleet</div>
                <div className="text-foreground font-bold">{orc.totalDrones > 0 ? orc.totalDrones : uavs.size} UAVs</div>
              </div>
              <div className="bg-background rounded px-1.5 py-1">
                <div className="text-muted-foreground">Positions</div>
                <div className="text-foreground font-bold">{positions.length}</div>
              </div>
            </div>

            {/* Step 1: Preflight */}
            <div className={cn("rounded border p-2",
              phase === 'idle' ? 'border-primary' : preflightDone ? 'border-success/30' : 'border-border opacity-60'
            )}>
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle2 className={cn("w-3 h-3", preflightDone ? 'text-success' : 'text-primary')} />
                <span className="text-[9px] font-bold">1. Preflight Checks</span>
                {preflightDone && <CheckCircle2 className="w-3 h-3 text-success ml-auto" />}
                {phase === 'preflight' && <Loader2 className="w-3 h-3 text-primary ml-auto animate-spin" />}
              </div>
              <p className="text-[7px] text-muted-foreground mb-1">
                Battery, GPS, calibration, geofence validation for all drones.
              </p>
              {orc.preflightResults.length > 0 && (
                <div className="mb-1 text-[8px]">
                  <span className="text-success">{orc.preflightResults.filter(r => r.passed).length} passed</span>
                  {orc.preflightResults.some(r => !r.passed) && (
                    <span className="text-destructive ml-2">
                      {orc.preflightResults.filter(r => !r.passed).length} failed
                    </span>
                  )}
                </div>
              )}
              <Button
                size="sm" className="w-full h-6 text-[9px]"
                disabled={phase !== 'idle' || busy}
                onClick={handlePreflight}
              >
                {busy && phase === 'idle' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                Run Preflight
              </Button>
            </div>

            {/* Step 2: Upload */}
            <div className={cn("rounded border p-2",
              phase === 'preflight' ? 'border-primary' : uploadDone ? 'border-success/30' : 'border-border opacity-60'
            )}>
              <div className="flex items-center gap-1 mb-1">
                <Upload className={cn("w-3 h-3", uploadDone ? 'text-success' : 'text-primary')} />
                <span className="text-[9px] font-bold">2. Upload Show Data</span>
                {uploadDone && <CheckCircle2 className="w-3 h-3 text-success ml-auto" />}
                {phase === 'uploading' && <Loader2 className="w-3 h-3 text-primary ml-auto animate-spin" />}
              </div>
              <p className="text-[7px] text-muted-foreground mb-1">
                Trajectories, light programs, cue markers → fleet.
              </p>
              {phase === 'uploading' && (
                <Progress value={orc.uploadProgress * 100} className="h-1.5 mb-1" />
              )}
              <Button
                size="sm" className="w-full h-6 text-[9px]"
                disabled={phase !== 'preflight' || busy}
                onClick={handleUpload}
              >
                {phase === 'uploading' ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                Upload to Fleet ({positions.length} slots)
              </Button>
            </div>

            {/* Step 3: Authorize */}
            <div className={cn("rounded border p-2",
              phase === 'uploaded' ? 'border-primary' : authDone ? 'border-success/30' : 'border-border opacity-60'
            )}>
              <div className="flex items-center gap-1 mb-1">
                <Shield className={cn("w-3 h-3", authDone ? 'text-success' : 'text-primary')} />
                <span className="text-[9px] font-bold">3. Authorize</span>
                {authDone && <CheckCircle2 className="w-3 h-3 text-success ml-auto" />}
              </div>
              <div className="space-y-1">
                <Select value={authScope} onValueChange={(v) => setAuthScope(v as AuthorizationScope)}>
                  <SelectTrigger className="h-6 text-[9px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live" className="text-[9px]">🟢 Live (full safety)</SelectItem>
                    <SelectItem value="rehearsal" className="text-[9px]">🟡 Rehearsal (reduced)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    size="sm" className="flex-1 h-6 text-[9px]"
                    disabled={phase !== 'uploaded' || busy}
                    onClick={handleAuthorize}
                  >
                    Authorize ({authScope})
                  </Button>
                  {phase === 'authorized' && (
                    <Button size="sm" variant="outline" className="h-6 text-[9px] px-2" onClick={handleDeauthorize}>
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Step 4: Start */}
            <div className={cn("rounded border p-2",
              phase === 'authorized' ? 'border-success' : 'border-border opacity-60'
            )}>
              <div className="flex items-center gap-1 mb-1">
                <Play className="w-3 h-3 text-success" />
                <span className="text-[9px] font-bold">4. Start Show</span>
              </div>

              <Select value={startMethod} onValueChange={(v) => setStartMethod(v as StartMethod)}>
                <SelectTrigger className="h-6 text-[9px] mb-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-[9px]">Manual Start</SelectItem>
                  <SelectItem value="rc" className="text-[9px]">RC Trigger</SelectItem>
                  <SelectItem value="gps_time" className="text-[9px]">GPS Time Sync</SelectItem>
                </SelectContent>
              </Select>

              {startMethod === 'gps_time' && (
                <Input type="time" step="1" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                  className="h-6 text-[9px] mb-1 bg-background" />
              )}

              <div className="flex gap-1 mb-1">
                <Input
                  type="number" value={countdownTarget}
                  onChange={(e) => setCountdownTarget(parseInt(e.target.value) || 10)}
                  className="h-7 text-[9px] w-16 bg-background"
                />
                <Button
                  size="sm"
                  className="flex-1 h-7 text-[10px] bg-success hover:bg-success/90 text-success-foreground"
                  disabled={phase !== 'authorized'}
                  onClick={handleCountdown}
                >
                  <Clock className="w-3 h-3 mr-1" />Countdown
                </Button>
              </div>
            </div>

            {/* Live Controls */}
            {isLive && (
              <div className="rounded border border-warning p-2">
                <div className="text-[9px] font-bold mb-1 text-warning">⚡ Live Controls</div>
                <div className="grid grid-cols-2 gap-1">
                  {phase === 'running' && (
                    <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={handlePause}>
                      <Pause className="w-3 h-3 mr-1" />Pause
                    </Button>
                  )}
                  {phase === 'paused' && (
                    <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={handleResume}>
                      <Play className="w-3 h-3 mr-1" />Resume
                    </Button>
                  )}
                  {(phase === 'running' || phase === 'paused') && (
                    <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={handleLand}>
                      <Plane className="w-3 h-3 mr-1" />Land
                    </Button>
                  )}
                  <Button
                    size="sm" variant="destructive"
                    className="h-7 text-[10px] col-span-2 font-bold"
                    onClick={handleAbort}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />🚨 EMERGENCY ABORT
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Mapping Tab ─────────────────────────────────────── */}
        <TabsContent value="mapping" className="flex-1 flex flex-col p-2 mt-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-foreground">Drone ↔ Slot Mapping</span>
            <div className="flex items-center gap-1">
              <Switch checked={autoMapping} onCheckedChange={setAutoMapping} className="h-3 w-5" />
              <span className="text-[8px] text-muted-foreground">Auto</span>
            </div>
          </div>
          <p className="text-[7px] text-muted-foreground mb-2">
            {orc.droneMapping.length > 0
              ? `${orc.droneMapping.filter(Boolean).length} drones mapped to ${orc.droneMapping.length} slots.`
              : 'Upload show data to populate mapping.'}
          </p>
          <ScrollArea className="flex-1">
            <div className="space-y-0.5">
              {orc.droneMapping.length === 0 ? (
                <div className="text-center py-4 text-[9px] text-muted-foreground">
                  {phase === 'idle' ? 'Run preflight & upload first' : 'No mapping data'}
                </div>
              ) : (
                orc.droneMapping.map((droneId, slot) => (
                  <div key={slot} className="flex items-center gap-1.5 bg-background rounded px-1.5 py-1">
                    <span className="text-[8px] font-mono text-muted-foreground w-8">#{slot + 1}</span>
                    <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
                    <span className="text-[9px] font-mono text-electric">{droneId ?? '---'}</span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ── Config Tab ──────────────────────────────────────── */}
        <TabsContent value="config" className="flex-1 p-2 mt-0 overflow-y-auto">
          <div className="space-y-3">
            <div>
              <Label className="text-[8px] text-muted-foreground">Show Name</Label>
              <Input value={projectName} readOnly className="h-6 text-[9px] bg-background mt-0.5" />
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Duration</Label>
              <Input value={`${duration}s`} readOnly className="h-6 text-[9px] bg-background mt-0.5" />
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Authorization</Label>
              <div className="text-[8px] text-foreground mt-0.5 bg-background rounded px-1.5 py-1">
                {orc.authorization.authorized
                  ? `✅ ${orc.authorization.scope.toUpperCase()} — authorized at ${orc.authorization.authorizedAt ? new Date(orc.authorization.authorizedAt).toLocaleTimeString() : '---'}`
                  : '❌ Not authorized'}
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Start Method</Label>
              <div className="text-[8px] text-foreground mt-0.5 bg-background rounded px-1.5 py-1">
                {startMethod === 'auto' ? 'Manual' : startMethod === 'rc' ? 'RC Trigger' : 'GPS Time Sync'}
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Fleet</Label>
              <div className="text-[8px] text-foreground mt-0.5 bg-background rounded px-1.5 py-1">
                {orc.totalDrones} drones ({orc.activeDrones} active) — {orc.droneMapping.filter(Boolean).length} mapped
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Clock Sync</Label>
              <div className="text-[8px] mt-0.5 bg-background rounded px-1.5 py-1">
                {clockSync.synced ? (
                  <span className="text-success">✅ Synced (Δ{clockSync.offset.toFixed(0)}ms, RTT {clockSync.roundTrip.toFixed(0)}ms)</span>
                ) : (
                  <span className="text-muted-foreground">❌ Not synced</span>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
