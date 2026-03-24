/**
 * MobileTabBar — Unified dock bar for mobile editor.
 * Features: quick-access tabs, long-press context menu, swipe to cycle categories.
 */
import { useCallback, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { Sparkles, Cpu, Smartphone, Map, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { PANEL_SECTIONS, type PanelId } from '@/components/editor/PanelTabBar';
import DockContextMenu from './DockContextMenu';

export type MobileTab = 'timeline' | 'assets' | 'properties' | 'livefx' | 'points' | 'formations' | 'mobilelink' | 'controllers' | 'fieldmap' | 'radio' | 'remote' | 'more';

interface MobileTabBarProps {
  activeTab: MobileTab | null;
  onTabChange: (tab: MobileTab | null) => void;
  onOpenPanel: (id: PanelId) => void;
  panelHeight: 'collapsed' | 'half' | 'full';
  onPanelHeightChange: (h: 'collapsed' | 'half' | 'full') => void;
}

const TABS: { key: MobileTab; icon: typeof Sparkles; label: string; panelId?: PanelId; accent?: boolean }[] = [
  { key: 'livefx', icon: Sparkles, label: 'Live FX', panelId: 'livefiring', accent: true },
  { key: 'controllers', icon: Cpu, label: 'Control', panelId: 'controllers' },
  { key: 'remote', icon: Smartphone, label: 'Remote', panelId: 'remotecontrol' },
  { key: 'fieldmap', icon: Map, label: 'Map', panelId: 'fieldmap' },
  { key: 'more', icon: LayoutGrid, label: 'Painéis' },
];

// Swipe category cycling
const CATEGORY_NAMES = PANEL_SECTIONS.map(s => s.title);

export default function MobileTabBar({
  activeTab,
  onTabChange,
  onOpenPanel,
  panelHeight,
  onPanelHeightChange,
}: MobileTabBarProps) {
  const activeEffectsCount = useLiveSfxStore(s => s.activeEffects.length);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [swipeLabel, setSwipeLabel] = useState<string | null>(null);
  const swipeLabelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Long-press context menu state
  const [contextMenu, setContextMenu] = useState<{ tab: MobileTab; rect: DOMRect } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Swipe tracking
  const swipeRef = useRef<{ startX: number; startY: number; started: boolean }>({ startX: 0, startY: 0, started: false });

  const handleTabClick = useCallback((tab: MobileTab) => {
    // Don't fire click if long-press just fired
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    haptics.tap();
    const tabDef = TABS.find(t => t.key === tab);

    if (tabDef?.panelId) {
      if (activeTab === tab) {
        if (panelHeight === 'full') {
          onTabChange(null);
          onPanelHeightChange('collapsed');
        } else {
          onPanelHeightChange('full');
        }
      } else {
        onOpenPanel(tabDef.panelId);
        onTabChange(tab);
        onPanelHeightChange('full');
      }
      return;
    }

    // "More" / "Painéis"
    if (activeTab === tab) {
      if (panelHeight === 'full') {
        onTabChange(null);
        onPanelHeightChange('collapsed');
      } else {
        onPanelHeightChange('full');
      }
    } else {
      onTabChange(tab);
      onPanelHeightChange('full');
    }
  }, [activeTab, panelHeight, onTabChange, onPanelHeightChange, onOpenPanel]);

  // --- Long press handlers ---
  const handleLongPressStart = useCallback((tab: MobileTab, e: React.TouchEvent | React.MouseEvent) => {
    if (tab === 'more') return; // No context menu for "more"
    longPressFired.current = false;
    const target = e.currentTarget as HTMLElement;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      haptics.success();
      setContextMenu({ tab, rect: target.getBoundingClientRect() });
    }, 400);
  }, []);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // --- Swipe handlers ---
  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeRef.current = { startX: touch.clientX, startY: touch.clientY, started: true };
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeRef.current.started) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - swipeRef.current.startX;
    const dy = touch.clientY - swipeRef.current.startY;
    swipeRef.current.started = false;

    // Only trigger if horizontal > vertical and > 50px
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setCategoryIndex(prev => {
        const next = dx < 0
          ? Math.min(prev + 1, CATEGORY_NAMES.length - 1)
          : Math.max(prev - 1, 0);

        // Show toast label
        setSwipeLabel(CATEGORY_NAMES[next]);
        if (swipeLabelTimeout.current) clearTimeout(swipeLabelTimeout.current);
        swipeLabelTimeout.current = setTimeout(() => setSwipeLabel(null), 1200);

        haptics.tap();

        // Open the first panel in this category
        const section = PANEL_SECTIONS[next];
        if (section?.items[0]) {
          onOpenPanel(section.items[0].id);
          onTabChange('more');
          onPanelHeightChange('full');
        }

        return next;
      });
    }
  }, [onOpenPanel, onTabChange, onPanelHeightChange]);

  const handleContextSelect = useCallback((id: PanelId) => {
    onOpenPanel(id);
    onTabChange('more');
    onPanelHeightChange('full');
  }, [onOpenPanel, onTabChange, onPanelHeightChange]);

  const getScale = (index: number) => {
    if (hoveredIndex === null) return 1;
    const dist = Math.abs(index - hoveredIndex);
    if (dist === 0) return 1.2;
    if (dist === 1) return 1.08;
    return 1;
  };

  const getTranslateY = (index: number) => {
    if (hoveredIndex === null) return 0;
    const dist = Math.abs(index - hoveredIndex);
    if (dist === 0) return -5;
    if (dist === 1) return -2;
    return 0;
  };

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Swipe category indicator */}
        {swipeLabel && (
          <div className="pointer-events-none flex justify-center mb-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            <div
              className="px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.15em]"
              style={{
                background: 'hsl(var(--card) / 0.9)',
                backdropFilter: 'blur(24px)',
                color: 'hsl(var(--primary))',
                border: '1px solid hsl(var(--primary) / 0.15)',
                boxShadow: '0 4px 16px hsl(var(--primary) / 0.1)',
              }}
            >
              {swipeLabel}
            </div>
          </div>
        )}

        <nav
          className="pointer-events-auto glass-dock mx-3 mb-2 rounded-2xl px-2 py-1 flex items-end justify-around"
          onMouseLeave={() => setHoveredIndex(null)}
          onTouchStart={handleSwipeStart}
          onTouchEnd={handleSwipeEnd}
        >
          {TABS.map(({ key, icon: Icon, label, accent }, index) => {
            const isActive = activeTab === key;
            const scale = getScale(index);
            const translateY = getTranslateY(index);

            return (
              <button
                key={key}
                onClick={() => handleTabClick(key)}
                onMouseEnter={() => setHoveredIndex(index)}
                onTouchStart={(e) => {
                  setHoveredIndex(index);
                  handleLongPressStart(key, e);
                }}
                onTouchEnd={() => {
                  handleLongPressEnd();
                  setTimeout(() => setHoveredIndex(null), 300);
                }}
                onTouchCancel={() => {
                  handleLongPressEnd();
                  setHoveredIndex(null);
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center py-2 px-3 rounded-xl min-h-[52px] min-w-[48px]",
                  "active:scale-90"
                )}
                style={{
                  transform: `scale(${scale}) translateY(${translateY}px)`,
                  transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                <div className="relative">
                  <Icon className={cn(
                    "w-6 h-6 transition-colors duration-200",
                    isActive
                      ? accent ? "text-accent" : "text-primary"
                      : "text-muted-foreground/60"
                  )}
                    style={isActive ? { filter: `drop-shadow(0 0 6px ${accent ? 'hsl(var(--accent))' : 'hsl(var(--primary))'})` } : undefined}
                  />
                  {key === 'livefx' && activeEffectsCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center px-0.5"
                      style={{ boxShadow: '0 0 6px hsl(var(--destructive) / 0.5)' }}>
                      {activeEffectsCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[9px] font-semibold mt-0.5 transition-colors duration-200",
                  isActive
                    ? accent ? "text-accent" : "text-primary"
                    : "text-muted-foreground/40"
                )}>
                  {label}
                </span>

                {isActive && (
                  <div className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                    style={{
                      background: accent ? 'hsl(var(--accent))' : 'hsl(var(--primary))',
                      boxShadow: `0 0 4px ${accent ? 'hsl(var(--accent))' : 'hsl(var(--primary))'}`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Category dots indicator */}
        <div className="pointer-events-none flex justify-center gap-1 pb-1">
          {CATEGORY_NAMES.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === categoryIndex ? 12 : 4,
                height: 4,
                background: i === categoryIndex ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.2)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Long-press context menu */}
      {contextMenu && (
        <DockContextMenu
          tab={contextMenu.tab}
          anchorRect={contextMenu.rect}
          onSelect={handleContextSelect}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
