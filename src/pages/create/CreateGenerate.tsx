/**
 * /create/generate — 4-step AI wizard.
 *
 * Pure design-time configuration: chooses event type / scale / segments /
 * duration and asks createShowPlan() to seed an empty show. The actual
 * generative pass (positions + cues) is delegated to the JOI / AI Builder
 * panels inside the editor — keeps this route free of network calls.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import SegmentChips from '@/features/create-flow/components/SegmentChips';
import { createShowPlan } from '@/features/create-flow/createShowPlan';
import type { SegmentType } from '@/features/viewport-tools/types';
import type { EventType, EventScale } from '@/features/create-flow/types';
import { cn } from '@/lib/utils';

const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: 'festival', label: 'Festival' },
  { id: 'wedding', label: 'Casamento' },
  { id: 'arena', label: 'Arena' },
  { id: 'corporate', label: 'Corporativo' },
];
const SCALES: { id: EventScale; label: string }[] = [
  { id: 'small', label: 'Pequeno' },
  { id: 'medium', label: 'Médio' },
  { id: 'large', label: 'Grande' },
];
const DURATIONS: { value: number; label: string }[] = [
  { value: 30, label: '30s' },
  { value: 60, label: '1min' },
  { value: 180, label: '3min' },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-2 rounded-md text-xs font-semibold border transition-colors',
        active
          ? 'bg-primary/15 border-primary/40 text-primary'
          : 'bg-card/40 border-border/40 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function CreateGenerate() {
  const navigate = useNavigate();
  const [eventType, setEventType] = useState<EventType>('festival');
  const [scale, setScale] = useState<EventScale>('medium');
  const [segments, setSegments] = useState<SegmentType[]>(['PYRO', 'DRONES', 'LIGHT']);
  const [duration, setDuration] = useState<number>(180);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const effectiveDuration = customDuration && Number.isFinite(Number(customDuration))
    ? Math.max(5, Math.min(3600, Number(customDuration)))
    : duration;

  const onGenerate = async () => {
    setBusy(true);
    try {
      const { showId } = await createShowPlan({
        mode: 'generated',
        name: `${EVENT_TYPES.find(e => e.id === eventType)?.label} (${SCALES.find(s => s.id === scale)?.label})`,
        segments,
        duration: effectiveDuration,
        eventType,
        scale,
      });
      navigate(`/editor/${showId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100dvh-3rem)] w-full bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/create')} className="-ml-2 text-muted-foreground">
          <ArrowLeft className="size-4" /> Voltar
        </Button>
        <header className="space-y-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" /> Gerar Automaticamente
          </h1>
          <p className="text-sm text-muted-foreground">
            Quatro escolhas e a IA prepara o esqueleto do show no editor.
          </p>
        </header>

        <Card className="p-5 space-y-6 bg-card/60 border-border/40">
          <section className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo de evento</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((e) => (
                <Chip key={e.id} active={eventType === e.id} onClick={() => setEventType(e.id)}>{e.label}</Chip>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tamanho</label>
            <div className="flex flex-wrap gap-2">
              {SCALES.map((s) => (
                <Chip key={s.id} active={scale === s.id} onClick={() => setScale(s.id)}>{s.label}</Chip>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Segmentos</label>
            <SegmentChips value={segments} onChange={setSegments} />
          </section>

          <section className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duração</label>
            <div className="flex flex-wrap gap-2 items-center">
              {DURATIONS.map((d) => (
                <Chip
                  key={d.value}
                  active={!customDuration && duration === d.value}
                  onClick={() => { setDuration(d.value); setCustomDuration(''); }}
                >
                  {d.label}
                </Chip>
              ))}
              <Input
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Custom (s)"
                className="w-32 h-9 text-xs"
                inputMode="numeric"
              />
            </div>
          </section>
        </Card>

        <div className="flex justify-end">
          <Button onClick={onGenerate} disabled={busy || segments.length === 0} className="gap-2">
            Gerar Show <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
