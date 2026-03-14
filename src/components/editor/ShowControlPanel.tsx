/**
 * ─── Show Control Panel ────────────────────────────────────────────
 * Clock synchronization, show start/pause/resume, countdown timer.
 * Based on Skybrush Live show execution workflow.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Play, Pause, Square, RotateCcw, Upload, Shield, Wifi, WifiOff, Radio, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFleetStore } from '@/store/useFleetStore';
import { useProjectStore } from '@/store/useProjectStore';
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
    clockSync, connectionState,
    uavs, preflightSummary,
  } = useFleetStore();

  const { duration, projectName } = useProjectStore();

  const [startMethod, setStartMethod] = useState<'manual' | 'countdown' | 'gps_time'>('manual');
  const [scheduledTime, setScheduledTime] = useState('');
  const [countdownTarget, setCountdownTarget] = useState(30); // seconds
  const [authCode, setAuthCode] = useState('');
  const [localTime, setLocalTime] = useState(Date.now());
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update local clock every 100ms
  useEffect(() => {
    const timer = setInterval(() => setLocalTime(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer logic
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

  // Show progress simulation
  useEffect(() => {
    if (showState === 'running') {
      const timer = setInterval(() => {
        setShowProgress(Math.min(1, showProgress + 1 / (duration * 10)));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [showState, showProgress, duration, setShowProgress]);

  const handleUploadShow = useCallback(() => {
    setShowState('uploaded');
    toast.success('Show data uploaded to fleet');
  }, [setShowState]);

  const handleAuthorize = useCallback(() => {
    if (authCode.length < 4) {
      toast.error('Enter authorization code');
      return;
    }
    setShowState('authorized');
    toast.success('Show authorized');
  }, [authCode, setShowState]);

  const handleStartCountdown = useCallback(() => {
    setCountdownSeconds(countdownTarget);
    setShowState('countdown');
    toast.info(`Countdown started: T-${countdownTarget}s`);
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
    toast.error('🚨 SHOW ABORTED — ALL DRONES RTH');
  }, [setShowState, setShowProgress, setCountdownSeconds]);

  const serverTime = clockSync.synced ? localTime + clockSync.offset : null;
  const isReady = showState === 'authorized' || showState === 'uploaded';
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

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="p-2 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-electric" />
            <span className="text-xs font-bold text-foreground tracking-wide">SHOW CONTROL</span>
          </div>
          <Badge variant="outline" className={cn("text-[8px]", getStateColor())}>
            {showState.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Clock Display */}
      <div className="p-2 border-b border-border bg-background">
        <div className="text-center">
          {/* Countdown or Time */}
          {showState === 'countdown' ? (
            <div className="text-2xl font-mono-code font-bold text-warning animate-pulse">
              {formatCountdown(countdownSeconds)}
            </div>
          ) : (
            <div className="text-xl font-mono-code font-bold text-foreground">
              {formatTime(localTime)}
            </div>
          )}

          {/* Server time */}
          <div className="flex items-center justify-center gap-1 mt-0.5">
            {clockSync.synced ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[8px] text-muted-foreground">
                  Server: {serverTime ? formatTime(serverTime) : '---'}
                </span>
                <span className="text-[7px] text-muted-foreground">
                  (Δ{clockSync.offset.toFixed(0)}ms, RTT {clockSync.roundTrip.toFixed(0)}ms)
                </span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                <span className="text-[8px] text-muted-foreground">Not synced</span>
              </>
            )}
          </div>
        </div>

        {/* Progress bar during show */}
        {(showState === 'running' || showState === 'paused') && (
          <div className="mt-2">
            <Progress value={showProgress * 100} className="h-1.5" />
            <div className="flex justify-between text-[8px] text-muted-foreground mt-0.5">
              <span>{(showProgress * duration).toFixed(1)}s</span>
              <span>{duration}s</span>
            </div>
          </div>
        )}
      </div>

      {/* Show Info */}
      <div className="p-2 border-b border-border">
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
      </div>

      {/* Workflow Steps */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {/* Step 1: Upload */}
        <div className={cn("rounded border p-2", showState === 'idle' ? 'border-primary' : 'border-border opacity-60')}>
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[9px] font-bold">1. Upload Show</span>
            {showState !== 'idle' && <CheckCircle2 className="w-3 h-3 text-success" />}
          </div>
          <Button
            size="sm"
            className="w-full h-6 text-[9px]"
            disabled={showState !== 'idle'}
            onClick={handleUploadShow}
          >
            <Upload className="w-3 h-3 mr-1" />Upload to Fleet
          </Button>
        </div>

        {/* Step 2: Authorize */}
        <div className={cn("rounded border p-2", showState === 'uploaded' ? 'border-primary' : 'border-border opacity-60')}>
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[9px] font-bold">2. Authorize</span>
            {(showState === 'authorized' || isRunning) && <CheckCircle2 className="w-3 h-3 text-success" />}
          </div>
          <div className="flex gap-1">
            <Input
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
              className="h-6 text-[9px] bg-background flex-1"
              placeholder="Auth code..."
              disabled={showState !== 'uploaded'}
            />
            <Button
              size="sm"
              className="h-6 text-[9px]"
              disabled={showState !== 'uploaded'}
              onClick={handleAuthorize}
            >
              <Shield className="w-3 h-3" />
            </Button>
          </div>
        </div>

        {/* Step 3: Start */}
        <div className={cn("rounded border p-2", isReady ? 'border-primary' : 'border-border opacity-60')}>
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[9px] font-bold">3. Start Show</span>
          </div>

          {/* Start Method */}
          <Select value={startMethod} onValueChange={(v) => setStartMethod(v as typeof startMethod)}>
            <SelectTrigger className="h-6 text-[9px] mb-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual" className="text-[9px]">Manual Start</SelectItem>
              <SelectItem value="countdown" className="text-[9px]">Countdown</SelectItem>
              <SelectItem value="gps_time" className="text-[9px]">GPS Time</SelectItem>
            </SelectContent>
          </Select>

          {startMethod === 'countdown' && (
            <div className="flex items-center gap-1 mb-1">
              <Label className="text-[8px] text-muted-foreground">Seconds:</Label>
              <Input
                type="number"
                value={countdownTarget}
                onChange={(e) => setCountdownTarget(parseInt(e.target.value) || 30)}
                className="h-6 text-[9px] w-16 bg-background"
              />
            </div>
          )}

          {startMethod === 'gps_time' && (
            <Input
              type="time"
              step="1"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="h-6 text-[9px] mb-1 bg-background"
            />
          )}

          <div className="flex gap-1">
            {startMethod === 'countdown' ? (
              <Button
                size="sm"
                className="flex-1 h-7 text-[10px] bg-success hover:bg-success/90 text-success-foreground"
                disabled={!isReady}
                onClick={handleStartCountdown}
              >
                <Clock className="w-3 h-3 mr-1" />Start Countdown
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 h-7 text-[10px] bg-success hover:bg-success/90 text-success-foreground"
                disabled={!isReady}
                onClick={handleStartNow}
              >
                <Play className="w-3 h-3 mr-1" />START
              </Button>
            )}
          </div>
        </div>

        {/* Live Controls */}
        {(isRunning || showState === 'paused') && (
          <div className="rounded border border-warning p-2">
            <div className="text-[9px] font-bold mb-1 text-warning">Live Controls</div>
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
              <Button size="sm" variant="destructive" className="h-6 text-[9px] col-span-2" onClick={handleAbort}>
                <AlertTriangle className="w-3 h-3 mr-1" />EMERGENCY ABORT
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
