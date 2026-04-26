/**
 * QuickJumpMenu — Tiny global navigation pill (top-right).
 *
 * Visible only on immersive routes (/studio, /command) where the AppSidebar
 * is hidden. Provides one-click access between the three creative surfaces:
 *   • Studio          → 3D editor
 *   • FXK-DRONES      → Drone command panel (deep-link via ?panel=drones)
 *   • AI Choreography → Grok Vision generator
 *
 * Active-state detection is URL-driven and matches both pathname and the
 * `?panel=` search param so the highlight stays correct after navigation
 * (including deep-links and browser back/forward).
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wand2, Plane, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = {
  label: string;
  path: string;          // route to navigate to (with optional ?query)
  icon: typeof Wand2;
  desc: string;
  match: (pathname: string, params: URLSearchParams) => boolean;
};

const ITEMS: readonly Item[] = [
  {
    label: 'Studio',
    path: '/studio',
    icon: Wand2,
    desc: 'Editor 3D',
    // Active on /studio when no special panel param is targeting another item.
    match: (p, q) => p === '/studio' && q.get('panel') !== 'drones',
  },
  {
    label: 'FXK-DRONES',
    path: '/studio?panel=drones',
    icon: Plane,
    desc: 'Console de drones',
    // Active when explicitly targeting the drones panel via deep-link.
    // Note: Index.tsx clears ?panel= shortly after handling it, so this
    // primarily highlights during the navigation tick — that's intentional
    // and matches what URL-driven nav can observe.
    match: (p, q) => p === '/studio' && q.get('panel') === 'drones',
  },
  {
    label: 'AI Choreography',
    path: '/ai-choreography',
    icon: Sparkles,
    desc: 'Grok Vision',
    match: (p) => p === '/ai-choreography' || p.startsWith('/ai-choreography/'),
  },
] as const;

export default function QuickJumpMenu() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Recompute search params whenever location.search changes.
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  // Resolve the current active item from URL state. Falls back to Studio
  // (the default landing) when nothing matches, so the pill always shows
  // something sensible.
  const current = useMemo(
    () => ITEMS.find((i) => i.match(location.pathname, searchParams)) ?? ITEMS[0],
    [location.pathname, searchParams],
  );
  const CurrentIcon = current.icon;

  // Click-away to close the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Close on route/search change (e.g. after user picks an item).
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

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
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 h-7 px-2 rounded-control text-[11px] font-medium tracking-wide transition-all active:scale-95',
          'backdrop-blur-xl border',
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
          {ITEMS.map((item) => {
            const { label, path, icon: Icon, desc } = item;
            const active = item.match(location.pathname, searchParams);
            return (
              <button
                key={path}
                role="menuitem"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setOpen(false);
                  navigate(path);
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                  'hover:bg-white/[0.06]',
                )}
                style={
                  active
                    ? { background: 'hsl(32 100% 50% / 0.12)', color: 'hsl(32 100% 50%)' }
                    : undefined
                }
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
