import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import type { ColorTransitionMode } from '@/lib/colorInterpolation';
import {
  generateFormation,
  FORMATION_PRESETS,
  type FormationType,
  type FormationConfig,
  type FormationPoint,
} from '@/lib/formations';
import { Trash2, Plus, FileCode, Box, Loader2, Copy, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { parseSVGToFormation } from '@/lib/svgParser';
import { parseModelToFormation, parseKMZToFormation, SUPPORTED_EXTENSIONS, type ProjectionMode, type SamplingMode, type ModelParseResult } from '@/lib/modelToFormation';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

interface FormationBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GenerationTab = 'presets' | 'svg' | '3d-model';

/* ── 2D Preview Canvas ─────────────────────────────────────── */

function FormationPreview({ points }: { points: FormationPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const padding = 24;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'hsl(240 6% 8%)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'hsl(240 4% 15%)';
    ctx.lineWidth = 0.5;
    const gridStep = 20;
    for (let x = padding; x <= w - padding; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, h - padding); ctx.stroke();
    }
    for (let y = padding; y <= h - padding; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(w - padding, y); ctx.stroke();
    }

    // Center crosshair
    ctx.strokeStyle = 'hsl(240 4% 25%)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w / 2, padding); ctx.lineTo(w / 2, h - padding); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padding, h / 2); ctx.lineTo(w - padding, h / 2); ctx.stroke();

    if (points.length === 0) return;

    let maxDist = 0;
    for (const p of points) {
      const dist = Math.max(Math.abs(p.x), Math.abs(p.z));
      if (dist > maxDist) maxDist = dist;
    }
    maxDist = Math.max(maxDist, 1);
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;
    const scale = Math.min(drawW, drawH) / (maxDist * 2.4);

    for (const p of points) {
      const px = w / 2 + p.x * scale;
      const py = h / 2 + p.z * scale;

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, 8);
      gradient.addColorStop(0, 'hsla(207, 90%, 54%, 0.5)');
      gradient.addColorStop(1, 'hsla(207, 90%, 54%, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(px - 8, py - 8, 16, 16);

      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(207 90% 54%)';
      ctx.fill();
    }

    ctx.fillStyle = 'hsl(240 5% 55%)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${points.length} drones`, w - padding, h - padding + 14);
  }, [points]);

  return (
    <canvas ref={canvasRef} width={280} height={220} className="rounded-sm border border-border w-full" style={{ imageRendering: 'auto' }} />
  );
}

/* ── Slider Field ──────────────────────────────────────────── */

