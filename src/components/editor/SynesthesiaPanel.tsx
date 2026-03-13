import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Music, Zap, Play, RefreshCw, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import { analyzeAudio, suggestFormationTimes, type AudioAnalysisResult, type Beat, type Onset, type FrequencyBand } from '@/lib/audioAnalyzer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SyncMode = 'beat-snap' | 'onset-trigger' | 'frequency-map';

export default function SynesthesiaPanel({ onClose }: { onClose: () => void }) {
  const [analysis, setAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>('beat-snap');
  const [sensitivity, setSensitivity] = useState(0.6);
  const [minHold, setMinHold] = useState(4);
  const [autoColor, setAutoColor] = useState(true);

  const audioUrl = useProjectStore((s) => s.audioUrl);
  const bpm = useProjectStore((s) => s.bpm);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const addDroneFormation = useProjectStore((s) => s.addDroneFormation);
  const updateDroneFormation = useProjectStore((s) => s.updateDroneFormation);
  const duration = useProjectStore((s) => s.duration);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Analyze audio
  const runAnalysis = useCallback(async () => {
    if (!audioUrl) {
      toast.error('Carregue um áudio primeiro');
      return;
    }
    setAnalyzing(true);
    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const result = await analyzeAudio(audioBuffer);
      setAnalysis(result);
      toast.success(`Análise completa`, {
        description: `${result.bpm} BPM · ${result.beats.length} beats · ${result.onsets.length} onsets`,
      });
    } catch (e: any) {
      toast.error('Erro na análise: ' + (e.message || 'desconhecido'));
    } finally {
      setAnalyzing(false);
    }
  }, [audioUrl]);

  // Draw visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'hsl(240 6% 8%)';
    ctx.fillRect(0, 0, w, h);

    const dur = analysis.duration;
    const timeToX = (t: number) => (t / dur) * w;

    // Frequency bands (background heatmap)
    analysis.frequencies.forEach((f) => {
      const x = timeToX(f.time);
      const bw = Math.max(2, w / analysis.frequencies.length);
      
      // Low = red, mid = green, high = blue
      const maxE = Math.max(f.low, f.mid, f.high, 0.001);
      ctx.fillStyle = `rgba(${Math.floor(f.low / maxE * 200)}, ${Math.floor(f.mid / maxE * 150)}, ${Math.floor(f.high / maxE * 255)}, 0.3)`;
      ctx.fillRect(x, 0, bw, h);
    });

    // Beats
    analysis.beats.forEach((b) => {
      const x = timeToX(b.time);
      ctx.strokeStyle = `hsla(24, 95%, 53%, ${0.3 + b.strength * 0.5})`;
      ctx.lineWidth = b.strength > 0.6 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });

    // Onsets
    const onsetColors: Record<string, string> = {
      kick: 'hsl(0, 80%, 55%)',
      snare: 'hsl(45, 90%, 60%)',
      'hi-hat': 'hsl(180, 80%, 60%)',
      transient: 'hsl(270, 60%, 60%)',
    };
    analysis.onsets.forEach((o) => {
      const x = timeToX(o.time);
      const y = h - (o.energy * h * 3);
      ctx.fillStyle = onsetColors[o.type] || 'white';
      ctx.beginPath();
      ctx.arc(x, Math.max(4, y), 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Peak times
    analysis.peakTimes.forEach((t) => {
      const x = timeToX(t);
      ctx.strokeStyle = 'hsla(207, 90%, 54%, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Legend
    ctx.font = '9px monospace';
    ctx.fillStyle = 'hsl(0, 80%, 55%)';
    ctx.fillText('● Kick', 4, h - 28);
    ctx.fillStyle = 'hsl(45, 90%, 60%)';
    ctx.fillText('● Snare', 4, h - 18);
    ctx.fillStyle = 'hsl(180, 80%, 60%)';
    ctx.fillText('● Hi-hat', 4, h - 8);
    ctx.fillStyle = 'hsl(24, 95%, 53%)';
    ctx.fillText('| Beat', 60, h - 8);
  }, [analysis]);

  // Beat Snap: align existing formations to beats
  const applyBeatSnap = useCallback(() => {
    if (!analysis || droneFormations.length === 0) {
      toast.error('Precisa de análise de áudio e formações');
      return;
    }

    droneFormations.forEach((f) => {
      const nearestBeat = analysis.beats.reduce((best, b) =>
        Math.abs(b.time - f.startTime) < Math.abs(best.time - f.startTime) ? b : best,
        analysis.beats[0],
      );
      if (nearestBeat && Math.abs(nearestBeat.time - f.startTime) < 2) {
        updateDroneFormation(f.id, { startTime: nearestBeat.time });
      }
    });
    toast.success('Formações alinhadas aos beats');
  }, [analysis, droneFormations, updateDroneFormation]);

  // Onset Trigger: generate formation change markers at strong onsets
  const applyOnsetTrigger = useCallback(() => {
    if (!analysis) return;

    const strongOnsets = analysis.onsets
      .filter((o) => o.energy > sensitivity * 0.1)
      .filter((o, i, arr) => i === 0 || o.time - arr[i - 1].time > minHold);

    if (droneFormations.length === 0) {
      toast.info(`${strongOnsets.length} pontos de transição identificados`, {
        description: 'Adicione formações e aplique novamente para sincronizar.',
      });
      return;
    }

    // Re-time existing formations to onset points
    const times = strongOnsets.slice(0, droneFormations.length);
    times.forEach((onset, i) => {
      if (i < droneFormations.length) {
        updateDroneFormation(droneFormations[i].id, { startTime: onset.time });
      }
    });
    toast.success(`${times.length} formações sincronizadas com onsets`);
  }, [analysis, sensitivity, minHold, droneFormations, updateDroneFormation]);

  // Frequency Map: auto-color formations based on dominant frequency at their start time
  const applyFrequencyMap = useCallback(() => {
    if (!analysis || droneFormations.length === 0) return;

    droneFormations.forEach((f) => {
      const nearestFreq = analysis.frequencies.reduce((best, freq) =>
        Math.abs(freq.time - f.startTime) < Math.abs(best.time - f.startTime) ? freq : best,
        analysis.frequencies[0],
      );
      if (!nearestFreq) return;

      const total = nearestFreq.low + nearestFreq.mid + nearestFreq.high + 0.001;
      const r = Math.floor((nearestFreq.low / total) * 255);
      const g = Math.floor((nearestFreq.mid / total) * 200);
      const b = Math.floor((nearestFreq.high / total) * 255);
      const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      updateDroneFormation(f.id, { color });
    });
    toast.success('Cores mapeadas por frequência');
  }, [analysis, droneFormations, updateDroneFormation]);

  // Auto-suggest formation times
  const autoSuggest = useCallback(() => {
    if (!analysis) return;
    const count = Math.max(droneFormations.length, 4);
    const suggestions = suggestFormationTimes(analysis, count, minHold);

    if (droneFormations.length > 0) {
      suggestions.slice(0, droneFormations.length).forEach((s, i) => {
        updateDroneFormation(droneFormations[i].id, {
          startTime: s.startTime,
          holdDuration: s.holdDuration,
        });
      });
      toast.success(`${Math.min(suggestions.length, droneFormations.length)} formações re-temporizadas`);
    } else {
      toast.info(`${suggestions.length} timings sugeridos`, {
        description: suggestions.map((s, i) => `F${i + 1}: ${s.startTime.toFixed(1)}s`).join(' · '),
      });
    }
  }, [analysis, droneFormations, minHold, updateDroneFormation]);

  const handleApply = () => {
    if (syncMode === 'beat-snap') applyBeatSnap();
    else if (syncMode === 'onset-trigger') applyOnsetTrigger();
    else if (syncMode === 'frequency-map') applyFrequencyMap();
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            Synesthesia
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Analyze button */}
        <Button
          onClick={runAnalysis}
          disabled={analyzing || !audioUrl}
          variant="outline"
          size="sm"
          className="w-full h-7 text-[9px] gap-1"
        >
          {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
          {analyzing ? 'Analisando...' : audioUrl ? 'Analisar Áudio' : 'Carregue áudio primeiro'}
        </Button>

        {/* Analysis result */}
        {analysis && (
          <>
            <div className="grid grid-cols-3 gap-1 text-center">
              {[
                { label: 'BPM', value: analysis.bpm },
                { label: 'Beats', value: analysis.beats.length },
                { label: 'Onsets', value: analysis.onsets.length },
              ].map(({ label, value }) => (
                <div key={label} className="p-1 rounded-sm bg-surface-2 border border-border/50">
                  <div className="text-[10px] font-mono-code text-primary font-bold">{value}</div>
                  <div className="text-[7px] text-muted-foreground uppercase">{label}</div>
                </div>
              ))}
            </div>

            {/* Onset breakdown */}
            <div className="flex gap-1 text-[8px]">
              {['kick', 'snare', 'hi-hat', 'transient'].map((type) => {
                const count = analysis.onsets.filter((o) => o.type === type).length;
                const colors: Record<string, string> = { kick: 'text-red-400', snare: 'text-yellow-400', 'hi-hat': 'text-cyan-400', transient: 'text-purple-400' };
                return (
                  <span key={type} className={cn("font-mono-code", colors[type])}>
                    {type}: {count}
                  </span>
                );
              })}
            </div>

            {/* Visualization */}
            <canvas
              ref={canvasRef}
              width={240}
              height={80}
              className="w-full rounded-sm border border-border"
            />

            {/* Sync mode */}
            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Modo de Sincronização</span>
              {([
                { id: 'beat-snap' as SyncMode, label: 'Beat Snap', desc: 'Alinha formações ao beat mais próximo', icon: Zap },
                { id: 'onset-trigger' as SyncMode, label: 'Onset Trigger', desc: 'Sincroniza transições com kicks/snares', icon: Music },
                { id: 'frequency-map' as SyncMode, label: 'Frequency Map', desc: 'Mapeia cores por banda de frequência', icon: BarChart3 },
              ]).map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSyncMode(id)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-sm text-left transition-colors text-[9px] border",
                    syncMode === id
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-transparent hover:bg-surface-3 text-muted-foreground"
                  )}
                >
                  <Icon className="w-3 h-3 flex-shrink-0" />
                  <div>
                    <div className="font-semibold">{label}</div>
                    <div className="text-[7px] text-muted-foreground">{desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Sensitivity */}
            {syncMode === 'onset-trigger' && (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-[9px] text-muted-foreground font-semibold uppercase">Sensibilidade</span>
                  <span className="text-[9px] font-mono-code text-foreground">{(sensitivity * 100).toFixed(0)}%</span>
                </div>
                <Slider value={[sensitivity]} onValueChange={([v]) => setSensitivity(v)} min={0.1} max={1} step={0.05} />
              </div>
            )}

            {/* Min hold */}
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase">Hold Mínimo</span>
                <span className="text-[9px] font-mono-code text-foreground">{minHold}s</span>
              </div>
              <Slider value={[minHold]} onValueChange={([v]) => setMinHold(v)} min={2} max={15} step={0.5} />
            </div>

            {/* Action buttons */}
            <div className="flex gap-1">
              <Button onClick={handleApply} size="sm" className="flex-1 h-7 text-[9px] gap-1">
                <Zap className="w-3 h-3" />
                Aplicar
              </Button>
              <Button onClick={autoSuggest} variant="outline" size="sm" className="flex-1 h-7 text-[9px] gap-1">
                <RefreshCw className="w-3 h-3" />
                Auto-Timing
              </Button>
            </div>

            {/* Info */}
            <div className="text-[8px] text-muted-foreground space-y-0.5 p-1.5 bg-surface-1 rounded-sm border border-border/50">
              <p><strong>Beat Snap:</strong> Alinha startTime de cada formação ao beat mais próximo.</p>
              <p><strong>Onset Trigger:</strong> Re-posiciona formações em kicks/snares fortes.</p>
              <p><strong>Frequency Map:</strong> Pinta cada formação com a cor dominante (grave=vermelho, médio=verde, agudo=azul).</p>
              <p><strong>Auto-Timing:</strong> Sugere tempos ideais baseado em picos de energia.</p>
            </div>
          </>
        )}

        {!analysis && !analyzing && (
          <div className="text-center py-6 space-y-2">
            <Music className="w-8 h-8 mx-auto text-muted-foreground/30" />
            <p className="text-[9px] text-muted-foreground">
              Carregue um áudio na timeline e clique "Analisar" para detectar beats, onsets e frequências.
            </p>
            <p className="text-[8px] text-muted-foreground/60">
              Motor baseado em ConstantQ NRT + Onset Detection com classificação espectral (kick/snare/hi-hat).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
