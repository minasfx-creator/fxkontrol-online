import { useState, useCallback } from 'react';
import { X, Sparkles, Loader2, Wand2, Film, Zap, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useProjectStore, type DroneFormation } from '@/store/useProjectStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Mode = 'single' | 'full-show' | 'trajectory';

const QUICK_PROMPTS = [
  { emoji: '🌀', label: 'Vórtex Cibernético', prompt: 'vortex cibernético com espirais logarítmicas' },
  { emoji: '🦅', label: 'Fênix Renascendo', prompt: 'phoenix rising with spread wings and tail feathers' },
  { emoji: '🇧🇷', label: 'Bandeira Brasil', prompt: 'bandeira do Brasil com losango amarelo e círculo azul' },
  { emoji: '🧬', label: 'DNA Helix', prompt: 'DNA double helix rotating' },
  { emoji: '🌌', label: 'Galáxia Espiral', prompt: 'spiral galaxy with 3 arms and dense core' },
  { emoji: '💎', label: 'Diamante 3D', prompt: 'geodesic diamond with facets' },
  { emoji: '🎵', label: 'Nota Musical', prompt: 'treble clef music note' },
  { emoji: '🏛️', label: 'Coliseu', prompt: 'roman colosseum elliptical structure' },
];

const SHOW_THEMES = [
  { emoji: '🎆', label: 'Réveillon 2027', prompt: 'Réveillon celebration with countdown, fireworks, and champagne toast' },
  { emoji: '💒', label: 'Casamento', prompt: 'Wedding ceremony: rings, hearts, doves, and crown finale' },
  { emoji: '🎄', label: 'Natal', prompt: 'Christmas show: star of Bethlehem, tree, bell, snowflake, gifts, peace' },
  { emoji: '🚀', label: 'Espaço', prompt: 'Space odyssey: rocket launch, saturn, galaxy, constellation, earth' },
  { emoji: '🌿', label: 'Natureza', prompt: 'Nature evolution: seed, fern, butterfly, flower, tree, globe' },
  { emoji: '⚡', label: 'Tech Future', prompt: 'Technology future: circuit, DNA, robot, globe, infinity symbol' },
];

export default function SwarmGPTPanel({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('single');
  const [prompt, setPrompt] = useState('');
  const [droneCount, setDroneCount] = useState(300);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  const [history, setHistory] = useState<{ prompt: string; result: string; time: string }[]>([]);

  const addDroneFormation = useProjectStore((s) => s.addDroneFormation);
  const droneFormations = useProjectStore((s) => s.droneFormations);

  const generateSingle = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLoadingPhase('Interpretando forma com IA...');
    try {
      const lastFormation = droneFormations.length > 0 ? droneFormations[droneFormations.length - 1] : null;
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { mode: 'text', prompt, droneCount, previousFormation: lastFormation?.points?.slice(0, droneCount) },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const pts = (data.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
      const lastTime = droneFormations.length > 0
        ? droneFormations[droneFormations.length - 1].startTime + droneFormations[droneFormations.length - 1].transitionDuration + droneFormations[droneFormations.length - 1].holdDuration
        : 0;

      addDroneFormation({
        id: `swarm-${Date.now()}`,
        formationType: 'ai-generated',
        droneCount: pts.length,
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

      setHistory(prev => [{ prompt, result: `${data.formationName} · ${pts.length} drones`, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      toast.success(`"${data.formationName}" gerada`, { description: `${pts.length} drones · ${data.model || 'AI'}` });
    } catch (e: any) {
      handleError(e);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, [prompt, droneCount, droneFormations, addDroneFormation]);

  const generateFullShow = useCallback(async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLoadingPhase('Desenhando show completo...');
    try {
      const { data, error } = await supabase.functions.invoke('generate-formation', {
        body: { generateFullShow: true, prompt, droneCount },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      let time = 0;
      (data.formations || []).forEach((f: any) => {
        const pts = (f.points || []).map((p: any) => ({ x: Number(p.x), z: Number(p.z) }));
        addDroneFormation({
          id: `show-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          formationType: 'ai-generated',
          droneCount: pts.length,
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
        time += (f.transitionDuration || 12) + (f.holdDuration || 15);
      });

      setHistory(prev => [{ prompt, result: `Show "${data.showName}" · ${data.formations?.length || 0} formações`, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      toast.success(`Show "${data.showName}" gerado!`, { description: `${data.formations?.length || 0} formações · ${data.totalDuration}s` });
    } catch (e: any) {
      handleError(e);
    } finally {
      setLoading(false);
      setLoadingPhase('');
    }
  }, [prompt, droneCount, addDroneFormation]);

  const handleError = (e: any) => {
    const msg = e.message || 'Erro';
    if (msg.includes('429')) toast.error('Rate limit', { description: 'Aguarde e tente novamente.' });
    else if (msg.includes('402')) toast.error('Créditos esgotados');
    else toast.error(msg);
  };

  const handleGenerate = () => {
    if (mode === 'full-show') generateFullShow();
    else generateSingle();
  };

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold font-mono-code text-foreground tracking-wider uppercase">
            SwarmGPT
          </span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex border-b border-border">
        {([
          { id: 'single' as Mode, label: 'Formação', icon: Wand2 },
          { id: 'full-show' as Mode, label: 'Show Completo', icon: Film },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1.5 text-[9px] font-semibold uppercase transition-colors",
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

        {/* Quick prompts */}
        <div className="space-y-1">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase">
            {mode === 'full-show' ? 'Temas de Show' : 'Prompts Rápidos'}
          </span>
          <div className="grid grid-cols-2 gap-1">
            {(mode === 'full-show' ? SHOW_THEMES : QUICK_PROMPTS).map((q) => (
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
          placeholder={mode === 'full-show'
            ? "Descreva o tema do show completo... Ex: 'Celebração Brasil 2027 com bandeira, Cristo Redentor e fogos'"
            : "Descreva a formação... Ex: 'vórtex cibernético com 4 braços espirais'"
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="h-16 text-[10px] bg-surface-2 border-border resize-none"
        />

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full h-8 text-[10px] gap-1"
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
              {mode === 'full-show' ? 'Gerar Show Completo' : 'Gerar Formação'} ({droneCount})
            </>
          )}
        </Button>

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-1">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase">Histórico</span>
            {history.map((h, i) => (
              <div
                key={i}
                className="p-1.5 rounded-sm border border-border/50 bg-surface-1/50 text-[8px] font-mono-code cursor-pointer hover:bg-surface-2"
                onClick={() => setPrompt(h.prompt)}
              >
                <div className="flex justify-between text-muted-foreground">
                  <span className="truncate flex-1">{h.prompt}</span>
                  <span className="ml-1 flex-shrink-0">{h.time}</span>
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
