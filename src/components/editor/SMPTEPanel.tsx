import { useEffect, useRef, useState } from 'react';
import { X, Clock, Radio, Play, Square, RotateCcw, Zap, Volume2, VolumeX, Link2, Unlink2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useProjectStore } from '@/store/useProjectStore';
import { formatTimecode, encodeTimecodeToLTC, generateMTCQuarterFrames, secondsToTimecode, type SMPTEFrameRate } from '@/lib/smpteEngine';

interface SMPTEPanelProps {
  onClose: () => void;
}

export default function SMPTEPanel({ onClose }: SMPTEPanelProps) {
  const store = useSMPTEStore();
  const { currentTime, isPlaying } = useProjectStore();
  const [startTcInput, setStartTcInput] = useState('01:00:00:00');

  // Derive display TC from current time + offset
  const offsetTime = currentTime + store.startTimecodeSeconds;
  const tc = secondsToTimecode(offsetTime, store.frameRate, store.frameRate === 29.97);
  const tcStr = formatTimecode(tc);
  const ltcSignal = store.running ? encodeTimecodeToLTC(tc) : null;
  const mtcFrames = store.running ? generateMTCQuarterFrames(tc) : [];

  // Initialize start TC input
  useEffect(() => {
    const stc = secondsToTimecode(store.startTimecodeSeconds, store.frameRate, false);
    setStartTcInput(formatTimecode(stc));
  }, [store.startTimecodeSeconds, store.frameRate]);

  const handleStartTcBlur = () => {
    store.setStartTimecode(startTcInput);
  };

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono-code font-bold text-foreground">SMPTE / LTC / MTC</span>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="w-3 h-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Big timecode display */}
        <div className="bg-surface-0 rounded-lg p-4 border border-border text-center">
          <span className="font-mono-code text-2xl font-bold tracking-[0.15em] text-primary">
            {tcStr}
          </span>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              store.locked ? "bg-success animate-pulse" : store.running ? "bg-warning animate-pulse" : "bg-destructive"
            )} />
            <span className="text-[10px] font-mono-code text-muted-foreground">
              {store.locked ? 'LOCKED' : store.running ? 'SYNCING' : 'IDLE'}
            </span>
            <span className="text-[10px] font-mono-code text-muted-foreground">
              {store.frameRate}fps{tc.dropFrame ? ' DF' : ' NDF'}
            </span>
          </div>
          {/* Secondary: project time */}
          <div className="text-[9px] font-mono-code text-muted-foreground mt-1">
            Project: {currentTime.toFixed(2)}s | Offset: +{store.startTimecodeSeconds.toFixed(1)}s
          </div>
        </div>

        {/* Transport */}
        <div className="flex items-center gap-1 justify-center">
          <Button
            variant={store.running ? "default" : "outline"}
            size="sm"
            className="h-7 text-[10px] font-mono-code gap-1"
            onClick={() => store.setRunning(!store.running)}
          >
            {store.running ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {store.running ? 'STOP' : 'START'}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] font-mono-code gap-1" onClick={store.reset}>
            <RotateCcw className="w-3 h-3" /> RESET
          </Button>
        </div>

        {/* Auto-follow toggle */}
        <div className="bg-surface-0 rounded p-2 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {store.autoFollow ? <Link2 className="w-3 h-3 text-primary" /> : <Unlink2 className="w-3 h-3 text-muted-foreground" />}
              <Label className="text-[10px] font-mono-code text-foreground">Auto-Follow Playback</Label>
            </div>
            <Switch checked={store.autoFollow} onCheckedChange={store.setAutoFollow} className="scale-75" />
          </div>
          <div className="text-[8px] text-muted-foreground leading-tight">
            {store.autoFollow ? 'SMPTE starts/stops with project playback' : 'Manual control only'}
          </div>
        </div>

        {/* Start timecode */}
        <div className="space-y-1">
          <Label className="text-[10px] font-mono-code text-muted-foreground flex items-center gap-1">
            <Timer className="w-3 h-3" /> START TIMECODE
          </Label>
          <Input
            value={startTcInput}
            onChange={e => setStartTcInput(e.target.value)}
            onBlur={handleStartTcBlur}
            onKeyDown={e => e.key === 'Enter' && handleStartTcBlur()}
            className="h-7 text-xs font-mono-code tracking-wider"
            placeholder="01:00:00:00"
          />
          <div className="flex gap-1">
            {['00:00:00:00', '01:00:00:00', '10:00:00:00', '23:00:00:00'].map(preset => (
              <button
                key={preset}
                onClick={() => { setStartTcInput(preset); store.setStartTimecode(preset); }}
                className="text-[8px] font-mono-code text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/30 hover:border-primary/40 transition-colors"
              >
                {preset.slice(0, 5)}
              </button>
            ))}
          </div>
        </div>

        {/* Configuration */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-mono-code text-muted-foreground">SYNC MODE</Label>
            <Select value={store.mode} onValueChange={(v) => store.setMode(v as any)}>
              <SelectTrigger className="h-7 text-xs font-mono-code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="master">Master (generate TC)</SelectItem>
                <SelectItem value="slave">Slave (receive TC)</SelectItem>
                <SelectItem value="freerun">Free Run</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-mono-code text-muted-foreground">FRAME RATE</Label>
            <Select
              value={String(store.frameRate)}
              onValueChange={(v) => store.setFrameRate(Number(v) as SMPTEFrameRate)}
            >
              <SelectTrigger className="h-7 text-xs font-mono-code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 fps (Film)</SelectItem>
                <SelectItem value="25">25 fps (PAL / EBU)</SelectItem>
                <SelectItem value="29.97">29.97 fps (NTSC DF)</SelectItem>
                <SelectItem value="30">30 fps (SMPTE NDF)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* LTC Audio Output */}
        <div className="bg-surface-0 rounded p-2 border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {store.ltcAudioEnabled ? <Volume2 className="w-3 h-3 text-primary" /> : <VolumeX className="w-3 h-3 text-muted-foreground" />}
              <Label className="text-[10px] font-mono-code text-foreground">LTC Audio Output</Label>
            </div>
            <Switch checked={store.ltcAudioEnabled} onCheckedChange={store.setLtcAudioEnabled} className="scale-75" />
          </div>
          <div className="text-[8px] text-muted-foreground leading-tight">
            Generates SMPTE 12M LTC audio signal on default output at 48kHz
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
          <MetricRow label="Auto-Follow" value={store.autoFollow ? 'ON' : 'OFF'} />
        </div>

        {/* LTC Signal visualization */}
        {ltcSignal && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold flex items-center gap-1">
              <Radio className="w-3 h-3" /> LTC SIGNAL (80-bit SMPTE 12M)
            </div>
            <div className="bg-surface-0 rounded p-2 border border-border h-12 flex items-end gap-px overflow-hidden">
              {ltcSignal.biphase.slice(0, 80).map((v, i) => (
                <div
                  key={i}
                  className={cn("w-1 transition-all", v === 1 ? "bg-primary h-full" : "bg-muted h-1/3")}
                />
              ))}
            </div>
            <div className="text-[9px] font-mono-code text-muted-foreground">
              {ltcSignal.bits.length} bits • {ltcSignal.audioSamples.length} samples @ 48kHz • Biphase-Mark
            </div>
          </div>
        )}

        {/* MTC quarter frames */}
        {mtcFrames.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold flex items-center gap-1">
              <Zap className="w-3 h-3" /> MTC QUARTER FRAMES (MIDI F1)
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
            <div>• SMPTE 12M-2 (2008) Linear Timecode</div>
            <div>• Manchester / Biphase-Mark encoding</div>
            <div>• MTC: MIDI 1.0 Specification (F1 xx)</div>
            <div>• Drop-Frame: SMPTE 12M Annex A (29.97fps)</div>
            <div>• Supported: 24/25/29.97df/30 fps</div>
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
