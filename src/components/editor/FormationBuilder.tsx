import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Trash2, Plus, MessageSquare, Image, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FormationBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GenerationTab = 'presets' | 'text' | 'image' | 'generative';

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
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;

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
    <canvas
      ref={canvasRef}
      width={280}
      height={220}
      className="rounded-sm border border-border w-full"
      style={{ imageRendering: 'auto' }}
    />
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

/* ── AI Generation Hook ────────────────────────────────────── */

function useAIFormation() {
  const [loading, setLoading] = useState(false);
  const [aiPoints, setAiPoints] = useState<FormationPoint[] | null>(null);
  const [aiMeta, setAiMeta] = useState<{ name: string; height: number; transition: number; model?: string } | null>(null);

  const generate = useCallback(async (mode: 'text' | 'image' | 'generative', prompt: string, droneCount: number, imageBase64?: string) => {
    setLoading(true);
    setAiPoints(null);
    setAiMeta(null);
    try {
      const { droneFormations } = useProjectStore.getState();
      const lastFormation = droneFormations.length > 0 ? droneFormations[droneFormations.length - 1] : null;
      const previousFormation = lastFormation?.points?.slice(0, droneCount);

      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { mode, prompt, droneCount, imageBase64, previousFormation },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const pts: FormationPoint[] = (data.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));

      setAiPoints(pts);
      setAiMeta({
        name: data.formationName || 'AI Formation',
        height: data.suggestedHeight || 25,
        transition: data.suggestedTransitionTime || 12,
        model: data.model,
      });

      const accuracy = pts.length === droneCount ? '✓' : `⚠ ${pts.length}/${droneCount}`;
      toast.success(`"${data.formationName}" ${accuracy}`, {
        description: `${pts.length} drones · ${data.suggestedHeight}m · raw=${data.rawPointCount} · ${data.model || 'AI'}`,
      });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar formação');
    } finally {
      setLoading(false);
    }
  }, []);

  const generateTrajectory = useCallback(async (prompt: string, droneCount: number) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { generateTrajectory: true, prompt, droneCount },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(`Coreografia gerada: ${data.phases?.length || 0} fases · ${data.totalDuration}s`);
      return data;
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar coreografia');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, aiPoints, aiMeta, generate, generateTrajectory, setAiPoints };
}

/* ── Formation Queue ───────────────────────────────────────── */

