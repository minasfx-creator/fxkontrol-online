import { useState, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, Flame, Sparkles, Radio, Shapes } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { EFFECT_LIBRARY, useProjectStore, type Effect } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { key: 'morteiros' as const, label: 'Morteiros', icon: Flame },
  { key: 'peonias' as const, label: 'Peônias', icon: Sparkles },
  { key: 'drones' as const, label: 'Drones', icon: Radio },
  { key: 'formacoes' as const, label: 'Formações', icon: Shapes },
];

function EffectCard({ effect }: { effect: Effect }) {
  const { selectedEffectId, selectEffect, addTimelineItem, currentTime } = useProjectStore();
  const [isDragging, setIsDragging] = useState(false);
  const isSelected = selectedEffectId === effect.id;

  const handleDoubleClick = () => {
    const newItem = {
      id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      effectId: effect.id,
      startTime: currentTime,
      trackIndex: effect.type === 'firework' ? 0 : 1,
      position: {
        x: (Math.random() - 0.5) * 16,
        y: effect.type === 'firework' ? 8 + Math.random() * 6 : 5 + Math.random() * 10,
        z: (Math.random() - 0.5) * 8,
      },
    };
    addTimelineItem(newItem);
  };

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/effect-id', effect.id);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  }, [effect.id]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

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
        <p className="truncate text-xs font-medium">{effect.name}</p>
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
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(['morteiros', 'drones']));

  const toggleCategory = (key: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filteredEffects = EFFECT_LIBRARY.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">Effect Library</h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search effects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs bg-surface-2 border-border"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-1 py-1">
        {CATEGORIES.map(({ key, label, icon: Icon }) => {
          const isOpen = openCategories.has(key);
          const effects = filteredEffects.filter((e) => e.category === key);
          if (search && effects.length === 0) return null;

          return (
            <div key={key} className="mb-0.5">
              <button
                onClick={() => toggleCategory(key)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <Icon className="w-3.5 h-3.5" />
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

      {/* Tip */}
      <div className="px-3 py-2 border-t border-border">
        <p className="text-[10px] text-muted-foreground">Drag or double-click to add to timeline</p>
      </div>
    </div>
  );
}
