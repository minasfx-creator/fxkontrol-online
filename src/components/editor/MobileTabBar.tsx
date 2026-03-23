/**
 * MobileTabBar — Unified dock bar for mobile editor.
 * Shows essential quick-access tabs + "All Panels" button.
 * Uses the same PANEL_SECTIONS source as desktop PanelTabBar.
 */
import { useCallback, useRef, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { Sparkles, Cpu, Smartphone, Map, LayoutGrid, Route, MapPin, Cable } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import type { PanelId } from '@/components/editor/PanelTabBar';

export type MobileTab = 'timeline' | 'assets' | 'properties' | 'livefx' | 'points' | 'formations' | 'mobilelink' | 'controllers' | 'fieldmap' | 'radio' | 'remote' | 'more';

interface MobileTabBarProps {
  activeTab: MobileTab | null;
  onTabChange: (tab: MobileTab | null) => void;
  onOpenPanel: (id: PanelId) => void;
  panelHeight: 'collapsed' | 'half' | 'full';
  onPanelHeightChange: (h: 'collapsed' | 'half' | 'full') => void;
}

const TABS: { key: MobileTab; icon: typeof Route; label: string; panelId?: PanelId; accent?: boolean }[] = [
  { key: 'livefx', icon: Sparkles, label: 'Live FX', panelId: 'livefiring', accent: true },
  { key: 'controllers', icon: Cpu, label: 'Control', panelId: 'controllers' },
  { key: 'remote', icon: Smartphone, label: 'Remote', panelId: 'remotecontrol' },
  { key: 'fieldmap', icon: Map, label: 'Map', panelId: 'fieldmap' },
  { key: 'more', icon: LayoutGrid, label: 'Painéis' },
];

export default function MobileTabBar({
  activeTab,
  onTabChange,
  onOpenPanel,
  panelHeight,
  onPanelHeightChange,
}: MobileTabBarProps) {
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeEffectsCount = useLiveSfxStore(s => s.activeEffects.length);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const handleTabClick = useCallback((tab: MobileTab) => {
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

    // "More" / "Painéis" button
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

  const handleLongPressStart = useCallback((tab: MobileTab) => {
    if (tab === 'livefx') {
      longPressRef.current = setTimeout(() => {
        onOpenPanel('livefiring');
        onTabChange('livefx');
        onPanelHeightChange('full');
        haptics.success();
      }, 500);
    }
  }, [onOpenPanel, onTabChange, onPanelHeightChange]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

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
    <div
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav
        className="pointer-events-auto glass-dock mx-3 mb-2 rounded-2xl px-2 py-1 flex items-end justify-around"
        onMouseLeave={() => setHoveredIndex(null)}
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
              onTouchStart={() => {
                setHoveredIndex(index);
                handleLongPressStart(key);
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
    </div>
  );
}
