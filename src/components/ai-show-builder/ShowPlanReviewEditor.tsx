/**
 * ShowPlanReviewEditor — modo de revisão editável do ShowPlan.
 *
 * Permite editar manualmente seções, posições e timelineItems do plano
 * gerado pela IA antes de chamar materializeShowPlan. Toda mudança é
 * imutável (helpers em editShowPlan.ts) e re-validada na hora.
 */
import { useMemo, useState } from 'react';
import { Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type {
  PlannedPosition,
  PlannedTimelineItem,
  ShowIntensity,
  ShowPlan,
  ShowSection,
  ShowSiteConfig,
} from '@/lib/aiShowBuilder/types';
import { validateShowPlan } from '@/lib/aiShowBuilder/validateShowPlan';
import {
  removePosition,
  removeTimelineItem,
  updatePlanMeta,
  updatePosition,
  updateSection,
  updateTimelineItem,
} from '@/lib/aiShowBuilder/editShowPlan';

interface Props {
  plan: ShowPlan;
  site: ShowSiteConfig;
  onChange: (next: ShowPlan) => void;
  onClose: () => void;
}

const INTENSITIES: ShowIntensity[] = ['low', 'medium', 'high'];

const num = (v: string, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export default function ShowPlanReviewEditor({ plan, site, onChange, onClose }: Props) {
  const [tab, setTab] = useState<'meta' | 'sections' | 'positions' | 'timeline'>('sections');

  const validation = useMemo(() => validateShowPlan(plan, site), [plan, site]);

  return (
    <div className="rounded-md border border-border/50 bg-background/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Revisar e editar plano</h4>
          <p className="text-xs text-muted-foreground">
            Ajuste seções, posições e cues antes de aplicar no mundo 3D.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar revisão</Button>
      </div>

      {/* Status */}
      <div className="flex flex-wrap gap-3 text-xs">
        {validation.ok ? (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Plano válido
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {validation.errors.length} erro(s)
          </span>
        )}
        {validation.warnings.length > 0 && (
          <span className="flex items-center gap-1 text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> {validation.warnings.length} aviso(s)
          </span>
        )}
        <span className="text-muted-foreground">
          {plan.positions.length} posições · {plan.timelineItems.length} cues · {plan.duration.toFixed(0)}s
        </span>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="meta">Show</TabsTrigger>
          <TabsTrigger value="sections">Seções</TabsTrigger>
          <TabsTrigger value="positions">Posições ({plan.positions.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({plan.timelineItems.length})</TabsTrigger>
        </TabsList>

        {/* META */}
        <TabsContent value="meta" className="pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input
                value={plan.title}
                onChange={(e) => onChange(updatePlanMeta(plan, { title: e.target.value }))}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duração (s)</Label>
              <Input
                type="number"
                min={1}
                value={plan.duration}
                onChange={(e) => onChange(updatePlanMeta(plan, { duration: num(e.target.value, plan.duration) }))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Estilo</Label>
              <Input
                value={plan.style}
                onChange={(e) => onChange(updatePlanMeta(plan, { style: e.target.value }))}
                maxLength={80}
              />
            </div>
          </div>
        </TabsContent>

        {/* SECTIONS */}
        <TabsContent value="sections" className="pt-3">
          <ScrollArea className="max-h-[280px] pr-2">
            <div className="space-y-2">
              {plan.sections.map((sec) => (
                <SectionRow
                  key={sec.id}
                  section={sec}
                  duration={plan.duration}
                  onChange={(patch) => onChange(updateSection(plan, sec.id, patch))}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* POSITIONS */}
        <TabsContent value="positions" className="pt-3">
          <ScrollArea className="max-h-[320px] pr-2">
            <div className="space-y-2">
              {plan.positions.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma posição no plano.</p>
              )}
              {plan.positions.map((p) => (
                <PositionRow
                  key={p.id}
                  position={p}
                  site={site}
                  onChange={(patch) => onChange(updatePosition(plan, p.id, patch))}
                  onRemove={() => onChange(removePosition(plan, p.id))}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline" className="pt-3">
          <ScrollArea className="max-h-[320px] pr-2">
            <div className="space-y-2">
              {plan.timelineItems.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum cue no plano.</p>
              )}
              {plan.timelineItems.map((it) => (
                <TimelineRow
                  key={it.id}
                  item={it}
                  duration={plan.duration}
                  positions={plan.positions}
                  onChange={(patch) => onChange(updateTimelineItem(plan, it.id, patch))}
                  onRemove={() => onChange(removeTimelineItem(plan, it.id))}
                />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="rounded border border-border/40 bg-card/30 p-2 space-y-1 max-h-32 overflow-auto">
          {validation.errors.map((e, i) => (
            <p key={`e-${i}`} className="text-[11px] text-red-300">• {e}</p>
          ))}
          {validation.warnings.map((w, i) => (
            <p key={`w-${i}`} className="text-[11px] text-amber-300">• {w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes ─────────────────────────────────────────────────────

function SectionRow({
  section,
  duration,
  onChange,
}: {
  section: ShowSection;
  duration: number;
  onChange: (patch: Partial<ShowSection>) => void;
}) {
  return (
    <div className="rounded border border-border/40 bg-card/30 p-2 grid grid-cols-12 gap-2 items-end">
      <div className="col-span-3 space-y-1">
        <Label className="text-[10px] uppercase">Nome</Label>
        <Input
          value={section.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Início (s)</Label>
        <Input
          type="number"
          min={0}
          max={duration}
          value={section.startTime}
          onChange={(e) => onChange({ startTime: num(e.target.value, section.startTime) })}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Duração (s)</Label>
        <Input
          type="number"
          min={0}
          value={section.duration}
          onChange={(e) => onChange({ duration: num(e.target.value, section.duration) })}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Intensidade</Label>
        <Select value={section.intensity} onValueChange={(v) => onChange({ intensity: v as ShowIntensity })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {INTENSITIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-3 space-y-1">
        <Label className="text-[10px] uppercase">Descrição</Label>
        <Input
          value={section.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

function PositionRow({
  position,
  site,
  onChange,
  onRemove,
}: {
  position: PlannedPosition;
  site: ShowSiteConfig;
  onChange: (patch: Partial<PlannedPosition>) => void;
  onRemove: () => void;
}) {
  const halfW = site.width / 2;
  const halfD = site.depth / 2;
  const oob =
    position.x < -halfW || position.x > halfW ||
    position.z < -halfD || position.z > halfD ||
    position.y < 0 || position.y > site.maxHeight;

  return (
    <div className={`rounded border p-2 grid grid-cols-12 gap-2 items-end ${oob ? 'border-red-500/40 bg-red-500/5' : 'border-border/40 bg-card/30'}`}>
      <div className="col-span-3 space-y-1">
        <Label className="text-[10px] uppercase">Nome</Label>
        <Input
          value={position.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Tipo</Label>
        <Select value={position.type} onValueChange={(v) => onChange({ type: v as PlannedPosition['type'] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="drone">drone</SelectItem>
            <SelectItem value="pyro">pyro</SelectItem>
            <SelectItem value="anchor">anchor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="col-span-2 space-y-1">
          <Label className="text-[10px] uppercase">{axis.toUpperCase()} (m)</Label>
          <Input
            type="number"
            value={position[axis]}
            onChange={(e) => onChange({ [axis]: num(e.target.value, position[axis]) } as Partial<PlannedPosition>)}
            className="h-8 text-xs"
          />
        </div>
      ))}
      <div className="col-span-1 flex justify-end">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} title="Remover">
          <Trash2 className="h-3.5 w-3.5 text-red-300" />
        </Button>
      </div>
    </div>
  );
}

function TimelineRow({
  item,
  duration,
  positions,
  onChange,
  onRemove,
}: {
  item: PlannedTimelineItem;
  duration: number;
  positions: PlannedPosition[];
  onChange: (patch: Partial<PlannedTimelineItem>) => void;
  onRemove: () => void;
}) {
  const oob = item.startTime < 0 || item.startTime > duration;
  return (
    <div className={`rounded border p-2 grid grid-cols-12 gap-2 items-end ${oob ? 'border-red-500/40 bg-red-500/5' : 'border-border/40 bg-card/30'}`}>
      <div className="col-span-3 space-y-1">
        <Label className="text-[10px] uppercase">Label</Label>
        <Input
          value={item.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Tipo</Label>
        <Select value={item.type} onValueChange={(v) => onChange({ type: v as PlannedTimelineItem['type'] })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="marker">marker</SelectItem>
            <SelectItem value="drone_move">drone_move</SelectItem>
            <SelectItem value="pyro_effect">pyro_effect</SelectItem>
            <SelectItem value="finale">finale</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Início (s)</Label>
        <Input
          type="number"
          min={0}
          max={duration}
          step={0.1}
          value={item.startTime}
          onChange={(e) => onChange({ startTime: num(e.target.value, item.startTime) })}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Duração (s)</Label>
        <Input
          type="number"
          min={0}
          step={0.1}
          value={item.duration ?? 0}
          onChange={(e) => onChange({ duration: num(e.target.value, item.duration ?? 0) })}
          className="h-8 text-xs"
        />
      </div>
      <div className="col-span-2 space-y-1">
        <Label className="text-[10px] uppercase">Posição</Label>
        <Select
          value={item.positionId ?? '__none'}
          onValueChange={(v) => {
            if (v === '__none') {
              onChange({ positionId: undefined, positionName: undefined });
            } else {
              const pos = positions.find((p) => p.id === v);
              onChange({ positionId: v, positionName: pos?.name });
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— nenhuma —</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-1 flex justify-end">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove} title="Remover">
          <Trash2 className="h-3.5 w-3.5 text-red-300" />
        </Button>
      </div>
    </div>
  );
}
