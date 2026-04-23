import { useEffect, useState, useRef } from 'react';
import { X, Clock, Radio, Play, Square, RotateCcw, Zap, Volume2, VolumeX, Link2, Unlink2, Timer, Wifi, WifiOff, ArrowDownToLine, Gauge, Satellite, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSMPTEStore, type ChaseMode } from '@/store/useSMPTEStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useFireOneHardware } from '@/hooks/useFireOneHardware';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { formatTimecode, encodeTimecodeToLTC, generateMTCQuarterFrames, secondsToTimecode, type SMPTEFrameRate } from '@/lib/smpteEngine';
import { formatSMPTE } from '@/lib/smpteUtils';
import { getOSCClient, buildMA3TimecodeSync, buildMA3TimecodeTransport } from '@/lib/oscEngine';
import { ltcRuntime, updateTimelineClockFromLTCFps } from '@/hardware/transports/ltcRuntime';

interface SMPTEPanelProps {
  onClose: () => void;
}

export default function SMPTEPanel({ onClose }: SMPTEPanelProps) {
  const store = useSMPTEStore();
    const currentTime = useProjectStore(s => s.currentTime);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const hardware = useFireOneHardware();
  const pbus = usePBusHardware();
  const [startTcInput, setStartTcInput] = useState('01:00:00:00');
  const [wsUrlInput, setWsUrlInput] = useState(store.wsUrl);
  const [syncToFireOne, setSyncToFireOne] = useState(false);
  const [syncToPBus, setSyncToPBus] = useState(false);
  const [syncToMA3, setSyncToMA3] = useState(false);
  const [kalmanEnabled, setKalmanEnabled] = useState(() => ltcRuntime.isKalmanEnabled());
  const [replaySpeed, setReplaySpeed] = useState('1');
  const [replayPlaying, setReplayPlaying] = useState(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pbusSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ma3SyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derive display TC
  const offsetTime = currentTime + store.startTimecodeSeconds;
  const tc = store.externalEnabled && store.status === 'connected' && store.mode === 'slave' && store.externalTimecode
    ? store.externalTimecode
    : secondsToTimecode(offsetTime, store.frameRate, store.frameRate === 29.97);
  const tcStr = formatTimecode(tc);
  const ltcSignal = store.running ? encodeTimecodeToLTC(tc) : null;
  const mtcFrames = store.running ? generateMTCQuarterFrames(tc) : [];
  const pllDiagnostics = ltcRuntime.getPLLDiagnostics();
  const driftSeries = ltcRuntime.getDriftSeries();
  const telemetrySeries = ltcRuntime.getTelemetrySeries();
  const transportDiagnostics = ltcRuntime.getDiagnostics();
  const ltcEvents = ltcRuntime.getEvents().slice(-8).reverse();
  const replayFrames = ltcRuntime.getReplayRecord();
  const detectedFrameDuration = pllDiagnostics.fps ? 1 / pllDiagnostics.fps : null;
  const driftBars = driftSeries.drift.slice(-24).map((value, index) => ({
    id: `${driftSeries.time[index] ?? index}-${index}`,
    value,
  }));
  const driftWindow = driftSeries.drift.slice(-32);
  const timeWindow = telemetrySeries.time.slice(-32);
  const rawWindow = telemetrySeries.raw.slice(-32);
  const filteredWindow = telemetrySeries.filtered.slice(-32);
  const clockWindow = telemetrySeries.clock.slice(-32);
  const maxMagnitude = driftWindow.reduce((peak, value) => Math.max(peak, Math.abs(value)), 0.001);
  const maxTimeMagnitude = [rawWindow, filteredWindow, clockWindow]
    .flat()
    .reduce((range, value) => ({ min: Math.min(range.min, value), max: Math.max(range.max, value) }), { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY });
  const timeSpan = Number.isFinite(maxTimeMagnitude.min) && Number.isFinite(maxTimeMagnitude.max)
    ? Math.max(0.001, maxTimeMagnitude.max - maxTimeMagnitude.min)
    : 0.001;
  const driftLinePoints = driftWindow.map((value, index) => {
    const x = driftWindow.length <= 1 ? 0 : (index / (driftWindow.length - 1)) * 100;
    const y = 50 - (value / maxMagnitude) * 42;
    return `${x},${Math.max(4, Math.min(96, y))}`;
  }).join(' ');
  const mapTimePoints = (series: number[]) => series.map((value, index) => {
    const x = series.length <= 1 ? 0 : (index / (series.length - 1)) * 100;
    const y = 92 - (((value - maxTimeMagnitude.min) / timeSpan) * 84);
    return `${x},${Math.max(4, Math.min(96, y))}`;
  }).join(' ');
  const rawLinePoints = mapTimePoints(rawWindow);
  const filteredLinePoints = mapTimePoints(filteredWindow);
  const clockLinePoints = mapTimePoints(clockWindow);
  const markerEvents = ltcEvents
    .map((event) => ({ event, index: timeWindow.findIndex((time) => Math.abs(time - event.time / 1000) < 0.2) }))
    .filter((entry) => entry.index >= 0);

  const handleReplay = () => {
    const snapshot = ltcRuntime.getReplayRecord();
    if (!snapshot.length) return;
    const speed = Number.parseFloat(replaySpeed) || 1;
    setReplayPlaying(true);
    ltcRuntime.replayAsync(snapshot, {
      speed,
      onFrame: (_, index, total) => {
        if (index >= total - 1) {
          setReplayPlaying(false);
          updateTimelineClockFromLTCFps();
        }
      },
    });
  };

  const handleClearReplay = () => {
    ltcRuntime.stopReplay();
    setReplayPlaying(false);
    ltcRuntime.clearReplayRecord();
  };

  const handlePauseReplay = () => {
    ltcRuntime.stopReplay();
    setReplayPlaying(false);
  };

  const handleStepReplay = () => {
    const snapshot = ltcRuntime.getReplayRecord();
    if (!snapshot.length) return;
    ltcRuntime.stepReplay(snapshot, {
      speed: Number.parseFloat(replaySpeed) || 1,
      onFrame: () => {
        setReplayPlaying(false);
        updateTimelineClockFromLTCFps();
      },
    });
  };

  useEffect(() => {
    ltcRuntime.setKalmanEnabled(kalmanEnabled);
  }, [kalmanEnabled]);

  useEffect(() => {
    ltcRuntime.setChaseMode(store.chaseMode);
  }, [store.chaseMode]);

  useEffect(() => {
    const stc = secondsToTimecode(store.startTimecodeSeconds, store.frameRate, false);
    setStartTcInput(formatTimecode(stc));
  }, [store.startTimecodeSeconds, store.frameRate]);

  const handleStartTcBlur = () => store.setStartTimecode(startTcInput);

  // FireOne timecode sync
  useEffect(() => {
    if (!syncToFireOne || !hardware.isConnected || !store.running) {
      if (syncIntervalRef.current) { clearInterval(syncIntervalRef.current); syncIntervalRef.current = null; }
      return;
    }
    syncIntervalRef.current = setInterval(() => {
      const ms = Math.round((currentTime + store.startTimecodeSeconds) * 1000);
      hardware.syncTimecode(ms).catch(() => {});
    }, 100); // sync every 100ms
    return () => { if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); };
  }, [syncToFireOne, hardware.isConnected, store.running, currentTime, store.startTimecodeSeconds]);

  // PBUS timecode sync
  useEffect(() => {
    if (!syncToPBus || !pbus.isConnected || !store.running) {
      if (pbusSyncRef.current) { clearInterval(pbusSyncRef.current); pbusSyncRef.current = null; }
      return;
    }
    pbusSyncRef.current = setInterval(() => {
      // PBUS devices receive timecode via requestCueStatus which updates internal clock
      pbus.devices.forEach((_, addr) => {
        pbus.requestCueStatus(addr).catch(() => {});
      });
    }, 200); // sync every 200ms for PBUS
    return () => { if (pbusSyncRef.current) clearInterval(pbusSyncRef.current); };
  }, [syncToPBus, pbus.isConnected, store.running, pbus]);

  // MA3 timecode sync via OSC
  useEffect(() => {
    if (!syncToMA3 || !store.running) {
      if (ma3SyncRef.current) { clearInterval(ma3SyncRef.current); ma3SyncRef.current = null; }
      return;
    }
    const oscClient = getOSCClient();
    ma3SyncRef.current = setInterval(() => {
      const t = secondsToTimecode(currentTime + store.startTimecodeSeconds, store.frameRate, store.frameRate === 29.97);
      oscClient.send(buildMA3TimecodeSync(t.hours, t.minutes, t.seconds, t.frames));
    }, 100); // 10Hz sync
    return () => { if (ma3SyncRef.current) clearInterval(ma3SyncRef.current); };
  }, [syncToMA3, store.running, currentTime, store.startTimecodeSeconds, store.frameRate]);

  const statusColor = {
    disconnected: 'bg-muted-foreground',
    connecting: 'bg-warning animate-pulse',
    connected: 'bg-success animate-pulse',
    error: 'bg-destructive animate-pulse',
  }[store.status];

  const statusLabel = {
    disconnected: 'DISCONNECTED',
    connecting: 'CONNECTING...',
    connected: 'CONNECTED',
    error: 'ERROR',
  }[store.status];

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono-code font-bold text-foreground">SMPTE / LTC / MTC</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Big timecode display */}
        <div className="bg-surface-0 rounded-lg p-4 border border-border text-center">
          <span className="font-mono-code text-2xl font-bold tracking-[0.15em] text-primary">
            {tcStr}
          </span>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className={cn("w-2 h-2 rounded-full", store.locked ? "bg-success animate-pulse" : store.running ? "bg-warning animate-pulse" : "bg-destructive")} />
            <span className="text-[10px] font-mono-code text-muted-foreground">
              {store.locked ? 'LOCKED' : store.running ? 'SYNCING' : 'IDLE'}
            </span>
            <span className="text-[10px] font-mono-code text-muted-foreground">
              {store.frameRate}fps{tc.dropFrame ? ' DF' : ' NDF'}
            </span>
            {store.externalEnabled && store.status === 'connected' && (
              <span className="text-[10px] font-mono-code text-success">EXT</span>
            )}
          </div>
          <div className="text-[9px] font-mono-code text-muted-foreground mt-1">
            Project: {currentTime.toFixed(2)}s | Offset: +{store.startTimecodeSeconds.toFixed(1)}s
          </div>
          {store.frameRate === 29.97 && (
            <div className="text-[8px] font-mono-code text-fxk-cyan/60 mt-0.5">
              DF: {formatSMPTE(offsetTime, store.frameRate, true).text}
            </div>
          )}
        </div>

        {/* Transport */}
        <div className="flex items-center gap-1 justify-center">
          <Button variant={store.running ? "default" : "outline"} size="sm" className="h-7 text-[10px] font-mono-code gap-1" onClick={() => store.setRunning(!store.running)}>
            {store.running ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {store.running ? 'STOP' : 'START'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] font-mono-code gap-1" onClick={store.reset}>
            <RotateCcw className="w-3 h-3" /> RESET
          </Button>
        </div>

        {/* ═══ EXTERNAL SYNC ═══ */}
        <div className={cn(
          "rounded border p-2 space-y-2",
          store.externalEnabled ? "bg-primary/5 border-primary/30" : "bg-surface-0 border-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Satellite className="w-3.5 h-3.5 text-primary" />
              <Label className="text-[10px] font-mono-code text-foreground font-bold">EXTERNAL TC RECEIVER</Label>
            </div>
            <Switch checked={store.externalEnabled} onCheckedChange={store.setExternalEnabled} className="scale-75" />
          </div>

          {store.externalEnabled && (
            <div className="space-y-2">
              {/* Connection status */}
              <div className="flex items-center gap-2">
                <div className={cn("w-2 h-2 rounded-full", statusColor)} />
                <span className="text-[9px] font-mono-code text-muted-foreground">{statusLabel}</span>
                {store.status === 'connected' && (
                  <span className="text-[9px] font-mono-code text-success ml-auto">{store.packetCount} pkts</span>
                )}
              </div>

              {/* WebSocket URL */}
              <div className="space-y-1">
                <Label className="text-[8px] font-mono-code text-muted-foreground">WEBSOCKET URL</Label>
                <div className="flex gap-1">
                  <Input
                    value={wsUrlInput}
                    onChange={e => setWsUrlInput(e.target.value)}
                    onBlur={() => store.setWsUrl(wsUrlInput)}
                    onKeyDown={e => { if (e.key === 'Enter') { store.setWsUrl(wsUrlInput); store.connectExternal(); } }}
                    className="h-6 text-[9px] font-mono-code flex-1"
                    placeholder="wss://your-project.supabase.co/functions/v1/timecode-bridge"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[9px]"
                    onClick={() => {
                      store.setWsUrl(wsUrlInput);
                      if (store.status === 'connected') store.disconnectExternal();
                      else store.connectExternal();
                    }}
                  >
                    {store.status === 'connected' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                  </Button>
                </div>
              </div>

              {/* Chase mode */}
              <div className="space-y-1">
                <Label className="text-[8px] font-mono-code text-muted-foreground">CHASE MODE</Label>
                <Select value={store.chaseMode} onValueChange={v => store.setChaseMode(v as ChaseMode)}>
                  <SelectTrigger className="h-6 text-[9px] font-mono-code"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard" className="text-[9px]">Hard Lock — instant chase</SelectItem>
                    <SelectItem value="soft" className="text-[9px]">Soft Lock — chase if &gt;0.5s drift</SelectItem>
                    <SelectItem value="jam" className="text-[9px]">Jam Sync — sync once, freewheel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* External TC display */}
              {store.externalTimecode && store.status === 'connected' && (
                <div className="bg-surface-0 rounded p-1.5 border border-border">
                  <div className="text-[8px] font-mono-code text-muted-foreground mb-0.5">INCOMING TIMECODE</div>
                  <div className="font-mono-code text-sm font-bold text-success tracking-wider">
                    {formatTimecode(store.externalTimecode)}
                  </div>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[8px] font-mono-code text-muted-foreground">
                      Latency: {store.latency.toFixed(1)}ms
                    </span>
                    <span className="text-[8px] font-mono-code text-muted-foreground">
                      {store.externalTimecode.frameRate}fps
                    </span>
                    <span className="text-[8px] font-mono-code text-muted-foreground">
                      {((Date.now() - store.lastPacketAt) / 1000).toFixed(1)}s ago
                    </span>
                  </div>
                </div>
              )}

              {/* Integration help */}
              <div className="text-[7px] font-mono-code text-muted-foreground/60 leading-tight space-y-0.5">
                <div>Send TC via WebSocket JSON:</div>
                <div className="bg-surface-0 rounded px-1 py-0.5 border border-border/30">
                  {`{"type":"tc","hours":1,"minutes":0,"seconds":30,"frames":15,"fps":30}`}
                </div>
                <div className="bg-surface-0 rounded px-1 py-0.5 border border-border/30">
                  {`{"type":"transport","command":"play"|"stop"|"locate"}`}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FireOne Timecode Sync */}
        <div className={cn(
          "rounded border p-2 space-y-1",
          syncToFireOne && hardware.isConnected ? "bg-green-500/5 border-green-500/30" : "bg-surface-0 border-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Zap className={cn("w-3.5 h-3.5", syncToFireOne && hardware.isConnected ? "text-green-400" : "text-muted-foreground")} />
              <Label className="text-[10px] font-mono-code text-foreground font-bold">SYNC TO FIREONE</Label>
            </div>
            <Switch checked={syncToFireOne} onCheckedChange={setSyncToFireOne} className="scale-75" />
          </div>
          {syncToFireOne && (
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", hardware.isConnected ? "bg-green-400 animate-pulse" : "bg-yellow-400")} />
              <span className="text-[9px] font-mono-code text-muted-foreground">
                {hardware.isConnected
                  ? `${hardware.modules.size} módulo(s) recebendo TC`
                  : 'Hardware não conectado'}
              </span>
            </div>
          )}
        </div>

        {/* PBUS Timecode Sync */}
        <div className={cn(
          "rounded border p-2 space-y-1",
          syncToPBus && pbus.isConnected ? "bg-amber-500/5 border-amber-500/30" : "bg-surface-0 border-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Radio className={cn("w-3.5 h-3.5", syncToPBus && pbus.isConnected ? "text-amber-400" : "text-muted-foreground")} />
              <Label className="text-[10px] font-mono-code text-foreground font-bold">SYNC TO PBUS</Label>
            </div>
            <Switch checked={syncToPBus} onCheckedChange={setSyncToPBus} className="scale-75" />
          </div>
          {syncToPBus && (
            <div className="flex items-center gap-1.5">
              <div className={cn("w-2 h-2 rounded-full", pbus.isConnected ? "bg-amber-400 animate-pulse" : "bg-yellow-400")} />
              <span className="text-[9px] font-mono-code text-muted-foreground">
                {pbus.isConnected
                  ? `${pbus.deviceCount} dispositivo(s) recebendo TC`
                  : 'PBUS não conectado'}
              </span>
            </div>
          )}
        </div>

        {/* MA3 Timecode Sync via OSC */}
        <div className={cn(
          "rounded border p-2 space-y-1",
          syncToMA3 ? "bg-blue-500/5 border-blue-500/30" : "bg-surface-0 border-border"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Monitor className={cn("w-3.5 h-3.5", syncToMA3 ? "text-blue-400" : "text-muted-foreground")} />
              <Label className="text-[10px] font-mono-code text-foreground font-bold">SYNC TO MA3</Label>
            </div>
            <Switch checked={syncToMA3} onCheckedChange={setSyncToMA3} className="scale-75" />
          </div>
          {syncToMA3 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", store.running ? "bg-blue-400 animate-pulse" : "bg-muted-foreground")} />
                <span className="text-[9px] font-mono-code text-muted-foreground">
                  {store.running ? 'Sending TC via OSC @ 10Hz' : 'Aguardando playback'}
                </span>
              </div>
              <div className="text-[7px] font-mono-code text-muted-foreground/50">
                OSC → SetUserVar "tc" → MA3 macros podem ler o timecode
              </div>
            </div>
          )}
        </div>

        {/* Auto-follow toggle */}
        <div className="bg-surface-0 rounded p-2 border border-border space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {store.autoFollow ? <Link2 className="w-3 h-3 text-primary" /> : <Unlink2 className="w-3 h-3 text-muted-foreground" />}
              <Label className="text-[10px] font-mono-code text-foreground">Auto-Follow Playback</Label>
            </div>
            <Switch checked={store.autoFollow} onCheckedChange={store.setAutoFollow} className="scale-75" />
          </div>
        </div>

        {/* Start timecode */}
        <div className="space-y-1">
          <Label className="text-[10px] font-mono-code text-muted-foreground flex items-center gap-1">
            <Timer className="w-3 h-3" /> START TIMECODE
          </Label>
          <Input value={startTcInput} onChange={e => setStartTcInput(e.target.value)} onBlur={handleStartTcBlur} onKeyDown={e => e.key === 'Enter' && handleStartTcBlur()} className="h-7 text-xs font-mono-code tracking-wider" placeholder="01:00:00:00" />
          <div className="flex gap-1">
            {['00:00:00:00', '01:00:00:00', '10:00:00:00', '23:00:00:00'].map(preset => (
              <button key={preset} onClick={() => { setStartTcInput(preset); store.setStartTimecode(preset); }} className="text-[8px] font-mono-code text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/30 hover:border-primary/40 transition-colors">
                {preset.slice(0, 5)}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] font-mono-code text-muted-foreground">SYNC MODE</Label>
            <Select value={store.mode} onValueChange={(v) => store.setMode(v as any)}>
              <SelectTrigger className="h-7 text-xs font-mono-code"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="master">Master (generate TC)</SelectItem>
                <SelectItem value="slave">Slave (receive TC)</SelectItem>
                <SelectItem value="freerun">Free Run</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-mono-code text-muted-foreground">FRAME RATE</Label>
            <Select value={String(store.frameRate)} onValueChange={(v) => store.setFrameRate(Number(v) as SMPTEFrameRate)}>
              <SelectTrigger className="h-7 text-xs font-mono-code"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps (Film)</SelectItem>
                <SelectItem value="25">25 fps (PAL / EBU)</SelectItem>
                <SelectItem value="29.97">29.97 fps (NTSC DF)</SelectItem>
                <SelectItem value="30">30 fps (SMPTE NDF)</SelectItem>
                <SelectItem value="60">60 fps (NDF HFR)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* LTC Audio Output */}
        <div className="bg-surface-0 rounded p-2 border border-border space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {store.ltcAudioEnabled ? <Volume2 className="w-3 h-3 text-primary" /> : <VolumeX className="w-3 h-3 text-muted-foreground" />}
              <Label className="text-[10px] font-mono-code text-foreground">LTC Audio Output</Label>
            </div>
            <Switch checked={store.ltcAudioEnabled} onCheckedChange={store.setLtcAudioEnabled} className="scale-75" />
          </div>
          {store.ltcAudioEnabled && store.running && (
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[9px] font-mono-code text-success">LTC TRANSMITTING</span>
            </div>
          )}
        </div>

        {/* Sync metrics */}
        <div className="bg-surface-0 rounded p-2 space-y-1 border border-border">
          <div className="text-[10px] font-mono-code text-muted-foreground font-bold mb-1">SYNC METRICS</div>
          <MetricRow label="Offset" value={`${store.offset.toFixed(2)} ms`} warn={Math.abs(store.offset) > 1} />
          <MetricRow label="Jitter" value={`±${Math.abs(store.jitter).toFixed(2)} ms`} warn={Math.abs(store.jitter) > 0.4} />
          <MetricRow label="Drift" value={`${store.drift.toFixed(1)} ppm`} warn={Math.abs(store.drift) > 5} />
          <MetricRow label="Mode" value={store.mode.toUpperCase()} />
          {store.externalEnabled && (
            <>
              <MetricRow label="WS Latency" value={`${store.latency.toFixed(1)} ms`} warn={store.latency > 50} />
              <MetricRow label="Chase" value={store.chaseMode.toUpperCase()} />
              <MetricRow label="Ext Packets" value={String(store.packetCount)} />
            </>
          )}
        </div>

        <div className="bg-surface-0 rounded p-2 space-y-2 border border-border">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold">PLL DIAGNOSTICS</div>
            <Badge variant="outline" className="h-5 rounded-sm px-1.5 text-[8px] font-mono-code uppercase">
              {pllDiagnostics.state}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-2 py-1.5">
            <Label className="text-[9px] font-mono-code text-muted-foreground">Kalman input filter</Label>
            <Switch checked={kalmanEnabled} onCheckedChange={setKalmanEnabled} className="scale-75" />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <MetricRow label="SRC" value={pllDiagnostics.source ?? '—'} />
            <MetricRow label="FPS" value={pllDiagnostics.fps?.toFixed(2) ?? '—'} />
            <MetricRow label="RATE" value={pllDiagnostics.rate.toFixed(5)} warn={Math.abs(pllDiagnostics.rate - 1) > 0.01} />
            <MetricRow label="INT" value={pllDiagnostics.integral.toFixed(5)} />
            <MetricRow label="DRIFT" value={pllDiagnostics.driftSec.toFixed(4)} warn={Math.abs(pllDiagnostics.driftSec) > 0.01} />
            <MetricRow label="AVG" value={pllDiagnostics.avgDriftSec.toFixed(4)} />
            <MetricRow label="PEAK" value={pllDiagnostics.peakDriftSec.toFixed(4)} warn={pllDiagnostics.peakDriftSec > 0.02} />
            <MetricRow label="FRAME" value={detectedFrameDuration ? `${detectedFrameDuration.toFixed(5)}s` : '—'} />
          </div>
        </div>

        <div className="bg-surface-0 rounded p-2 space-y-2 border border-border">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold">DRIFT HISTORY</div>
            <span className="text-[8px] font-mono-code text-muted-foreground">{driftSeries.drift.length} frames</span>
          </div>
          <div className="h-16 flex items-end gap-px overflow-hidden rounded border border-border/40 bg-background/40 px-1 py-1">
            {driftBars.length > 0 ? driftBars.map((bar) => {
              const magnitude = Math.max(8, Math.min(100, Math.abs(bar.value) * 4000));
              return (
                <div
                  key={bar.id}
                  className={cn('flex-1 rounded-[1px]', bar.value >= 0 ? 'bg-primary/70' : 'bg-warning/70')}
                  style={{ height: `${magnitude}%` }}
                  title={bar.value.toFixed(6)}
                />
              );
            }) : (
              <div className="flex h-full w-full items-center justify-center text-[8px] font-mono-code text-muted-foreground">
                No drift samples
              </div>
            )}
          </div>
          <div className="relative rounded border border-border/40 bg-background/40 px-1 py-1">
            <svg viewBox="0 0 100 100" className="h-20 w-full">
              <line x1="0" y1="50" x2="100" y2="50" className="stroke-border/60" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {driftLinePoints && (
                <polyline
                  fill="none"
                  points={driftLinePoints}
                  className="stroke-primary"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {markerEvents.map(({ event, index }) => {
                const x = driftWindow.length <= 1 ? 0 : (index / Math.max(1, driftWindow.length - 1)) * 100;
                return (
                  <line
                    key={`${event.type}-${event.sequence}`}
                    x1={x}
                    y1="8"
                    x2={x}
                    y2="92"
                    className={cn(event.type === 'source-switch' ? 'stroke-warning' : event.type === 'hard-sync' ? 'stroke-destructive' : 'stroke-success')}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </div>
        </div>

        <div className="bg-surface-0 rounded p-2 space-y-2 border border-border">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold">TIMECODE ANALYZER</div>
            <span className="text-[8px] font-mono-code text-muted-foreground">raw / filtered / clock</span>
          </div>
          <div className="relative rounded border border-border/40 bg-background/40 px-1 py-1">
            <svg viewBox="0 0 100 100" className="h-24 w-full">
              <line x1="0" y1="50" x2="100" y2="50" className="stroke-border/60" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {rawLinePoints && (
                <polyline fill="none" points={rawLinePoints} className="stroke-warning" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
              {filteredLinePoints && (
                <polyline fill="none" points={filteredLinePoints} className="stroke-primary" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              )}
              {clockLinePoints && (
                <polyline fill="none" points={clockLinePoints} className="stroke-success" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
              {markerEvents.map(({ event, index }) => {
                const x = rawWindow.length <= 1 ? 0 : (index / Math.max(1, rawWindow.length - 1)) * 100;
                return (
                  <line
                    key={`analyzer-${event.type}-${event.sequence}`}
                    x1={x}
                    y1="6"
                    x2={x}
                    y2="94"
                    className={cn(
                      event.type === 'source-switch' ? 'stroke-warning' : event.type === 'hard-sync' ? 'stroke-destructive' : event.type === 'drop' ? 'stroke-warning' : 'stroke-success'
                    )}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[8px] font-mono-code text-muted-foreground">
            <span className="text-warning">RAW LTC</span>
            <span className="text-primary">FILTERED</span>
            <span className="text-success">CLOCK OUT</span>
          </div>
        </div>

        <div className="bg-surface-0 rounded p-2 space-y-2 border border-border">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold">TRANSPORT EVENTS</div>
            <span className="text-[8px] font-mono-code text-muted-foreground">{ltcRuntime.getEvents().length} total</span>
          </div>
          <div className="space-y-1">
            {ltcEvents.length > 0 ? ltcEvents.map((event, index) => (
              <div key={`${event.type}-${index}`} className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-2 py-1 text-[8px] font-mono-code">
                <span className="text-foreground">{event.type}</span>
                <span className="text-muted-foreground">
                  {'from' in event ? `${event.from ?? '∅'} → ${event.to}` : 'rate' in event ? event.rate.toFixed(5) : 'frames' in event ? `${event.frames} frames` : 'reason' in event ? event.reason : 'freewheel'}
                </span>
              </div>
            )) : (
              <div className="text-[8px] font-mono-code text-muted-foreground">No transport events</div>
            )}
          </div>
        </div>

        <div className="bg-surface-0 rounded p-2 space-y-2 border border-border">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold">REPLAY LAB</div>
            <span className="text-[8px] font-mono-code text-muted-foreground">{replayFrames.length} recorded</span>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 flex-1 text-[9px] font-mono-code" onClick={handleReplay} disabled={replayFrames.length === 0 || replayPlaying}>
              Play
            </Button>
            <Button variant="outline" size="sm" className="h-7 flex-1 text-[9px] font-mono-code" onClick={handlePauseReplay} disabled={!replayPlaying}>
              Pause
            </Button>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 flex-1 text-[9px] font-mono-code" onClick={handleStepReplay} disabled={replayFrames.length === 0}>
              Step
            </Button>
            <Button variant="outline" size="sm" className="h-7 flex-1 text-[9px] font-mono-code" onClick={handleClearReplay} disabled={replayFrames.length === 0}>
              Clear Record
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-[8px] font-mono-code text-muted-foreground">Replay speed</Label>
            <Select value={replaySpeed} onValueChange={setReplaySpeed}>
              <SelectTrigger className="h-7 text-[9px] font-mono-code"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="1">1.0x</SelectItem>
                <SelectItem value="2">2.0x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-[8px] font-mono-code text-muted-foreground">
            Reaplica a trilha gravada sem recomputar Kalman/PLL, preservando saída determinística quadro a quadro.
          </div>
        </div>

        {/* LTC Signal */}
        {ltcSignal && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold flex items-center gap-1">
              <Radio className="w-3 h-3" /> LTC SIGNAL (80-bit SMPTE 12M)
            </div>
            <div className="bg-surface-0 rounded p-2 border border-border h-12 flex items-end gap-px overflow-hidden">
              {ltcSignal.biphase.slice(0, 80).map((v, i) => (
                <div key={i} className={cn("w-1 transition-all", v === 1 ? "bg-primary h-full" : "bg-muted h-1/3")} />
              ))}
            </div>
            <div className="text-[9px] font-mono-code text-muted-foreground">
              {ltcSignal.bits.length} bits • {ltcSignal.audioSamples.length} samples @ 48kHz
            </div>
          </div>
        )}

        {/* MTC quarter frames */}
        {mtcFrames.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold flex items-center gap-1">
              <Zap className="w-3 h-3" /> MTC QUARTER FRAMES
            </div>
            <div className="grid grid-cols-4 gap-1">
              {mtcFrames.map((qf, i) => (
                <div key={i} className="bg-surface-0 rounded p-1 border border-border text-center">
                  <div className="text-[9px] font-mono-code text-muted-foreground">QF{qf.piece}</div>
                  <div className="text-[10px] font-mono-code text-foreground font-bold">0x{qf.nibble.toString(16).toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Protocol info */}
        <div className="bg-surface-0 rounded p-2 border border-border space-y-1">
          <div className="text-[10px] font-mono-code text-muted-foreground font-bold">PROTOCOL INFO</div>
          <div className="text-[8px] font-mono-code text-muted-foreground space-y-0.5">
            <div>• SMPTE 12M-2 Linear Timecode (LTC)</div>
            <div>• MTC: MIDI 1.0 Quarter-Frame (F1 xx)</div>
            <div>• WebSocket relay for external generators</div>
            <div>• Chase modes: Tight / Smooth / Freewheel / External Master</div>
            <div>• Transport: Play / Stop / Locate</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between text-[10px] font-mono-code">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(warn ? "text-warning" : "text-foreground")}>{value}</span>
    </div>
  );
}
