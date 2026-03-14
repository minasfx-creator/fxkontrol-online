/**
 * ─── Show Control Panel v2 ─────────────────────────────────────────
 * Full Skybrush Live show execution workflow.
 * SHOW-CFG, authorization scope, drone mapping, start conditions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Play, Pause, Square, Upload, Shield, AlertTriangle, CheckCircle2, Timer, Settings, Users, Map, Eye, EyeOff, RotateCcw, Zap } from 'lucide-react';
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
import type { AuthorizationScope, StartMethod } from '@/lib/flockwaveProtocol';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

interface ShowControlPanelProps {
  onClose?: () => void;
}

export default function ShowControlPanel({ onClose }: ShowControlPanelProps) {
  const {
    showState, setShowState, showProgress, setShowProgress,
    countdownSeconds, setCountdownSeconds,
    clockSync, connectionState, uavs, preflightSummary,
  } = useFleetStore();

  const { duration, projectName } = useProjectStore();

  const [startMethod, setStartMethod] = useState<StartMethod>('auto');
  const [authScope, setAuthScope] = useState<AuthorizationScope>('live');
  const [scheduledTime, setScheduledTime] = useState('');
  const [countdownTarget, setCountdownTarget] = useState(30);
  const [localTime, setLocalTime] = useState(Date.now());
  const [showMapping, setShowMapping] = useState(false);
  const [droneMapping, setDroneMapping] = useState<(string | null)[]>([]);
  const [autoMapping, setAutoMapping] = useState(true);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setLocalTime(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  // Auto-generate mapping from UAVs
  useEffect(() => {
    if (autoMapping && uavs.size > 0) {
      setDroneMapping(Array.from(uavs.keys()));
    }
  }, [uavs.size, autoMapping]);

  // Countdown logic
  useEffect(() => {
    if (showState === 'countdown' && countdownSeconds > 0) {
      countdownRef.current = setInterval(() => {
        setCountdownSeconds(Math.max(0, countdownSeconds - 1));
      }, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
    if (showState === 'countdown' && countdownSeconds <= 0) {
      setShowState('running');
      toast.success('🚀 SHOW STARTED!');
    }
  }, [showState, countdownSeconds, setCountdownSeconds, setShowState]);

  // Progress simulation
  useEffect(() => {
    if (showState === 'running') {
      const timer = setInterval(() => {
        setShowProgress(Math.min(1, showProgress + 1 / (duration * 10)));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [showState, showProgress, duration, setShowProgress]);

  const handleUploadShow = useCallback(() => {
    if (uavs.size === 0) {
      toast.error('No UAVs in fleet');
      return;
    }
    setShowState('uploaded');
    toast.success(`Show uploaded to ${uavs.size} drones`);
  }, [setShowState, uavs.size]);

  const handleAuthorize = useCallback(() => {
    setShowState('authorized');
    toast.success(`Show authorized (scope: ${authScope})`);
  }, [authScope, setShowState]);

  const handleDeauthorize = useCallback(() => {
    setShowState('uploaded');
    toast.warning('Show deauthorized');
  }, [setShowState]);

  const handleStartCountdown = useCallback(() => {
    setCountdownSeconds(countdownTarget);
    setShowState('countdown');
    toast.info(`Countdown: T-${countdownTarget}s`);
  }, [countdownTarget, setCountdownSeconds, setShowState]);

  const handleStartNow = useCallback(() => {
    setShowState('running');
    setShowProgress(0);
    toast.success('🚀 SHOW STARTED!');
  }, [setShowState, setShowProgress]);

  const handlePause = useCallback(() => {
    setShowState('paused');
    toast.warning('Show paused');
  }, [setShowState]);

  const handleResume = useCallback(() => {
    setShowState('running');
    toast.info('Show resumed');
  }, [setShowState]);

  const handleStop = useCallback(() => {
    setShowState('idle');
    setShowProgress(0);
    setCountdownSeconds(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    toast.warning('Show stopped');
  }, [setShowState, setShowProgress, setCountdownSeconds]);

  const handleAbort = useCallback(() => {
    setShowState('aborted');
    setShowProgress(0);
    setCountdownSeconds(0);
    if (countdownRef.current) clearInterval(countdownRef.current);
    toast.error('🚨 EMERGENCY ABORT — ALL DRONES RTH');
  }, [setShowState, setShowProgress, setCountdownSeconds]);

  const handleReset = useCallback(() => {
    setShowState('idle');
    setShowProgress(0);
    setCountdownSeconds(0);
    toast.info('Show control reset');
  }, [setShowState, setShowProgress, setCountdownSeconds]);

  const serverTime = clockSync.synced ? localTime + clockSync.offset : null;
  const isReady = showState === 'authorized';
  const isRunning = showState === 'running' || showState === 'countdown';

  const getStateColor = () => {
    switch (showState) {
      case 'idle': return 'text-muted-foreground';
      case 'uploaded': return 'text-primary';
      case 'authorized': return 'text-success';
      case 'countdown': return 'text-warning animate-pulse';
      case 'running': return 'text-success animate-pulse';
      case 'paused': return 'text-warning';
      case 'completed': return 'text-success';
      case 'aborted': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStateBg = () => {
    switch (showState) {
      case 'countdown': return 'bg-warning/5 border-warning/30';
      case 'running': return 'bg-success/5 border-success/30';
      case 'aborted': return 'bg-destructive/5 border-destructive/30';
      default: return 'bg-background border-border';
    }
  };

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
            <Badge variant="outline" className={cn("text-[8px]", getStateColor())}>
              {showState.toUpperCase()}
            </Badge>
            {(showState === 'completed' || showState === 'aborted') && (
              <Button size="sm" variant="ghost" className="h-4 w-4 p-0" onClick={handleReset}>
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Clock Display */}
      <div className={cn("p-2 border-b transition-colors", getStateBg())}>
        <div className="text-center">
          {showState === 'countdown' ? (
            <div className="text-3xl font-mono-code font-bold text-warning animate-pulse tracking-wider">
              {formatCountdown(countdownSeconds)}
            </div>
          ) : (
            <div className="text-xl font-mono-code font-bold text-foreground">
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
                  (Δ{clockSync.offset.toFixed(0)}ms RTT {clockSync.roundTrip.toFixed(0)}ms)
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

        {(showState === 'running' || showState === 'paused') && (
          <div className="mt-2">
            <Progress value={showProgress * 100} className="h-2" />
            <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
              <span>{(showProgress * duration).toFixed(1)}s</span>
              <span className="font-bold">{(showProgress * 100).toFixed(0)}%</span>
              <span>{duration}s</span>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="workflow" className="flex-1 flex flex-col">
        <TabsList className="h-7 mx-2 mt-1">
          <TabsTrigger value="workflow" className="text-[9px] h-5">Workflow</TabsTrigger>
          <TabsTrigger value="mapping" className="text-[9px] h-5">Mapping</TabsTrigger>
          <TabsTrigger value="config" className="text-[9px] h-5">Config</TabsTrigger>
        </TabsList>

        {/* Workflow Tab */}
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
                <div className="text-foreground font-bold">{uavs.size} UAVs</div>
              </div>
              <div className="bg-background rounded px-1.5 py-1">
                <div className="text-muted-foreground">Preflight</div>
                <div className={cn("font-bold", preflightSummary?.ready ? 'text-success' : 'text-muted-foreground')}>
                  {preflightSummary ? (preflightSummary.ready ? 'PASS' : 'FAIL') : '---'}
                </div>
              </div>
            </div>

            {/* Step 1: Upload */}
            <div className={cn("rounded border p-2", showState === 'idle' ? 'border-primary' : 'border-border opacity-60')}>
              <div className="flex items-center gap-1 mb-1">
                <Upload className="w-3 h-3 text-primary" />
                <span className="text-[9px] font-bold">1. Upload Show Data</span>
                {showState !== 'idle' && <CheckCircle2 className="w-3 h-3 text-success ml-auto" />}
              </div>
              <p className="text-[7px] text-muted-foreground mb-1">
                Uploads trajectories, light programs and cue markers to all drones.
              </p>
              <Button size="sm" className="w-full h-6 text-[9px]" disabled={showState !== 'idle'} onClick={handleUploadShow}>
                <Upload className="w-3 h-3 mr-1" />Upload to Fleet ({uavs.size})
              </Button>
            </div>

            {/* Step 2: Authorize */}
            <div className={cn("rounded border p-2", showState === 'uploaded' ? 'border-primary' : 'border-border opacity-60')}>
              <div className="flex items-center gap-1 mb-1">
                <Shield className="w-3 h-3 text-success" />
                <span className="text-[9px] font-bold">2. Authorize</span>
                {(showState === 'authorized' || isRunning) && <CheckCircle2 className="w-3 h-3 text-success ml-auto" />}
              </div>
              <div className="space-y-1">
                <Select value={authScope} onValueChange={(v) => setAuthScope(v as AuthorizationScope)}>
                  <SelectTrigger className="h-6 text-[9px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live" className="text-[9px]">🟢 Live (full safety)</SelectItem>
                    <SelectItem value="rehearsal" className="text-[9px]">🟡 Rehearsal (reduced safety)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button size="sm" className="flex-1 h-6 text-[9px]" disabled={showState !== 'uploaded'} onClick={handleAuthorize}>
                    Authorize ({authScope})
                  </Button>
                  {showState === 'authorized' && (
                    <Button size="sm" variant="outline" className="h-6 text-[9px] px-2" onClick={handleDeauthorize}>
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Start */}
            <div className={cn("rounded border p-2", isReady ? 'border-success' : 'border-border opacity-60')}>
              <div className="flex items-center gap-1 mb-1">
                <Play className="w-3 h-3 text-success" />
                <span className="text-[9px] font-bold">3. Start Show</span>
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
                <Input type="number" value={countdownTarget} onChange={(e) => setCountdownTarget(parseInt(e.target.value) || 10)}
                  className="h-7 text-[9px] w-16 bg-background" />
                <Button size="sm" className="flex-1 h-7 text-[10px] bg-success hover:bg-success/90 text-success-foreground"
                  disabled={!isReady} onClick={handleStartCountdown}>
                  <Clock className="w-3 h-3 mr-1" />Countdown
                </Button>
              </div>

              <Button size="sm" variant="outline"
                className="w-full h-6 text-[9px] border-success/50 text-success"
                disabled={!isReady} onClick={handleStartNow}>
                <Zap className="w-3 h-3 mr-1" />START NOW (skip countdown)
              </Button>
            </div>

            {/* Live Controls */}
            {(isRunning || showState === 'paused') && (
              <div className="rounded border border-warning p-2">
                <div className="text-[9px] font-bold mb-1 text-warning">⚡ Live Controls</div>
                <div className="grid grid-cols-2 gap-1">
                  {showState === 'running' && (
                    <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={handlePause}>
                      <Pause className="w-3 h-3 mr-1" />Pause
                    </Button>
                  )}
                  {showState === 'paused' && (
                    <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={handleResume}>
                      <Play className="w-3 h-3 mr-1" />Resume
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-6 text-[9px]" onClick={handleStop}>
                    <Square className="w-3 h-3 mr-1" />Stop
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7 text-[10px] col-span-2 font-bold" onClick={handleAbort}>
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />🚨 EMERGENCY ABORT
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Mapping Tab */}
        <TabsContent value="mapping" className="flex-1 flex flex-col p-2 mt-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-foreground">Drone ↔ Slot Mapping</span>
            <div className="flex items-center gap-1">
              <Switch checked={autoMapping} onCheckedChange={setAutoMapping} className="h-3 w-5" />
              <span className="text-[8px] text-muted-foreground">Auto</span>
            </div>
          </div>
          <p className="text-[7px] text-muted-foreground mb-2">
            Maps physical drones to show slots. Auto mode assigns by UAV ID order.
          </p>
          <ScrollArea className="flex-1">
            <div className="space-y-0.5">
              {droneMapping.length === 0 ? (
                <div className="text-center py-4 text-[9px] text-muted-foreground">
                  No drones in fleet
                </div>
              ) : (
                droneMapping.map((droneId, slot) => (
                  <div key={slot} className="flex items-center gap-1.5 bg-background rounded px-1.5 py-1">
                    <span className="text-[8px] font-mono-code text-muted-foreground w-8">#{slot + 1}</span>
                    <span className="text-[8px] text-foreground">→</span>
                    {autoMapping ? (
                      <span className="text-[9px] font-mono-code text-electric">{droneId ?? '---'}</span>
                    ) : (
                      <Select
                        value={droneId ?? ''}
                        onValueChange={(v) => {
                          const next = [...droneMapping];
                          next[slot] = v || null;
                          setDroneMapping(next);
                        }}
                      >
                        <SelectTrigger className="h-5 text-[8px] flex-1">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(uavs.keys()).map(id => (
                            <SelectItem key={id} value={id} className="text-[8px]">{id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Config Tab */}
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
              <Label className="text-[8px] text-muted-foreground">Authorization Scope</Label>
              <div className="text-[8px] text-foreground mt-0.5 bg-background rounded px-1.5 py-1">
                {authScope === 'live' ? '🟢 Live — all safety features enabled' : '🟡 Rehearsal — reduced safety for testing'}
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Start Method</Label>
              <div className="text-[8px] text-foreground mt-0.5 bg-background rounded px-1.5 py-1">
                {startMethod === 'auto' ? 'Manual' : startMethod === 'rc' ? 'RC Trigger' : 'GPS Time Sync'}
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Fleet Size</Label>
              <div className="text-[8px] text-foreground mt-0.5 bg-background rounded px-1.5 py-1">
                {uavs.size} drones ({droneMapping.filter(Boolean).length} mapped)
              </div>
            </div>
            <div>
              <Label className="text-[8px] text-muted-foreground">Clock Sync Status</Label>
              <div className="text-[8px] mt-0.5 bg-background rounded px-1.5 py-1">
                {clockSync.synced ? (
                  <span className="text-success">✅ Synced (offset: {clockSync.offset.toFixed(0)}ms)</span>
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
