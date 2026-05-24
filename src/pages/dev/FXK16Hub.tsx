/**
 * /dev/fxk16 — Unified FXK16 dev hub (Validate + Calibrate fusion).
 *
 * Replaces /dev/fxk16-validate and /dev/fxk16-calibrate with a single
 * route that hosts both as tabs. Uses ?tab= query param so deep links
 * survive (e.g. /dev/fxk16?tab=calibrate). Each tab is lazy-loaded so
 * the existing code-splitting is preserved.
 *
 * Hardware path, hold-to-confirm and FXK16 bridge singleton are NOT
 * touched — only the route shell is consolidated.
 */
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const FXK16ValidatePage    = lazy(() => import('@/components/dev/fxk16/ValidatePanel'));
const FXK16CalibrationPage = lazy(() => import('@/components/dev/fxk16/CalibrationPanel'));

type Tab = 'validate' | 'calibrate';

const TABS: { key: Tab; label: string; sub: string; icon: typeof Activity }[] = [
  { key: 'validate',  label: 'VALIDATE',  sub: 'HARNESS',   icon: Activity },
  { key: 'calibrate', label: 'CALIBRATE', sub: 'LATENCY',   icon: Wand2 },
];

export default function FXK16Hub() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'calibrate' ? 'calibrate' : 'validate';

  const setTab = useCallback((next: Tab) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  }, [params, setParams]);

  const content = useMemo(() => {
    return tab === 'calibrate' ? <FXK16CalibrationPage /> : <FXK16ValidatePage />;
  }, [tab]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background">
      <div
        className="shrink-0 flex border-b sticky top-0 z-20 backdrop-blur-md"
        style={{ background: 'hsl(220 12% 5% / 0.92)', borderColor: 'hsl(32 100% 50% / 0.18)' }}
      >
        {TABS.map(t => {
          const isActive = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all relative',
                'text-[10px] font-mono font-bold tracking-[0.18em] uppercase',
                isActive ? 'text-[hsl(32_100%_65%)]' : 'text-muted-foreground/45 hover:text-muted-foreground/70'
              )}
              aria-pressed={isActive}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </div>
              <span className="text-[7px] tracking-[0.25em] opacity-60">{t.sub}</span>
              {isActive && (
                <div
                  className="absolute bottom-0 left-[15%] right-[15%] h-[2px]"
                  style={{ background: 'linear-gradient(90deg, transparent, hsl(32 100% 50% / 0.7), transparent)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[hsl(32_100%_65%)] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {content}
        </Suspense>
      </div>
    </div>
  );
}
