import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Music, Zap, Play, RefreshCw, Loader2, BarChart3, Flame, Target, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, type DroneFormation, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { analyzeAudio, suggestFormationTimes, type AudioAnalysisResult, type Beat, type Onset, type FrequencyBand } from '@/lib/audioAnalyzer';
import { generateCuePlacements, ONSET_EFFECT_MAP, type CuePlacement } from '@/lib/musicReactiveEngine';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type SyncMode = 'beat-snap' | 'onset-trigger' | 'frequency-map';
type TabMode = 'formations' | 'cues';

export default function SynesthesiaPanel({ onClose }: { onClose: () => void }) {
  const [analysis, setAnalysis] = useState<AudioAnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>('beat-snap');
  const [sensitivity, setSensitivity] = useState(0.6);
  const [minHold, setMinHold] = useState(4);
  const [autoColor, setAutoColor] = useState(true);
  const [tabMode, setTabMode] = useState<TabMode>('cues');

  // Cue placement settings
  const [cueMode, setCueMode] = useState<'beats' | 'onsets' | 'peaks' | 'combined'>('combined');
  const [beatDivisor, setBeatDivisor] = useState(4);
  const [cueSensitivity, setCueSensitivity] = useState(0.7);
  const [minCueInterval, setMinCueInterval] = useState(0.5);
  const [distributePositions, setDistributePositions] = useState(true);
  const [distributeEffects, setDistributeEffects] = useState(false);
  const [selectedOnsetTypes, setSelectedOnsetTypes] = useState<Onset['type'][]>(['kick', 'snare']);
  const [previewPlacements, setPreviewPlacements] = useState<CuePlacement[]>([]);

  const audioUrl = useProjectStore((s) => s.audioUrl);
  const bpm = useProjectStore((s) => s.bpm);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const addDroneFormation = useProjectStore((s) => s.addDroneFormation);
  const updateDroneFormation = useProjectStore((s) => s.updateDroneFormation);
  const duration = useProjectStore((s) => s.duration);
  const positions = useProjectStore((s) => s.positions);
  const addTimelineItem = useProjectStore((s) => s.addTimelineItem);

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

    // Preview cue placements
    if (previewPlacements.length > 0) {
      previewPlacements.forEach((p) => {
        const x = timeToX(p.time);
        ctx.fillStyle = 'hsla(142, 76%, 55%, 0.8)';
        ctx.beginPath();
        ctx.moveTo(x, h - 2);
        ctx.lineTo(x - 3, h - 8);
        ctx.lineTo(x + 3, h - 8);
        ctx.closePath();
        ctx.fill();
      });
    }

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
    if (previewPlacements.length > 0) {
      ctx.fillStyle = 'hsl(142, 76%, 55%)';
      ctx.fillText(`▲ ${previewPlacements.length} cues`, 110, h - 8);
    }
  }, [analysis, previewPlacements]);

  // Preview cue placements
  const previewCues = useCallback(() => {
    if (!analysis) return;
    const pyroEffects = EFFECT_LIBRARY.filter(e => e.type === 'firework');
    const pyroPositions = positions.filter(p => p.type === 'pyro');

    const placements = generateCuePlacements(analysis, {
      mode: cueMode,
      effectIds: pyroEffects.slice(0, 8).map(e => e.id),
      positionIds: pyroPositions.map(p => p.id),
      minInterval: minCueInterval,
      sensitivity: cueSensitivity,
      startTime: 0,
      endTime: analysis.duration,
      beatDivisor,
      onsetTypes: selectedOnsetTypes,
      distributePositions,
      distributeEffects,
    });

    setPreviewPlacements(placements);
    toast.info(`${placements.length} cues geradas (preview)`);
  }, [analysis, cueMode, minCueInterval, cueSensitivity, beatDivisor, selectedOnsetTypes, positions, distributePositions, distributeEffects]);

  // Apply cue placements to timeline
  const applyCuePlacements = useCallback(() => {
    if (previewPlacements.length === 0) {
      toast.error('Gere um preview primeiro');
      return;
    }

    useUndoStore.getState().checkpoint();
    const pyroPositions = positions.filter(p => p.type === 'pyro');

    previewPlacements.forEach((p, i) => {
      const pos = p.positionId
        ? positions.find(pp => pp.id === p.positionId)
        : pyroPositions[i % Math.max(1, pyroPositions.length)];

      addTimelineItem({
        id: `tl-sync-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        effectId: p.effectId,
        startTime: p.time,
        trackIndex: 0,
        position: pos ? { x: pos.x, y: pos.y, z: pos.z } : { x: 0, y: 0, z: 0 },
        positionId: pos?.id,
        notes: `Auto-sync: ${p.source}${p.onsetType ? ` (${p.onsetType})` : ''} · str:${p.strength.toFixed(2)}`,
      });
    });

    toast.success(`${previewPlacements.length} cues adicionados à timeline`, {
      description: 'Use Ctrl+Z para desfazer',
    });
    setPreviewPlacements([]);
  }, [previewPlacements, positions, addTimelineItem]);

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

  // Onset Trigger
  const applyOnsetTrigger = useCallback(() => {
    if (!analysis) return;
    const strongOnsets = analysis.onsets
      .filter((o) => o.energy > sensitivity * 0.1)
      .filter((o, i, arr) => i === 0 || o.time - arr[i - 1].time > minHold);

    if (droneFormations.length === 0) {
      toast.info(`${strongOnsets.length} pontos de transição identificados`);
      return;
    }
    const times = strongOnsets.slice(0, droneFormations.length);
    times.forEach((onset, i) => {
      if (i < droneFormations.length) {
        updateDroneFormation(droneFormations[i].id, { startTime: onset.time });
      }
    });
    toast.success(`${times.length} formações sincronizadas com onsets`);
  }, [analysis, sensitivity, minHold, droneFormations, updateDroneFormation]);

  // Frequency Map
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
        updateDroneFormation(droneFormations[i].id, { startTime: s.startTime, holdDuration: s.holdDuration });
      });
      toast.success(`${Math.min(suggestions.length, droneFormations.length)} formações re-temporizadas`);
    } else {
      toast.info(`${suggestions.length} timings sugeridos`);
    }
  }, [analysis, droneFormations, minHold, updateDroneFormation]);

  const handleApply = () => {
    if (syncMode === 'beat-snap') applyBeatSnap();
    else if (syncMode === 'onset-trigger') applyOnsetTrigger();
    else if (syncMode === 'frequency-map') applyFrequencyMap();
  };

  const toggleOnsetType = (type: Onset['type']) => {
    setSelectedOnsetTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
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

      {/* Tab selector */}
      <div className="flex border-b border-border">
        {([
          { id: 'cues' as TabMode, label: 'Auto Cues', icon: Flame },
          { id: 'formations' as TabMode, label: 'Formations', icon: Target },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTabMode(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-semibold uppercase transition-colors",
              tabMode === id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
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
                const colors: Record<string, string> = { kick: 'text-destructive', snare: 'text-safety', 'hi-hat': 'text-electric', transient: 'text-primary' };
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

            {/* === AUTO CUES TAB === */}
            {tabMode === 'cues' && (
              <div className="space-y-2">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase">Posicionamento Automático de Cues</span>

                {/* Cue mode */}
                <div className="grid grid-cols-2 gap-1">
                  {([
                    { id: 'beats' as const, label: 'Beats' },
                    { id: 'onsets' as const, label: 'Onsets' },
                    { id: 'peaks' as const, label: 'Peaks' },
                    { id: 'combined' as const, label: 'Combinado' },
                  ]).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setCueMode(id)}
                      className={cn(
                        "px-2 py-1 rounded-sm text-[8px] font-semibold border transition-colors",
                        cueMode === id
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Beat divisor */}
                {(cueMode === 'beats' || cueMode === 'combined') && (
                  <div className="space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-[8px] text-muted-foreground">Beat Divisor</span>
                      <span className="text-[8px] font-mono-code text-foreground">
                        {beatDivisor === 1 ? 'Every beat' : beatDivisor === 2 ? 'Half note' : beatDivisor === 4 ? 'Measure' : `1/${beatDivisor}`}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 4, 8].map(d => (
                        <button
                          key={d}
                          onClick={() => setBeatDivisor(d)}
                          className={cn(
                            "flex-1 text-[8px] py-0.5 rounded-sm border",
                            beatDivisor === d ? "bg-primary/20 border-primary/40 text-primary" : "border-border/50 text-muted-foreground"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Onset type filter */}
                {(cueMode === 'onsets' || cueMode === 'combined') && (
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-muted-foreground">Filtro de Onset</span>
                    <div className="flex gap-1 flex-wrap">
                      {(['kick', 'snare', 'hi-hat', 'transient'] as Onset['type'][]).map(type => (
                        <button
                          key={type}
                          onClick={() => toggleOnsetType(type)}
                          className={cn(
                            "text-[7px] px-1.5 py-0.5 rounded-sm border font-semibold",
                            selectedOnsetTypes.includes(type)
                              ? "bg-primary/15 border-primary/40 text-primary"
                              : "border-border/50 text-muted-foreground"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sensitivity */}
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-[8px] text-muted-foreground">Sensibilidade</span>
                    <span className="text-[8px] font-mono-code text-foreground">{(cueSensitivity * 100).toFixed(0)}%</span>
                  </div>
                  <Slider value={[cueSensitivity]} onValueChange={([v]) => setCueSensitivity(v)} min={0.1} max={1} step={0.05} />
                </div>

                {/* Min interval */}
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-[8px] text-muted-foreground">Intervalo Mín.</span>
                    <span className="text-[8px] font-mono-code text-foreground">{minCueInterval.toFixed(1)}s</span>
                  </div>
                  <Slider value={[minCueInterval]} onValueChange={([v]) => setMinCueInterval(v)} min={0.1} max={3} step={0.1} />
                </div>

                {/* Distribution toggles */}
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={distributePositions} onChange={e => setDistributePositions(e.target.checked)}
                      className="w-3 h-3 rounded border-border" />
                    <span className="text-[8px] text-muted-foreground">Distribuir entre posições</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={distributeEffects} onChange={e => setDistributeEffects(e.target.checked)}
                      className="w-3 h-3 rounded border-border" />
                    <span className="text-[8px] text-muted-foreground">Variar efeitos automaticamente</span>
                  </label>
                </div>

                {/* Position/effect count info */}
                <div className="text-[8px] text-muted-foreground p-1.5 bg-surface-1 rounded-sm border border-border/50 space-y-0.5">
                  <p>📍 {positions.filter(p => p.type === 'pyro').length} posições pyro disponíveis</p>
                  <p>🎆 {EFFECT_LIBRARY.filter(e => e.type === 'firework').length} efeitos na biblioteca</p>
                  {previewPlacements.length > 0 && (
                    <p className="text-safety font-bold">▲ {previewPlacements.length} cues no preview</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1">
                  <Button onClick={previewCues} variant="outline" size="sm" className="flex-1 h-7 text-[9px] gap-1">
                    <Shuffle className="w-3 h-3" />
                    Preview
                  </Button>
                  <Button onClick={applyCuePlacements} size="sm" className="flex-1 h-7 text-[9px] gap-1"
                    disabled={previewPlacements.length === 0}>
                    <Flame className="w-3 h-3" />
                    Aplicar ({previewPlacements.length})
                  </Button>
                </div>
              </div>
            )}

            {/* === FORMATIONS TAB === */}
            {tabMode === 'formations' && (
              <div className="space-y-2">
                {/* Sync mode */}
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
                  <p><strong>Frequency Map:</strong> Pinta cada formação com a cor dominante.</p>
                  <p><strong>Auto-Timing:</strong> Sugere tempos ideais baseado em picos de energia.</p>
                </div>
              </div>
            )}
          </>
        )}

        {!analysis && !analyzing && (
          <div className="text-center py-6 space-y-2">
            <Music className="w-8 h-8 mx-auto text-muted-foreground/30" />
            <p className="text-[9px] text-muted-foreground">
              Carregue um áudio na timeline e clique "Analisar" para detectar beats, onsets e frequências.
            </p>
            <p className="text-[8px] text-muted-foreground/60">
              Motor de análise NRT com classificação espectral (kick/snare/hi-hat) e posicionamento automático de cues pirotécnicas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
