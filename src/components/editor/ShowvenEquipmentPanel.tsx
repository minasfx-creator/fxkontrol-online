import { useState, useCallback } from 'react';
import { Flame, Sparkles, Cloud, PartyPopper, Cpu, ChevronDown, ChevronRight, GripVertical, X, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  SHOWVEN_FLAMERS, SHOWVEN_SPARKULARS, SHOWVEN_FOG, SHOWVEN_CONFETTI, SHOWVEN_CONTROLLERS, SHOWVEN_FLYING_DISPLAYS,
  type ShowvenFlamerPreset, type ShowvenSparkularPreset, type ShowvenFogPreset,
  type ShowvenConfettiPreset, type ShowvenControllerPreset, type ShowvenCategory,
  type ShowvenFlyingDisplayPreset,
} from '@/lib/showvenPresets';
import { useProjectStore } from '@/store/useProjectStore';
import { useUndoStore } from '@/store/useUndoStore';
import { toast } from 'sonner';

interface ShowvenEquipmentPanelProps {
  onClose?: () => void;
}

type AnyPreset = ShowvenFlamerPreset | ShowvenSparkularPreset | ShowvenFogPreset | ShowvenConfettiPreset | ShowvenControllerPreset | ShowvenFlyingDisplayPreset;

const CATEGORY_META: Record<ShowvenCategory, { label: string; icon: typeof Flame; color: string }> = {
  flamer:         { label: 'Flamers',         icon: Flame,       color: 'hsl(20 90% 55%)' },
  sparkular:      { label: 'Sparkulars',      icon: Sparkles,    color: 'hsl(45 95% 60%)' },
  cryo:           { label: 'Cryo Jets',       icon: Cloud,       color: 'hsl(200 80% 70%)' },
  confetti:       { label: 'Confetti',        icon: PartyPopper, color: 'hsl(330 80% 65%)' },
  fog:            { label: 'Fog Machines',    icon: Cloud,       color: 'hsl(220 15% 65%)' },
  controller:     { label: 'Controllers',     icon: Cpu,         color: 'hsl(150 50% 50%)' },
  remote:         { label: 'Remotes',         icon: Cpu,         color: 'hsl(270 40% 60%)' },
  flyingDisplay:  { label: 'Flying Displays', icon: Monitor,     color: 'hsl(180 70% 55%)' },
};

function getSpecLine(preset: AnyPreset, category: ShowvenCategory): string {
  if (category === 'flamer') {
    const p = preset as ShowvenFlamerPreset;
    return `${p.maxHeightM}m · ${p.nozzles} nozzle${p.nozzles > 1 ? 's' : ''} · ${p.dmxChannels}ch DMX · ${p.weightKg}kg`;
  }
  if (category === 'sparkular') {
    const p = preset as ShowvenSparkularPreset;
    return `${p.maxHeightM}m · ${p.sparkType} · ${p.sparkColor} · ${p.dmxChannels}ch DMX`;
  }
  if (category === 'fog') {
    const p = preset as ShowvenFogPreset;
    return `${p.outputCuftMin.toLocaleString()} cuft/min · ${p.fogType} · ${p.heaterWatts}W · ${p.weightKg}kg`;
  }
  if (category === 'confetti') {
    const p = preset as ShowvenConfettiPreset;
    return `${p.rangeM}m range · ${p.type} · ${p.dmxChannels}ch DMX`;
  }
  if (category === 'controller' || category === 'remote') {
    const p = preset as ShowvenControllerPreset;
    return `${p.channels}ch · ${p.type} · ${p.protocol}`;
  }
  if (category === 'flyingDisplay') {
    const p = preset as ShowvenFlyingDisplayPreset;
    return `${p.widthM}×${p.heightM}m · ${p.pixelPitch} · ${p.transparency}% transp · ${p.weightKg}kg`;
  }
  return '';
}

function getEffectType(category: ShowvenCategory): string {
  switch (category) {
    case 'flamer': return 'flame';
    case 'sparkular': return 'sparkular';
    case 'fog': return 'fog_low';
    case 'confetti': return 'confetti';
    case 'cryo': return 'cryo';
    default: return '';
  }
}

