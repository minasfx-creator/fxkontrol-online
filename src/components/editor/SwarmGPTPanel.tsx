import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Sparkles, Loader2, Wand2, Film, Send, Music, RotateCw, Layers, RefreshCw, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Mode = 'single' | 'full-show' | 'trajectory' | 'music-sync';

const QUICK_PROMPTS = [
  { emoji: '🌀', label: 'Vórtex Cibernético', prompt: 'vortex cibernético com espirais logarítmicas' },
  { emoji: '🦅', label: 'Fênix Renascendo', prompt: 'phoenix rising with spread wings and tail feathers' },
  { emoji: '🇧🇷', label: 'Bandeira Brasil', prompt: 'bandeira do Brasil com losango amarelo e círculo azul' },
  { emoji: '🧬', label: 'DNA Helix', prompt: 'DNA double helix rotating' },
  { emoji: '🌌', label: 'Galáxia Espiral', prompt: 'spiral galaxy with 3 arms and dense core' },
  { emoji: '💎', label: 'Diamante 3D', prompt: 'geodesic diamond with facets' },
  { emoji: '🎵', label: 'Nota Musical', prompt: 'treble clef music note' },
  { emoji: '🏛️', label: 'Coliseu', prompt: 'roman colosseum elliptical structure' },
  { emoji: '🦋', label: 'Borboleta', prompt: 'butterfly with detailed symmetrical wings open wide' },
  { emoji: '❤️', label: 'Coração Batendo', prompt: 'beating heart with pulsing scale animation' },
  { emoji: '🐉', label: 'Dragão', prompt: 'chinese dragon serpentine body with head and claws' },
  { emoji: '🌍', label: 'Globo Terrestre', prompt: 'earth globe with continents and meridians' },
  { emoji: '⚡', label: 'Raio', prompt: 'lightning bolt zigzag with glow effect' },
  { emoji: '🏆', label: 'Troféu', prompt: 'championship trophy cup with handles' },
  { emoji: '🎸', label: 'Guitarra', prompt: 'electric guitar silhouette with neck and body' },
  { emoji: '🕊️', label: 'Pomba da Paz', prompt: 'dove of peace with olive branch flying' },
  { emoji: '❄️', label: 'Floco de Neve', prompt: 'snowflake with 6 fractal arms and branches' },
  { emoji: '👑', label: 'Coroa', prompt: 'royal crown with 5 peaks and jewels' },
];

const SHOW_THEMES = [
  { emoji: '🎆', label: 'Réveillon 2027', prompt: 'Réveillon celebration: countdown 3-2-1, champagne glass, firework burst, heart, 2027 text, stars finale' },
  { emoji: '💒', label: 'Casamento', prompt: 'Wedding: bouquet, hearts, rings interlocked, dove pair, crown, fireworks finale' },
  { emoji: '🎄', label: 'Natal', prompt: 'Christmas: star of Bethlehem, pine tree, bell, snowflake, gift box, peace angel' },
  { emoji: '🚀', label: 'Espaço', prompt: 'Space odyssey: rocket launch, saturn rings, spiral galaxy, constellation, earth, infinity' },
  { emoji: '🌿', label: 'Natureza', prompt: 'Nature evolution: seed sprout, fern leaf, butterfly, flower bloom, tree of life, earth globe' },
  { emoji: '⚡', label: 'Tech Future', prompt: 'Technology: circuit chip, DNA helix, robot head, neural network, globe grid, infinity symbol' },
  { emoji: '🎵', label: 'Musical', prompt: 'Music festival: treble clef, guitar, piano keys, vinyl record, equalizer waves, concert stage' },
  { emoji: '⚽', label: 'Esporte', prompt: 'Sports celebration: soccer ball, trophy cup, torch flame, olympic rings, podium, firework' },
  { emoji: '🎭', label: 'Arte & Cultura', prompt: 'Arts: theater masks, ballet dancer, paintbrush, musical note, mandala, star burst finale' },
  { emoji: '🌅', label: 'Sustentabilidade', prompt: 'Sustainability: water drop, tree, wind turbine, solar panel, recycle symbol, earth' },
  { emoji: '🌀', label: 'Grand Finale', prompt: 'Grand Finale (Ritmo Frenético): Caos controlado e volume máximo. Todos os 300 drones sobem à altitude máxima e iniciam descida em espiral (Vórtex), mudando de cor rapidamente (RGB Cycle). Pirotecnia densa: cakes, shells calibre 10-12, mines, gerbs e waterfall simultâneos. Finale com explosão radiante e chuva de fogos.' },
];

