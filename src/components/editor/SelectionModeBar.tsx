import { useProjectStore, type SelectionMode } from '@/store/useProjectStore';
import { MapPin, Zap, Link2, Lasso, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useCallback } from 'react';

const SECTION_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
const SECTION_COLORS: Record<string, string> = {
  A: '#4CAF50', B: '#2196F3', C: '#FF9800', D: '#E91E63', E: '#9C27B0', F: '#00BCD4',
};

const modes: { id: SelectionMode; icon: typeof MapPin; label: string; shortcut: string }[] = [
  { id: 'positions', icon: MapPin, label: 'Posições', shortcut: '1' },
  { id: 'events', icon: Zap, label: 'Eventos', shortcut: '2' },
  { id: 'both', icon: Link2, label: 'Ambos', shortcut: '3' },
];

export default function SelectionModeBar() {
  const { selectionMode, setSelectionMode, editorMode, positions, selectMultiplePositionsAndLinkedEvents } = useProjectStore();
  const [showSections, setShowSections] = useState(false);

  const selectBySection = useCallback((section: string) => {
    const ids = positions.filter(p => p.section === section).map(p => p.id);
    if (ids.length > 0) selectMultiplePositionsAndLinkedEvents(ids);
    setShowSections(false);
  }, [positions, selectMultiplePositionsAndLinkedEvents]);

  if (editorMode !== 'select') return null;

  return (
    <div className="absolute top-3 left-3 z-40 flex items-center gap-0.5 bg-card/90 backdrop-blur-md border border-border/40 rounded-lg px-1 py-0.5 shadow-xl">
      {modes.map(({ id, icon: Icon, label, shortcut }) => (
        <button
          key={id}
          onClick={() => setSelectionMode(id)}
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded-md text-[9px] font-medium transition-all",
            selectionMode === id
              ? "bg-primary/15 text-primary border border-primary/25"
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20 border border-transparent"
          )}
          title={`${label} (${shortcut})`}
        >
          <Icon className="w-3 h-3" />
          <span className="hidden sm:inline">{label}</span>
          <kbd className="text-[7px] text-muted-foreground/30 ml-0.5">{shortcut}</kbd>
        </button>
      ))}

      <div className="w-px h-4 bg-border/30 mx-0.5" />

      {/* Lasso toggle — activates box select */}
      <button
        onClick={() => {
          // Box select is always available via Shift+Drag, this is just a visual indicator
        }}
        className="flex items-center gap-1 px-1.5 py-1.5 rounded-md text-[9px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/20 transition-all"
        title="Lasso (Shift+Drag)"
      >
        <Lasso className="w-3 h-3" />
      </button>

      {/* Select by Section */}
      <div className="relative">
        <button
          onClick={() => setShowSections(!showSections)}
          className={cn(
            "flex items-center gap-1 px-1.5 py-1.5 rounded-md text-[9px] transition-all",
            showSections
              ? "bg-accent/15 text-accent border border-accent/25"
              : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/20 border border-transparent"
          )}
          title="Selecionar por Seção"
        >
          <Grid3x3 className="w-3 h-3" />
        </button>
        {showSections && (
          <div className="absolute top-full left-0 mt-1 bg-popover/95 backdrop-blur-md border border-border/50 rounded-lg p-1 shadow-xl min-w-[100px] z-50">
            <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-wider px-2 py-0.5 block">Seção</span>
            {SECTION_OPTIONS.map(s => {
              const count = positions.filter(p => p.section === s).length;
              return (
                <button
                  key={s}
                  onClick={() => selectBySection(s)}
                  disabled={count === 0}
                  className="flex w-full items-center gap-2 px-2 py-1 rounded-md text-[9px] hover:bg-accent/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SECTION_COLORS[s] }} />
                  <span className="font-medium">Seção {s}</span>
                  <span className="ml-auto text-muted-foreground/40 text-[8px]">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