function EquipmentCard({ preset, category }: { preset: AnyPreset; category: ShowvenCategory }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const effectType = getEffectType(category);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/showven-equipment', JSON.stringify({
      id: preset.id,
      category,
      effectType,
      name: preset.name,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, [preset, category, effectType]);

  const handleDoubleClick = useCallback(() => {
    if (!effectType) {
      toast.info(`${preset.name} é um controlador — não gera efeito na cena.`);
      return;
    }
    const store = useProjectStore.getState();
    useUndoStore.getState().checkpoint();

    // Create a pyro position
    const posId = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const offset = store.positions.length * 2;
    store.addPosition({
      id: posId,
      name: `${preset.name}`,
      x: offset,
      y: 0,
      z: 0,
      type: 'pyro',
      color: meta.color,
      heading: 0,
      pitch: 0,
      roll: 0,
    });

    // Create timeline item linked to the effect type
    const tlId = `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    store.addTimelineItem({
      id: tlId,
      effectId: effectType,
      startTime: store.currentTime,
      trackIndex: 0,
      position: { x: offset, y: 0, z: 0 },
      notes: `Showven ${preset.name}`,
    });

    toast.success(`${preset.name} adicionado à cena`);
  }, [preset, category, effectType, meta.color]);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            draggable={!!effectType}
            onDragStart={handleDragStart}
            onDoubleClick={handleDoubleClick}
            className={cn(
              "group flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing",
              "border border-border/10 hover:border-border/30 transition-all duration-150",
              "hover:bg-accent/5 hover:shadow-[0_0_12px_hsl(var(--primary)/0.06)]",
              !effectType && "cursor-default opacity-60"
            )}
          >
            {effectType && (
              <GripVertical className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 flex-shrink-0" />
            )}
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: `${meta.color}20` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate leading-tight">{preset.name}</p>
              <p className="text-[9px] text-muted-foreground/70 truncate leading-tight mt-0.5">
                {getSpecLine(preset, category)}
              </p>
            </div>
            {effectType && (
              <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-border/20 text-muted-foreground/50 flex-shrink-0">
                {'dmxChannels' in preset ? `${(preset as any).dmxChannels}ch` : ''}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[220px] text-[10px]">
          <p className="font-semibold">{preset.name}</p>
          <p className="text-muted-foreground mt-0.5">{preset.description}</p>
          {effectType && <p className="text-primary/80 mt-1">Double-click ou arraste para a cena</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CategorySection({ category, presets }: { category: ShowvenCategory; presets: AnyPreset[] }) {
  const [open, setOpen] = useState(true);
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/5 rounded-lg transition-colors">
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground/50" /> : <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
        <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        <span className="text-[11px] font-bold tracking-wide uppercase text-muted-foreground/70">{meta.label}</span>
        <Badge variant="secondary" className="ml-auto text-[9px] h-4 px-1.5">{presets.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-1 px-1 pb-2">
          {presets.map(p => (
            <EquipmentCard key={p.id} preset={p} category={category} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ShowvenEquipmentPanel({ onClose }: ShowvenEquipmentPanelProps) {
  return (
    <div className="h-full flex flex-col" style={{ background: 'hsl(var(--card))' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.12)' }}>
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground">Showven™ Equipment</h3>
            <p className="text-[9px] text-muted-foreground/60">Arraste para a cena 3D</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Equipment list */}
      <ScrollArea className="flex-1">
        <div className="p-2 flex flex-col gap-1">
          <CategorySection category="flamer" presets={SHOWVEN_FLAMERS} />
          <CategorySection category="sparkular" presets={SHOWVEN_SPARKULARS} />
          <CategorySection category="fog" presets={SHOWVEN_FOG} />
          <CategorySection category="confetti" presets={SHOWVEN_CONFETTI} />
          <CategorySection category="flyingDisplay" presets={SHOWVEN_FLYING_DISPLAYS} />
          <CategorySection category="controller" presets={SHOWVEN_CONTROLLERS} />
        </div>
      </ScrollArea>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border/10">
        <p className="text-[9px] text-muted-foreground/50 text-center">
          Double-click para adicionar · Drag & drop para posicionar
        </p>
      </div>
    </div>
  );
}
