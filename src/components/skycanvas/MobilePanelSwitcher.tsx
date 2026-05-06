/**
 * MobilePanelSwitcher — 3-chip glass bar shown only below md breakpoint.
 *
 * Pure presentational tab strip: it owns no state and has no knowledge of
 * dockStore. The parent (SkyCanvas) keeps a single `MobilePanelKey` in
 * React state and uses it to drive the EditorShell `layout` slots
 * (left / right / timeline widths collapse to 0 when not active).
 *
 * Accessibility (a11y):
 *   - role="tablist" + role="tab" with aria-selected
 *   - aria-controls pointing at the matching panel id (set by parent)
 *   - Roving tabindex (only the active tab is in the tab order)
 *   - ArrowLeft / ArrowRight / Home / End keyboard navigation, with
 *     activation on focus (selects + moves focus, parent then focuses panel)
 */
import { useRef } from 'react';
import { Library, SlidersHorizontal, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobilePanelKey = 'library' | 'inspector' | 'timeline';

interface Props {
  active: MobilePanelKey;
  onChange: (key: MobilePanelKey) => void;
  /** Optional extra bottom offset in px to clear the transport FAB. */
  bottomOffset?: number;
  /** Map of panel key → DOM id of the panel region (for aria-controls). */
  panelIds?: Partial<Record<MobilePanelKey, string>>;
}

const ITEMS: ReadonlyArray<{ key: MobilePanelKey; label: string; Icon: typeof Library }> = [
  { key: 'library',   label: 'Biblioteca', Icon: Library },
  { key: 'inspector', label: 'Inspector',  Icon: SlidersHorizontal },
  { key: 'timeline',  label: 'Timeline',   Icon: Clock },
];

export default function MobilePanelSwitcher({
  active,
  onChange,
  bottomOffset = 80,
  panelIds,
}: Props) {
  const btnRefs = useRef<Record<MobilePanelKey, HTMLButtonElement | null>>({
    library: null, inspector: null, timeline: null,
  });

  const activate = (key: MobilePanelKey) => {
    if (key !== active) onChange(key);
    btnRefs.current[key]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = ITEMS.findIndex((i) => i.key === active);
    if (idx < 0) return;
    let nextIdx: number | null = null;
    switch (e.key) {
      case 'ArrowRight': nextIdx = (idx + 1) % ITEMS.length; break;
      case 'ArrowLeft':  nextIdx = (idx - 1 + ITEMS.length) % ITEMS.length; break;
      case 'Home':       nextIdx = 0; break;
      case 'End':        nextIdx = ITEMS.length - 1; break;
      default: return;
    }
    e.preventDefault();
    activate(ITEMS[nextIdx].key);
  };

  return (
    <div
      className="md:hidden absolute left-1/2 -translate-x-1/2 z-50"
      style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))` }}
      role="tablist"
      aria-label="Painéis móveis"
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
    >
      <div className="glass-pane glass-pill h-11 px-1.5 flex items-center gap-1">
        {ITEMS.map(({ key, label, Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              ref={(el) => { btnRefs.current[key] = el; }}
              id={`mobile-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              aria-controls={panelIds?.[key]}
              tabIndex={isActive ? 0 : -1}
              onClick={() => activate(key)}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 rounded-full ds-mono text-[10px] uppercase tracking-wider transition-colors duration-200 ds-focus',
                isActive
                  ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40'
                  : 'text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05]',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
