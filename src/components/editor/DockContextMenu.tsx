/**
 * DockContextMenu — 3D Touch / long-press popup for dock items.
 * Shows related sub-panels from the matching PANEL_SECTIONS category.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { PANEL_SECTIONS, type PanelId } from './PanelTabBar';
import type { MobileTab } from './MobileTabBar';

// Map dock tabs to their parent PANEL_SECTIONS category
const TAB_TO_SECTION: Record<string, string> = {
  livefx: 'Conexões',
  controllers: 'Hardware',
  remote: 'Conexões',
  fieldmap: 'Hardware',
};

interface DockContextMenuProps {
  tab: MobileTab;
  anchorRect: DOMRect | null;
  onSelect: (id: PanelId) => void;
  onDismiss: () => void;
}

export default function DockContextMenu({ tab, anchorRect, onSelect, onDismiss }: DockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const sectionTitle = TAB_TO_SECTION[tab];
  const section = PANEL_SECTIONS.find(s => s.title === sectionTitle);

  useEffect(() => {
    const handler = (e: PointerEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [onDismiss]);

  if (!section || !anchorRect) return null;

  // Position above the anchor, centered
  const menuWidth = 200;
  const left = Math.max(8, Math.min(anchorRect.left + anchorRect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 8));
  const bottom = window.innerHeight - anchorRect.top + 8;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}>
      <div
        ref={menuRef}
        className="fixed rounded-2xl overflow-hidden border border-border/10 shadow-2xl animate-in zoom-in-95 fade-in-0 duration-200"
        style={{
          left,
          bottom,
          width: menuWidth,
          background: 'hsl(var(--card) / 0.95)',
          backdropFilter: 'blur(32px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.6)',
        }}
      >
        {/* Section header */}
        <div className="px-3 pt-2.5 pb-1.5 border-b border-border/5">
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
            {section.title}
          </span>
        </div>

        {/* Items */}
        <div className="py-1 max-h-[280px] overflow-y-auto">
          {section.items.map(({ id, label, icon: Icon }, idx) => (
            <button
              key={id}
              onClick={() => {
                haptics.tap();
                onSelect(id);
                onDismiss();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all active:scale-[0.97] active:bg-primary/10",
                "hover:bg-muted/30",
                idx < section.items.length - 1 && "border-b border-border/[0.03]",
              )}
            >
              <div className="w-7 h-7 rounded-lg bg-muted/20 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-muted-foreground/70" />
              </div>
              <span className="text-[12px] font-medium text-foreground/90 truncate">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for long-press detection
export function useLongPress(
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void,
  delay = 400,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didFireRef = useRef(false);

  const start = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    didFireRef.current = false;
    timerRef.current = setTimeout(() => {
      didFireRef.current = true;
      haptics.success();
      onLongPress(e);
    }, delay);
  }, [onLongPress, delay]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { start, cancel, didFire: didFireRef };
}
