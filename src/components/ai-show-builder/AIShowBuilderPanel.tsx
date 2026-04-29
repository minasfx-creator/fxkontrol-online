/**
 * AIShowBuilderPanel — coração do Assistente de Coreografia IA.
 *
 * Recebe um ShowSiteConfig já definido. Pede um prompt ao usuário,
 * gera ShowPlan (determinístico), valida e materializa no
 * useProjectStore. Inspecionável antes de aplicar.
 */
import { useCallback, useMemo, useState } from 'react';
import { Sparkles, Wand2, Shuffle, AlertTriangle, CheckCircle2, Info, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ShowPlan, ShowPlanValidationResult, ShowSiteConfig } from '@/lib/aiShowBuilder/types';
import { generateShowPlanFromPrompt } from '@/lib/aiShowBuilder/generateShowPlan';
import { validateShowPlan } from '@/lib/aiShowBuilder/validateShowPlan';
import { materializeShowPlan } from '@/lib/aiShowBuilder/materializeShowPlan';
import ShowPlanReviewEditor from './ShowPlanReviewEditor';


const QUICK_CHIPS: string[] = [
  '12 posições',
  'Espaçamento 20m',
  'Formação em linha',
  'Formação circular',
  'Cometas azuis 30mm',
  'Finale impactante',
  'Show de 1 minuto',
  'Entrada suave',
  'Clímax intenso',
];

interface Props {
  site: ShowSiteConfig;
  onApplied?: (summary: { positions: number; cues: number; duration: number }) => void;
  onEditSite?: () => void;
}

export default function AIShowBuilderPanel({ site, onApplied, onEditSite }: Props) {
  const [prompt, setPrompt] = useState('');
  const [variation, setVariation] = useState(0);
  const [plan, setPlan] = useState<ShowPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);


  const validation: ShowPlanValidationResult | null = useMemo(
    () => (plan ? validateShowPlan(plan, site) : null),
    [plan, site],
  );

  const addChip = (chip: string) => {
    setPrompt((p) => (p.trim().length === 0 ? chip : `${p}, ${chip.toLowerCase()}`));
  };

  const handleGenerate = useCallback((seed: number) => {
    const value = prompt.trim();
    if (value.length < 4) {
      toast.error('Descreva sua ideia com mais detalhes (mínimo 4 caracteres).');
      return;
    }
    setBusy(true);
    try {
      const next = generateShowPlanFromPrompt(value, site, seed);
      setPlan(next);
      setVariation(seed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao gerar plano';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [prompt, site]);

  const handleApply = useCallback(() => {
    if (!plan || !validation) return;
    if (!validation.ok) {
      toast.error('Revise o plano antes de aplicar. Existem problemas de segurança ou configuração.');
      return;
    }
    try {
      const result = materializeShowPlan(plan);
      toast.success('Show materializado no mundo 3D.', {
        description: `${result.positionsAdded} posições · ${result.timelineItemsAdded} cues · ${result.duration.toFixed(0)}s`,
      });
      onApplied?.({
        positions: result.positionsAdded,
        cues: result.timelineItemsAdded,
        duration: result.duration,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Falha ao aplicar plano';
      toast.error(msg);
    }
  }, [plan, validation, onApplied]);

  return (
    <Card className="border-border/40 bg-card/50">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              Assistente de Coreografia IA
            </CardTitle>
            <CardDescription>
              Descreva sua ideia. A IA cria posições, trajetórias, efeitos e timeline no mundo 3D.
            </CardDescription>
          </div>
          {onEditSite && (
            <Button variant="ghost" size="sm" onClick={onEditSite}>
              {site.name || 'Local'} · {site.width}×{site.depth}m
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: adicione 12 posições com distanciamento de 20 metros entre cada ponto, acrescente corridas de cometa 30 mm azul e um final surpreendente com 1 min."
          className="min-h-[120px] resize-none text-sm"
          disabled={busy}
          maxLength={4000}
        />

        <div className="flex flex-wrap gap-2">
          {QUICK_CHIPS.map((chip) => (
            <Badge
              key={chip}
              variant="outline"
              className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
              onClick={() => !busy && addChip(chip)}
            >
              {chip}
            </Badge>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => handleGenerate(0)} disabled={busy || prompt.trim().length < 4} className="gap-2">
            <Wand2 className="h-4 w-4" /> Gerar plano do show
          </Button>
          {plan && (
            <Button variant="secondary" onClick={() => handleGenerate(variation + 1)} disabled={busy} className="gap-2">
              <Shuffle className="h-4 w-4" /> Gerar variação
            </Button>
          )}
          {plan && (
            <Button variant="ghost" onClick={() => setPlan(null)} disabled={busy}>
              Editar prompt
            </Button>
          )}
        </div>

        {plan && validation && !reviewing && (
          <PlanPreview
            plan={plan}
            validation={validation}
            onApply={handleApply}
            onReview={() => setReviewing(true)}
          />
        )}

        {plan && reviewing && (
          <ShowPlanReviewEditor
            plan={plan}
            site={site}
            onChange={setPlan}
            onClose={() => setReviewing(false)}
          />
        )}

        <p className="text-[11px] text-muted-foreground italic pt-1">
          Este plano é uma pré-visualização criativa. Revise segurança, distâncias e normas locais antes da execução real.
        </p>
      </CardContent>
    </Card>
  );
}

function PlanPreview({
  plan,
  validation,
  onApply,
  onReview,
}: {
  plan: ShowPlan;
  validation: ShowPlanValidationResult;
  onApply: () => void;
  onReview: () => void;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{plan.title}</h4>
          <p className="text-xs text-muted-foreground">
            Estilo: {plan.style} · {plan.duration.toFixed(0)}s
          </p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{plan.positions.length}</strong> posições</span>
          <span><strong className="text-foreground">{plan.timelineItems.length}</strong> cues</span>
          <span><strong className="text-foreground">{plan.trajectories.length}</strong> trajetórias</span>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-3 gap-2 text-xs">
        {plan.sections.map((sec) => (
          <div key={sec.id} className="rounded border border-border/40 p-2 bg-card/30">
            <div className="font-semibold text-foreground">{sec.name}</div>
            <div className="text-muted-foreground">
              {sec.startTime.toFixed(0)}s → {(sec.startTime + sec.duration).toFixed(0)}s
            </div>
          </div>
        ))}
      </div>

      {(plan.assumptions.length > 0 || validation.warnings.length > 0 || validation.errors.length > 0) && (
        <ScrollArea className="max-h-44 pr-2">
          <div className="space-y-2">
            {validation.errors.map((e, i) => (
              <div key={`err-${i}`} className="flex gap-2 text-xs text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{e}</span>
              </div>
            ))}
            {validation.warnings.map((w, i) => (
              <div key={`warn-${i}`} className="flex gap-2 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{w}</span>
              </div>
            ))}
            {plan.safetyWarnings.map((w, i) => (
              <div key={`safety-${i}`} className="flex gap-2 text-xs text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{w}</span>
              </div>
            ))}
            {plan.assumptions.map((a, i) => (
              <div key={`asm-${i}`} className="flex gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>{a}</span>
              </div>
            ))}
            {validation.ok && validation.errors.length === 0 && (
              <div className="flex gap-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> <span>Plano válido para aplicação.</span>
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onReview} className="gap-2">
          <Pencil className="h-4 w-4" /> Revisar e editar
        </Button>
        <Button onClick={onApply} disabled={!validation.ok}>
          Aplicar no mundo 3D
        </Button>
      </div>
    </div>
  );
}
