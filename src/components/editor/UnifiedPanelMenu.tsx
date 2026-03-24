/**
 * UnifiedPanelMenu — Single source of truth for all panel navigation.
 * Adapts to iOS (bottom sheet), Android (navigation drawer), macOS (sidebar).
 * Uses PANEL_SECTIONS from PanelTabBar as the canonical data.
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, ChevronRight, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { PANEL_SECTIONS, type PanelId } from './PanelTabBar';
import { ScrollArea } from '@/components/ui/scroll-area';

const RECENTS_KEY = 'fxk-recent-panels';
const FAVORITES_KEY = 'fxk-panel-favorites';
const MAX_RECENTS = 6;

interface UnifiedPanelMenuProps {
  activePanel: PanelId | null;
  onSelectPanel: (id: PanelId) => void;
  variant: 'sheet' | 'drawer' | 'sidebar';
  onDismiss?: () => void;
}

export default function UnifiedPanelMenu({
  activePanel,
  onSelectPanel,
  variant,
  onDismiss,
}: UnifiedPanelMenuProps) {
  const [search, setSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [recents, setRecents] = useState<PanelId[]>([]);
  const [favorites, setFavorites] = useState<PanelId[]>([]);

  useEffect(() => {
    try { setRecents(JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]').slice(0, MAX_RECENTS)); } catch { setRecents([]); }
    try { setFavorites(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]')); } catch { setFavorites([]); }
  }, []);

  const allItems = useMemo(() => PANEL_SECTIONS.flatMap(s => s.items), []);

  const handleSelect = useCallback((id: PanelId) => {
    onSelectPanel(id);
    haptics.tap();
    const updated = [id, ...recents.filter(r => r !== id)].slice(0, MAX_RECENTS);
    setRecents(updated);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
  }, [onSelectPanel, recents]);

  const toggleFavorite = useCallback((id: PanelId) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleSection = useCallback((title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return PANEL_SECTIONS;
    const q = search.toLowerCase();
    return PANEL_SECTIONS.map(s => ({
      ...s,
      items: s.items.filter(i => i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)),
    })).filter(s => s.items.length > 0);
  }, [search]);

  const recentItems = useMemo(() =>
    recents.map(id => allItems.find(i => i.id === id)).filter(Boolean) as typeof allItems,
    [recents, allItems]
  );

  const favoriteItems = useMemo(() =>
    favorites.map(id => allItems.find(i => i.id === id)).filter(Boolean) as typeof allItems,
    [favorites, allItems]
  );

  const isSheet = variant === 'sheet';
  const isDrawer = variant === 'drawer';

  return (
    <div className={cn(
      "flex flex-col h-full",
      isSheet && "pb-safe",
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center gap-2 px-4 shrink-0",
        isSheet ? "pt-2 pb-3" : "pt-3 pb-2",
      )}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Buscar painel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-10 pr-4 text-sm rounded-xl bg-muted/30 text-foreground placeholder:text-muted-foreground/40 outline-none border-0 transition-all",
              "focus:ring-2 focus:ring-primary/20 focus:bg-muted/50",
              isSheet ? "h-10" : "h-9",
            )}
          />
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className={cn("px-3 pb-4 space-y-3", isSheet && "px-4")}>
          {/* Favorites */}
          {favoriteItems.length > 0 && !search && (
            <Section title="Favoritos" icon={Star}>
              <div className="grid grid-cols-3 gap-1.5">
                {favoriteItems.map(({ id, label, icon: Icon }) => (
                  <PanelChip
                    key={id}
                    id={id}
                    label={label}
                    icon={Icon}
                    active={activePanel === id}
                    onSelect={handleSelect}
                    variant={variant}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Recents */}
          {recentItems.length > 0 && !search && (
            <Section title="Recentes">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {recentItems.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleSelect(id)}
                    className={cn(
                      "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-95",
                      "bg-muted/20 hover:bg-muted/40",
                      activePanel === id && "bg-primary/10 text-primary ring-1 ring-primary/20",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium whitespace-nowrap">{label}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* All sections */}
          {filtered.map((section) => {
            const isCollapsed = collapsedSections.has(section.title);
            const hasActive = section.items.some(i => i.id === activePanel);
            const SectionIcon = section.icon;

            return (
              <div key={section.title}>
                <button
                  onClick={() => toggleSection(section.title)}
                  className={cn(
                    "w-full flex items-center gap-2 px-1 py-1.5 text-left group",
                  )}
                >
                  <SectionIcon className={cn(
                    "w-3.5 h-3.5 transition-colors",
                    hasActive ? "text-primary" : "text-muted-foreground/50",
                  )} />
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-[0.1em] flex-1",
                    hasActive ? "text-primary/80" : "text-muted-foreground/50",
                  )}>
                    {section.title}
                  </span>
                  <ChevronRight className={cn(
                    "w-3 h-3 text-muted-foreground/30 transition-transform",
                    !isCollapsed && "rotate-90",
                  )} />
                </button>

                {!isCollapsed && (
                  <div className="rounded-2xl overflow-hidden bg-card/50 border border-border/5">
                    {section.items.map(({ id, label, icon: Icon, shortcut }, idx) => (
                      <button
                        key={id}
                        onClick={() => handleSelect(id)}
                        className={cn(
                          "w-full flex items-center gap-3 text-left transition-all active:scale-[0.98]",
                          isSheet ? "px-4 py-3.5" : "px-3 py-2.5",
                          "hover:bg-muted/30",
                          activePanel === id && "bg-primary/8",
                          idx < section.items.length - 1 && "border-b border-border/5",
                        )}
                      >
                        <div className={cn(
                          "rounded-lg flex items-center justify-center shrink-0",
                          isSheet ? "w-8 h-8" : "w-7 h-7",
                          activePanel === id ? "bg-primary/15" : "bg-muted/20",
                        )}>
                          <Icon className={cn(
                            "w-4 h-4",
                            activePanel === id ? "text-primary" : "text-muted-foreground/70",
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "text-[13px] font-medium block",
                            activePanel === id ? "text-primary" : "text-foreground",
                          )}>
                            {label}
                          </span>
                        </div>
                        {shortcut && (
                          <kbd className="text-[9px] font-mono bg-muted/30 text-muted-foreground/50 px-1.5 py-0.5 rounded-md">
                            {shortcut}
                          </kbd>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(id); }}
                          className={cn(
                            "w-6 h-6 flex items-center justify-center rounded-full transition-colors",
                            favorites.includes(id) ? "text-[hsl(var(--fxk-gold))]" : "text-muted-foreground/20 hover:text-muted-foreground/50",
                          )}
                        >
                          <Star className={cn("w-3 h-3", favorites.includes(id) && "fill-current")} />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/20" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Star; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 px-1 mb-2">
        {Icon && <Icon className="w-3 h-3 text-[hsl(var(--fxk-gold))]" />}
        <h4 className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function PanelChip({
  id, label, icon: Icon, active, onSelect, variant,
}: {
  id: PanelId; label: string; icon: typeof Star; active: boolean;
  onSelect: (id: PanelId) => void; variant: string;
}) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all active:scale-95",
        "bg-muted/20 hover:bg-muted/40",
        active && "bg-primary/10 text-primary ring-1 ring-primary/20",
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[11px] font-medium truncate">{label}</span>
    </button>
  );
}
