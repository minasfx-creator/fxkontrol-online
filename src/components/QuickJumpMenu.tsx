/**
 * QuickJumpMenu — Tiny global top-left navigation pill.
 *
 * Always-visible (including inside /studio fullscreen editor) so the operator
 * can jump in one click between the three main creative surfaces:
 *   • Studio          → 3D editor
 *   • FXK-DRONES      → Drone command panel (lives inside Studio, scrolls to it)
 *   • AI Choreography → Grok Vision generator
 *
 * Sits at top-left, glassmorphic, ~28px tall — designed not to fight the
 * Tactical Dock (which is vertical, also top-left but lower).
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wand2, Plane, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { label: 'Studio', path: '/studio', icon: Wand2, desc: 'Editor 3D' },
  { label: 'FXK-DRONES', path: '/studio?panel=drones', icon: Plane, desc: 'Console de drones' },
  { label: 'AI Choreography', path: '/ai-choreography', icon: Sparkles, desc: 'Grok Vision' },
] as const;

export default function QuickJumpMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = ITEMS.find(i => location.pathname.startsWith(i.path.split('?')[0])) ?? ITEMS[0];
  const CurrentIcon = current.icon;

  return (
    <div
      ref={ref}
      className="fixed z-[60] pointer-events-auto"
      style={{
        top: 'calc(0.5rem + env(safe-area-inset-top))',
        right: 'calc(0.5rem + env(safe-area-inset-right))',
        fontFamily: 'inherit',
      }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 h-7 px-2 rounded-control text-[11px] font-medium tracking-wide transition-all active:scale-95',
          'backdrop-blur-xl border'
        )}
        style={{
          background: 'hsl(var(--background) / 0.6)',
          borderColor: 'hsl(32 100% 50% / 0.2)',
          color: 'hsl(32 100% 50%)',
          boxShadow: '0 4px 12px hsl(0 0% 0% / 0.3)',
        }}
        title="Navegação rápida"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CurrentIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 mt-1 min-w-[180px] rounded-panel overflow-hidden backdrop-blur-xl border animate-in fade-in slide-in-from-top-1 duration-150"
          style={{
            background: 'hsl(var(--background) / 0.85)',
            borderColor: 'hsl(32 100% 50% / 0.2)',
            boxShadow: '0 8px 24px hsl(0 0% 0% / 0.5)',
          }}
        >
          {ITEMS.map(({ label, path, icon: Icon, desc }) => {
            // Drone panel deep-link clears ?panel= immediately, so we only
            // highlight stable routes: Studio (any /studio*) and AI Choreography.
            const cleanPath = path.split('?')[0];
            const active = path.includes('?')
              ? false
              : location.pathname === cleanPath
                || (cleanPath === '/studio' && location.pathname.startsWith('/studio'));
            return (
              <button
                key={path}
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  navigate(path);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  'hover:bg-white/[0.06]'
                )}
                style={active ? { background: 'hsl(32 100% 50% / 0.1)', color: 'hsl(32 100% 50%)' } : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[11px] font-medium">{label}</span>
                  <span className="text-[9px] text-muted-foreground/70">{desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
