/**
 * MobilePanelSwitcher — 3-chip glass bar shown only below md breakpoint.
 * Lets the operator switch which floating sheet is open without juggling
 * collapse states. Pure presentation; only mutates dock via the parent
 * `onChange` callback.
 */
import { Library, SlidersHorizontal, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobilePanelKey = 'library' | 'inspector' | 'timeline';

interface Props {
  active: MobilePanelKey;
  onChange: (key: MobilePanelKey) => void;
  /** Optional extra bottom offset in px to clear the transport FAB. */
  bottomOffset?: number;
}

const ITEMS: ReadonlyArray<{ key: MobilePanelKey; label: string; Icon: typeof Library }> = [
  { key: 'library',   label: 'Biblioteca', Icon: Library },
  { key: 'inspector', label: 'Inspector',  Icon: SlidersHorizontal },
  { key: 'timeline',  label: 'Timeline',   Icon: Clock },
];

export default function MobilePanelSwitcher({ active, onChange, bottomOffset = 80 }: Props) {
  return (
    <div
      className="md:hidden absolute left-1/2 -translate-x-1/2 z-50"
      style={{ bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))` }}
      role="tablist"
      aria-label="Painéis móveis"
    >
      <div className="glass-pane glass-pill h-11 px-1.5 flex items-center gap-1">
        {ITEMS.map(({ key, label, Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => onChange(key)}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 rounded-full ds-mono text-[10px] uppercase tracking-wider transition-colors duration-200 ds-focus',
                isActive
                  ? 'bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/40'
                  : 'text-zinc-400 hover:text-cyan-200 hover:bg-white/[0.05]',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
