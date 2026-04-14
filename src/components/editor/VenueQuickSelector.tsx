/**
 * VenueQuickSelector — Compact command-palette for selecting world show venues.
 * Replaces the old WorldShowPresetsPanel sidebar.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { X, Search, MapPin, Clock, Crosshair, Sparkles } from 'lucide-react';
import { WORLD_SHOW_PRESETS, CONTINENT_LABELS, type WorldShowPreset } from '@/data/worldShowPresets';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onSelect: (preset: WorldShowPreset) => void;
  onClose: () => void;
}

export default function VenueQuickSelector({ open, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setFilter(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    let results = WORLD_SHOW_PRESETS;
    if (filter) results = results.filter(p => p.continent === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
      );
    }
    return results;
  }, [query, filter]);

  const handleSelect = useCallback((preset: WorldShowPreset) => {
    onSelect(preset);
  }, [onSelect]);

  if (!open) return null;

  const continents = Object.keys(CONTINENT_LABELS);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" onClick={onClose} />

      {/* Palette */}
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[61] w-[560px] max-w-[90vw] rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'hsl(var(--background) / 0.95)',
          backdropFilter: 'blur(24px) saturate(1.5)',
          border: '1px solid hsl(var(--primary) / 0.15)',
          boxShadow: '0 0 80px hsl(var(--primary) / 0.08), 0 25px 50px rgba(0,0,0,0.4)',
        }}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/15">
          <Search className="w-4 h-4 text-primary/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar praça, cidade ou país..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none font-mono"
          />
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted/30 transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Continent chips */}
        <div className="flex gap-1.5 px-4 py-2 border-b border-border/10 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all",
              filter === null
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground/50 hover:text-muted-foreground/80 border border-transparent"
            )}
          >
            TODOS
          </button>
          {continents.map(c => (
            <button
              key={c}
              onClick={() => setFilter(filter === c ? null : c)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider transition-all",
                filter === c
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground/50 hover:text-muted-foreground/80 border border-transparent"
              )}
            >
              {CONTINENT_LABELS[c].toUpperCase()}
            </button>
          ))}
        </div>

        {/* Results grid */}
        <div className="max-h-[360px] overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground/40">
              <MapPin className="w-6 h-6 mb-2" />
              <p className="text-xs">Nenhuma praça encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleSelect(preset)}
                  className="group text-left p-3 rounded-xl border border-border/15 hover:border-primary/30 transition-all hover:bg-primary/[0.03] relative overflow-hidden"
                >
                  {/* Subtle glow on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.05) 0%, transparent 70%)' }}
                  />
                  <div className="relative">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{preset.flag}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold truncate text-foreground">{preset.name}</h4>
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                          <MapPin className="w-2.5 h-2.5" />
                          <span className="truncate">{preset.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[9px] text-muted-foreground/50 font-mono">
                      <span className="flex items-center gap-0.5"><Crosshair className="w-2.5 h-2.5" />{preset.stats.positions}</span>
                      <span className="flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />{preset.stats.cues}</span>
                      <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{Math.round(preset.duration / 60)}m</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border/10 text-[9px] text-muted-foreground/30 font-mono text-center tracking-wider">
          ESC para fechar · Selecione uma praça para carregar automaticamente
        </div>
      </div>
    </>
  );
}
