/**
 * /dev/fxk32q — FXK32Q dev hub
 *
 * Tabs:
 *   • CONTROL  → bench-only painel (connect/ARM/Hold-to-Fire/E-STOP).
 *   • SNAPSHOT → live read-only adapter view (snapshot/provenance/diagnostics).
 *
 * Deep-link via `?tab=control|snapshot`. Lazy-loaded.
 * Never mutates workMode / SafetyStateMachine / FieldBus.
 */
import { lazy, Suspense, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const FXK32QControlPanel = lazy(() => import('@/components/dev/fxk32q/FXK32QControlPanel'));
const FXK32QAdapterPanel = lazy(() => import('@/components/dev/fxk32q/FXK32QAdapterPanel'));

type Tab = 'control' | 'snapshot';

const TABS: { key: Tab; label: string; sub: string; icon: typeof Activity }[] = [
  { key: 'control',  label: 'CONTROL',  sub: 'BENCH',     icon: Zap },
  { key: 'snapshot', label: 'SNAPSHOT', sub: 'READ-ONLY', icon: Activity },
];

export default function FXK32QHub() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'snapshot' ? 'snapshot' : 'control';

  const setTab = useCallback((next: Tab) => {
    const p = new URLSearchParams(params);
    p.set('tab', next);
    setParams(p, { replace: true });
  }, [params, setParams]);

  const content = useMemo(() => {
    return tab === 'snapshot' ? <FXK32QAdapterPanel /> : <FXK32QControlPanel />;
  }, [tab]);

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background">
      <div
        className="shrink-0 flex border-b sticky top-0 z-20 backdrop-blur-md"
        style={{ background: 'hsl(220 12% 5% / 0.92)', borderColor: 'hsl(190 70% 58% / 0.18)' }}
      >
        {TABS.map((t) => {
          const isActive = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-all relative',
                'text-[10px] font-mono font-bold tracking-[0.18em] uppercase',
                isActive ? 'text-[hsl(190_70%_70%)]' : 'text-muted-foreground/45 hover:text-muted-foreground/70'
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
                  style={{ background: 'linear-gradient(90deg, transparent, hsl(190 70% 58% / 0.7), transparent)' }}
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
              <div className="w-6 h-6 border-2 border-[hsl(190_70%_70%)] border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          {content}
        </Suspense>
      </div>
    </div>
  );
}