function SliderField({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase">{label}</span>
        <span className="text-xs font-mono-code text-foreground">{value}{unit || ''}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

/* ── Formation Queue ─────────────────────────────────────────── */

function FormationQueue() {
  const {
    droneFormations, removeDroneFormation, selectFormation, selectedFormationId,
    updateDroneFormation, reorderDroneFormation, duplicateDroneFormation, clearAllFormations,
    recalculateFormationTimings, setCurrentTime,
  } = useProjectStore();
  const [editId, setEditId] = useState<string | null>(null);

  const totalDuration = droneFormations.reduce((s, f) => s + f.transitionDuration + f.holdDuration, 0);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] text-muted-foreground font-mono">{totalDuration.toFixed(0)}s total</span>
        <div className="flex gap-0.5">
          <button onClick={recalculateFormationTimings} className="text-[8px] text-muted-foreground hover:text-primary px-1 py-0.5 rounded hover:bg-primary/10 transition-colors" title="Recalcular tempos">⏱ Re-sync</button>
          <button onClick={clearAllFormations} className="text-[8px] text-muted-foreground hover:text-destructive px-1 py-0.5 rounded hover:bg-destructive/10 transition-colors" title="Limpar tudo">🗑 Clear</button>
        </div>
      </div>

      <div className="max-h-[340px] overflow-y-auto space-y-0.5">
        {droneFormations.map((f, idx) => {
          const preset = FORMATION_PRESETS.find(p => p.type === f.formationType);
          const endTime = f.startTime + f.transitionDuration + f.holdDuration;
          const isSelected = selectedFormationId === f.id;
          const isEditing = editId === f.id;

          return (
            <div
              key={f.id}
              onClick={() => { selectFormation(f.id); setCurrentTime(f.startTime); }}
              className={cn(
                "group rounded-sm border cursor-pointer text-[10px] relative transition-all duration-200 ease-out",
                isSelected ? "border-primary/50 bg-primary/10 shadow-[0_0_8px_hsl(var(--electric)/0.15)]" : "border-border/30 hover:border-border hover:bg-surface-2/50",
              )}
            >
              <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold" style={{ backgroundColor: f.color + '33', color: f.color, border: `1px solid ${f.color}66` }}>
                {idx + 1}
              </div>

              <div className="pl-4 pr-1 py-1.5">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                  <span className="font-medium text-foreground truncate flex-1">
                    {preset?.icon || '🤖'} {preset?.label || f.formationType}
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditId(isEditing ? null : f.id); }} className="text-muted-foreground hover:text-primary" title="Editar">✏️</button>
                    <button onClick={(e) => { e.stopPropagation(); duplicateDroneFormation(f.id); }} className="text-muted-foreground hover:text-primary" title="Duplicar">📋</button>
                    <button className="text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeDroneFormation(f.id); }} title="Remover">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-0.5">
                  <span className="font-mono-code text-muted-foreground">{f.startTime.toFixed(0)}s</span>
                  <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(f.transitionDuration / (f.transitionDuration + f.holdDuration)) * 100}%`, background: `linear-gradient(90deg, ${f.color}66, ${f.color})` }} />
                  </div>
                  <span className="font-mono-code text-muted-foreground">{endTime.toFixed(0)}s</span>
                </div>

                <div className="flex gap-2 mt-0.5 text-[8px] font-mono-code text-muted-foreground">
                  <span>{f.droneCount}🤖</span>
                  <span>{f.height}m ↑</span>
                  <span>{f.transitionDuration}s→</span>
                  <span>{f.holdDuration}s⏸</span>
                </div>

                {isEditing && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/30 space-y-1" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <span className="text-[7px] text-muted-foreground uppercase">Altura</span>
                        <Input type="number" value={f.height} onChange={(e) => updateDroneFormation(f.id, { height: Number(e.target.value) })} className="h-5 text-[9px] bg-surface-3 border-border/50" />
                      </div>
                      <div>
                        <span className="text-[7px] text-muted-foreground uppercase">Transição</span>
                        <Input type="number" value={f.transitionDuration} onChange={(e) => updateDroneFormation(f.id, { transitionDuration: Number(e.target.value) })} className="h-5 text-[9px] bg-surface-3 border-border/50" />
                      </div>
                      <div>
                        <span className="text-[7px] text-muted-foreground uppercase">Hold</span>
                        <Input type="number" value={f.holdDuration} onChange={(e) => updateDroneFormation(f.id, { holdDuration: Number(e.target.value) })} className="h-5 text-[9px] bg-surface-3 border-border/50" />
                      </div>
                      <div>
                        <span className="text-[7px] text-muted-foreground uppercase">Cor</span>
                        <input type="color" value={f.color} onChange={(e) => updateDroneFormation(f.id, { color: e.target.value })} className="w-full h-5 rounded border border-border/50 cursor-pointer" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Tab: Presets ───────────────────────────────────────────── */

function PresetsTab({ selectedType, onSelect }: { selectedType: FormationType; onSelect: (t: FormationType) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2 mb-1">Formas Geométricas</p>
      {FORMATION_PRESETS.map((preset) => (
        <button
          key={preset.type}
          onClick={() => onSelect(preset.type)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left transition-colors text-xs',
            selectedType === preset.type
              ? 'bg-primary/15 text-primary border border-primary/30'
              : 'hover:bg-surface-3 text-secondary-foreground border border-transparent'
          )}
        >
          <span className="text-base">{preset.icon}</span>
          <div>
            <p className="font-medium">{preset.label}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Tab: SVG Import ────────────────────────────────────────── */

function SVGImportTab({ droneCount, onPoints }: {
  droneCount: number;
  onPoints: (points: { x: number; z: number }[], name: string) => void;
}) {
  const [svgContent, setSvgContent] = useState('');
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setSvgContent(reader.result as string);
    reader.readAsText(file);
  }, []);

  const handleParse = useCallback(() => {
    const content = svgContent.trim();
    if (!content) return;
    const isSVG = content.startsWith('<');
    const svgStr = isSVG ? content : `<svg><path d="${content}"/></svg>`;
    const result = parseSVGToFormation(svgStr, droneCount);
    if (result.points.length === 0) { toast.error('Nenhum path encontrado no SVG'); return; }
    onPoints(result.points, fileName || 'SVG Import');
    toast.success(`${result.points.length} pontos extraídos de ${result.pathCount} path(s)`);
  }, [svgContent, droneCount, fileName, onPoints]);

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">SVG → Formação</p>
      <input ref={fileRef} type="file" accept=".svg" className="hidden" onChange={handleFile} />
      <button onClick={() => fileRef.current?.click()} className="w-full h-14 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
        <FileCode className="h-4 w-4" />
        <span className="text-[9px]">{fileName || 'Carregar .svg'}</span>
      </button>
      <Textarea
        placeholder="Ou cole SVG / path data aqui...&#10;Ex: M50,0 L100,100 L0,100 Z"
        value={svgContent.length > 500 ? `[SVG carregado: ${svgContent.length} chars]` : svgContent}
        onChange={(e) => setSvgContent(e.target.value)}
        className="h-14 text-[9px] bg-surface-2 border-border resize-none font-mono-code"
      />
      <Button size="sm" className="w-full h-7 text-xs" disabled={!svgContent.trim()} onClick={handleParse}>
        <FileCode className="h-3 w-3 mr-1" />
        Converter ({droneCount} drones)
      </Button>
    </div>
  );
}

/* ── Tab: 3D Model Import ──────────────────────────────────── */

function Model3DTab({ droneCount, radius, onPoints }: {
  droneCount: number;
  radius: number;
  onPoints: (points: { x: number; z: number }[], name: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [projection, setProjection] = useState<ProjectionMode>('top-down');
  const [sampling, setSampling] = useState<SamplingMode>('surface');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ModelParseResult | null>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_EXTENSIONS.includes(ext as any) && ext !== 'kml') {
      toast.error(`Formato .${ext} não suportado.`);
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setResult(null);
    try {
      const res = ext === 'kml'
        ? await parseKMZToFormation(file, droneCount, radius)
        : await parseModelToFormation(file, droneCount, radius, projection, sampling);
      setResult(res);
      onPoints(res.points, res.modelName);
      toast.success(`"${res.modelName}" → ${res.points.length} drones`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar modelo 3D');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [droneCount, radius, projection, sampling, onPoints]);

  const projections: { id: ProjectionMode; label: string; icon: string }[] = [
    { id: 'top-down', label: 'Topo', icon: '⬇️' },
    { id: 'front', label: 'Frente', icon: '➡️' },
    { id: 'side', label: 'Lateral', icon: '↗️' },
    { id: 'isometric', label: 'Iso', icon: '🔷' },
  ];

  const samplingModes: { id: SamplingMode; label: string }[] = [
    { id: 'surface', label: '◼ Superfície' },
    { id: 'edges', label: '△ Arestas' },
    { id: 'silhouette', label: '◯ Silhueta' },
    { id: 'vertices', label: '• Vértices' },
  ];

  const acceptStr = SUPPORTED_EXTENSIONS.map(e => `.${e}`).join(',') + ',.kml';

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">3D Model → Formação</p>
      <div className="space-y-1">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase">Projeção</span>
        <div className="grid grid-cols-4 gap-0.5">
          {projections.map((p) => (
            <button key={p.id} onClick={() => setProjection(p.id)} className={cn("px-1 py-1 rounded-sm text-[8px] border transition-colors text-center", projection === p.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-surface-2 text-muted-foreground hover:text-foreground")}>
              <div>{p.icon}</div><div>{p.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase">Amostragem</span>
        <div className="grid grid-cols-2 gap-0.5">
          {samplingModes.map((s) => (
            <button key={s.id} onClick={() => setSampling(s.id)} className={cn("px-1.5 py-1 rounded-sm text-[8px] border transition-colors text-left", sampling === s.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 bg-surface-2 text-muted-foreground hover:text-foreground")}>
              <div className="font-semibold">{s.label}</div>
            </button>
          ))}
        </div>
      </div>
      <input ref={fileRef} type="file" accept={acceptStr} className="hidden" onChange={handleFile} />
      <button onClick={() => fileRef.current?.click()} disabled={parsing} className="w-full h-16 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50">
        {parsing ? (<><Loader2 className="h-4 w-4 animate-spin" /><span className="text-[9px]">Processando...</span></>) : (<><Box className="h-5 w-5" /><span className="text-[9px]">{fileName || 'Importar modelo 3D'}</span></>)}
      </button>
      {result && (
        <div className="bg-surface-2 rounded-sm p-2 space-y-1 text-[9px] font-mono-code">
          <div className="flex justify-between text-primary font-semibold"><span>{result.format}</span><span>Score: {result.quality.score}/100</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Vértices</span><span className="text-foreground">{result.originalVertexCount.toLocaleString()}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>→ Drones</span><span className="text-foreground">{result.points.length}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Bbox</span><span className="text-foreground">{result.boundingBox.width}×{result.boundingBox.height}×{result.boundingBox.depth}m</span></div>
        </div>
      )}
      <p className="text-[8px] text-muted-foreground">Suporta: .OBJ, .STL, .GLB, .GLTF, .SKP, .DAE, .PLY, .KML</p>
    </div>
  );
}

/* ── Main FormationBuilder (Simplified) ──────────────────────── */

export default function FormationBuilder({ open, onOpenChange }: FormationBuilderProps) {
  const { droneFormations, addDroneFormation, materializeFormation } = useProjectStore();
  const [activeTab, setActiveTab] = useState<GenerationTab>('presets');
  const [selectedType, setSelectedType] = useState<FormationType>('circle');
  const [count, setCount] = useState(() => droneFormations.length > 0 ? droneFormations[0].droneCount : 24);
  const [radius, setRadius] = useState(10);
  const [spacing, setSpacing] = useState(2);
  const [rotation, setRotation] = useState(0);
  const [height, setHeight] = useState(20);
  const [transitionDuration, setTransitionDuration] = useState(10);
  const [holdDuration, setHoldDuration] = useState(15);
  const [color, setColor] = useState('#00B4D8');
  const [endColor, setEndColor] = useState('#00B4D8');
  const [colorTransition, setColorTransition] = useState<ColorTransitionMode>('linear');
  const [importedPoints, setImportedPoints] = useState<FormationPoint[] | null>(null);

  const lastFormationEnd = useMemo(() => {
    if (droneFormations.length === 0) return 0;
    const last = droneFormations[droneFormations.length - 1];
    return last.startTime + last.transitionDuration + last.holdDuration;
  }, [droneFormations]);

  const config: FormationConfig = useMemo(
    () => ({ type: selectedType, count, radius, spacing, rotation }),
    [selectedType, count, radius, spacing, rotation]
  );

  const presetPoints = useMemo(() => generateFormation(config), [config]);
  const displayPoints = importedPoints || presetPoints;

  const handleApply = () => {
    const formation: DroneFormation = {
      id: `form-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      formationType: importedPoints ? 'imported' : selectedType,
      droneCount: displayPoints.length > 0 ? displayPoints.length : count,
      height,
      radius,
      spacing,
      rotation,
      startTime: lastFormationEnd,
      transitionDuration,
      holdDuration,
      color,
      endColor: endColor !== color ? endColor : undefined,
      colorTransition: colorTransition !== 'instant' ? colorTransition : 'instant',
      points: displayPoints.map(p => ({ x: p.x, z: p.z })),
    };
    addDroneFormation(formation);
    materializeFormation(formation);
    toast.success(`Formação materializada: ${formation.droneCount} drones`);
    setImportedPoints(null);
    onOpenChange(false);
  };

  const needsRadius = ['heart', 'star', 'circle', 'wave', 'spiral', 'diamond', 'cross', 'double-helix', 'firework'].includes(selectedType);
  const needsSpacing = ['grid', 'line', 'v-shape'].includes(selectedType);
  const maxTransitionDistance = Math.sqrt(radius * radius + height * height) * 2;

  const tabs: { id: GenerationTab; label: string; icon: React.ElementType }[] = [
    { id: 'presets', label: 'Presets', icon: Plus },
    { id: 'svg', label: 'SVG', icon: FileCode },
    { id: '3d-model', label: '3D', icon: Box },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-card border-border p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            Formation Builder
            <span className="text-[10px] font-normal text-muted-foreground bg-surface-2 px-2 py-0.5 rounded">
              #{droneFormations.length + 1} · {count} drones
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); if (id === 'presets') setImportedPoints(null); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2",
                activeTab === id ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-surface-2/50"
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex">
          {/* Left: Tab content */}
          <div className="w-[180px] border-r border-border p-2 overflow-y-auto max-h-[480px]">
            {activeTab === 'presets' && <PresetsTab selectedType={selectedType} onSelect={setSelectedType} />}
            {activeTab === 'svg' && (
              <SVGImportTab droneCount={count} onPoints={(points, name) => { setImportedPoints(points); toast.success(`SVG "${name}" convertido`); }} />
            )}
            {activeTab === '3d-model' && (
              <Model3DTab droneCount={count} radius={radius} onPoints={(points, name) => { setImportedPoints(points); toast.success(`"${name}" convertido`); }} />
            )}
          </div>

          {/* Center: Preview + Parameters */}
          <div className="flex-1 p-3 space-y-2">
            <FormationPreview points={displayPoints} />

            <div className="space-y-2">
              <SliderField label="Drones" value={count} onChange={setCount} min={4} max={2000} step={1} />

              {activeTab === 'presets' && needsRadius && <SliderField label="Raio" value={radius} onChange={setRadius} min={2} max={50} step={1} unit="m" />}
              {activeTab === 'presets' && needsSpacing && <SliderField label="Espaçamento" value={spacing} onChange={setSpacing} min={0.5} max={10} step={0.5} unit="m" />}
              {activeTab === 'presets' && <SliderField label="Rotação" value={rotation} onChange={setRotation} min={0} max={360} step={5} unit="°" />}

              <div className="border-t border-border pt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Coreografia</p>
                <SliderField label="Altura" value={height} onChange={setHeight} min={5} max={120} step={1} unit="m" />
                <SliderField label="Transição" value={transitionDuration} onChange={setTransitionDuration} min={3} max={60} step={1} unit="s" />
                <SliderField label="Hold" value={holdDuration} onChange={setHoldDuration} min={3} max={120} step={1} unit="s" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Cor</span>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded border border-border cursor-pointer" />
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase ml-2">→</span>
                  <input type="color" value={endColor} onChange={e => setEndColor(e.target.value)} className="w-6 h-6 rounded border border-border cursor-pointer" />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {([
                    { id: 'instant', label: '⚡ Instant' },
                    { id: 'linear', label: '↗️ Linear' },
                    { id: 'pulse', label: '💫 Pulse' },
                    { id: 'rainbow', label: '🌈 Rainbow' },
                    { id: 'wave', label: '🌊 Wave' },
                    { id: 'rgb_cycle', label: '🔴🟢🔵 RGB' },
                    { id: 'cascade', label: '🏞️ Cascade' },
                    { id: 'sparkle', label: '✨ Sparkle' },
                  ] as { id: ColorTransitionMode; label: string }[]).map(m => (
                    <button key={m.id} onClick={() => setColorTransition(m.id)} className={cn("px-1.5 py-0.5 rounded text-[8px] border transition-colors", colorTransition === m.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface-2 text-muted-foreground hover:text-foreground")}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeline info */}
              <div className="bg-surface-2 rounded-sm p-2 text-[10px] font-mono-code text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>Início</span><span className="text-foreground">{lastFormationEnd.toFixed(1)}s</span></div>
                <div className="flex justify-between"><span>Fim</span><span className="text-foreground">{(lastFormationEnd + transitionDuration + holdDuration).toFixed(1)}s</span></div>
                <div className="flex justify-between">
                  <span>Vel. Máx.</span>
                  <span className={cn("text-foreground", maxTransitionDistance / transitionDuration > 15 && "text-destructive")}>
                    {(maxTransitionDistance / transitionDuration).toFixed(1)} m/s {maxTransitionDistance / transitionDuration > 15 && "⚠️"}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button size="sm" className="flex-1 text-xs h-8 bg-primary text-primary-foreground" onClick={handleApply} disabled={displayPoints.length === 0}>
                <Plus className="h-3 w-3 mr-1" />
                Materializar ({displayPoints.length})
              </Button>
            </div>
          </div>

          {/* Right: Formation queue */}
          <div className="w-[160px] border-l border-border p-2 space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-1 mb-1">
              Coreografia ({droneFormations.length})
            </p>
            {droneFormations.length === 0 ? (
              <p className="text-[9px] text-muted-foreground px-1">Nenhuma formação</p>
            ) : (
              <FormationQueue />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
