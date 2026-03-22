/**
 * MobileTabBar — Apple-style tab bar with SF icon language
 * Frosted glass, clean labels, smooth transitions.
 */
import { useCallback, useRef } from 'react';
import { haptics } from '@/lib/haptics';
import { Clock, Sparkles, MapPin, Hexagon, MoreHorizontal, Cable, Cpu, Map, Radio, Smartphone, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

export type MobileTab = 'timeline' | 'assets' | 'properties' | 'livefx' | 'points' | 'formations' | 'mobilelink' | 'controllers' | 'fieldmap' | 'radio' | 'remote' | 'more';

interface MobileTabBarProps {
  activeTab: MobileTab | null;
  onTabChange: (tab: MobileTab | null) => void;
  onOpenPanel: (id: PanelId) => void;
  panelHeight: 'collapsed' | 'half' | 'full';
  onPanelHeightChange: (h: 'collapsed' | 'half' | 'full') => void;
}

const TABS: { key: MobileTab; icon: typeof Clock; label: string; panelId?: PanelId; accent?: boolean }[] = [
  { key: 'livefx', icon: Sparkles, label: 'Live FX', panelId: 'livefiring', accent: true },
  { key: 'controllers', icon: Cpu, label: 'Control', panelId: 'controllers' },
  { key: 'remote', icon: Smartphone, label: 'Remote', panelId: 'remotecontrol' },
  { key: 'fieldmap', icon: Map, label: 'Map', panelId: 'fieldmap' },
  { key: 'more', icon: MoreHorizontal, label: 'More' },
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

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav className="pointer-events-auto glass-dock mx-4 mb-2 rounded-2xl px-1 py-1 flex items-center justify-around">
        {TABS.map(({ key, icon: Icon, label, accent }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              onTouchStart={() => handleLongPressStart(key)}
              onTouchEnd={handleLongPressEnd}
              onTouchCancel={handleLongPressEnd}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200",
                "active:scale-90"
              )}
            >
              <Icon className={cn(
                "w-5 h-5 transition-colors duration-200",
                isActive
                  ? accent ? "text-accent" : "text-primary"
                  : "text-[hsl(var(--muted-foreground)/0.6)]"
              )} />
              <span className={cn(
                "text-[9px] font-semibold mt-0.5 transition-colors duration-200",
                isActive
                  ? accent ? "text-accent" : "text-primary"
                  : "text-[hsl(var(--muted-foreground)/0.4)]"
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