const TRAJECTORY_PRESETS = [
  { emoji: '🌊', label: 'Ondulação', prompt: 'gentle wave oscillation building to stormy seas then calm' },
  { emoji: '💓', label: 'Pulsação', prompt: 'heartbeat pulse rhythm: subtle then strong then fading' },
  { emoji: '🌪️', label: 'Tornado', prompt: 'slow rotation accelerating into tornado then explosive scatter' },
  { emoji: '🌸', label: 'Bloom', prompt: 'flower blooming open from center with petals unfolding' },
  { emoji: '🎆', label: 'Fogos', prompt: 'firework burst: converge to center then explosive expand then rain down' },
  { emoji: '🌌', label: 'Nebulosa', prompt: 'nebula shimmer with slow spiral and cascade color change' },
];

/* ── Normalize point count to match droneCount ───────────── */

function normalizeDroneCount(pts: { x: number; z: number }[], target: number): { x: number; z: number }[] {
  if (pts.length === 0) return [];
  if (pts.length === target) return pts;
  if (pts.length > target) return pts.slice(0, target);
  const result = [...pts];
  let i = 0;
  while (result.length < target) {
    const src = pts[i % pts.length];
    result.push({ x: src.x + (Math.random() - 0.5) * 0.5, z: src.z + (Math.random() - 0.5) * 0.5 });
    i++;
  }
  return result;
}

/* ── Map AI pyro type names to effect library IDs ──────── */

function mapPyroType(type: string): string {
  const map: Record<string, string> = {
    shell: 'shell', mine: 'mine', comet: 'comet', cake: 'cake',
    roman_candle: 'roman_candle', gerb: 'gerb', waterfall: 'waterfall',
    fan: 'fan', flame: 'flame', cryo: 'cryo', salute: 'salute',
    confetti: 'confetti', laser: 'laser', strobe: 'strobe',
  };
  return map[type] || 'shell';
}

/* ── Mini 2D Preview ──────────────────────────────────────── */

