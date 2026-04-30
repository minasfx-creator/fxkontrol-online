/**
 * MasterMenuFloat — Top-center floating "Master Menu" pill for the Studio.
 *
 * Mockup contract (UI/UX brief):
 *   "Acrescentar UI de menu master com acesso a todas as áreas e
 *    funções da plataforma — aproveitar componentes existentes."
 *
 * Implementation note: the underlying overlay is the existing
 * FullscreenCommandMenu (which already lists every PanelId from
 * PANEL_SECTIONS — same source of truth as PanelTabBar). This component
 * is the prominent, always-visible *trigger* the mockup asks for.
 *
 * Visual: Vantablack glass per Mission Control palette memory.
 * Keyboard: Cmd/Ctrl+M opens (Cmd/Ctrl+K already opens via Toolbar).
 */

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Command, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PanelId } from './PanelTabBar';

const FullscreenCommandMenu = lazy(() => import('./FullscreenCommandMenu'));

interface Props {
  onOpenPanel: (id: PanelId) => void;
  /** Tailwind className overrides for the pill (positioning, etc.). */
  className?: string;
}

export default function MasterMenuFloat({ onOpenPanel, className }: Props) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ctrl = e.metaKey || e.ctrlKey;
      if (ctrl && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title="Master Menu (⌘M)"
        className={cn(
          'pointer-events-auto fixed z-[70] top-2 left-1/2 -translate-x-1/2',
          'flex items-center gap-2 h-8 px-3 rounded-full',
          'bg-[#050810]/80 backdrop-blur-xl border border-cyan-500/30',
          'text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/90',
          'shadow-[0_8px_28px_-12px_rgba(0,255,255,0.35)]',
          'hover:border-cyan-400/60 hover:text-cyan-100 hover:bg-[#0a1422]/85',
          'transition-all',
          className,
        )}
      >
        <Command className="h-3 w-3" />
        <span>Master Menu</span>
        <span className="text-cyan-400/40 text-[9px] font-mono normal-case tracking-normal">⌘M</span>
        <ChevronDown className="h-3 w-3 text-cyan-300/50" />
      </button>

      {open && (
        <Suspense fallback={null}>
          <FullscreenCommandMenu
            open={open}
            onClose={() => setOpen(false)}
            onOpenPanel={(id) => {
              onOpenPanel(id);
              setOpen(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
