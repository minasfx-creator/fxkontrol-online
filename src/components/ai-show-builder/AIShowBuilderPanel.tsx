/**
 * AIShowBuilderPanel — coração do Assistente de Coreografia IA.
 *
 * Recebe um ShowSiteConfig já definido. Pede um prompt ao usuário,
 * gera ShowPlan (determinístico), valida e materializa no
 * useProjectStore. Inspecionável antes de aplicar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Wand2, Shuffle, AlertTriangle, CheckCircle2, Info, Pencil, MousePointerSquareDashed, ArrowRightCircle, Loader2, Undo2, Redo2, History, Trash2, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectStore } from '@/store/useProjectStore';
import { appendShowPlan, resumeOffsetFor, resumeOffsetAtCue } from '@/lib/aiShowBuilder/continueShowPlan';
import { diffShowPlan, summarizeDiff, type ShowPlanDiff } from '@/lib/aiShowBuilder/showPlanDiff';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ShowPlan, ShowPlanValidationResult, ShowSiteConfig } from '@/lib/aiShowBuilder/types';
import { generateShowPlanWithProviderDetailed } from '@/lib/aiShowBuilder/generateShowPlanWithProvider';
import { validateShowPlan } from '@/lib/aiShowBuilder/validateShowPlan';
import { materializeShowPlan } from '@/lib/aiShowBuilder/materializeShowPlan';
import {
  getAiShowBuilderLayoutMode,
  getPipelineModel,
  type AiShowBuilderLayoutMode,
  type AiShowPipelineModel,
} from '@/lib/aiShowBuilder/pipelineModel';
import ShowPlanReviewEditor from './ShowPlanReviewEditor';
import ShowEngineHost from '@/components/show-engine/ShowEngineHost';
import PromptBar from '@/components/show-engine/PromptBar';


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

interface ExtensionHistoryEntry {
  id: string;
  timestamp: number;
  prompt: string;
  anchorLabel: string;
  resumeAt: number;
  providerId: string;
  fellBack: boolean;
  /** Snapshot do plano ANTES da extensão — usado pelo Undo. */
  prevPlan: ShowPlan;
  diff: ShowPlanDiff;
}

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
  const [continuationPrompt, setContinuationPrompt] = useState('');
  const [continuing, setContinuing] = useState(false);
  const [anchorCueId, setAnchorCueId] = useState<string>('__last__');
  const [extensionHistory, setExtensionHistory] = useState<ExtensionHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<Array<{ entry: ExtensionHistoryEntry; nextPlan: ShowPlan }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(() => new Set());
  const positionsCount = useProjectStore((s) => s.positions.length);
  const selectedCount = useProjectStore((s) => s.selectedPositionIds.length);
  const selectAllPositionsInStore = useCallback(() => {
    const { positions, selectMultiplePositionsAndLinkedEvents } = useProjectStore.getState();
    const ids = positions.map((p) => p.id);
    selectMultiplePositionsAndLinkedEvents(ids);
    toast.success(`${ids.length} posições selecionadas`);
  }, []);

  /**
   * Seleciona posições compatíveis (pyro/drone-pad) que estão referenciadas
   * por algum item do timeline, junto com seus eventos linkados.
   *
   * filter='all'    → ambos os tipos
   * filter='pyro'   → apenas type === 'pyro'
   * filter='drone'  → apenas type === 'drone-pad'
   */
  const selectCompatibleFromTimeline = useCallback((filter: 'all' | 'pyro' | 'drone') => {
    const { positions, timelineItems, selectMultiplePositionsAndLinkedEvents } = useProjectStore.getState();
    const referenced = new Set<string>();
    for (const it of timelineItems) {
      if (it.positionId) referenced.add(it.positionId);
      if (it.positionIds) for (const pid of it.positionIds) referenced.add(pid);
    }
    const allowedTypes =
      filter === 'pyro' ? new Set(['pyro'])
      : filter === 'drone' ? new Set(['drone-pad'])
      : new Set(['pyro', 'drone-pad']);
    const ids = positions
      .filter((p) => referenced.has(p.id) && allowedTypes.has(p.type))
      .map((p) => p.id);
    if (ids.length === 0) {
      toast.info('Nenhuma posição compatível encontrada no timeline.');
      return;
    }
    selectMultiplePositionsAndLinkedEvents(ids);
    const label = filter === 'all' ? 'compatíveis' : filter === 'pyro' ? 'pyro' : 'drone';
    toast.success(`${ids.length} posições ${label} + eventos linkados selecionados`);
  }, []);

  // Contadores reativos (para badges nos botões)
  const compatibleCounts = useProjectStore((s) => {
    const referenced = new Set<string>();
    for (const it of s.timelineItems) {
      if (it.positionId) referenced.add(it.positionId);
      if (it.positionIds) for (const pid of it.positionIds) referenced.add(pid);
    }
    let pyro = 0, drone = 0;
    for (const p of s.positions) {
      if (!referenced.has(p.id)) continue;
      if (p.type === 'pyro') pyro++;
      else if (p.type === 'drone-pad') drone++;
    }
    return { pyro, drone, total: pyro + drone };
  });
  const [layoutMode, setLayoutMode] = useState<AiShowBuilderLayoutMode>(() =>
    getAiShowBuilderLayoutMode(),
  );

  // Reage a resize/orientação. Só afeta apresentação — nunca dados.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const update = () => setLayoutMode(getAiShowBuilderLayoutMode());
    const mqDesktop = window.matchMedia('(min-width: 1024px)');
    const mqLandscape = window.matchMedia('(orientation: landscape)');
    mqDesktop.addEventListener('change', update);
    mqLandscape.addEventListener('change', update);
    return () => {
      mqDesktop.removeEventListener('change', update);
      mqLandscape.removeEventListener('change', update);
    };
  }, []);

  const validation: ShowPlanValidationResult | null = useMemo(
    () => (plan ? validateShowPlan(plan, site) : null),
    [plan, site],
  );

  // Modelo renderizável canônico — idêntico em todos os layoutModes.
  const pipelineModel: AiShowPipelineModel | null = useMemo(
    () => (plan ? getPipelineModel(plan, layoutMode) : null),
    [plan, layoutMode],
  );

  const addChip = (chip: string) => {
    setPrompt((p) => (p.trim().length === 0 ? chip : `${p}, ${chip.toLowerCase()}`));
  };

  const handleGenerate = useCallback(async (seed: number) => {
    const value = prompt.trim();
    if (value.length < 4) {
      toast.error('Descreva sua ideia com mais detalhes (mínimo 4 caracteres).');
      return;
    }
    setBusy(true);
    try {
      const { plan: next, fellBack, providerId } = await generateShowPlanWithProviderDetailed({
        prompt: value,
        site,
        variationSeed: seed,
      });
      setPlan(next);
      setVariation(seed);
      setExtensionHistory([]);
      setRedoStack([]);
      if (fellBack) {
        toast.warning('IA remota indisponível — usando gerador local como fallback.');
      } else if (providerId !== 'local-deterministic') {
        toast.success(`Plano gerado via ${providerId}.`);
      }
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

  const usingAnchor = anchorCueId !== '__last__';
  const resumeAt = plan
    ? (usingAnchor ? resumeOffsetAtCue(plan, anchorCueId) : resumeOffsetFor(plan))
    : 0;

  // Cues ordenados por tempo para o seletor de âncora.
  const sortedCues = useMemo(() => {
    if (!plan) return [];
    return [...plan.timelineItems].sort((a, b) => a.startTime - b.startTime);
  }, [plan]);

  const handleContinue = useCallback(async () => {
    if (!plan) return;
    const value = continuationPrompt.trim();
    if (value.length < 4) {
      toast.error('Descreva como o show deve continuar (mínimo 4 caracteres).');
      return;
    }
    setContinuing(true);
    try {
      const seed = (variation + 1) ^ Math.floor(resumeAt);
      const anchorLabel = usingAnchor
        ? sortedCues.find((c) => c.id === anchorCueId)?.label ?? 'cue selecionado'
        : 'último cue';
      const { plan: addition, fellBack, providerId } = await generateShowPlanWithProviderDetailed({
        prompt: `Continuação a partir de ${resumeAt.toFixed(1)}s (após ${anchorLabel}) do show "${plan.title}". ${value}`,
        site,
        variationSeed: seed,
      });
      const merged = appendShowPlan(plan, addition, {
        gap: 1,
        anchorCueId: usingAnchor ? anchorCueId : undefined,
      });
      const entry: ExtensionHistoryEntry = {
        id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        prompt: value,
        anchorLabel,
        resumeAt,
        providerId,
        fellBack,
        prevPlan: plan,
        diff: diffShowPlan(plan, merged),
      };
      setExtensionHistory((h) => [entry, ...h].slice(0, 20));
      setRedoStack([]);
      setPlan(merged);
      setVariation(seed);
      setContinuationPrompt('');
      setAnchorCueId('__last__');
      if (fellBack) toast.warning('IA remota indisponível — coreografia continuada via gerador local.');
      else toast.success(`Coreografia estendida via ${providerId} (+${addition.duration.toFixed(0)}s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao continuar coreografia');
    } finally {
      setContinuing(false);
    }
  }, [plan, continuationPrompt, site, variation, resumeAt, anchorCueId, usingAnchor, sortedCues]);

  const handleUndoExtension = useCallback(() => {
    setExtensionHistory((h) => {
      if (h.length === 0) return h;
      const [last, ...rest] = h;
      setPlan((current) => {
        if (current) setRedoStack((r) => [{ entry: last, nextPlan: current }, ...r].slice(0, 20));
        return last.prevPlan;
      });
      toast.success(`Continuação revertida (${summarizeDiff(last.diff)})`);
      return rest;
    });
  }, []);

  const handleRedoExtension = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const [head, ...rest] = r;
      setPlan(head.nextPlan);
      setExtensionHistory((h) => [head.entry, ...h].slice(0, 20));
      toast.success(`Continuação refeita (${summarizeDiff(head.entry.diff)})`);
      return rest;
    });
  }, []);

  /** Restaura o snapshot prevPlan de uma entrada específica do histórico,
   *  descartando todas as continuações posteriores a ela. */
  const handleRestoreToEntry = useCallback((entryId: string) => {
    setExtensionHistory((h) => {
      const idx = h.findIndex((e) => e.id === entryId);
      if (idx === -1) return h;
      const target = h[idx];
      setPlan(target.prevPlan);
      setRedoStack([]);
      toast.success(`Plano restaurado ao estado anterior a “${target.prompt.slice(0, 40)}”`);
      // remove a entrada-alvo e tudo mais recente que ela (índices 0..idx).
      return h.slice(idx + 1);
    });
  }, []);

  const handleClearHistory = useCallback(() => {
    setExtensionHistory([]);
    setRedoStack([]);
    toast.success('Histórico de extensões limpo');
  }, []);


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
            <Wand2 className="h-4 w-4" /> {busy ? 'Gerando plano…' : 'Gerar plano do show'}
          </Button>
          {plan && (
            <Button variant="secondary" onClick={() => handleGenerate(variation + 1)} disabled={busy} className="gap-2">
              <Shuffle className="h-4 w-4" /> {busy ? 'Gerando…' : 'Gerar variação'}
            </Button>
          )}
          {plan && (
            <Button variant="ghost" onClick={() => { setPlan(null); setExtensionHistory([]); setRedoStack([]); }} disabled={busy}>
              Editar prompt
            </Button>
          )}
          <Button
            variant="outline"
            onClick={selectAllPositionsInStore}
            disabled={positionsCount === 0}
            className="gap-2"
            title={positionsCount === 0 ? 'Aplique um plano primeiro' : `Seleciona ${positionsCount} posições`}
          >
            <MousePointerSquareDashed className="h-4 w-4" />
            Selecionar todas {positionsCount > 0 && `(${selectedCount}/${positionsCount})`}
          </Button>
          <Button
            variant="outline"
            onClick={() => selectCompatibleFromTimeline('all')}
            disabled={compatibleCounts.total === 0}
            className="gap-2"
            title="Posições (pyro+drone) referenciadas pelo timeline + eventos linkados"
          >
            <MousePointerSquareDashed className="h-4 w-4" />
            Compatíveis no timeline {compatibleCounts.total > 0 && `(${compatibleCounts.total})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectCompatibleFromTimeline('pyro')}
            disabled={compatibleCounts.pyro === 0}
            title="Apenas posições pyro do timeline"
          >
            Pyro {compatibleCounts.pyro > 0 && `(${compatibleCounts.pyro})`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectCompatibleFromTimeline('drone')}
            disabled={compatibleCounts.drone === 0}
            title="Apenas pads de drone do timeline"
          >
            Drone {compatibleCounts.drone > 0 && `(${compatibleCounts.drone})`}
          </Button>
        </div>

        {/* Live 3D preview + permanent PromptBar — always visible. */}
        <div className="relative h-[320px] rounded-md overflow-hidden border border-border/50">
          <ShowEngineHost plan={plan} />
          <div className="absolute left-2 right-2 bottom-2 z-30">
            <PromptBar
              site={site}
              currentPlan={plan}
              onPlan={(p) => { setPlan(p); setVariation((v) => v + 1); }}
              onApply={handleApply}
              onResetView={() => {
                // ResetView dispatched via custom event so any mounted engine listens.
                window.dispatchEvent(new CustomEvent('show-engine-reset-view'));
              }}
            />
          </div>
        </div>

        {plan && validation && pipelineModel && !reviewing && (
          <PlanPreview
            plan={plan}
            model={pipelineModel}
            layoutMode={layoutMode}
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

        {plan && !reviewing && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ArrowRightCircle className="h-4 w-4 text-primary" />
              Continuar coreografia
              <Badge variant="outline" className="ml-auto text-[10px]">
                retoma em {resumeAt.toFixed(1)}s
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Adiciona um novo trecho ao show. Por padrão começa após o último
              cue, mas você pode ancorar em qualquer cue específico da timeline.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground shrink-0">Ancorar em:</span>
              <Select value={anchorCueId} onValueChange={setAnchorCueId} disabled={continuing}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Último cue" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__last__">
                    Último cue ({resumeOffsetFor(plan).toFixed(1)}s)
                  </SelectItem>
                  {sortedCues.map((cue) => {
                    const end = cue.startTime + (cue.duration ?? 0);
                    return (
                      <SelectItem key={cue.id} value={cue.id}>
                        {cue.startTime.toFixed(1)}s · {cue.label || cue.type}
                        {cue.duration ? ` → ${end.toFixed(1)}s` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={continuationPrompt}
              onChange={(e) => setContinuationPrompt(e.target.value)}
              placeholder="Ex: depois do finale, 20s de cometas verdes em leque com cauda dourada"
              className="min-h-[72px] resize-none text-sm"
              disabled={continuing}
              maxLength={2000}
            />
            <div className="flex items-center gap-2 justify-end flex-wrap">
              {extensionHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory((s) => !s)}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  title={`${extensionHistory.length} continuação(ões) no histórico`}
                >
                  <History className="h-3.5 w-3.5" />
                  Histórico ({extensionHistory.length})
                </Button>
              )}
              {extensionHistory.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUndoExtension}
                  disabled={continuing}
                  className="gap-1.5"
                  title={`Desfazer: ${extensionHistory[0].prompt.slice(0, 50)}`}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Desfazer última
                </Button>
              )}
              {redoStack.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRedoExtension}
                  disabled={continuing}
                  className="gap-1.5"
                  title={`Refazer: ${redoStack[0].entry.prompt.slice(0, 50)}`}
                >
                  <Redo2 className="h-3.5 w-3.5" />
                  Refazer ({redoStack.length})
                </Button>
              )}
              {extensionHistory.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  disabled={continuing}
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  title="Limpar histórico (não altera o plano atual)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpar
                </Button>
              )}
              <Button
                onClick={handleContinue}
                disabled={continuing || continuationPrompt.trim().length < 4}
                className="gap-2"
                size="sm"
              >
                {continuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {continuing ? 'Estendendo…' : 'Estender show'}
              </Button>
            </div>

            {showHistory && extensionHistory.length > 0 && (
              <div className="rounded-md border border-border/40 bg-background/40 p-2 space-y-1.5 max-h-56 overflow-auto">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-bold px-1">
                  Histórico de extensões (mais recente primeiro)
                </div>
                {extensionHistory.map((entry, idx) => {
                  const ago = Math.max(1, Math.floor((Date.now() - entry.timestamp) / 1000));
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2 rounded-sm bg-card/40 border border-border/30 px-2 py-1.5 text-[11px]"
                    >
                      <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">
                        #{extensionHistory.length - idx}
                      </Badge>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] text-primary">
                            {summarizeDiff(entry.diff)}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            @ {entry.resumeAt.toFixed(1)}s · {entry.anchorLabel} · há {ago}s
                          </span>
                          {entry.fellBack && (
                            <Badge variant="outline" className="text-[8px] border-amber-500/40 text-amber-400">
                              fallback
                            </Badge>
                          )}
                        </div>
                        <div className="text-foreground/80 truncate" title={entry.prompt}>
                          “{entry.prompt}”
                        </div>
                      </div>
                      {idx === 0 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleUndoExtension}
                          disabled={continuing}
                          className="h-6 px-2 text-[10px] gap-1 shrink-0"
                          title="Reverter esta continuação"
                        >
                          <Undo2 className="h-3 w-3" />
                          Undo
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRestoreToEntry(entry.id)}
                          disabled={continuing}
                          className="h-6 px-2 text-[10px] gap-1 shrink-0"
                          title="Restaurar plano até antes desta continuação (descarta as posteriores)"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restaurar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
  model,
  layoutMode,
  validation,
  onApply,
  onReview,
}: {
  plan: ShowPlan;
  model: AiShowPipelineModel;
  layoutMode: AiShowBuilderLayoutMode;
  validation: ShowPlanValidationResult;
  onApply: () => void;
  onReview: () => void;
}) {
  // Apenas apresentação muda por layout. Dados vêm sempre de `model`.
  const sectionsGridClass =
    layoutMode === 'desktop'
      ? 'grid grid-cols-3 gap-2 text-xs'
      : layoutMode === 'mobileLandscape'
        ? 'grid grid-cols-3 gap-2 text-xs'
        : 'grid grid-cols-2 gap-2 text-xs';

  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">{plan.title}</h4>
          <p className="text-xs text-muted-foreground">
            Estilo: {plan.style} · {model.duration.toFixed(0)}s
          </p>
        </div>
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{model.positions.length}</strong> posições</span>
          <span><strong className="text-foreground">{model.timelineItems.length}</strong> cues</span>
          <span><strong className="text-foreground">{plan.trajectories.length}</strong> trajetórias</span>
        </div>
      </div>

      <Separator />

      <div className={sectionsGridClass}>
        {model.sections.map((sec) => (
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