function MiniPreview({ points }: { points: { x: number; z: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height, pad = 10;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'hsl(240 6% 6%)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'hsl(240 4% 12%)';
    ctx.lineWidth = 0.5;
    for (let x = pad; x <= w - pad; x += 15) { ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke(); }
    for (let y = pad; y <= h - pad; y += 15) { ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }

    let maxDist = 0;
    for (const p of points) maxDist = Math.max(maxDist, Math.abs(p.x), Math.abs(p.z));
    maxDist = Math.max(maxDist, 1);
    const scale = Math.min(w - pad * 2, h - pad * 2) / (maxDist * 2.2);

    for (const p of points) {
      const px = w / 2 + p.x * scale;
      const py = h / 2 + p.z * scale;
      ctx.beginPath();
      ctx.arc(px, py, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'hsl(207 90% 54%)';
      ctx.fill();
    }

    ctx.fillStyle = 'hsl(240 5% 40%)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${points.length}`, w - pad, h - 3);
  }, [points]);

  return <canvas ref={canvasRef} width={200} height={120} className="rounded-sm border border-border/50 w-full" />;
}

/* ── Main Panel ───────────────────────────────────────────── */

export default function SwarmGPTPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('single');
  const [prompt, setPrompt] = useState('');
  const [droneCount, setDroneCount] = useState(300);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<{ prompt: string; result: string; time: string; points?: { x: number; z: number }[] }[]>([]);
  const [musicSyncBPM, setMusicSyncBPM] = useState(120);
  const [musicSyncBeats, setMusicSyncBeats] = useState(4);
  const [lastGeneratedPoints, setLastGeneratedPoints] = useState<{ x: number; z: number }[]>([]);
  const [showFormationList, setShowFormationList] = useState(false);

  const addDroneFormation = useProjectStore((s) => s.addDroneFormation);
  const addTimelineItem = useProjectStore((s) => s.addTimelineItem);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const bpm = useProjectStore((s) => s.bpm);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setPlaying = useProjectStore((s) => s.setPlaying);
  const clearAllFormations = useProjectStore((s) => s.clearAllFormations);
  const selectFormation = useProjectStore((s) => s.selectFormation);
  const selectedFormationId = useProjectStore((s) => s.selectedFormationId);
  const removeDroneFormation = useProjectStore((s) => s.removeDroneFormation);
  const duplicateDroneFormation = useProjectStore((s) => s.duplicateDroneFormation);
  const reorderDroneFormation = useProjectStore((s) => s.reorderDroneFormation);
  const recalculateFormationTimings = useProjectStore((s) => s.recalculateFormationTimings);
  const updateDroneFormation = useProjectStore((s) => s.updateDroneFormation);

  const generateSingle = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLoadingPhase('Interpretando forma com IA...');
    try {
      const lastFormation = droneFormations.length > 0 ? droneFormations[droneFormations.length - 1] : null;
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { mode: 'text', prompt, droneCount, previousFormation: lastFormation?.points?.slice(0, droneCount) },
      });
      if (error) {
        // Check if data contains a message from the edge function
        const errMsg = (data as any)?.error || error.message || String(error);
        throw new Error(errMsg.includes('402') || errMsg.includes('Créditos') ? '402' : errMsg.includes('429') ? '429' : errMsg);
      }
      if (data?.error) throw new Error(data.error);

      const rawPts = (data.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
      const pts = normalizeDroneCount(rawPts, droneCount);
      setLastGeneratedPoints(pts);

      const lastTime = droneFormations.length > 0
        ? droneFormations[droneFormations.length - 1].startTime + droneFormations[droneFormations.length - 1].transitionDuration + droneFormations[droneFormations.length - 1].holdDuration
        : 0;

      addDroneFormation({
        id: `swarm-${Date.now()}`,
        formationType: 'ai-generated',
        droneCount,
        height: data.suggestedHeight || 30,
        radius: 20,
        spacing: 2,
        rotation: 0,
        startTime: lastTime,
        transitionDuration: data.suggestedTransitionTime || 12,
        holdDuration: 15,
        color: '#00E5FF',
        points: pts,
      });

      // Auto-seek to formation start
      setCurrentTime(lastTime);

      setHistory(prev => [{ prompt, result: `${data.formationName} · ${pts.length} drones`, time: new Date().toLocaleTimeString(), points: pts }, ...prev.slice(0, 9)]);
      toast.success(`"${data.formationName}" gerada`, { description: `${pts.length} drones · ${data.model || 'AI'}` });
    } catch (e: any) {
      handleError(e);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, [prompt, droneCount, droneFormations, addDroneFormation, setCurrentTime]);

  const generateFullShow = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLoadingPhase('Desenhando show completo...');
    try {
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { generateFullShow: true, prompt, droneCount },
      });
      if (error) {
        const errMsg = (data as any)?.error || error.message || String(error);
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);

      let time = 0;
      const allPts: { x: number; z: number }[] = [];
      let pyroCount = 0;
      (data.formations || []).forEach((f: any) => {
        const rawPts = (f.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
        const pts = normalizeDroneCount(rawPts, droneCount);
        if (allPts.length === 0) allPts.push(...pts);
        addDroneFormation({
          id: `show-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          formationType: 'ai-generated',
          droneCount,
          height: f.height || 30,
          radius: 20,
          spacing: 2,
          rotation: 0,
          startTime: time,
          transitionDuration: f.transitionDuration || 12,
          holdDuration: f.holdDuration || 15,
          color: f.color || '#00E5FF',
          endColor: f.endColor,
          colorTransition: f.colorTransition || 'linear',
          points: pts,
        });

        // Insert pyro cues as timeline items
        const holdStart = time + (f.transitionDuration || 12);
        if (f.pyroCues && Array.isArray(f.pyroCues)) {
          f.pyroCues.forEach((cue: any) => {
            const pyroType = mapPyroType(cue.type);
            const effectId = pyroType; // matches effect library IDs
            for (let d = 0; d < (cue.count || 1); d++) {
              const spread = d * 3;
              addTimelineItem({
                id: `pyro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                effectId,
                startTime: holdStart + (cue.fireTime || 0) + d * 0.15,
                trackIndex: 1 + (d % 3),
                position: {
                  x: (cue.positionX || 0) + (d % 2 === 0 ? spread : -spread),
                  y: 0,
                  z: (cue.positionZ || 0),
                },
              });
              pyroCount++;
            }
          });
        }

        time += (f.transitionDuration || 12) + (f.holdDuration || 15);
      });

      setLastGeneratedPoints(allPts);
      setCurrentTime(0);
      setHistory(prev => [{ prompt, result: `Show "${data.showName}" · ${data.formations?.length || 0} formações · ${pyroCount} fogos`, time: new Date().toLocaleTimeString(), points: allPts }, ...prev.slice(0, 9)]);
      if (data.fallback) {
        toast.warning(`Show gerado em modo local (sem IA)`, { description: `${data.formations?.length || 0} formações · ${pyroCount} fogos pirotécnicos`, duration: 8000 });
      } else {
        toast.success(`Show "${data.showName}" gerado!`, { description: `${data.formations?.length || 0} formações · ${pyroCount} fogos · ${data.totalDuration}s` });
      }
    } catch (e: any) {
      handleError(e);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, [prompt, droneCount, addDroneFormation, addTimelineItem, setCurrentTime]);

  const generateMusicSync = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLoadingPhase('Sincronizando com música...');
    try {
      const effectiveBPM = bpm || musicSyncBPM;
      const beatDuration = 60 / effectiveBPM;
      const enhancedPrompt = `${prompt}. Sync to music at ${effectiveBPM} BPM. Create formations that change every ${musicSyncBeats} beats (${(beatDuration * musicSyncBeats).toFixed(1)}s). Use transitions timed to musical phrases.`;
      
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { generateFullShow: true, prompt: enhancedPrompt, droneCount },
      });
      if (error) {
        const errMsg = (data as any)?.error || error.message || String(error);
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);

      let time = 0;
      let pyroCount = 0;
      (data.formations || []).forEach((f: any) => {
        const rawPts = (f.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
        const pts = normalizeDroneCount(rawPts, droneCount);
        const quantizedTransition = Math.round((f.transitionDuration || 8) / beatDuration) * beatDuration;
        const quantizedHold = Math.round((f.holdDuration || 12) / beatDuration) * beatDuration;
        
        addDroneFormation({
          id: `music-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          formationType: 'ai-generated',
          droneCount,
          height: f.height || 30,
          radius: 20,
          spacing: 2,
          rotation: 0,
          startTime: time,
          transitionDuration: quantizedTransition,
          holdDuration: quantizedHold,
          color: f.color || '#00E5FF',
          endColor: f.endColor,
          colorTransition: f.colorTransition || 'pulse',
          points: pts,
        });

        // Insert pyro cues quantized to beats
        const holdStart = time + quantizedTransition;
        if (f.pyroCues && Array.isArray(f.pyroCues)) {
          f.pyroCues.forEach((cue: any) => {
            const quantizedFire = Math.round((cue.fireTime || 0) / beatDuration) * beatDuration;
            const pyroType = mapPyroType(cue.type);
            for (let d = 0; d < (cue.count || 1); d++) {
              addTimelineItem({
                id: `pyro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                effectId: pyroType,
                startTime: holdStart + quantizedFire + d * 0.15,
                trackIndex: 1 + (d % 3),
                position: {
                  x: (cue.positionX || 0) + (d % 2 === 0 ? d * 3 : -d * 3),
                  y: 0,
                  z: (cue.positionZ || 0),
                },
              });
              pyroCount++;
            }
          });
        }

        time += quantizedTransition + quantizedHold;
      });

      setCurrentTime(0);
      toast.success(`Show musical gerado!`, { description: `${effectiveBPM} BPM · ${data.formations?.length || 0} formações · ${pyroCount} fogos` });
    } catch (e: any) {
      handleError(e);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, [prompt, droneCount, bpm, musicSyncBPM, musicSyncBeats, addDroneFormation, addTimelineItem, setCurrentTime]);

  const handleError = (e: any) => {
    const msg = e.message || 'Erro';
    if (msg.includes('429')) toast.error('Rate limit', { description: 'Aguarde e tente novamente.' });
    else if (msg.includes('402')) toast.error('Créditos esgotados');
    else toast.error(msg);
  };

  const handleGenerate = () => {
    if (mode === 'full-show') generateFullShow();
    else if (mode === 'music-sync') generateMusicSync();
    else generateSingle();
  };

  const handlePreview = () => {
    if (droneFormations.length > 0) {
      setCurrentTime(0);
      setPlaying(true);
    }
  };

  const quickList = mode === 'full-show' ? SHOW_THEMES : mode === 'trajectory' ? TRAJECTORY_PRESETS : QUICK_PROMPTS;

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            SwarmGPT
          </span>
          <span className="text-[8px] bg-primary/20 text-primary px-1 py-0.5 rounded font-mono-code">v6</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-border">
        {([
          { id: 'single' as Mode, label: 'Formação', icon: Wand2 },
          { id: 'full-show' as Mode, label: 'Show', icon: Film },
          { id: 'music-sync' as Mode, label: 'Music', icon: Music },
          { id: 'trajectory' as Mode, label: 'Motion', icon: RotateCw },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 text-[8px] font-semibold uppercase transition-colors",
              mode === id ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {/* Drone count */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Drones</span>
            <span className="text-[10px] font-mono-code text-foreground">{droneCount}</span>
          </div>
          <Slider value={[droneCount]} onValueChange={([v]) => setDroneCount(v)} min={50} max={2000} step={10} />
        </div>

        {/* Music sync options */}
        {mode === 'music-sync' && (
          <div className="space-y-1.5 p-2 rounded-sm border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-1">
              <Music className="w-3 h-3 text-primary" />
              <span className="text-[9px] font-semibold text-primary uppercase">Sincronização Musical</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground">BPM</span>
                <span className="text-[10px] font-mono-code">{bpm || musicSyncBPM}</span>
              </div>
              {!bpm && (
                <Slider value={[musicSyncBPM]} onValueChange={([v]) => setMusicSyncBPM(v)} min={60} max={200} step={1} />
              )}
              {bpm && <p className="text-[8px] text-primary">✓ BPM detectado do áudio</p>}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-muted-foreground">Beats por formação</span>
                <span className="text-[10px] font-mono-code">{musicSyncBeats}</span>
              </div>
              <Slider value={[musicSyncBeats]} onValueChange={([v]) => setMusicSyncBeats(v)} min={2} max={16} step={1} />
            </div>
          </div>
        )}

        {/* Quick prompts */}
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase">
            {mode === 'full-show' ? 'Temas de Show' : mode === 'trajectory' ? 'Movimentos' : mode === 'music-sync' ? 'Estilos Musicais' : 'Prompts Rápidos'}
          </span>
          <div className="grid grid-cols-2 gap-1">
            {quickList.map((q) => (
              <button
                key={q.label}
                onClick={() => setPrompt(q.prompt)}
                disabled={loading}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-1 rounded-sm text-[8px] text-left transition-colors border",
                  prompt === q.prompt
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/50 bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-sm">{q.emoji}</span>
                <span className="truncate">{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt input */}
        <Textarea
          placeholder={
            mode === 'full-show' ? "Descreva o tema do show completo..."
            : mode === 'music-sync' ? "Descreva o estilo visual sincronizado com a música..."
            : mode === 'trajectory' ? "Descreva o padrão de movimento..."
            : "Descreva a formação..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !loading && prompt.trim()) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          className="h-16 text-[10px] bg-surface-2 border-border resize-none"
        />

        {/* Generate + Preview buttons */}
        <div className="flex gap-1">
          <Button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="flex-1 h-8 text-[10px] gap-1"
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {loadingPhase}
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                {mode === 'full-show' ? 'Gerar Show' : mode === 'music-sync' ? 'Music Sync' : mode === 'trajectory' ? 'Gerar Motion' : 'Gerar'} ({droneCount})
              </>
            )}
          </Button>
          {droneFormations.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handlePreview}
              title="Preview show"
            >
              <Eye className="w-3 h-3" />
            </Button>
          )}
        </div>
        <p className="text-[8px] text-muted-foreground">Ctrl+Enter para gerar</p>

        {/* 2D Preview of last generation */}
        {lastGeneratedPoints.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Última Geração</span>
            <MiniPreview points={lastGeneratedPoints} />
          </div>
        )}

        {/* Stats */}
        {droneFormations.length > 0 && (
          <div className="flex items-center gap-2 text-[8px] font-mono-code text-muted-foreground bg-surface-2 rounded-sm px-2 py-1">
            <Layers className="w-3 h-3" />
            <span>{droneFormations.length} formações</span>
            <span>·</span>
            <span>{droneFormations.reduce((s, f) => s + f.transitionDuration + f.holdDuration, 0).toFixed(0)}s total</span>
            <span>·</span>
            <span>{droneFormations[0]?.droneCount || 0} drones</span>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Histórico</span>
            {history.map((h, i) => (
              <div
                key={i}
                className="p-1.5 rounded-sm border border-border/50 bg-surface-1/50 text-[8px] font-mono-code cursor-pointer hover:bg-surface-2 group"
                onClick={() => setPrompt(h.prompt)}
              >
                <div className="flex justify-between text-muted-foreground">
                  <span className="truncate flex-1">{h.prompt}</span>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                    <span>{h.time}</span>
                    <RefreshCw className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="text-foreground mt-0.5">{h.result}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
