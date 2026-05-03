/**
 * EffectLibrarySidebar — searchable, categorized effect palette with HTML5
 * drag source. Designed for the Video Editor surface.
 *
 * Plano: Experience Plane (presentation only). NÃO toca CommandBus,
 * FieldBus, SafetyStateMachine ou workMode.
 *
 * Drag protocol
 * ─────────────
 *   dataTransfer.setData('application/x-fxk-effect', effectId)
 *   dataTransfer.setData('text/plain', effectId)        // fallback
 *   dataTransfer.effectAllowed = 'copy'
 *
 * Consumers (timeline lanes) read 'application/x-fxk-effect' and resolve
 * the effect from EFFECT_LIBRARY.
 */
import { useMemo, useState } from 'react';
import {
  Search, Sparkles, Flame, Layers, Stars,
  Music2, Zap, Lightbulb, Mountain, Wind, ChevronDown, ChevronRight,
  type LucideIcon,
} from 'lucide-react';

import {
  Sidebar, SidebarHeader, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { EFFECT_LIBRARY, type Effect } from '@/data/effectLibrary';

// ──────────────────────────────────────────────────────────────────────────
// Category registry — order + label + icon. Values match Effect.category.
// ──────────────────────────────────────────────────────────────────────────

interface Group {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Track id this group prefers when dropped on a generic surface. */
  preferredTrack: 'pyro' | 'drone' | 'audio' | 'video';
}

const GROUPS: Group[] = [
  { id: 'morteiros',       label: 'Morteiros',      icon: Flame,     preferredTrack: 'pyro'  },
  { id: 'peonias',         label: 'Peônias',        icon: Sparkles,  preferredTrack: 'pyro'  },
  { id: 'drones',          label: 'Drones',         icon: Layers,    preferredTrack: 'drone' },
  { id: 'formacoes',       label: 'Formações',      icon: Stars,     preferredTrack: 'drone' },
  { id: 'cakes_batteries', label: 'Cakes/Bat.',     icon: Zap,       preferredTrack: 'pyro'  },
  { id: 'mines',           label: 'Mines',          icon: Mountain,  preferredTrack: 'pyro'  },
  { id: 'roman_candles',   label: 'Roman Candles',  icon: Flame,     preferredTrack: 'pyro'  },
  { id: 'waterfalls',      label: 'Waterfalls',     icon: Wind,      preferredTrack: 'pyro'  },
  { id: 'ground_effects',  label: 'Ground FX',      icon: Mountain,  preferredTrack: 'pyro'  },
  { id: 'lasers',          label: 'Lasers',         icon: Zap,       preferredTrack: 'pyro'  },
  { id: 'iluminacao',      label: 'Iluminação',     icon: Lightbulb, preferredTrack: 'drone' },
  { id: 'sfx',             label: 'SFX',            icon: Music2,    preferredTrack: 'audio' },
];

// Categories the user explicitly highlighted in the brief — surface first.
const PRIMARY = new Set(['morteiros', 'peonias', 'drones', 'formacoes']);

export const FXK_EFFECT_DRAG_TYPE = 'application/x-fxk-effect';

// ──────────────────────────────────────────────────────────────────────────
// Item row
// ──────────────────────────────────────────────────────────────────────────

function EffectRow({ effect }: { effect: Effect }) {
  const onDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(FXK_EFFECT_DRAG_TYPE, effect.id);
    e.dataTransfer.setData('text/plain', effect.id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      className={cn(
        'group w-full flex items-center gap-2 px-2 py-1.5 rounded-sm',
        'text-left text-[12px] text-zinc-300 hover:bg-cyan-500/10 hover:text-cyan-100',
        'cursor-grab active:cursor-grabbing transition-colors',
      )}
      title={`${effect.name} · drag to a track`}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10 shrink-0"
        style={{ background: effect.color, boxShadow: `0 0 6px ${effect.color}80` }}
      />
      <span className="flex-1 truncate">{effect.name}</span>
      {effect.caliber ? (
        <span className="ds-mono text-[10px] text-zinc-500 group-hover:text-cyan-300">
          {effect.caliber}″
        </span>
      ) : null}
      {effect.duration ? (
        <span className="ds-mono text-[10px] text-zinc-500 group-hover:text-cyan-300 tabular-nums">
          {effect.duration.toFixed(1)}s
        </span>
      ) : null}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Group block (collapsible)
// ──────────────────────────────────────────────────────────────────────────

function GroupBlock({
  group, items, openByDefault,
}: { group: Group; items: Effect[]; openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <SidebarGroup>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-cyan-500/5"
      >
        <Chevron className="h-3 w-3 text-zinc-500" />
        <group.icon className="h-3.5 w-3.5 text-cyan-400/80" />
        <SidebarGroupLabel className="flex-1 text-left text-[10px] uppercase tracking-widest text-zinc-400 px-0">
          {group.label}
        </SidebarGroupLabel>
        <Badge
          variant="outline"
          className="h-4 px-1.5 ds-mono text-[9px] border-cyan-500/20 text-zinc-400"
        >
          {items.length}
        </Badge>
      </button>
      {open && (
        <SidebarGroupContent className="pl-1">
          {items.length === 0 ? (
            <div className="px-2 py-1 text-[11px] text-zinc-600 italic">empty</div>
          ) : (
            items.map((e) => <EffectRow key={e.id} effect={e} />)
          )}
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────────────────────────────

export default function EffectLibrarySidebar() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return EFFECT_LIBRARY;
    return EFFECT_LIBRARY.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.pattern ?? '').toLowerCase().includes(q),
    );
  }, [query]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Effect[]>();
    for (const e of filtered) {
      const arr = map.get(e.category) ?? [];
      arr.push(e);
      map.set(e.category, arr);
    }
    return map;
  }, [filtered]);

  // Show primary groups first, then the rest. Hide groups with 0 items
  // when filtering, so the search experience is tight.
  const orderedGroups = useMemo(() => {
    const primary = GROUPS.filter((g) => PRIMARY.has(g.id));
    const rest = GROUPS.filter((g) => !PRIMARY.has(g.id));
    const all = [...primary, ...rest];
    return query
      ? all.filter((g) => (byCategory.get(g.id)?.length ?? 0) > 0)
      : all;
  }, [byCategory, query]);

  return (
    <Sidebar collapsible="icon" className="border-r border-cyan-500/10">
      <SidebarHeader className="px-3 py-3 gap-2">
        <div className="flex items-center gap-2 ds-mono text-[11px] tracking-wider text-cyan-300/80">
          <Sparkles className="h-4 w-4" />
          <span>EFFECT · LIBRARY</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search effects…"
            className="h-8 pl-7 bg-[#0c1322] border-cyan-500/15 text-[12px] placeholder:text-zinc-600"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <ScrollArea className="h-full">
          <div className="px-1 pb-3">
            {orderedGroups.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-zinc-500">
                No effects match “{query}”.
              </div>
            ) : (
              orderedGroups.map((g) => (
                <GroupBlock
                  key={g.id}
                  group={g}
                  items={byCategory.get(g.id) ?? []}
                  openByDefault={PRIMARY.has(g.id) || !!query}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="px-3 py-2 border-t border-cyan-500/10 ds-mono text-[10px] text-zinc-500">
        drag onto a track
      </SidebarFooter>
    </Sidebar>
  );
}
