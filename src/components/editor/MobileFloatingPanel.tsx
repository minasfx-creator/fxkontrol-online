/**
 * Mobile Floating Panel
 * Renders panel content as a floating overlay on mobile, with configurable height.
 */
import { cn } from '@/lib/utils';
import type { MobileTab } from './MobileTabBar';

interface MobileFloatingPanelProps {
  activeTab: MobileTab | null;
  height: 'collapsed' | 'half' | 'full';
  children: React.ReactNode;
}

const HEIGHT_CLASSES: Record<string, string> = {
  collapsed: 'h-0 opacity-0 pointer-events-none',
  half: 'h-[40vh]',
  full: 'h-[calc(100dvh-56px-env(safe-area-inset-bottom))]',
};

export default function MobileFloatingPanel({ activeTab, height, children }: MobileFloatingPanelProps) {
  if (!activeTab || height === 'collapsed') return null;

  return (
    <div
      className={cn(
        "fixed left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border/50 transition-all duration-300 ease-out overflow-hidden",
        HEIGHT_CLASSES[height]
      )}
      style={{
        // Position above the tab bar (≈56px tab bar + safe area)
        bottom: 'calc(56px + env(safe-area-inset-bottom))',
      }}
    >
      <div className="h-full overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
