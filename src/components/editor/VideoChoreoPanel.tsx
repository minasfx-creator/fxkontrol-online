import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  X, Video, Upload, Play, Pause, SkipBack, SkipForward, Loader2,
  Film, Eye, Layers, Trash2, Download, Wand2, Settings2, ChevronDown,
  ChevronRight, Palette, Move3d, Zap, RefreshCw, Maximize2,
  Brain, Sparkles, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useProjectStore } from '@/store/useProjectStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  extractEnhancedFrames, generateVideoChoreo, renderFramePreview,
  isGifFile, isVideoFile, DEFAULT_OPTIONS,
  type VideoFrame, type ChoreoKeyframe, type VideoChoreoResult,
} from '@/lib/videoChoreoEngine';

export default function VideoChoreoPanel({ onClose }: { onClose: () => void }) {
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing state
  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [result, setResult] = useState<VideoChoreoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [progress, setProgress] = useState(0);

  // Preview state
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const playIntervalRef = useRef<number | null>(null);

  // Options
  const [droneCount, setDroneCount] = useState(300);
  const [fps, setFps] = useState(4);
  const [resolution, setResolution] = useState(192);
  const [maxFrames, setMaxFrames] = useState(120);
  const [threshold, setThreshold] = useState(128);
  const [invertDetection, setInvertDetection] = useState(false);
  const [detectionMode, setDetectionMode] = useState<'threshold' | 'edge' | 'adaptive'>('threshold');
  const [blurRadius, setBlurRadius] = useState(1);
  const [contrastBoost, setContrastBoost] = useState(1.2);
  const [edgeSensitivity, setEdgeSensitivity] = useState(50);
  const [holdDuration, setHoldDuration] = useState(2);
  const [transitionDuration, setTransitionDuration] = useState(4);
  const [baseHeight, setBaseHeight] = useState(30);
  const [heightVariation, setHeightVariation] = useState(0.3);
  const [colorExtraction, setColorExtraction] = useState(true);
  const [smoothTrajectories, setSmoothTrajectories] = useState(true);
  const [frameRange, setFrameRange] = useState<[number, number]>([0, 100]);

  // AI Mode
  const [processingMode, setProcessingMode] = useState<'silhouette' | 'ai-semantic'>('silhouette');
  const [aiContext, setAiContext] = useState('');
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisDepth, setAnalysisDepth] = useState<'fast' | 'cinematic'>('cinematic');
  const [showAiDetails, setShowAiDetails] = useState(true);

  // Store
  const addDroneFormation = useProjectStore(s => s.addDroneFormation);
  const droneFormations = useProjectStore(s => s.droneFormations);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const setPlaying = useProjectStore(s => s.setPlaying);

  // ── AI Semantic Generation ──────────────────────────────────
  const generateAIChoreo = useCallback(async () => {
    if (frames.length === 0) return;
    setAiLoading(true);
    setLoadingPhase('Preparando frames para IA...');
    setProgress(10);

    try {
      // Convert frames to data URLs (downscale for API)
      const frameDataUrls: string[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = 256;
      canvas.height = 256;

      for (let i = 0; i < frames.length; i++) {
        setProgress(10 + (i / frames.length) * 30);
        setLoadingPhase(`Codificando frame ${i + 1}/${frames.length}...`);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = frames[i].thumbnail;
        });
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(img, 0, 0, 256, 256);
        frameDataUrls.push(canvas.toDataURL('image/jpeg', 0.7));
      }

      setProgress(45);
      setLoadingPhase('Analisando vídeo com IA...');

      const { data, error } = await supabase.functions.invoke('video-choreo-ai', {
        body: {
          frameDataUrls,
          droneCount,
          context: aiContext || undefined,
          mode: 'semantic',
          analysisDepth,
        },
      });

      if (error) throw new Error(error.message || 'AI processing failed');
      if (data?.error) throw new Error(data.error);

      setProgress(80);
      setLoadingPhase('Construindo formações...');

      setAiResult(data);

      // Convert AI formations to choreo result
      const formations = data.formations || [];
      if (formations.length === 0) throw new Error('IA não gerou formações');

      const keyframes: ChoreoKeyframe[] = [];
      let time = 0;

      for (let i = 0; i < formations.length; i++) {
        const f = formations[i];
        const points = (f.points || []).slice(0, droneCount).map((p: any) => ({
          x: p.x || 0,
          y: p.y || f.height || baseHeight,
          z: p.z || 0,
        }));

        // If AI didn't generate enough points, fill with formation shape
        while (points.length < droneCount) {
          const angle = Math.random() * Math.PI * 2;
          const r = Math.random() * 15 * (f.spread || 1);
          points.push({
            x: Math.cos(angle) * r,
            y: f.height || baseHeight,
            z: Math.sin(angle) * r,
          });
        }

        keyframes.push({
          frameIndex: f.frameIndex || i,
          time,
          points,
          color: f.color || '#00E5FF',
          brightness: 0.7,
          thumbnail: frames[Math.min(i, frames.length - 1)]?.thumbnail || '',
        });

        time += (f.suggestedTransitionDuration || transitionDuration) + (f.suggestedHoldDuration || holdDuration);
      }

      const choreoResult: VideoChoreoResult = {
        keyframes,
        trajectories: [],
        totalDuration: time,
        droneCount,
      };

      setResult(choreoResult);

      // Add to project
      let projectTime = droneFormations.length > 0
        ? droneFormations[droneFormations.length - 1].startTime +
          droneFormations[droneFormations.length - 1].transitionDuration +
          droneFormations[droneFormations.length - 1].holdDuration
        : 0;

      for (let i = 0; i < keyframes.length; i++) {
        const kf = keyframes[i];
        const f = formations[i] || {};
        addDroneFormation({
          id: `ai-vchoreo-${Date.now()}-${i}`,
          formationType: 'ai-semantic',
          droneCount,
          height: kf.points[0]?.y || baseHeight,
          radius: 20,
          spacing: 2,
          rotation: f.rotation || 0,
          startTime: projectTime,
          transitionDuration: f.suggestedTransitionDuration || transitionDuration,
          holdDuration: f.suggestedHoldDuration || holdDuration,
          color: kf.color,
          points: kf.points.map(p => ({ x: p.x, z: p.z })),
        });
        projectTime += (f.suggestedTransitionDuration || transitionDuration) + (f.suggestedHoldDuration || holdDuration);
      }

      setCurrentTime(0);
      setProgress(100);
      toast.success('🧠 Coreografia semântica gerada!', {
        description: `${data.analysis?.substring(0, 80) || `${formations.length} formações criadas pela IA`}`,
      });

    } catch (err: any) {
      console.error('AI choreo error:', err);
      toast.error('Erro na análise por IA', { description: err.message });
    } finally {
      setAiLoading(false);
      setLoadingPhase('');
      setProgress(0);
    }
  }, [frames, droneCount, aiContext, baseHeight, holdDuration, transitionDuration, droneFormations, addDroneFormation, setCurrentTime]);

  // ── File Upload ─────────────────────────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isVideoFile(f) && !isGifFile(f)) {
      toast.error('Formato não suportado', { description: 'Use MP4, WebM, MOV ou GIF' });
      return;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setFrames([]);
    setResult(null);
    setSelectedFrame(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ── Extract Frames ──────────────────────────────────────────
  const extractFrames = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const enhanced = await extractEnhancedFrames(file, {
        fps, maxFrames, resolution, colorExtraction,
        frameRange: [frameRange[0] / 100, frameRange[1] / 100],
        onProgress: (p, phase) => {
          setProgress(Math.round(p * 100));
          setLoadingPhase(phase);
        },
      });
      setFrames(enhanced);
      setSelectedFrame(0);
      toast.success(`${enhanced.length} frames extraídos`, {
        description: `${resolution}px · ${fps} FPS · cores ${colorExtraction ? 'ON' : 'OFF'}`,
      });
    } catch (err: any) {
      toast.error('Erro ao extrair frames', { description: err.message });
    } finally {
      setLoading(false);
      setLoadingPhase('');
      setProgress(0);
    }
  }, [file, fps, maxFrames, resolution, colorExtraction, frameRange]);

  // ── Generate Choreography ───────────────────────────────────
  const generateChoreo = useCallback(async () => {
    if (frames.length === 0) return;
    setLoading(true);
    try {
      const choreo = await generateVideoChoreo(frames, {
        droneCount,
        radius: Math.max(15, Math.sqrt(droneCount) * 2.2),
        baseHeight, heightVariation,
        threshold, invertDetection, detectionMode,
        blurRadius, contrastBoost, edgeSensitivity,
        holdDuration, transitionDuration,
        smoothTrajectories,
        onProgress: (p, phase) => {
          setProgress(Math.round(p * 100));
          setLoadingPhase(phase);
        },
      });

      setResult(choreo);

      // Add formations to project store
      let time = droneFormations.length > 0
        ? droneFormations[droneFormations.length - 1].startTime +
          droneFormations[droneFormations.length - 1].transitionDuration +
          droneFormations[droneFormations.length - 1].holdDuration
        : 0;

      for (const kf of choreo.keyframes) {
        addDroneFormation({
          id: `vchoreo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          formationType: 'video-traced',
          droneCount,
          height: kf.points[0]?.y || baseHeight,
          radius: 20,
          spacing: 2,
          rotation: 0,
          startTime: time,
          transitionDuration,
          holdDuration,
          color: kf.color,
          points: kf.points.map(p => ({ x: p.x, z: p.z })),
        });
        time += transitionDuration + holdDuration;
      }

      setCurrentTime(0);
      toast.success(`Coreografia gerada!`, {
        description: `${choreo.keyframes.length} formações · ${droneCount} drones · ${choreo.totalDuration.toFixed(0)}s · ${choreo.trajectories.length} trajetórias`,
      });
    } catch (err: any) {
      toast.error('Erro ao gerar coreografia', { description: err.message });
    } finally {
      setLoading(false);
      setLoadingPhase('');
      setProgress(0);
    }
  }, [frames, droneCount, baseHeight, heightVariation, threshold, invertDetection, detectionMode, blurRadius, contrastBoost, edgeSensitivity, holdDuration, transitionDuration, smoothTrajectories, droneFormations, addDroneFormation, setCurrentTime]);

  // ── Frame Preview Rendering ─────────────────────────────────
  useEffect(() => {
    if (!previewCanvasRef.current || !result || result.keyframes.length === 0) return;
    const kf = result.keyframes[selectedFrame % result.keyframes.length];
    if (!kf) return;
    renderFramePreview(previewCanvasRef.current, kf.points, kf.color);
  }, [selectedFrame, result]);

  // ── Auto-play ───────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying && result && result.keyframes.length > 1) {
      playIntervalRef.current = window.setInterval(() => {
        setSelectedFrame(prev => (prev + 1) % result.keyframes.length);
      }, (holdDuration + transitionDuration) * 200); // 5x speed preview
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, result, holdDuration, transitionDuration]);

  const currentKeyframe = result?.keyframes[selectedFrame];
  const fileSize = file ? `${(file.size / (1024 * 1024)).toFixed(1)}MB` : '';

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Film className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            Video Choreo
          </span>
          <span className="text-[8px] bg-primary/20 text-primary px-1 py-0.5 rounded font-mono-code">MEGA</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={cn("text-muted-foreground hover:text-foreground transition-colors", showSettings && "text-primary")}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* ── Upload Zone ────────────────────────────────────── */}
        <input ref={fileInputRef} type="file" accept="video/*,image/gif" onChange={handleFileUpload} className="hidden" />

        {!file ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-32 rounded-lg border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-primary/60" />
            </div>
            <span className="text-[10px] text-primary/70 font-semibold">Arraste ou clique para enviar</span>
            <span className="text-[8px] text-muted-foreground">MP4, WebM, MOV, GIF — até 120 frames</span>
          </button>
        ) : (
          <>
            {/* Video Preview */}
            <div className="relative rounded-lg overflow-hidden border border-border/30">
              {isGifFile(file) ? (
                <img src={previewUrl!} alt="GIF" className="w-full h-28 object-contain bg-black/50" />
              ) : (
                <video src={previewUrl!} className="w-full h-28 object-contain bg-black/50" muted loop autoPlay playsInline />
              )}
              <button
                onClick={() => { setFile(null); setPreviewUrl(null); setFrames([]); setResult(null); }}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1 left-1 flex items-center gap-1">
                <span className="bg-black/70 px-1.5 py-0.5 rounded text-[7px] text-white/80 font-mono">{file.name}</span>
                <span className="bg-black/70 px-1.5 py-0.5 rounded text-[7px] text-white/80 font-mono">{fileSize}</span>
              </div>
              {frames.length > 0 && (
                <div className="absolute bottom-1 right-1 bg-primary/90 px-1.5 py-0.5 rounded text-[7px] text-white font-bold">
                  {frames.length} frames
                </div>
              )}
            </div>

            {/* Frame Range */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[8px] text-muted-foreground font-semibold uppercase">Range de Frames</span>
                <span className="text-[9px] font-mono-code text-foreground">{frameRange[0]}% — {frameRange[1]}%</span>
              </div>
              <Slider
                value={frameRange}
                onValueChange={(v) => setFrameRange(v as [number, number])}
                min={0} max={100} step={1}
              />
            </div>

            {/* Extract button */}
            <Button
              onClick={extractFrames}
              disabled={loading}
              className="w-full h-8 text-[10px] gap-1"
              size="sm"
            >
              {loading && progress < 60 ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {loadingPhase} ({progress}%)
                </>
              ) : (
                <>
                  <Zap className="w-3 h-3" />
                  Extrair Frames ({fps} FPS · {resolution}px)
                </>
              )}
            </Button>
          </>
        )}

        {/* ── Frame Filmstrip ────────────────────────────────── */}
        {frames.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">
                Filmstrip ({frames.length} frames)
              </span>
              {colorExtraction && (
                <div className="flex items-center gap-0.5">
                  <Palette className="w-2.5 h-2.5 text-muted-foreground" />
                  <span className="text-[7px] text-muted-foreground">Cores extraídas</span>
                </div>
              )}
            </div>

            {/* Filmstrip with color bars */}
            <div className="flex gap-[2px] overflow-x-auto pb-1 scrollbar-thin">
              {frames.map((f, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedFrame(i)}
                  className={cn(
                    "flex flex-col flex-shrink-0 rounded-sm overflow-hidden border transition-all",
                    selectedFrame === i
                      ? "border-primary ring-1 ring-primary/30 scale-105"
                      : "border-border/30 hover:border-border/60"
                  )}
                >
                  <img src={f.thumbnail} alt={`Frame ${i}`} className="w-10 h-10 object-cover" />
                  <div
                    className="w-full h-1"
                    style={{ backgroundColor: f.dominantColor }}
                  />
                </button>
              ))}
            </div>

            {/* Selected frame info */}
            {frames[selectedFrame] && (
              <div className="flex items-center gap-2 px-2 py-1 rounded bg-surface-1 border border-border/30">
                <div
                  className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0"
                  style={{ backgroundColor: frames[selectedFrame].dominantColor }}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-mono-code text-foreground">
                    Frame {selectedFrame + 1}/{frames.length}
                  </span>
                  <span className="text-[8px] text-muted-foreground ml-2">
                    {frames[selectedFrame].dominantColor} · brilho {(frames[selectedFrame].brightness * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Drone Count ────────────────────────────────────── */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Drones</span>
            <span className="text-[10px] font-mono-code text-foreground">{droneCount}</span>
          </div>
          <Slider value={[droneCount]} onValueChange={([v]) => setDroneCount(v)} min={50} max={2000} step={10} />
        </div>

        {/* ── Processing Mode Toggle ─────────────────────────── */}
        {frames.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Modo de Processamento</span>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setProcessingMode('silhouette')}
                className={cn(
                  "flex items-center gap-1.5 p-2 rounded-lg border transition-all text-left",
                  processingMode === 'silhouette'
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/40 bg-surface-1 text-muted-foreground hover:text-foreground hover:border-border/60"
                )}
              >
                <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                <div>
                  <div className="text-[8px] font-bold uppercase">Silhueta</div>
                  <div className="text-[7px] opacity-70">Pixel-based</div>
                </div>
              </button>
              <button
                onClick={() => setProcessingMode('ai-semantic')}
                className={cn(
                  "flex items-center gap-1.5 p-2 rounded-lg border transition-all text-left",
                  processingMode === 'ai-semantic'
                    ? "border-accent/40 bg-accent/10 text-accent-foreground"
                    : "border-border/40 bg-surface-1 text-muted-foreground hover:text-foreground hover:border-border/60"
                )}
              >
                <Brain className="w-3.5 h-3.5 flex-shrink-0" />
                <div>
                  <div className="text-[8px] font-bold uppercase">IA Semântica</div>
                  <div className="text-[7px] opacity-70">Interpreta conteúdo</div>
                </div>
              </button>
            </div>

            {/* AI Context input */}
            {processingMode === 'ai-semantic' && (
              <div className="space-y-2 p-2 rounded-lg border border-accent/20 bg-accent/5">
                <div className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-accent-foreground" />
                  <span className="text-[8px] font-bold text-accent-foreground uppercase">Motor IA de Última Geração</span>
                </div>

                {/* Analysis Depth */}
                <div className="space-y-0.5">
                  <span className="text-[7px] text-muted-foreground font-semibold uppercase">Profundidade</span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => setAnalysisDepth('fast')}
                      className={cn(
                        "text-[7px] py-1.5 px-2 rounded border transition-all text-center",
                        analysisDepth === 'fast'
                          ? "border-primary/40 bg-primary/10 text-primary font-bold"
                          : "border-border/40 bg-surface-2 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      ⚡ Rápido
                    </button>
                    <button
                      onClick={() => setAnalysisDepth('cinematic')}
                      className={cn(
                        "text-[7px] py-1.5 px-2 rounded border transition-all text-center",
                        analysisDepth === 'cinematic'
                          ? "border-accent/40 bg-accent/10 text-accent-foreground font-bold"
                          : "border-border/40 bg-surface-2 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      🎬 Cinematográfico
                    </button>
                  </div>
                </div>

                {/* Context */}
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  placeholder="Ex: Show de Réveillon, tema oceano, 5000 espectadores, queremos emoção crescente com clímax no meio..."
                  className="w-full h-16 text-[9px] bg-surface-0 border border-border/30 rounded-md p-1.5 resize-none text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
                <div className="flex items-start gap-1 p-1.5 rounded bg-surface-1/80 border border-border/20">
                  <Brain className="w-3 h-3 text-accent-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-[7px] text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Gemini 2.5 Pro</strong> — Analisa movimento, narrativa temporal, emoções e composição visual.
                    Gera formações que <strong>capturam o significado</strong> do vídeo, com transições fisicamente corretas e arco dramático.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Settings Panel ─────────────────────────────────── */}
        {showSettings && (
          <div className="space-y-2 p-2 rounded-lg border border-border/40 bg-surface-1/50">
            <span className="text-[9px] text-primary font-semibold uppercase">Configurações Avançadas</span>

            {/* Detection mode */}
            <div className="space-y-1">
              <span className="text-[8px] text-muted-foreground font-semibold">Detecção</span>
              <div className="grid grid-cols-3 gap-0.5">
                {([
                  { id: 'threshold' as const, label: 'Threshold', icon: '◐' },
                  { id: 'edge' as const, label: 'Bordas', icon: '▢' },
                  { id: 'adaptive' as const, label: 'Adaptativo', icon: '◑' },
                ] as const).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setDetectionMode(m.id)}
                    className={cn(
                      "text-[7px] py-1 rounded border transition-colors",
                      detectionMode === m.id
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/50 bg-surface-2 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Extraction params */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">FPS</span>
                  <span className="text-[8px] font-mono-code">{fps}</span>
                </div>
                <Slider value={[fps]} onValueChange={([v]) => setFps(v)} min={1} max={24} step={1} />
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Resolução</span>
                  <span className="text-[8px] font-mono-code">{resolution}px</span>
                </div>
                <Slider value={[resolution]} onValueChange={([v]) => setResolution(v)} min={64} max={512} step={32} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Max Frames</span>
                  <span className="text-[8px] font-mono-code">{maxFrames}</span>
                </div>
                <Slider value={[maxFrames]} onValueChange={([v]) => setMaxFrames(v)} min={10} max={300} step={10} />
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Blur</span>
                  <span className="text-[8px] font-mono-code">{blurRadius}px</span>
                </div>
                <Slider value={[blurRadius]} onValueChange={([v]) => setBlurRadius(v)} min={0} max={8} step={1} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Contraste</span>
                  <span className="text-[8px] font-mono-code">{contrastBoost.toFixed(1)}x</span>
                </div>
                <Slider value={[contrastBoost]} onValueChange={([v]) => setContrastBoost(v)} min={0.5} max={4} step={0.1} />
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">
                    {detectionMode === 'edge' ? 'Borda Sens.' : 'Threshold'}
                  </span>
                  <span className="text-[8px] font-mono-code">
                    {detectionMode === 'edge' ? `${edgeSensitivity}%` : threshold}
                  </span>
                </div>
                {detectionMode === 'edge' ? (
                  <Slider value={[edgeSensitivity]} onValueChange={([v]) => setEdgeSensitivity(v)} min={5} max={100} step={5} />
                ) : (
                  <Slider value={[threshold]} onValueChange={([v]) => setThreshold(v)} min={30} max={230} step={5} />
                )}
              </div>
            </div>

            {/* Timing */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Transição</span>
                  <span className="text-[8px] font-mono-code">{transitionDuration}s</span>
                </div>
                <Slider value={[transitionDuration]} onValueChange={([v]) => setTransitionDuration(v)} min={1} max={20} step={0.5} />
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Hold</span>
                  <span className="text-[8px] font-mono-code">{holdDuration}s</span>
                </div>
                <Slider value={[holdDuration]} onValueChange={([v]) => setHoldDuration(v)} min={0.5} max={15} step={0.5} />
              </div>
            </div>

            {/* Height */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Altura Base</span>
                  <span className="text-[8px] font-mono-code">{baseHeight}m</span>
                </div>
                <Slider value={[baseHeight]} onValueChange={([v]) => setBaseHeight(v)} min={5} max={120} step={5} />
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[7px] text-muted-foreground">Var. Altura</span>
                  <span className="text-[8px] font-mono-code">{(heightVariation * 100).toFixed(0)}%</span>
                </div>
                <Slider value={[heightVariation]} onValueChange={([v]) => setHeightVariation(v)} min={0} max={1} step={0.05} />
              </div>
            </div>

            {/* Toggles */}
            <div className="flex gap-1.5">
              <button
                onClick={() => setInvertDetection(!invertDetection)}
                className={cn(
                  "flex-1 text-[7px] py-1 rounded border transition-colors",
                  invertDetection ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-surface-2 text-muted-foreground"
                )}
              >
                {invertDetection ? '✓ Pixels Claros' : 'Pixels Escuros'}
              </button>
              <button
                onClick={() => setColorExtraction(!colorExtraction)}
                className={cn(
                  "flex-1 text-[7px] py-1 rounded border transition-colors",
                  colorExtraction ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-surface-2 text-muted-foreground"
                )}
              >
                {colorExtraction ? '✓ Cores Auto' : 'Cores Off'}
              </button>
              <button
                onClick={() => setSmoothTrajectories(!smoothTrajectories)}
                className={cn(
                  "flex-1 text-[7px] py-1 rounded border transition-colors",
                  smoothTrajectories ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-surface-2 text-muted-foreground"
                )}
              >
                {smoothTrajectories ? '✓ Suavizar' : 'Linear'}
              </button>
            </div>
          </div>
        )}

        {/* ── Generate Button ────────────────────────────────── */}
        {frames.length > 0 && processingMode === 'silhouette' && (
          <Button
            onClick={generateChoreo}
            disabled={loading}
            className="w-full h-9 text-[10px] gap-1.5 font-semibold"
            size="sm"
          >
            {loading && progress >= 60 ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {loadingPhase} ({progress}%)
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                Gerar Coreografia ({frames.length} frames · {droneCount} drones)
              </>
            )}
          </Button>
        )}

        {frames.length > 0 && processingMode === 'ai-semantic' && (
          <Button
            onClick={generateAIChoreo}
            disabled={aiLoading || loading}
            className="w-full h-9 text-[10px] gap-1.5 font-semibold bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
            size="sm"
          >
            {aiLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {loadingPhase} ({progress}%)
              </>
            ) : (
              <>
                <Brain className="w-3.5 h-3.5" />
                🧠 Gerar com IA Semântica ({frames.length} frames)
              </>
            )}
          </Button>
        )}

        {/* AI Analysis Result */}
        {aiResult && processingMode === 'ai-semantic' && (
          <div className="space-y-2 p-2 rounded-lg border border-accent/20 bg-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Brain className="w-3 h-3 text-accent-foreground" />
                <span className="text-[8px] font-bold text-accent-foreground uppercase">Análise IA · Gemini Pro</span>
              </div>
              <button
                onClick={() => setShowAiDetails(!showAiDetails)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAiDetails ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            </div>

            {/* Analysis summary */}
            {aiResult.analysis && (
              <p className="text-[8px] text-foreground leading-relaxed">{aiResult.analysis}</p>
            )}

            {showAiDetails && (
              <>
                {/* Narrative */}
                {aiResult.narrative && (
                  <div className="p-1.5 rounded bg-surface-1/80 border border-border/20">
                    <span className="text-[7px] text-muted-foreground font-semibold uppercase">Narrativa</span>
                    <p className="text-[8px] text-foreground italic mt-0.5">"{aiResult.narrative}"</p>
                  </div>
                )}

                {/* Motion Analysis */}
                {aiResult.motionAnalysis && (
                  <div className="p-1.5 rounded bg-surface-1/80 border border-border/20">
                    <span className="text-[7px] text-muted-foreground font-semibold uppercase">Análise de Movimento</span>
                    <p className="text-[8px] text-foreground mt-0.5">{aiResult.motionAnalysis}</p>
                  </div>
                )}

                {/* Global Suggestions */}
                {aiResult.globalSuggestions && (
                  <div className="space-y-1">
                    <div className="flex gap-1 flex-wrap">
                      {aiResult.globalSuggestions.colorPalette?.map((c: string, i: number) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border border-border/30 shadow-sm"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {aiResult.globalSuggestions.musicStyle && (
                        <span className="text-[7px] bg-surface-1 px-1.5 py-0.5 rounded text-muted-foreground border border-border/20">
                          🎵 {aiResult.globalSuggestions.musicStyle}
                        </span>
                      )}
                      {aiResult.globalSuggestions.tempo && (
                        <span className="text-[7px] bg-surface-1 px-1.5 py-0.5 rounded text-muted-foreground border border-border/20">
                          ⏱ {aiResult.globalSuggestions.tempo}
                        </span>
                      )}
                      {aiResult.globalSuggestions.showStyle && (
                        <span className="text-[7px] bg-surface-1 px-1.5 py-0.5 rounded text-muted-foreground border border-border/20">
                          🎭 {aiResult.globalSuggestions.showStyle}
                        </span>
                      )}
                      {aiResult.globalSuggestions.openingEffect && (
                        <span className="text-[7px] bg-surface-1 px-1.5 py-0.5 rounded text-muted-foreground border border-border/20">
                          🚀 {aiResult.globalSuggestions.openingEffect}
                        </span>
                      )}
                      {aiResult.globalSuggestions.finaleEffect && (
                        <span className="text-[7px] bg-surface-1 px-1.5 py-0.5 rounded text-muted-foreground border border-border/20">
                          ✨ {aiResult.globalSuggestions.finaleEffect}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Formations List */}
                {aiResult.formations && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    <span className="text-[7px] text-muted-foreground font-semibold uppercase">
                      Formações ({aiResult.formations.length})
                    </span>
                    {aiResult.formations.map((f: any, i: number) => {
                      const isClimax = aiResult.globalSuggestions?.climaxFormationIndex === i;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "p-1.5 rounded border transition-all",
                            isClimax
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/20 bg-surface-1/50"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0 border border-border/30"
                              style={{
                                background: f.secondaryColor
                                  ? `linear-gradient(135deg, ${f.color || '#00E5FF'}, ${f.secondaryColor})`
                                  : f.color || '#00E5FF',
                              }}
                            />
                            <span className="text-[8px] font-bold text-foreground flex-1">{f.shape}</span>
                            {isClimax && (
                              <span className="text-[6px] bg-primary/20 text-primary px-1 rounded font-bold">CLÍMAX</span>
                            )}
                            <span className="text-[6px] bg-surface-2 px-1 rounded text-muted-foreground">{f.emotion}</span>
                          </div>
                          {f.description && (
                            <p className="text-[7px] text-muted-foreground mt-0.5 leading-relaxed">{f.description}</p>
                          )}
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {f.transitionStyle && (
                              <span className="text-[6px] text-muted-foreground/70">↗ {f.transitionStyle}</span>
                            )}
                            {f.motionDuringHold && f.motionDuringHold !== 'static' && (
                              <span className="text-[6px] text-muted-foreground/70">🔄 {f.motionDuringHold}</span>
                            )}
                            {f.ledEffect && f.ledEffect !== 'solid' && (
                              <span className="text-[6px] text-muted-foreground/70">💡 {f.ledEffect}</span>
                            )}
                            {f.height && (
                              <span className="text-[6px] text-muted-foreground/70">↕ {f.height}m</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Loading Bar ────────────────────────────────────── */}
        {loading && (
          <div className="space-y-0.5">
            <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[7px] text-muted-foreground text-center">{loadingPhase}</p>
          </div>
        )}

        {/* ── Result Preview ─────────────────────────────────── */}
        {result && result.keyframes.length > 0 && (
          <div className="space-y-2 border border-primary/20 rounded-lg p-2 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Move3d className="w-3 h-3 text-primary" />
                <span className="text-[9px] font-bold text-primary uppercase">Resultado</span>
              </div>
              <span className="text-[8px] font-mono-code text-muted-foreground">
                {result.keyframes.length} formações · {result.totalDuration.toFixed(0)}s
              </span>
            </div>

            {/* Preview Canvas */}
            <div className="relative">
              <canvas
                ref={previewCanvasRef}
                width={300}
                height={200}
                className="w-full rounded-md border border-border/30"
              />
              {currentKeyframe && (
                <div
                  className="absolute top-1 left-1 w-3 h-3 rounded-full border border-white/50"
                  style={{ backgroundColor: currentKeyframe.color }}
                />
              )}
              <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[7px] text-white/80 font-mono">
                {selectedFrame + 1}/{result.keyframes.length}
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-1 justify-center">
              <button
                onClick={() => setSelectedFrame(Math.max(0, selectedFrame - 1))}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <SkipBack className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  isPlaying
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-foreground hover:bg-primary/20"
                )}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
              </button>
              <button
                onClick={() => setSelectedFrame(Math.min(result.keyframes.length - 1, selectedFrame + 1))}
                className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
              >
                <SkipForward className="w-3 h-3" />
              </button>
            </div>

            {/* Frame scrubber */}
            <Slider
              value={[selectedFrame]}
              onValueChange={([v]) => { setSelectedFrame(v); setIsPlaying(false); }}
              min={0} max={result.keyframes.length - 1} step={1}
            />

            {/* Color timeline */}
            <div className="space-y-0.5">
              <span className="text-[7px] text-muted-foreground font-semibold">Timeline de Cores</span>
              <div className="flex h-3 rounded-sm overflow-hidden border border-border/30">
                {result.keyframes.map((kf, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 cursor-pointer transition-opacity",
                      i === selectedFrame ? "ring-1 ring-white/50" : "hover:opacity-80"
                    )}
                    style={{ backgroundColor: kf.color }}
                    onClick={() => setSelectedFrame(i)}
                  />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-1">
              <div className="text-center p-1 rounded bg-surface-1 border border-border/20">
                <div className="text-[10px] font-bold text-foreground">{result.droneCount}</div>
                <div className="text-[7px] text-muted-foreground">Drones</div>
              </div>
              <div className="text-center p-1 rounded bg-surface-1 border border-border/20">
                <div className="text-[10px] font-bold text-foreground">{result.keyframes.length}</div>
                <div className="text-[7px] text-muted-foreground">Formações</div>
              </div>
              <div className="text-center p-1 rounded bg-surface-1 border border-border/20">
                <div className="text-[10px] font-bold text-foreground">{result.totalDuration.toFixed(0)}s</div>
                <div className="text-[7px] text-muted-foreground">Duração</div>
              </div>
            </div>

            {/* Preview in 3D */}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[9px] gap-1"
              onClick={() => { setCurrentTime(0); setPlaying(true); }}
            >
              <Eye className="w-3 h-3" />
              Preview 3D
            </Button>
          </div>
        )}

        {/* Tips */}
        {!file && (
          <div className="p-2 rounded-lg border border-border/30 bg-surface-1/50 space-y-1">
            <span className="text-[9px] font-semibold text-foreground">💡 Dicas para melhores resultados:</span>
            <ul className="space-y-0.5 text-[8px] text-muted-foreground">
              <li>• Use vídeos com <strong>alto contraste</strong> (fundo claro/escuro)</li>
              <li>• Silhuetas e animações com <strong>contornos definidos</strong></li>
              <li>• GIFs animados de <strong>logos</strong> e <strong>ícones</strong></li>
              <li>• Vídeos curtos (5-30s) para melhor qualidade</li>
              <li>• Aumente a <strong>resolução</strong> para detalhes finos</li>
              <li>• Use modo <strong>Bordas</strong> para vídeos com texturas complexas</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
