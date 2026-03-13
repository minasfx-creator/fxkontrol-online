import { useEffect, useRef } from 'react';
import { X, Clock, Radio, Play, Square, RotateCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useProjectStore } from '@/store/useProjectStore';
import { formatTimecode, encodeTimecodeToLTC, generateMTCQuarterFrames, type SMPTEFrameRate } from '@/lib/smpteEngine';

interface SMPTEPanelProps {
  onClose: () => void;
}

export default function SMPTEPanel({ onClose }: SMPTEPanelProps) {
  const store = useSMPTEStore();
  const { currentTime, isPlaying } = useProjectStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick sync engine
  useEffect(() => {
    if (!store.running) return;
    intervalRef.current = setInterval(() => {
      const t = useProjectStore.getState().currentTime;
      const external = store.mode === 'slave' ? t + (Math.random() - 0.5) * 0.002 : undefined;
      store.tick(t, external);
    }, 33); // ~30Hz
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [store.running, store.mode]);

  const tc = store.timecode;
  const tcStr = formatTimecode(tc);
  const ltcSignal = store.running ? encodeTimecodeToLTC(tc) : null;
  const mtcFrames = store.running ? generateMTCQuarterFrames(tc) : [];

  return (
    <div className="h-full bg-surface-1 border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs font-mono-code font-bold text-foreground">SMPTE / LTC</span>
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
              store.locked ? "bg-success animate-pulse" : "bg-destructive"
            )} />
            <span className="text-[10px] font-mono-code text-muted-foreground">
              {store.locked ? 'LOCKED' : 'UNLOCKED'}
            </span>
            <span className="text-[10px] font-mono-code text-muted-foreground">
              {store.frameRate}fps{tc.dropFrame ? ' DF' : ' NDF'}
            </span>
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

        {/* Configuration */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-[10px] font-mono-code text-muted-foreground">SYNC MODE</Label>
            <Select value={store.mode} onValueChange={(v) => store.setMode(v as any)}>
              <SelectTrigger className="h-7 text-xs font-mono-code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="master">Master (generate)</SelectItem>
                <SelectItem value="slave">Slave (receive)</SelectItem>
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
                <SelectItem value="25">25 fps (PAL)</SelectItem>
                <SelectItem value="29.97">29.97 fps (NTSC DF)</SelectItem>
                <SelectItem value="30">30 fps (NDF)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sync metrics */}
        <div className="bg-surface-0 rounded p-2 space-y-1 border border-border">
          <div className="text-[10px] font-mono-code text-muted-foreground font-bold mb-1">SYNC METRICS</div>
          <MetricRow label="Offset" value={`${store.offset.toFixed(2)} ms`} warn={Math.abs(store.offset) > 1} />
          <MetricRow label="Jitter" value={`±${Math.abs(store.jitter).toFixed(2)} ms`} warn={Math.abs(store.jitter) > 0.4} />
          <MetricRow label="Drift" value={`${store.drift.toFixed(1)} ppm`} warn={Math.abs(store.drift) > 5} />
          <MetricRow label="Mode" value={store.mode.toUpperCase()} />
        </div>

        {/* LTC Signal visualization */}
        {ltcSignal && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono-code text-muted-foreground font-bold flex items-center gap-1">
              <Radio className="w-3 h-3" /> LTC SIGNAL
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
