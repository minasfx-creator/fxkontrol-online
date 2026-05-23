import { useCallback, useState, type KeyboardEvent } from 'react';
import { Sparkles, Wand2, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { generateShowPlanWithProviderDetailed } from '@/lib/aiShowBuilder/generateShowPlanWithProvider';
import type { ShowPlan, ShowSiteConfig } from '@/lib/aiShowBuilder/types';
import { toast } from 'sonner';

interface Props {
  site: ShowSiteConfig;
  currentPlan: ShowPlan | null;
  onPlan: (plan: ShowPlan) => void;
  onApply?: () => void;
  onResetView?: () => void;
}

/**
 * PromptBar — permanent overlay on top of the editor viewport.
 *
 * Always visible. Generates / refines / applies plans via the existing
 * provider pipeline. Shows the active provider and fallback status so the
 * operator knows whether the local generator or the remote AI is driving
 * the plan.
 */
export default function PromptBar({
  site,
  currentPlan,
  onPlan,
  onApply,
  onResetView,
}: Props) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string>('local');
  const [fellBack, setFellBack] = useState(false);

  const generate = useCallback(async () => {
    const value = prompt.trim();
    if (value.length < 4) {
      toast.error('Descreva a ideia (mínimo 4 caracteres).');
      return;
    }
    setBusy(true);
    try {
      const seed = currentPlan ? Date.now() & 0xff : 0;
      const { plan, providerId, fellBack: fb } = await generateShowPlanWithProviderDetailed({
        prompt: value,
        site,
        variationSeed: seed,
      });
      onPlan(plan);
      setProviderLabel(providerId);
      setFellBack(fb);
      if (fb) toast.warning('IA remota indisponível — usando gerador local.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar plano');
    } finally {
      setBusy(false);
    }
  }, [prompt, site, currentPlan, onPlan]);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      generate();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onApply?.();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Esc does not hide the bar — just blurs.
      (e.target as HTMLTextAreaElement).blur();
    }
  };

  return (
    <div className="pointer-events-auto rounded-lg border border-border/50 bg-background/85 backdrop-blur-md shadow-lg p-2 flex items-stretch gap-2">
      <div className="flex flex-col gap-1 justify-center px-1">
        <Badge variant={fellBack ? 'destructive' : 'outline'} className="text-[10px] uppercase">
          {fellBack ? 'fallback' : providerLabel}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {busy ? 'gerando…' : currentPlan ? 'pronto' : 'aguardando'}
        </span>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Descreva o show ou ajuste a cena… ex: finale dourado com drones em espiral"
        className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm"
        disabled={busy}
        maxLength={4000}
      />
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          onClick={generate}
          disabled={busy || prompt.trim().length < 4}
          className="gap-1"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {currentPlan ? 'Refinar' : 'Gerar'}
        </Button>
        <div className="flex gap-1">
          {onApply && (
            <Button size="sm" variant="secondary" onClick={onApply} disabled={!currentPlan} className="gap-1">
              <Sparkles className="h-3.5 w-3.5" /> Aplicar
            </Button>
          )}
          {onResetView && (
            <Button size="sm" variant="ghost" onClick={onResetView} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Reset View
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
