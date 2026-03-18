/**
 * Mobile Floating Tab Bar
 * Bottom tab bar with quick access to Live FX, Points, Formations, Timeline, and More.
 */
import { useCallback } from 'react';
import { Clock, Sparkles, MapPin, Layers, X, ChevronDown, ChevronUp, MoreHorizontal, Hexagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from '@/components/editor/PanelTabBar';

export type MobileTab = 'timeline' | 'assets' | 'properties' | 'livefx' | 'points' | 'formations' | 'more';

interface MobileTabBarProps {
  activeTab: MobileTab | null;
  onTabChange: (tab: MobileTab | null) => void;
  onOpenPanel: (id: PanelId) => void;
  panelHeight: 'collapsed' | 'half' | 'full';
  onPanelHeightChange: (h: 'collapsed' | 'half' | 'full') => void;
}

const TABS: { key: MobileTab; label: string; icon: typeof Clock; panelId?: PanelId; accent?: boolean }[] = [
  { key: 'livefx', label: 'Live FX', icon: Sparkles, panelId: 'livefiring', accent: true },
  { key: 'points', label: 'Points', icon: MapPin, panelId: 'properties' },
  { key: 'formations', label: 'Formações', icon: Hexagon, panelId: 'swarmgpt' },
  { key: 'timeline', label: 'Timeline', icon: Clock },
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
    const tabDef = TABS.find(t => t.key === tab);
    
    // If tab maps directly to a panel, open it
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
              {panelHeight === 'full' ? 'Minimizar' : 'Expandir'}
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
        {TABS.map(({ key, label, icon: Icon, accent }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => handleTabClick(key)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-2 rounded-lg transition-all min-w-[52px]",
                isActive
                  ? accent ? "text-destructive" : "text-primary"
                  : accent ? "text-orange-400" : "text-muted-foreground"
              )}
            >
              <Icon className={cn(
                "w-5 h-5",
                isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]",
                accent && !isActive && "drop-shadow-[0_0_4px_rgba(251,146,60,0.4)]"
              )} />
              <span className={cn(
                "text-[8px] font-bold uppercase tracking-wider",
                isActive && (accent ? "text-destructive" : "text-primary")
              )}>{label}</span>
              {isActive && (
                <div className={cn("w-1 h-1 rounded-full mt-0.5", accent ? "bg-destructive" : "bg-primary")} />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
