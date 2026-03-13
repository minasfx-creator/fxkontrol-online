import { useState, useMemo, useRef, useEffect } from 'react';
import { Volume2, X, AlertTriangle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import {
  analyzeSoundLevels,
  DEFAULT_ANALYSIS_CONFIG,
  type AnalysisConfig,
  type SoundLevelResult,
} from '@/lib/soundLevelEngine';
import { cn } from '@/lib/utils';

function extractCaliberFromName(name: string): number {
  const m = name.match(/(\d+)(?:in|")/);
  return m ? parseInt(m[1]) : 3;
}

function MiniChart({ result, currentTime, config }: {
  result: SoundLevelResult;
  currentTime: number;
  config: AnalysisConfig;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || result.frames.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = 'hsl(220, 20%, 8%)';
    ctx.fillRect(0, 0, w, h);

    const minDB = 30;
    const maxDB = 170;
    const dbRange = maxDB - minDB;
    const dur = result.duration;

    // Grid lines
    ctx.strokeStyle = 'hsla(220, 10%, 30%, 0.4)';
    ctx.lineWidth = 0.5;
    for (let db = 40; db <= 160; db += 20) {
      const y = h - ((db - minDB) / dbRange) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillStyle = 'hsl(220, 10%, 40%)';
      ctx.font = '8px monospace';
      ctx.fillText(`${db}`, 2, y - 2);
    }

    // Regulatory limit line
    const limitY = h - ((config.regulatoryLimit - minDB) / dbRange) * h;
    ctx.strokeStyle = 'hsla(0, 80%, 55%, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, limitY);
    ctx.lineTo(w, limitY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'hsl(0, 80%, 55%)';
    ctx.font = '7px monospace';
    ctx.fillText(`LIMIT ${config.regulatoryLimit}dB`, w - 55, limitY - 3);

    // dB(A) curve - filled gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'hsla(0, 85%, 55%, 0.8)');
    gradient.addColorStop(0.3, 'hsla(30, 90%, 55%, 0.6)');
    gradient.addColorStop(0.6, 'hsla(120, 70%, 45%, 0.4)');
    gradient.addColorStop(1, 'hsla(200, 70%, 40%, 0.1)');

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (const frame of result.frames) {
      const x = (frame.time / dur) * w;
      const y = h - ((frame.dbA - minDB) / dbRange) * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // dB(A) line
    ctx.strokeStyle = 'hsl(30, 90%, 60%)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < result.frames.length; i++) {
      const frame = result.frames[i];
      const x = (frame.time / dur) * w;
      const y = h - ((frame.dbA - minDB) / dbRange) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // dB(C) line
    ctx.strokeStyle = 'hsla(200, 80%, 60%, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 0; i < result.frames.length; i++) {
      const frame = result.frames[i];
      const x = (frame.time / dur) * w;
      const y = h - ((frame.dbC - minDB) / dbRange) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Playhead
    const phX = (currentTime / dur) * w;
    ctx.strokeStyle = 'hsl(0, 0%, 100%)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(phX, 0);
    ctx.lineTo(phX, h);
    ctx.stroke();

    // Current dB readout at playhead
    const frameIdx = Math.min(
      Math.floor((currentTime / dur) * result.frames.length),
      result.frames.length - 1
    );
    if (frameIdx >= 0 && frameIdx < result.frames.length) {
      const f = result.frames[frameIdx];
      ctx.fillStyle = 'hsl(0, 0%, 100%)';
      ctx.font = 'bold 10px monospace';
      const textX = phX + 4 > w - 40 ? phX - 44 : phX + 4;
      ctx.fillText(`${f.dbA.toFixed(1)} dB(A)`, textX, 14);
    }

    // Legend
    ctx.font = '7px monospace';
    ctx.fillStyle = 'hsl(30, 90%, 60%)';
    ctx.fillText('● dB(A)', w - 70, h - 14);
    ctx.fillStyle = 'hsl(200, 80%, 60%)';
    ctx.fillText('● dB(C)', w - 70, h - 5);

  }, [result, currentTime, config]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded border border-border"
      style={{ height: 160 }}
    />
  );
}

export default function SoundLevelPanel({ onClose }: { onClose: () => void }) {
  const { timelineItems, duration, currentTime } = useProjectStore();
  const [distance, setDistance] = useState(DEFAULT_ANALYSIS_CONFIG.measurementDistance);
  const [limit, setLimit] = useState(DEFAULT_ANALYSIS_CONFIG.regulatoryLimit);
  const [showC, setShowC] = useState(true);
  const [decayMs, setDecayMs] = useState(DEFAULT_ANALYSIS_CONFIG.burstDecayMs);

  const config: AnalysisConfig = useMemo(() => ({
    ...DEFAULT_ANALYSIS_CONFIG,
    measurementDistance: distance,
    regulatoryLimit: limit,
    burstDecayMs: decayMs,
  }), [distance, limit, decayMs]);

  const result = useMemo<SoundLevelResult>(() => {
    const effects = timelineItems.map(item => {
      const eff = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      return {
        startTime: item.startTime,
        effectName: eff?.name ?? 'Unknown',
        caliber: eff ? extractCaliberFromName(eff.name) : 3,
        duration: eff?.duration ?? 2,
        position: item.position,
        hasCrackle: eff?.name?.toLowerCase().includes('crackle'),
        hasReport: eff?.name?.toLowerCase().includes('report'),
        hasWhistle: eff?.name?.toLowerCase().includes('whistle'),
      };
    }).filter(e => e.caliber > 0);

    return analyzeSoundLevels(effects, duration, config);
  }, [timelineItems, duration, config]);

  const currentFrameIdx = Math.min(
    Math.floor((currentTime / duration) * result.frames.length),
    result.frames.length - 1
  );
  const currentFrame = result.frames[currentFrameIdx];

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <Volume2 className="h-3.5 w-3.5 text-primary" />
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider flex-1">Sound Level</h2>
        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* Current readout */}
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-surface-2 rounded p-1.5 text-center">
            <div className="text-[8px] text-muted-foreground font-mono-code uppercase">dB(A)</div>
            <div className={cn(
              "text-sm font-bold font-mono-code",
              currentFrame && currentFrame.dbA > limit ? "text-destructive" : "text-foreground"
            )}>
              {currentFrame ? currentFrame.dbA.toFixed(1) : '--'}
            </div>
          </div>
          <div className="bg-surface-2 rounded p-1.5 text-center">
            <div className="text-[8px] text-muted-foreground font-mono-code uppercase">Peak</div>
            <div className="text-sm font-bold font-mono-code text-accent">
              {result.peakDB.toFixed(1)}
            </div>
          </div>
          <div className="bg-surface-2 rounded p-1.5 text-center">
            <div className="text-[8px] text-muted-foreground font-mono-code uppercase">Leq</div>
            <div className="text-sm font-bold font-mono-code text-primary">
              {result.leq.toFixed(1)}
            </div>
          </div>
        </div>

        {/* Chart */}
        <MiniChart result={result} currentTime={currentTime} config={config} />

        {/* Exceedances */}
        {result.exceedances.length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <AlertTriangle className="w-3 h-3 text-destructive" />
              <span className="text-[9px] font-semibold text-destructive uppercase">
                {result.exceedances.length} Exceedance{result.exceedances.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-0.5 max-h-16 overflow-y-auto">
              {result.exceedances.slice(0, 10).map((ex, i) => (
                <div key={i} className="text-[8px] font-mono-code text-muted-foreground">
                  {ex.time.toFixed(1)}s → {ex.db.toFixed(1)} dB(A) (limit: {ex.limit})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Config */}
        <div className="space-y-2">
          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Measurement Distance: {distance}m
            </label>
            <Slider
              value={[distance]}
              onValueChange={([v]) => setDistance(v)}
              min={10} max={500} step={10}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Regulatory Limit: {limit} dB(A)
            </label>
            <Slider
              value={[limit]}
              onValueChange={([v]) => setLimit(v)}
              min={80} max={150} step={5}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
              Burst Decay: {decayMs}ms
            </label>
            <Slider
              value={[decayMs]}
              onValueChange={([v]) => setDecayMs(v)}
              min={200} max={2000} step={50}
              className="mt-1"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="bg-surface-2 rounded p-2 space-y-1">
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <BarChart3 className="w-3 h-3" /> Analysis Stats
          </div>
          <div className="grid grid-cols-2 gap-1 text-[8px] font-mono-code">
            <span className="text-muted-foreground">Peak dB(A)</span>
            <span className="text-foreground">{result.peakDB.toFixed(1)} @ {result.peakTime.toFixed(1)}s</span>
            <span className="text-muted-foreground">Leq</span>
            <span className="text-foreground">{result.leq.toFixed(1)} dB(A)</span>
            <span className="text-muted-foreground">Effects</span>
            <span className="text-foreground">{timelineItems.length} items</span>
            <span className="text-muted-foreground">Duration</span>
            <span className="text-foreground">{duration.toFixed(1)}s</span>
            <span className="text-muted-foreground">Exceedances</span>
            <span className={cn(
              result.exceedances.length > 0 ? "text-destructive" : "text-success"
            )}>
              {result.exceedances.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
