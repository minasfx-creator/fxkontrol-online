/**
 * Mobile Floating Tab Bar
 * Bottom tab bar for mobile devices that opens floating panels over the 3D viewport.
 * Priority panels: Timeline, Assets (EffectLibrary), Properties
 */
import { useState, useCallback } from 'react';
import { Clock, Layers, Settings2, X, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

export type MobileTab = 'timeline' | 'assets' | 'properties' | 'more';

interface MobileTabBarProps {
  activeTab: MobileTab | null;
  onTabChange: (tab: MobileTab | null) => void;
  onOpenPanel: (id: PanelId) => void;
  /** Height state for the floating panel: 'collapsed' | 'half' | 'full' */
  panelHeight: 'collapsed' | 'half' | 'full';
  onPanelHeightChange: (h: 'collapsed' | 'half' | 'full') => void;
}

const TABS: { key: MobileTab; label: string; icon: typeof Clock }[] = [
  { key: 'timeline', label: 'Timeline', icon: Clock },
  { key: 'assets', label: 'Assets', icon: Layers },
  { key: 'properties', label: 'Props', icon: Settings2 },
  { key: 'more', label: 'More', icon: MoreHorizontal },
];

export default function MobileTabBar({
  activeTab,
  onTabChange,
  onOpenPanel,
  panelHeight,
  onPanelHeightChange,
}: MobileTabBarProps) {
  const handleTabClick = useCallback((tab: MobileTab) => {
    if (activeTab === tab) {
      // Toggle: if already active, cycle height or close
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
      onPanelHeightChange(tab === 'assets' ? 'full' : 'half');
    }
  }, [activeTab, panelHeight, onTabChange, onPanelHeightChange]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Drag handle for resizing */}
      {activeTab && panelHeight !== 'collapsed' && (
        <div className="flex justify-center py-1 bg-card/95 backdrop-blur-xl border-t border-border/50 rounded-t-xl">
          <button
            onClick={() => {
              if (panelHeight === 'half') onPanelHeightChange('full');
              else onPanelHeightChange('half');
            }}
            className="flex items-center gap-1 px-3 py-0.5 rounded-full bg-muted/50 text-muted-foreground"
          >
            {panelHeight === 'full' ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
            <span className="text-[9px] uppercase tracking-wider font-bold">
              {panelHeight === 'full' ? 'Minimize' : 'Expand'}
            </span>
          </button>
          <button
            onClick={() => { onTabChange(null); onPanelHeightChange('collapsed'); }}
            className="absolute right-3 top-1.5 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab bar */}
      <nav className="flex items-center justify-around bg-card/95 backdrop-blur-xl border-t border-border/50 px-1 pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-all min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")} />
              <span className={cn("text-[9px] font-bold uppercase tracking-wider", isActive && "text-primary")}>{label}</span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
