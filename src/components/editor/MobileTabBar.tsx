/**
 * MobileTabBar — Glass floating dock (Free Fire style)
 * Pill-shaped, icon-only, with neon active indicators.
 */
import { useCallback, useRef } from 'react';
import { Clock, Sparkles, MapPin, Hexagon, MoreHorizontal, Cable } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

export type MobileTab = 'timeline' | 'assets' | 'properties' | 'livefx' | 'points' | 'formations' | 'mobilelink' | 'more';

interface MobileTabBarProps {
  activeTab: MobileTab | null;
  onTabChange: (tab: MobileTab | null) => void;
  onOpenPanel: (id: PanelId) => void;
  panelHeight: 'collapsed' | 'half' | 'full';
  onPanelHeightChange: (h: 'collapsed' | 'half' | 'full') => void;
}

const TABS: { key: MobileTab; icon: typeof Clock; panelId?: PanelId; accent?: boolean }[] = [
  { key: 'livefx', icon: Sparkles, panelId: 'livefiring', accent: true },
  { key: 'mobilelink', icon: Cable, panelId: 'mobilelink' },
  { key: 'points', icon: MapPin, panelId: 'properties' },
  { key: 'formations', icon: Hexagon, panelId: 'swarmgpt' },
  { key: 'timeline', icon: Clock },
  { key: 'more', icon: MoreHorizontal },
];

export default function MobileTabBar({
  activeTab,
  onTabChange,
  onOpenPanel,
  panelHeight,
  onPanelHeightChange,
}: MobileTabBarProps) {
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTabClick = useCallback((tab: MobileTab) => {
    const tabDef = TABS.find(t => t.key === tab);

    if (tabDef?.panelId) {
      onOpenPanel(tabDef.panelId);
      onTabChange(tab);
      onPanelHeightChange('full');
      return;
    }

    if (activeTab === tab) {
      if (panelHeight === 'half') {
        onPanelHeightChange('full');
      } else if (panelHeight === 'full') {
        onTabChange(null);
        onPanelHeightChange('collapsed');
      } else {
        onPanelHeightChange('half');
      }
    } else {
      onTabChange(tab);
      onPanelHeightChange(tab === 'more' ? 'full' : 'half');
    }
  }, [activeTab, panelHeight, onTabChange, onPanelHeightChange, onOpenPanel]);

  const handleLongPressStart = useCallback((tab: MobileTab) => {
    if (tab === 'livefx') {
      longPressRef.current = setTimeout(() => {
        // Long-press Live FX → fullscreen commander
        onOpenPanel('livefiring');
        onTabChange('livefx');
        onPanelHeightChange('full');
        if (navigator.vibrate) navigator.vibrate(50);
      }, 500);
    }
  }, [onOpenPanel, onTabChange, onPanelHeightChange]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none flex justify-center"
      style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}
    >
      <nav className="pointer-events-auto glass-dock rounded-2xl px-2 py-1.5 flex items-center gap-1">
        {TABS.map(({ key, icon: Icon, accent }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              onTouchStart={() => handleLongPressStart(key)}
              onTouchEnd={handleLongPressEnd}
              onTouchCancel={handleLongPressEnd}
              className={cn(
                "touch-target flex flex-col items-center justify-center w-12 h-10 rounded-xl transition-all active:scale-90",
                isActive
                  ? accent
                    ? "text-accent glow-active"
                    : "text-primary glow-active"
                  : accent
                    ? "text-accent/60"
                    : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <div className={cn(
                  "w-1 h-1 rounded-full mt-0.5",
                  accent ? "bg-accent shadow-[0_0_6px_hsl(var(--accent))]" : "bg-primary shadow-[0_0_6px_hsl(var(--primary))]"
                )} />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
