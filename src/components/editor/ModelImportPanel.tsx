import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Box, X, Upload, Trash2, RefreshCw, Download, Eye, Settings2, Layers, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import { parseModelToFormation, parseKMZToFormation, type ProjectionMode, type SamplingMode, type ModelParseResult, SUPPORTED_EXTENSIONS } from '@/lib/modelToFormation';
import { cn } from '@/lib/utils';

const PROJECTION_MODES: { id: ProjectionMode; label: string; icon: string }[] = [
  { id: 'front', label: 'Frente', icon: '🎭' },
  { id: 'side', label: 'Lateral', icon: '👤' },
  { id: 'top-down', label: 'Topo', icon: '🔽' },
  { id: 'isometric', label: 'Iso', icon: '🔷' },
];

const SAMPLING_MODES: { id: SamplingMode; label: string; desc: string }[] = [
  { id: 'surface', label: 'Superfície', desc: 'Amostragem uniforme da mesh' },
  { id: 'vertices', label: 'Vértices', desc: 'Posições originais do modelo' },
  { id: 'edges', label: 'Arestas', desc: 'Contornos e bordas' },
  { id: 'silhouette', label: 'Silhueta', desc: 'Contorno projetado (melhor para logos)' },
];

function MiniPreview2D({ points, color = '#00E5FF' }: { points: { x: number; z: number }[]; color?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, pad = 12;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#1a1a24';
    ctx.lineWidth = 0.5;
    for (let x = pad; x <= w - pad; x += 12) { ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke(); }
    for (let y = pad; y <= h - pad; y += 12) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }

    let maxDist = 0;
    for (const p of points) maxDist = Math.max(maxDist, Math.abs(p.x), Math.abs(p.z));
    maxDist = Math.max(maxDist, 1);
    const scale = Math.min(w - pad * 2, h - pad * 2) / (maxDist * 2.2);

    // Draw points with glow
    for (const p of points) {
      const px = w / 2 + p.x * scale;
      const py = h / 2 + p.z * scale;

      // Glow
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = color + '22';
      ctx.fill();

      // Point
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Count label
    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${points.length} pts`, w - pad, h - 4);

    // Axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(w / 2, pad); ctx.lineTo(w / 2, h - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, h / 2); ctx.lineTo(w - pad, h / 2); ctx.stroke();
  }, [points, color]);

  return <canvas ref={canvasRef} width={260} height={180} className="rounded border border-border/40 w-full" />;
}

export default function ModelImportPanel({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ModelParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [droneCount, setDroneCount] = useState(300);
  const [radius, setRadius] = useState(25);
  const [projection, setProjection] = useState<ProjectionMode>('front');
  const [sampling, setSampling] = useState<SamplingMode>('surface');
  const [height, setHeight] = useState(30);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addDroneFormation = useProjectStore(s => s.addDroneFormation);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const droneFormations = useProjectStore(s => s.droneFormations);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_EXTENSIONS.includes(ext as any)) {
      toast.error(`Formato .${ext} não suportado`, { description: `Use: ${SUPPORTED_EXTENSIONS.join(', ')}` });
      return;
    }
    setFile(f);
    if (fileRef.current) fileRef.current.value = '';
    // Auto-process
    processFile(f);
  }, [droneCount, radius, projection, sampling]);

  const processFile = useCallback(async (f?: File) => {
    const target = f || file;
    if (!target) return;
    setLoading(true);
    try {
      const ext = target.name.split('.').pop()?.toLowerCase() || '';
      let r: ModelParseResult;
      if (ext === 'kml') {
        r = await parseKMZToFormation(target, droneCount, radius);
      } else {
        r = await parseModelToFormation(target, droneCount, radius, projection, sampling);
      }
      setResult(r);
      toast.success(`${r.modelName} processado`, {
        description: `${r.originalVertexCount} vértices → ${r.points.length} drones · Score: ${r.quality.score}%`,
      });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao processar modelo');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [file, droneCount, radius, projection, sampling]);

  // Re-process when parameters change
  useEffect(() => {
    if (file && result) {
      const timer = setTimeout(() => processFile(), 300);
      return () => clearTimeout(timer);
    }
  }, [projection, sampling, droneCount, radius]);

  const addAsFormation = useCallback(() => {
    if (!result) return;
    const lastTime = droneFormations.length > 0
      ? droneFormations[droneFormations.length - 1].startTime +
        droneFormations[droneFormations.length - 1].transitionDuration +
        droneFormations[droneFormations.length - 1].holdDuration
      : 0;

    addDroneFormation({
      id: `model-${Date.now()}`,
      formationType: result.modelName,
      droneCount: result.points.length,
      height,
      radius,
      spacing: result.quality.avgSpacing,
      rotation: 0,
      startTime: lastTime,
      transitionDuration: 15,
      holdDuration: 20,
      color: '#00E5FF',
      points: result.points,
    });
    setCurrentTime(lastTime);
    toast.success(`Formação "${result.modelName}" adicionada à coreografia`, {
      description: `${result.points.length} drones · ${height}m altitude`,
    });
  }, [result, height, radius, droneFormations, addDroneFormation, setCurrentTime]);

  const qualityColor = result ? (
    result.quality.score >= 80 ? 'text-green-400' :
    result.quality.score >= 50 ? 'text-yellow-400' : 'text-red-400'
  ) : '';

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      {/* Header */}
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">3D → Formação</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* File Upload */}
        <div className="space-y-1.5">
          <input ref={fileRef} type="file" accept={SUPPORTED_EXTENSIONS.map(e => `.${e}`).join(',')} onChange={handleFileSelect} className="hidden" />
          <Button
            size="sm"
            className="w-full h-9 text-xs gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
          >
            <Upload className="w-3.5 h-3.5" />
            {loading ? 'Processando...' : file ? 'Trocar Modelo' : 'Importar Modelo 3D'}
          </Button>
          <p className="text-[8px] text-muted-foreground text-center">
            {SUPPORTED_EXTENSIONS.map(e => `.${e.toUpperCase()}`).join(' · ')}
          </p>
        </div>

        {/* Current file info */}
        {file && (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-surface-1/50 rounded border border-border/30">
            <Box className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-foreground font-medium truncate">{file.name}</div>
              <div className="text-[8px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setFile(null); setResult(null); }}>
              <Trash2 className="w-2.5 h-2.5 text-muted-foreground" />
            </Button>
          </div>
        )}

        {/* Parameters */}
        <div className="space-y-2.5">
          {/* Drone Count */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Drones</span>
              <span className="text-[10px] font-mono text-foreground">{droneCount}</span>
            </div>
            <Slider value={[droneCount]} onValueChange={([v]) => setDroneCount(v)} min={50} max={2000} step={10} />
          </div>

          {/* Radius */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Raio (m)</span>
              <span className="text-[10px] font-mono text-foreground">{radius}m</span>
            </div>
            <Slider value={[radius]} onValueChange={([v]) => setRadius(v)} min={10} max={150} step={5} />
          </div>

          {/* Height */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground font-semibold uppercase">Altitude (m)</span>
              <span className="text-[10px] font-mono text-foreground">{height}m</span>
            </div>
            <Slider value={[height]} onValueChange={([v]) => setHeight(v)} min={10} max={120} step={5} />
          </div>

          {/* Projection */}
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Projeção</span>
            <div className="grid grid-cols-4 gap-1">
              {PROJECTION_MODES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProjection(p.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-1.5 px-1 rounded border text-[8px] transition-colors",
                    projection === p.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/30 bg-surface-2 hover:bg-surface-3 text-muted-foreground"
                  )}
                >
                  <span className="text-sm">{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sampling */}
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Amostragem</span>
            <div className="grid grid-cols-2 gap-1">
              {SAMPLING_MODES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSampling(s.id)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 py-1.5 px-2 rounded border text-left transition-colors",
                    sampling === s.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/30 bg-surface-2 hover:bg-surface-3 text-muted-foreground"
                  )}
                >
                  <span className="text-[9px] font-medium">{s.label}</span>
                  <span className="text-[7px] opacity-70">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reprocess button */}
        {file && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[9px] gap-1"
            onClick={() => processFile()}
            disabled={loading}
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            Reprocessar
          </Button>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-2 border border-border/40 rounded p-2 bg-surface-1/30">
            {/* Preview */}
            <MiniPreview2D points={result.points} />

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div className="text-[8px] text-muted-foreground">Vértices:</div>
              <div className="text-[8px] text-foreground font-mono">{result.originalVertexCount.toLocaleString()}</div>

              <div className="text-[8px] text-muted-foreground">Triângulos:</div>
              <div className="text-[8px] text-foreground font-mono">{result.triangleCount.toLocaleString()}</div>

              <div className="text-[8px] text-muted-foreground">Drones finais:</div>
              <div className="text-[8px] text-foreground font-mono">{result.points.length}</div>

              <div className="text-[8px] text-muted-foreground">Espaçamento médio:</div>
              <div className="text-[8px] text-foreground font-mono">{result.quality.avgSpacing}m</div>

              <div className="text-[8px] text-muted-foreground">Uniformidade:</div>
              <div className="text-[8px] text-foreground font-mono">±{result.quality.spacingUniformity}m</div>

              <div className="text-[8px] text-muted-foreground">Bounding Box:</div>
              <div className="text-[8px] text-foreground font-mono">
                {result.boundingBox.width}×{result.boundingBox.height}×{result.boundingBox.depth}
              </div>

              <div className="text-[8px] text-muted-foreground">Qualidade:</div>
              <div className={cn("text-[9px] font-bold font-mono", qualityColor)}>
                {result.quality.score}%
                {result.quality.score >= 80 ? ' ✓' : result.quality.score >= 50 ? ' ⚠' : ' ✗'}
              </div>
            </div>

            {/* Add Formation button */}
            <Button
              size="sm"
              className="w-full h-8 text-[10px] gap-1.5"
              onClick={addAsFormation}
            >
              <Layers className="w-3.5 h-3.5" />
              Adicionar à Coreografia ({result.points.length} drones)
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!file && (
          <div className="text-center py-8 space-y-2">
            <Box className="w-10 h-10 text-muted-foreground/20 mx-auto" />
            <div>
              <p className="text-[10px] text-muted-foreground">Importe um modelo 3D</p>
              <p className="text-[8px] text-muted-foreground/60">
                O modelo será convertido em posições de drones
              </p>
            </div>
            <div className="space-y-1 text-[8px] text-muted-foreground/50 mt-4">
              <p>💡 Use <strong>Projeção Frente</strong> para logos e silhuetas</p>
              <p>💡 Use <strong>Amostragem Silhueta</strong> para contornos limpos</p>
              <p>💡 Exporte do SketchUp como .OBJ ou .DAE</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
