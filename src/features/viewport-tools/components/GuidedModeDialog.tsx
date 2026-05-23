/**
 * GuidedModeDialog
 * ────────────────────────────────────────────────────────────
 * 4-step wizard:
 *   1. Tipo de evento
 *   2. Sistema (pyro / drones / hybrid)
 *   3. Escala + duração
 *   4. Preview da receita + Apply (dispatch via CommandBus)
 *
 * After applying, the dialog flips to a "tweak" panel that lets the user
 * progressively re-scale / re-color / re-time the recipe by re-applying
 * (the toolbar undo handler covers the previous fan-out).
 */

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  EVENT_LABELS,
  SCALE_LABELS,
  SYSTEM_LABELS,
  applyRecipe,
  buildRecipe,
  type EventType,
  type GuidedAnswers,
  type ShowScale,
  type ShowSystem,
} from '@/features/viewport-tools/guided/guidedPresets';
import { useProjectStore } from '@/store/useProjectStore';
import { Sparkles, ChevronRight, ChevronLeft, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const EVENTS: EventType[] = ['wedding', 'corporate', 'newyear', 'concert', 'sports', 'festival'];
const SYSTEMS: ShowSystem[] = ['pyro', 'drones', 'hybrid'];
const SCALES: ShowScale[] = ['small', 'medium', 'large'];

export default function GuidedModeDialog({ open, onClose }: Props) {
  const positions = useProjectStore((s) => s.positions);
  const firstPyro = positions.find((p) => p.type === 'pyro') ?? positions[0];

  const [step, setStep] = useState<Step>(1);
  const [eventType, setEventType] = useState<EventType>('newyear');
  const [system, setSystem] = useState<ShowSystem>('hybrid');
  const [scale, setScale] = useState<ShowScale>('medium');
  const [duration, setDuration] = useState(180);
  const [applied, setApplied] = useState(false);
  const [intensity, setIntensity] = useState(100); // post-apply tweak (%)

  const answers: GuidedAnswers = useMemo(
    () => ({
      eventType,
      system,
      scale,
      durationSec: duration,
      anchorPositionId: firstPyro?.id,
      anchor: firstPyro ? { x: firstPyro.x, y: firstPyro.y, z: firstPyro.z } : undefined,
    }),
    [eventType, system, scale, duration, firstPyro],
  );

  const recipe = useMemo(() => buildRecipe(answers), [answers]);

  const reset = () => {
    setStep(1);
    setApplied(false);
    setIntensity(100);
  };

  const handleApply = () => {
    const r = applyRecipe(recipe);
    setApplied(true);
    setStep(5);
    toast.success(
      `Show base aplicado · ${r.cakes} cake(s) · ${r.formations} formação(ões).`,
    );
  };

  const handleReapplyWithIntensity = () => {
    // Re-build with scaled values; user can stack or undo previous via dock ↶.
    const f = intensity / 100;
    const tweaked = buildRecipe({
      ...answers,
      durationSec: Math.round(duration * (0.8 + f * 0.4)),
    });
    // Manual scale of shot count for cakes
    tweaked.cakes = tweaked.cakes.map((c) => ({ ...c, shots: Math.max(4, Math.round(c.shots * f)) }));
    tweaked.formations = tweaked.formations.map((fm) => ({
      ...fm,
      droneCount: Math.max(20, Math.round(fm.droneCount * f)),
    }));
    const r = applyRecipe(tweaked);
    toast.success(`Re-aplicado em ${intensity}% · ${r.cakes} cake(s) · ${r.formations} formação(ões).`);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          // small delay to avoid flicker before close anim
          setTimeout(reset, 200);
        }
      }}
    >
      <DialogContent className="max-w-2xl bg-[#050810] border-cyan-500/25 text-cyan-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-200">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Modo Guiado — Show Base Automático
            <Badge variant="outline" className="ml-2 border-cyan-500/40 text-cyan-300/80 text-[10px]">
              passo {step}/5
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step 1 — Evento */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-cyan-100/70">
              Qual o tipo de evento? Isso define a paleta e o ritmo da receita.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {EVENTS.map((ev) => (
                <button
                  key={ev}
                  onClick={() => setEventType(ev)}
                  className={
                    'p-3 rounded-lg border text-sm transition-all text-left ' +
                    (eventType === ev
                      ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-100'
                      : 'border-cyan-500/15 text-cyan-100/60 hover:border-cyan-500/40 hover:text-cyan-100')
                  }
                >
                  {EVENT_LABELS[ev]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Sistema */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-cyan-100/70">Qual sistema você vai operar?</p>
            <div className="grid grid-cols-3 gap-2">
              {SYSTEMS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSystem(s)}
                  className={
                    'p-3 rounded-lg border text-sm transition-all text-left ' +
                    (system === s
                      ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-100'
                      : 'border-cyan-500/15 text-cyan-100/60 hover:border-cyan-500/40 hover:text-cyan-100')
                  }
                >
                  {SYSTEM_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Escala + duração */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-cyan-100/70 mb-2">Tamanho do show</p>
              <div className="grid grid-cols-3 gap-2">
                {SCALES.map((sc) => (
                  <button
                    key={sc}
                    onClick={() => setScale(sc)}
                    className={
                      'p-3 rounded-lg border text-sm transition-all text-left ' +
                      (scale === sc
                        ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-100'
                        : 'border-cyan-500/15 text-cyan-100/60 hover:border-cyan-500/40 hover:text-cyan-100')
                    }
                  >
                    {SCALE_LABELS[sc]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-cyan-100/70 mb-2">
                Duração total: <span className="text-cyan-300">{duration}s</span> (~{Math.round(duration / 60)}min)
              </p>
              <Slider
                value={[duration]}
                min={60}
                max={600}
                step={15}
                onValueChange={(v) => setDuration(v[0])}
              />
            </div>
          </div>
        )}

        {/* Step 4 — Preview */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-3">
              <div className="text-xs text-cyan-300/70 uppercase tracking-wider">Receita</div>
              <div className="text-base text-cyan-100 mt-0.5">{recipe.label}</div>
              <p className="text-xs text-cyan-100/60 mt-1">{recipe.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipe.tags.map((t) => (
                  <Badge key={t} variant="outline" className="border-cyan-500/30 text-cyan-200/80 text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md border border-cyan-500/15 p-2">
                <div className="text-cyan-300/70">Cakes (PYRO)</div>
                <div className="text-cyan-100 text-lg">{recipe.cakes.length}</div>
              </div>
              <div className="rounded-md border border-cyan-500/15 p-2">
                <div className="text-cyan-300/70">Formações (DRONES)</div>
                <div className="text-cyan-100 text-lg">{recipe.formations.length}</div>
              </div>
            </div>
            {recipe.notes.length > 0 && (
              <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2 space-y-1">
                {recipe.notes.map((n, i) => (
                  <div key={i} className="text-[11px] text-amber-200/90">• {n}</div>
                ))}
              </div>
            )}
            {recipe.cakes.length > 0 && !firstPyro && (
              <div className="text-[11px] text-rose-300/90">
                ⚠ Nenhuma posição pyro encontrada — cakes serão criados em (0,0,0). Ajuste depois no editor.
              </div>
            )}
          </div>
        )}

        {/* Step 5 — Tweak panel (post-apply) */}
        {step === 5 && applied && (
          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2">
              <Check className="h-4 w-4 text-emerald-400 mt-0.5" />
              <div className="text-sm text-emerald-200/90">
                Show base aplicado ao ShowPlan. Ajuste a intensidade e re-aplique, ou abra o painel de tools
                para edição fina.
              </div>
            </div>
            <Separator className="bg-cyan-500/15" />
            <div>
              <p className="text-sm text-cyan-100/70 mb-2">
                Intensidade: <span className="text-cyan-300">{intensity}%</span>
              </p>
              <p className="text-[11px] text-cyan-100/40 mb-2">
                Escala shots de cakes e contagem de drones. Use o botão ↶ no dock para desfazer aplicações anteriores.
              </p>
              <Slider
                value={[intensity]}
                min={30}
                max={200}
                step={10}
                onValueChange={(v) => setIntensity(v[0])}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10"
                onClick={handleReapplyWithIntensity}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Re-aplicar @ {intensity}%
              </Button>
              <Button
                variant="outline"
                className="border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10"
                onClick={reset}
              >
                Novo guiado
              </Button>
            </div>
          </div>
        )}

        {/* Footer nav */}
        {step < 5 && (
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={step === 1}
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
              className="text-cyan-200/70 hover:text-cyan-200"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            {step < 4 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => ((s + 1) as Step))}
                className="bg-cyan-500/20 border border-cyan-500/50 text-cyan-100 hover:bg-cyan-500/30"
              >
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleApply}
                className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-100 hover:bg-emerald-500/30"
              >
                <Sparkles className="h-4 w-4 mr-1.5" /> Aplicar show base
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
