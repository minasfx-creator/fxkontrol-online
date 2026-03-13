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
import { Trash2, Plus, MessageSquare, Image, Sparkles, Loader2, Wand2, Film, FileCode, Box, Upload } from 'lucide-react';
import { parseSVGToFormation } from '@/lib/svgParser';
import { parseModelToFormation, parseKMZToFormation, SUPPORTED_EXTENSIONS, type ProjectionMode, type SamplingMode, type ModelParseResult } from '@/lib/modelToFormation';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface FormationBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GenerationTab = 'presets' | 'text' | 'image' | 'svg' | '3d-model' | 'generative' | 'full-show';

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
  const [loadingPhase, setLoadingPhase] = useState<string>('');
  const [aiPoints, setAiPoints] = useState<FormationPoint[] | null>(null);
  const [aiMeta, setAiMeta] = useState<{ name: string; height: number; transition: number; model?: string } | null>(null);

  const generate = useCallback(async (mode: 'text' | 'image' | 'generative', prompt: string, droneCount: number, imageBase64?: string) => {
    setLoading(true);
    setAiPoints(null);
    setAiMeta(null);
    setLoadingPhase(mode === 'image' ? 'Analisando imagem...' : mode === 'generative' ? 'Criando padrão criativo...' : 'Interpretando forma...');
    try {
      const { droneFormations } = useProjectStore.getState();
      const lastFormation = droneFormations.length > 0 ? droneFormations[droneFormations.length - 1] : null;
      const previousFormation = lastFormation?.points?.slice(0, droneCount);

      setLoadingPhase('Gerando coordenadas com IA...');
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { mode, prompt, droneCount, imageBase64, previousFormation },
      });
      if (error) {
        const errMsg = (data as any)?.error || error.message || String(error);
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);

      setLoadingPhase('Processando resultado...');
      const pts: FormationPoint[] = (data.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));

      setAiPoints(pts);
      setAiMeta({
        name: data.formationName || 'AI Formation',
        height: data.suggestedHeight || 25,
        transition: data.suggestedTransitionTime || 12,
        model: data.model,
      });

      const accuracy = pts.length === droneCount ? '✓ perfeito' : `⚠ ${pts.length}/${droneCount} (corrigido)`;
      toast.success(`"${data.formationName}" ${accuracy}`, {
        description: `${pts.length} drones · ${data.suggestedHeight}m · ${data.model || 'AI'}`,
      });
    } catch (e: any) {
      const msg = e.message || 'Erro ao gerar formação';
      if (msg.includes('429') || msg.includes('Limite')) {
        toast.error('Limite de requisições excedido', { description: 'Aguarde alguns segundos e tente novamente.' });
      } else if (msg.includes('402') || msg.includes('Créditos')) {
        toast.error('Créditos esgotados', { description: 'Adicione créditos no seu workspace.' });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, []);

  const generateTrajectory = useCallback(async (prompt: string, droneCount: number) => {
    setLoading(true);
    setLoadingPhase('Gerando coreografia...');
    try {
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { generateTrajectory: true, prompt, droneCount },
      });
      if (error) {
        const errMsg = (data as any)?.error || error.message || String(error);
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(`Coreografia gerada: ${data.phases?.length || 0} fases · ${data.totalDuration}s`);
      return data;
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar coreografia');
      return null;
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, []);

  const generateFullShow = useCallback(async (prompt: string, droneCount: number) => {
    setLoading(true);
    setLoadingPhase('Desenhando show completo com IA...');
    try {
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { generateFullShow: true, prompt, droneCount },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast.success(`Show "${data.showName}" gerado!`, {
        description: `${data.formations?.length || 0} formações · ${data.totalDuration}s · ${data.model || 'AI'}`,
      });
      return data;
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar show');
      return null;
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, []);

  return { loading, loadingPhase, aiPoints, aiMeta, generate, generateTrajectory, generateFullShow, setAiPoints };
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

function GenerativeAITab({ droneCount, onGenerate, onGenerateTrajectory, loading, loadingPhase }: {
  droneCount: number;
  onGenerate: (theme: string) => void;
  onGenerateTrajectory: (prompt: string) => void;
  loading: boolean;
  loadingPhase: string;
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
        <div className="flex items-center gap-2 text-[10px] text-primary animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          {loadingPhase || 'Gerando com modelo avançado...'}
        </div>
      )}
    </div>
  );
}

/* ── Tab: Full Show AI ─────────────────────────────────────── */

function FullShowTab({ droneCount, onGenerateFullShow, loading, loadingPhase }: {
  droneCount: number;
  onGenerateFullShow: (prompt: string) => void;
  loading: boolean;
  loadingPhase: string;
}) {
  const [prompt, setPrompt] = useState('');
  const showThemes = [
    { id: 'new-year', label: 'Réveillon', emoji: '🎆', prompt: 'Celebração de Ano Novo com contagem regressiva, fogos e estrelas' },
    { id: 'wedding', label: 'Casamento', emoji: '💒', prompt: 'Casamento romântico com corações, anéis e borboletas' },
    { id: 'national', label: 'Pátria', emoji: '🇧🇷', prompt: 'Celebração patriótica com bandeira do Brasil, estrelas e mapa do país' },
    { id: 'christmas', label: 'Natal', emoji: '🎄', prompt: 'Natal com árvore, estrela de Belém, sino e floco de neve' },
    { id: 'nature', label: 'Natureza', emoji: '🌍', prompt: 'Homenagem à natureza com borboleta, árvore, onda do mar e sol' },
    { id: 'space', label: 'Espaço', emoji: '🚀', prompt: 'Exploração espacial com foguete, planeta, estrelas e galáxia espiral' },
    { id: 'music', label: 'Musical', emoji: '🎵', prompt: 'Show musical com notas musicais, clave de sol, guitarra e coração pulsante' },
    { id: 'sports', label: 'Esportes', emoji: '⚽', prompt: 'Evento esportivo com bola, troféu, estrela e círculos olímpicos' },
  ];

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">🎬 Show Completo por IA</p>
      <p className="text-[9px] text-muted-foreground">
        Gera automaticamente 4-6 formações com cores, alturas e transições otimizadas.
      </p>

      <div className="grid grid-cols-2 gap-1">
        {showThemes.map((theme) => (
          <button
            key={theme.id}
            disabled={loading}
            onClick={() => onGenerateFullShow(theme.prompt)}
            className="flex items-center gap-1.5 px-2 py-2 rounded-sm text-left transition-colors text-[10px] bg-surface-2 hover:bg-surface-3 border border-border/50 hover:border-primary/30 disabled:opacity-50"
          >
            <span className="text-sm">{theme.emoji}</span>
            <span className="text-foreground">{theme.label}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-border pt-2 space-y-1.5">
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tema Personalizado</p>
        <Textarea
          placeholder="Descreva o tema do show... Ex: 'homenagem aos 100 anos da cidade com marcos históricos'"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="h-14 text-xs bg-surface-2 border-border resize-none"
        />
        <Button
          size="sm"
          className="w-full h-7 text-xs"
          disabled={loading || !prompt.trim()}
          onClick={() => onGenerateFullShow(prompt)}
        >
          {loading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Film className="h-3 w-3 mr-1" />}
          Gerar Show Completo ({droneCount} drones)
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[10px] text-primary animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          {loadingPhase || 'Desenhando show com IA avançada...'}
        </div>
      )}
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
    
    // If user pasted raw path data, wrap it in SVG
    const isSVG = content.startsWith('<');
    const svgStr = isSVG ? content : `<svg><path d="${content}"/></svg>`;
    
    const result = parseSVGToFormation(svgStr, droneCount);
    if (result.points.length === 0) {
      toast.error('Nenhum path encontrado no SVG');
      return;
    }
    onPoints(result.points, fileName || 'SVG Import');
    toast.success(`${result.points.length} pontos extraídos de ${result.pathCount} path(s)`);
  }, [svgContent, droneCount, fileName, onPoints]);

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">SVG → Formação</p>
      <input ref={fileRef} type="file" accept=".svg" className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full h-14 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
      >
        <FileCode className="h-4 w-4" />
        <span className="text-[9px]">{fileName || 'Carregar .svg'}</span>
      </button>
      <Textarea
        placeholder="Ou cole SVG / path data aqui...&#10;Ex: M50,0 L100,100 L0,100 Z"
        value={svgContent.length > 500 ? `[SVG carregado: ${svgContent.length} chars]` : svgContent}
        onChange={(e) => setSvgContent(e.target.value)}
        className="h-14 text-[9px] bg-surface-2 border-border resize-none font-mono-code"
      />
      <Button
        size="sm"
        className="w-full h-7 text-xs"
        disabled={!svgContent.trim()}
        onClick={handleParse}
      >
        <FileCode className="h-3 w-3 mr-1" />
        Converter ({droneCount} drones)
      </Button>
      <p className="text-[9px] text-muted-foreground">
        Suporta: path, rect, circle. Importa logos, ícones e formas vetoriais.
      </p>
    </div>
  );
}

