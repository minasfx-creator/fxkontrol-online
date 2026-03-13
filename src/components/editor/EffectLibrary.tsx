import { useState, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, Flame, Sparkles, Radio, Shapes, Wand2, Zap, Lightbulb, Droplets, Bomb, CandlestickChart as Candle, Waves, Box, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { EFFECT_LIBRARY, useProjectStore, type Effect } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';
import { parseVDL } from '@/lib/vdlParser';

const CATEGORIES = [
  { key: 'morteiros' as const, label: 'Shells', icon: Flame, emoji: '🎆' },
  { key: 'peonias' as const, label: 'Aerial Effects', icon: Sparkles, emoji: '✨' },
  { key: 'mines' as const, label: 'Mines', icon: Bomb, emoji: '⛏️' },
  { key: 'roman_candles' as const, label: 'Roman Candles', icon: Candle, emoji: '🕯️' },
  { key: 'waterfalls' as const, label: 'Waterfalls', icon: Waves, emoji: '🌊' },
  { key: 'cakes_batteries' as const, label: 'Cakes & Batteries', icon: Box, emoji: '🎂' },
  { key: 'sfx' as const, label: 'Special FX', icon: Droplets, emoji: '💨' },
  { key: 'lasers' as const, label: 'Lasers', icon: Zap, emoji: '🟢' },
  { key: 'iluminacao' as const, label: 'Lighting', icon: Lightbulb, emoji: '💡' },
  { key: 'drones' as const, label: 'Drone Units', icon: Radio, emoji: '🛸' },
  { key: 'formacoes' as const, label: 'Formations', icon: Shapes, emoji: '🔷' },
];

type FilterType = 'all' | 'firework' | 'drone' | 'sfx' | 'laser' | 'light';

function EffectCard({ effect }: { effect: Effect }) {
  const { selectedEffectId, selectEffect, addTimelineItem, currentTime, positions, selectedPositionId, selectedPositionIds } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedEffectId === effect.id;

  const handleDoubleClick = () => {
    // Finale 3D logic: link effect to selected pyro position(s)
    const pyroPositions = positions.filter(p => p.type === 'pyro');
    const targetIds = selectedPositionIds.length > 0
      ? selectedPositionIds.filter(id => positions.find(p => p.id === id)?.type === 'pyro')
      : selectedPositionId && positions.find(p => p.id === selectedPositionId)?.type === 'pyro'
        ? [selectedPositionId]
        : [];

    if (targetIds.length > 0) {
      // Fire from each selected position
      targetIds.forEach((posId, i) => {
        const pos = positions.find(p => p.id === posId);
        if (!pos) return;
        addTimelineItem({
          id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${i}`,
          effectId: effect.id,
          startTime: currentTime,
          trackIndex: effect.type === 'firework' ? 0 : effect.type === 'drone' ? 1 : 2,
          position: { x: pos.x, y: pos.y, z: pos.z },
          positionId: posId,
          positionIds: targetIds.length > 1 ? targetIds : undefined,
          positionName: pos.name,
        });
      });
    } else {
      // No position selected — place at random (legacy behavior)
      addTimelineItem({
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        effectId: effect.id,
        startTime: currentTime,
        trackIndex: effect.type === 'firework' ? 0 : effect.type === 'drone' ? 1 : 2,
        position: {
          x: (Math.random() - 0.5) * 16,
          y: effect.type === 'firework' ? 0 : 5 + Math.random() * 10,
          z: (Math.random() - 0.5) * 8,
        },
      });
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/effect-id', effect.id);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  }, [effect.id]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const typeColor = effect.type === 'laser' ? 'text-green-400' : effect.type === 'sfx' ? 'text-cyan-400' : effect.type === 'light' ? 'text-yellow-400' : '';

  return (
    <button
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => selectEffect(effect.id)}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-left transition-colors text-sm",
        isSelected
          ? "bg-primary/15 text-primary border border-primary/30"
          : "hover:bg-surface-3 text-secondary-foreground border border-transparent",
        isDragging && "opacity-50"
      )}
    >
      <span className="text-base flex-shrink-0">{effect.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={cn("truncate text-xs font-medium", typeColor)}>{effect.name}</p>
        <p className="text-[10px] text-muted-foreground">{effect.duration}s · ${effect.cost}</p>
      </div>
      <div
        className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-border"
        style={{ backgroundColor: effect.color }}
      />
    </button>
  );
}

export default function EffectLibrary() {
  const [search, setSearch] = useState('');
  const [vdlInput, setVdlInput] = useState('');
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['morteiros', 'drones']));
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const { addTimelineItem, currentTime } = useProjectStore();

  const toggleCategory = (key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filteredEffects = EFFECT_LIBRARY.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleVDLSubmit = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !vdlInput.trim()) return;
    const vdl = parseVDL(vdlInput);
    if (!vdl.valid) return;
    const colorStr = vdl.colorNames.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join('/');
    const newItem = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: `vdl-${Date.now()}`,
      startTime: currentTime,
      trackIndex: 0,
      position: {
        x: (Math.random() - 0.5) * 16,
        y: vdl.height / 10,
        z: (Math.random() - 0.5) * 8,
      },
      notes: `VDL: ${vdl.caliber}" ${colorStr} ${vdl.typeName} | Stars:${vdl.starCount} Spread:${vdl.spread}°`,
    };
    addTimelineItem(newItem);
    setVdlInput('');
  };

  const totalCount = filteredEffects.length;

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">Asset Palette</h2>
          <span className="text-[9px] font-mono-code text-muted-foreground">{totalCount} items</span>
        </div>
        <div className="relative mb-1.5">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search effects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs bg-surface-2 border-border"
          />
        </div>
        {/* Type filter chips */}
        <div className="flex flex-wrap gap-0.5">
          {([
            { key: 'all' as FilterType, label: 'All', emoji: '📦' },
            { key: 'firework' as FilterType, label: 'Pyro', emoji: '🎆' },
            { key: 'sfx' as FilterType, label: 'SFX', emoji: '💨' },
            { key: 'laser' as FilterType, label: 'Laser', emoji: '🟢' },
            { key: 'light' as FilterType, label: 'Light', emoji: '💡' },
            { key: 'drone' as FilterType, label: 'Drone', emoji: '🛸' },
          ]).map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={cn(
                "px-1.5 py-0.5 rounded-sm text-[8px] font-semibold uppercase transition-colors border",
                typeFilter === f.key
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-surface-2 text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              {f.emoji} {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {CATEGORIES.map(({ key, label, icon: Icon, emoji }) => {
          const isOpen = openCategories.has(key);
          const effects = filteredEffects.filter((e) => e.category === key);
          if (effects.length === 0) return null;

          return (
            <div key={key} className="mb-0.5">
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span className="text-sm">{emoji}</span>
                <span className="uppercase tracking-wider">{label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{effects.length}</span>
              </button>
              {isOpen && (
                <div className="pl-2 pr-1 space-y-0.5">
                  {effects.map((effect) => (
                    <EffectCard key={effect.id} effect={effect} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* VDL Quick Add */}
      <div className="px-3 py-2 border-t border-border space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Wand2 className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">VDL Quick Add</span>
        </div>
        <Input
          placeholder='e.g. 4in Red Peony'
          value={vdlInput}
          onChange={(e) => setVdlInput(e.target.value)}
          onKeyDown={handleVDLSubmit}
          className="h-7 text-xs bg-surface-2 border-border font-mono-code"
        />
        {vdlInput && (
          <p className={cn("text-[10px]", parseVDL(vdlInput).valid ? "text-primary" : "text-muted-foreground")}>
            {parseVDL(vdlInput).valid
              ? `✓ ${parseVDL(vdlInput).typeName} · ${parseVDL(vdlInput).caliber}" · ${parseVDL(vdlInput).duration}s — Enter to add`
              : 'Keep typing...'}
          </p>
        )}
        <p className="text-[9px] text-muted-foreground">Drag, double-click, or type VDL to add</p>
      </div>
    </div>
  );
}