function FormationQueue() {
  const { droneFormations, removeDroneFormation, selectFormation, selectedFormationId } = useProjectStore();

  return (
    <div className="space-y-1 max-h-[350px] overflow-y-auto">
      {droneFormations.map((f) => {
        const preset = FORMATION_PRESETS.find(p => p.type === f.formationType);
        const endTime = f.startTime + f.transitionDuration + f.holdDuration;
        return (
          <div
            key={f.id}
            onClick={() => selectFormation(f.id)}
            className={cn(
              "p-1.5 rounded-sm border cursor-pointer transition-colors text-[10px]",
              selectedFormationId === f.id
                ? "border-primary/40 bg-primary/10"
                : "border-transparent hover:bg-surface-3"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span>{preset?.icon || '🤖'}</span>
              <span className="font-medium text-foreground">{preset?.label || f.formationType}</span>
              <button
                className="ml-auto text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); removeDroneFormation(f.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <div className="font-mono-code text-muted-foreground mt-0.5">
              {f.startTime.toFixed(0)}s → {endTime.toFixed(0)}s · {f.height}m · {f.droneCount}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Tab: Presets ───────────────────────────────────────────── */

function PresetsTab({ selectedType, onSelect }: { selectedType: FormationType; onSelect: (t: FormationType) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-2 mb-1">Presets</p>
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

/* ── Tab: Text AI ──────────────────────────────────────────── */

function TextAITab({ droneCount, onGenerate, loading }: {
  droneCount: number;
  onGenerate: (prompt: string) => void;
  loading: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const quickEmojis = ['⭐', '❤️', '🎄', '🎵', '🌙', '🦋', '🔔', '✝️', '☮️', '♾️', '🏠', '🐬'];

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Texto / Emoji → Formação</p>
      
      {/* Quick emoji buttons */}
      <div className="flex flex-wrap gap-1">
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setPrompt(emoji)}
            className={cn(
              "w-7 h-7 rounded-sm text-base flex items-center justify-center border transition-colors",
              prompt === emoji
                ? "border-primary/40 bg-primary/10"
                : "border-border/50 bg-surface-2 hover:bg-surface-3"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>

      <Textarea
        placeholder="Descreva a formação... Ex: 'estrela de 5 pontas', '🌙', 'bandeira do Brasil', ou cole SVG path data"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="h-16 text-xs bg-surface-2 border-border resize-none"
      />
      <Button
        size="sm"
        className="w-full h-7 text-xs"
        disabled={loading || !prompt.trim()}
        onClick={() => onGenerate(prompt)}
      >
        {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <MessageSquare className="h-3 w-3 mr-1" />}
        Gerar com IA ({droneCount} drones)
      </Button>
      <p className="text-[9px] text-muted-foreground">
        Suporta texto, emojis, formas e SVG paths.
      </p>
    </div>
  );
}

/* ── Tab: Image AI ─────────────────────────────────────────── */

function ImageAITab({ droneCount, onGenerate, loading }: {
  droneCount: number;
  onGenerate: (imageBase64: string) => void;
  loading: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!preview) return;
    const base64 = preview.split(',')[1];
    onGenerate(base64);
  }, [preview, onGenerate]);

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Imagem → Formação</p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Preview" className="w-full h-24 object-contain rounded-sm border border-border bg-surface-2" />
          <button
            onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
            className="absolute top-1 right-1 bg-surface-1 rounded-sm p-0.5 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full h-24 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          <Image className="h-5 w-5" />
          <span className="text-[10px]">Carregar imagem</span>
        </button>
      )}
      <Button
        size="sm"
        className="w-full h-7 text-xs"
        disabled={loading || !preview}
        onClick={handleGenerate}
      >
        {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Image className="h-3 w-3 mr-1" />}
        Extrair Formação ({droneCount} drones)
      </Button>
      <p className="text-[9px] text-muted-foreground">
        A IA analisa os contornos da imagem e gera posições de drones.
      </p>
    </div>
  );
}

/* ── Tab: Generative AI ────────────────────────────────────── */

function GenerativeAITab({ droneCount, onGenerate, onGenerateTrajectory, loading }: {
  droneCount: number;
  onGenerate: (theme: string) => void;
  onGenerateTrajectory: (prompt: string) => void;
  loading: boolean;
}) {
  const [trajPrompt, setTrajPrompt] = useState('');
  const themes = [
    { id: 'abstract', label: 'Abstrato Geométrico', emoji: '🔷' },
    { id: 'nature', label: 'Formas da Natureza', emoji: '🌿' },
    { id: 'celebration', label: 'Celebração', emoji: '🎉' },
    { id: 'cosmic', label: 'Cósmico', emoji: '🌌' },
    { id: 'symmetric', label: 'Simetria Radical', emoji: '🔮' },
    { id: 'random', label: 'Surpresa Criativa', emoji: '🎲' },
  ];

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Formação Generativa</p>
      <div className="grid grid-cols-2 gap-1">
        {themes.map((theme) => (
          <button
            key={theme.id}
            disabled={loading}
            onClick={() => onGenerate(theme.label)}
            className="flex items-center gap-1.5 px-2 py-2 rounded-sm text-left transition-colors text-[10px] bg-surface-2 hover:bg-surface-3 border border-border/50 hover:border-primary/30 disabled:opacity-50"
          >
            <span className="text-sm">{theme.emoji}</span>
            <span className="text-foreground">{theme.label}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-border pt-2 space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">🎬 Coreografia por Linguagem</p>
        <Textarea
          placeholder="Descreva a coreografia... Ex: 'expandir em espiral, depois pulsar ritmicamente e convergir ao centro'"
          value={trajPrompt}
          onChange={(e) => setTrajPrompt(e.target.value)}
          className="h-14 text-xs bg-surface-2 border-border resize-none"
        />
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          disabled={loading || !trajPrompt.trim()}
          onClick={() => onGenerateTrajectory(trajPrompt)}
        >
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Gerar Coreografia IA
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[10px] text-primary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Gerando com modelo avançado...
        </div>
      )}
    </div>
  );
}

/* ── Main FormationBuilder ─────────────────────────────────── */

export default function FormationBuilder({ open, onOpenChange }: FormationBuilderProps) {
  const { droneFormations, addDroneFormation, materializeFormation } = useProjectStore();
  const [activeTab, setActiveTab] = useState<GenerationTab>('presets');
  const [selectedType, setSelectedType] = useState<FormationType>('circle');
  const [count, setCount] = useState(24);
  const [radius, setRadius] = useState(10);
  const [spacing, setSpacing] = useState(2);
  const [rotation, setRotation] = useState(0);
  const [height, setHeight] = useState(20);
  const [transitionDuration, setTransitionDuration] = useState(10);
  const [holdDuration, setHoldDuration] = useState(15);
  const [color, setColor] = useState('#00B4D8');
  const [endColor, setEndColor] = useState('#00B4D8');
  const [colorTransition, setColorTransition] = useState<ColorTransitionMode>('linear');

  const { loading: aiLoading, aiPoints, aiMeta, generate: aiGenerate, generateTrajectory: aiGenerateTrajectory, setAiPoints } = useAIFormation();

  const lastFormationEnd = useMemo(() => {
    if (droneFormations.length === 0) return 0;
    const last = droneFormations[droneFormations.length - 1];
    return last.startTime + last.transitionDuration + last.holdDuration;
  }, [droneFormations]);

  const isFirstFormation = droneFormations.length === 0;
  const effectiveCount = isFirstFormation ? count : droneFormations[0].droneCount;

  // Apply AI meta when received
  useEffect(() => {
    if (aiMeta) {
      setHeight(aiMeta.height);
      setTransitionDuration(aiMeta.transition);
    }
  }, [aiMeta]);

  const config: FormationConfig = useMemo(
    () => ({ type: selectedType, count: effectiveCount, radius, spacing, rotation }),
    [selectedType, effectiveCount, radius, spacing, rotation]
  );

  const presetPoints = useMemo(() => generateFormation(config), [config]);

  // Use AI points when available, otherwise preset points
  const displayPoints = activeTab !== 'presets' && aiPoints ? aiPoints : presetPoints;
  const effectivePoints = displayPoints;

  const handleApply = () => {
    const formation: DroneFormation = {
      id: `form-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      formationType: activeTab !== 'presets' && aiPoints ? 'ai-generated' : selectedType,
      droneCount: effectivePoints.length > 0 ? effectivePoints.length : effectiveCount,
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
      points: effectivePoints.map(p => ({ x: p.x, z: p.z })),
    };
    addDroneFormation(formation);
    materializeFormation(formation);
    toast.success(`Formação materializada: ${formation.droneCount} drone pads + trajetórias criados`);
    setAiPoints(null);
    onOpenChange(false);
  };

  const needsRadius = ['heart', 'star', 'circle', 'wave', 'spiral', 'diamond', 'cross', 'double-helix', 'firework'].includes(selectedType);
  const needsSpacing = ['grid', 'line', 'v-shape'].includes(selectedType);

  const maxTransitionDistance = Math.sqrt(radius * radius + height * height) * 2;
  const minTransitionTime = Math.ceil(maxTransitionDistance / 15);

  const tabs: { id: GenerationTab; label: string; icon: React.ElementType }[] = [
    { id: 'presets', label: 'Presets', icon: Plus },
    { id: 'text', label: 'Texto', icon: MessageSquare },
    { id: 'image', label: 'Imagem', icon: Image },
    { id: 'generative', label: 'IA', icon: Sparkles },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] bg-card border-border p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
            Formation Builder
            {!isFirstFormation && (
              <span className="text-[10px] font-normal text-muted-foreground bg-surface-2 px-2 py-0.5 rounded">
                Formação #{droneFormations.length + 1} · {effectiveCount} drones
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2",
                activeTab === id
                  ? "text-primary border-primary bg-primary/5"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-surface-2/50"
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
            {activeTab === 'presets' && (
              <PresetsTab selectedType={selectedType} onSelect={setSelectedType} />
            )}
            {activeTab === 'text' && (
              <TextAITab
                droneCount={effectiveCount}
                loading={aiLoading}
                onGenerate={(prompt) => aiGenerate('text', prompt, effectiveCount)}
              />
            )}
            {activeTab === 'image' && (
              <ImageAITab
                droneCount={effectiveCount}
                loading={aiLoading}
                onGenerate={(base64) => aiGenerate('image', '', effectiveCount, base64)}
              />
            )}
            {activeTab === 'generative' && (
              <GenerativeAITab
                droneCount={effectiveCount}
                loading={aiLoading}
                onGenerate={(theme) => aiGenerate('generative', theme, effectiveCount)}
                onGenerateTrajectory={(prompt) => aiGenerateTrajectory(prompt, effectiveCount)}
              />
            )}
          </div>

          {/* Center: Preview + Parameters */}
          <div className="flex-1 p-3 space-y-2">
            <FormationPreview points={displayPoints} />

            <div className="space-y-2">
              {isFirstFormation && activeTab === 'presets' && (
                <SliderField label="Drones" value={count} onChange={setCount} min={4} max={500} step={1} />
              )}

              {activeTab === 'presets' && needsRadius && (
                <SliderField label="Raio" value={radius} onChange={setRadius} min={2} max={50} step={1} unit="m" />
              )}

              {activeTab === 'presets' && needsSpacing && (
                <SliderField label="Espaçamento" value={spacing} onChange={setSpacing} min={0.5} max={10} step={0.5} unit="m" />
              )}

              {activeTab === 'presets' && (
                <SliderField label="Rotação" value={rotation} onChange={setRotation} min={0} max={360} step={5} unit="°" />
              )}

              <div className="border-t border-border pt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Coreografia</p>
                <SliderField label="Altura" value={height} onChange={setHeight} min={5} max={120} step={1} unit="m" />
                <SliderField
                  label="Tempo de Transição"
                  value={transitionDuration}
                  onChange={setTransitionDuration}
                  min={Math.max(3, minTransitionTime)}
                  max={60}
                  step={1}
                  unit="s"
                />
                <SliderField label="Tempo em Formação" value={holdDuration} onChange={setHoldDuration} min={3} max={120} step={1} unit="s" />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Cor Início</span>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-6 h-6 rounded border border-border cursor-pointer" />
                  <span className="text-[10px] font-mono-code text-muted-foreground">{color}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Cor Fim</span>
                  <input type="color" value={endColor} onChange={e => setEndColor(e.target.value)} className="w-6 h-6 rounded border border-border cursor-pointer" />
                  <span className="text-[10px] font-mono-code text-muted-foreground">{endColor}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase">Transição de Cor</span>
                  <div className="flex gap-1 flex-wrap">
                    {([
                      { id: 'instant', label: '⚡ Instantânea' },
                      { id: 'linear', label: '↗️ Linear' },
                      { id: 'pulse', label: '💫 Pulsar' },
                      { id: 'rainbow', label: '🌈 Arco-íris' },
                      { id: 'wave', label: '🌊 Onda' },
                    ] as { id: ColorTransitionMode; label: string }[]).map(m => (
                      <button
                        key={m.id}
                        onClick={() => setColorTransition(m.id)}
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] border transition-colors",
                          colorTransition === m.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-surface-2 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timeline info */}
              <div className="bg-surface-2 rounded-sm p-2 text-[10px] font-mono-code text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Início</span>
                  <span className="text-foreground">{lastFormationEnd.toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Formada em</span>
                  <span className="text-foreground">{(lastFormationEnd + transitionDuration).toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Fim</span>
                  <span className="text-foreground">{(lastFormationEnd + transitionDuration + holdDuration).toFixed(1)}s</span>
                </div>
                <div className="flex justify-between">
                  <span>Vel. Máx. Estimada</span>
                  <span className={cn(
                    "text-foreground",
                    maxTransitionDistance / transitionDuration > 15 && "text-destructive"
                  )}>
                    {(maxTransitionDistance / transitionDuration).toFixed(1)} m/s
                    {maxTransitionDistance / transitionDuration > 15 && " ⚠️"}
                  </span>
                </div>
                {activeTab !== 'presets' && aiPoints && (
                  <div className="flex justify-between text-primary">
                    <span>Fonte</span>
                    <span>🤖 IA ({aiMeta?.name})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs h-8 bg-primary text-primary-foreground"
                onClick={handleApply}
                disabled={effectivePoints.length === 0}
              >
                <Plus className="h-3 w-3 mr-1" />
                Materializar ({effectivePoints.length} drones)
              </Button>
            </div>
          </div>

          {/* Right: Formation queue */}
          <div className="w-[180px] border-l border-border p-2 space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider px-1 mb-1">
              Coreografia ({droneFormations.length})
            </p>
            {droneFormations.length === 0 ? (
              <p className="text-[9px] text-muted-foreground px-1">Nenhuma formação adicionada</p>
            ) : (
              <FormationQueue />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