/* ── Tab: 3D Model Import ──────────────────────────────────── */

function Model3DTab({ droneCount, radius, onPoints, loading: externalLoading }: {
  droneCount: number;
  radius: number;
  onPoints: (points: { x: number; z: number }[], name: string) => void;
  loading: boolean;
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
      toast.error(`Formato .${ext} não suportado. Use: .OBJ, .STL, .GLB, .GLTF, .SKP, .DAE, .PLY, .KML`);
      return;
    }

    setFileName(file.name);
    setParsing(true);
    setResult(null);

    try {
      let res;
      if (ext === 'kml') {
        res = await parseKMZToFormation(file, droneCount, radius);
      } else {
        res = await parseModelToFormation(file, droneCount, radius, projection, sampling);
      }

      setResult(res);
      onPoints(res.points, res.modelName);
      toast.success(`"${res.modelName}" → ${res.points.length} drones (${res.format}, qualidade: ${res.quality.score}/100)`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar modelo 3D');
      setResult(null);
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

  const samplingModes: { id: SamplingMode; label: string; desc: string }[] = [
    { id: 'surface', label: '◼ Superfície', desc: 'Preenchido' },
    { id: 'edges', label: '△ Arestas', desc: 'Wireframe' },
    { id: 'silhouette', label: '◯ Silhueta', desc: 'Contorno' },
    { id: 'vertices', label: '• Vértices', desc: 'Raw' },
  ];

  const acceptStr = SUPPORTED_EXTENSIONS.map(e => `.${e}`).join(',') + ',.kml';

  return (
    <div className="space-y-2 p-1">
      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">3D Model → Formação</p>

      {/* Projection mode */}
      <div className="space-y-1">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase">Projeção</span>
        <div className="grid grid-cols-4 gap-0.5">
          {projections.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjection(p.id)}
              className={cn(
                "px-1 py-1 rounded-sm text-[8px] border transition-colors text-center",
                projection === p.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-surface-2 text-muted-foreground hover:text-foreground"
              )}
            >
              <div>{p.icon}</div>
              <div>{p.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Sampling mode */}
      <div className="space-y-1">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase">Amostragem</span>
        <div className="grid grid-cols-2 gap-0.5">
          {samplingModes.map((s) => (
            <button
              key={s.id}
              onClick={() => setSampling(s.id)}
              className={cn(
                "px-1.5 py-1 rounded-sm text-[8px] border transition-colors text-left",
                sampling === s.id
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-surface-2 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="font-semibold">{s.label}</div>
              <div className="text-[7px] opacity-70">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* File input */}
      <input ref={fileRef} type="file" accept={acceptStr} className="hidden" onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={parsing}
        className="w-full h-16 border-2 border-dashed border-border rounded-sm flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors disabled:opacity-50"
      >
        {parsing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[9px]">Processando geometria...</span>
          </>
        ) : (
          <>
            <Box className="h-5 w-5" />
            <span className="text-[9px]">{fileName || 'Importar modelo 3D'}</span>
          </>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="bg-surface-2 rounded-sm p-2 space-y-1 text-[9px] font-mono-code">
          <div className="flex justify-between text-primary font-semibold">
            <span>{result.format}</span>
            <span>Score: {result.quality.score}/100</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Vértices</span>
            <span className="text-foreground">{result.originalVertexCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Triângulos</span>
            <span className="text-foreground">{result.triangleCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>→ Drones</span>
            <span className="text-foreground">{result.points.length}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Bbox</span>
            <span className="text-foreground">{result.boundingBox.width}×{result.boundingBox.height}×{result.boundingBox.depth}m</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Espaçamento médio</span>
            <span className="text-foreground">{result.quality.avgSpacing}m</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Modo</span>
            <span className="text-foreground">{result.samplingUsed}</span>
          </div>
        </div>
      )}

      <div className="text-[8px] text-muted-foreground space-y-0.5">
        <p className="font-semibold">Formatos suportados:</p>
        <p>• <span className="text-foreground">.SKP</span> — SketchUp nativo</p>
        <p>• <span className="text-foreground">.OBJ</span> — SketchUp, Blender, 3ds Max</p>
        <p>• <span className="text-foreground">.STL</span> — CAD, impressão 3D</p>
        <p>• <span className="text-foreground">.DAE</span> — Collada (SketchUp export)</p>
        <p>• <span className="text-foreground">.GLTF / .GLB</span> — Google Maps 3D</p>
        <p>• <span className="text-foreground">.PLY</span> — Point clouds, scans</p>
        <p>• <span className="text-foreground">.KML</span> — Google Earth</p>
      </div>

      <div className="border-t border-border pt-1.5 text-[8px] text-muted-foreground space-y-1">
        <p className="font-semibold">💡 Dicas:</p>
        <p>• <span className="text-foreground">SketchUp</span>: File → Export → .OBJ ou .DAE (melhor resultado)</p>
        <p>• <span className="text-foreground">.SKP direto</span>: funciona, mas .OBJ/.DAE tem mais precisão</p>
        <p>• <span className="text-foreground">Silhueta</span>: ideal para logos e contornos</p>
        <p>• <span className="text-foreground">Arestas</span>: wireframe — ótimo para prédios</p>
      </div>
    </div>
  );
}

/* ── Main FormationBuilder ─────────────────────────────────── */

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

  const { loading: aiLoading, loadingPhase: aiLoadingPhase, aiPoints, aiMeta, generate: aiGenerate, generateTrajectory: aiGenerateTrajectory, generateFullShow: aiGenerateFullShow, setAiPoints } = useAIFormation();

  const lastFormationEnd = useMemo(() => {
    if (droneFormations.length === 0) return 0;
    const last = droneFormations[droneFormations.length - 1];
    return last.startTime + last.transitionDuration + last.holdDuration;
  }, [droneFormations]);

  const isFirstFormation = droneFormations.length === 0;
  const effectiveCount = count;

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

  const handleFullShowApply = async (prompt: string) => {
    const result = await aiGenerateFullShow(prompt, effectiveCount);
    if (!result?.formations?.length) return;
    
    let currentEnd = lastFormationEnd;
    for (const f of result.formations) {
      const formation: DroneFormation = {
        id: `form-${Date.now()}-${Math.random().toString(36).slice(2, 5)}-${Math.random().toString(36).slice(2, 4)}`,
        formationType: 'ai-generated',
        droneCount: f.points.length,
        height: f.height,
        radius: 10,
        spacing: 2,
        rotation: 0,
        startTime: currentEnd,
        transitionDuration: f.transitionDuration,
        holdDuration: f.holdDuration,
        color: f.color,
        endColor: f.endColor || undefined,
        colorTransition: f.colorTransition || 'linear',
        points: f.points.map((p: any) => ({ x: p.x, z: p.z })),
      };
      addDroneFormation(formation);
      materializeFormation(formation);
      currentEnd += f.transitionDuration + f.holdDuration;
    }
    toast.success(`Show "${result.showName}" materializado: ${result.formations.length} formações`);
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
    { id: 'svg', label: 'SVG', icon: FileCode },
    { id: '3d-model', label: '3D', icon: Box },
    { id: 'generative', label: 'IA', icon: Sparkles },
    { id: 'full-show', label: 'Show', icon: Film },
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
            {activeTab === 'svg' && (
              <SVGImportTab
                droneCount={effectiveCount}
                onPoints={(points, name) => {
                  setAiPoints(points);
                  toast.success(`SVG "${name}" convertido`);
                }}
              />
            )}
            {activeTab === '3d-model' && (
              <Model3DTab
                droneCount={effectiveCount}
                radius={radius}
                loading={aiLoading}
                onPoints={(points, name) => {
                  setAiPoints(points);
                  toast.success(`Modelo "${name}" convertido em formação`);
                }}
              />
            )}
            {activeTab === 'generative' && (
              <GenerativeAITab
                droneCount={effectiveCount}
                loading={aiLoading}
                loadingPhase={aiLoadingPhase}
                onGenerate={(theme) => aiGenerate('generative', theme, effectiveCount)}
                onGenerateTrajectory={(prompt) => aiGenerateTrajectory(prompt, effectiveCount)}
              />
            )}
            {activeTab === 'full-show' && (
              <FullShowTab
                droneCount={effectiveCount}
                loading={aiLoading}
                loadingPhase={aiLoadingPhase}
                onGenerateFullShow={handleFullShowApply}
              />
            )}
          </div>

          {/* Center: Preview + Parameters */}
          <div className="flex-1 p-3 space-y-2">
            <FormationPreview points={displayPoints} />

            <div className="space-y-2">
              {/* Drone count — always visible */}
              <SliderField label="Drones" value={count} onChange={setCount} min={4} max={2000} step={1} />
              {!isFirstFormation && droneFormations[0]?.droneCount !== count && (
                <p className="text-[8px] text-yellow-400">⚠ Frota original: {droneFormations[0].droneCount} — será normalizado</p>
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
