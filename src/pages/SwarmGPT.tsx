import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lazyRetry } from '@/lib/lazyRetry';
import CommanderHUD from '@/components/swarmgpt/CommanderHUD';
import CorePanel from '@/components/swarmgpt/CorePanel';
import StageZone from '@/components/swarmgpt/StageZone';
import SystemLog, { useSystemLog } from '@/components/swarmgpt/SystemLog';

const SwarmGPTPanel = lazy(lazyRetry(() => import('@/components/editor/SwarmGPTPanel')));

/**
 * SwarmGPT Commander hub — central place for AI choreography generation.
 * 3-zone responsive layout: Core (left) · Stage (center) · Generator (right).
 * Stacks on mobile (HUD → Stage → Generator → Core).
 */
export default function SwarmGPTPage() {
  const navigate = useNavigate();
  const { lines, append, clear } = useSystemLog();
  const [busy, setBusy] = useState(false);

  // Validation state derives from log scan (cheap; real wiring lives inside the panel).
  const validationStatus = useMemo<'idle' | 'ok' | 'warn'>(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].level === 'warn') return 'warn';
      if (lines[i].level === 'ok')   return 'ok';
    }
    return 'idle';
  }, [lines]);

  return (
    <div className="relative min-h-[100dvh] w-full bg-background flex flex-col">
      <CommanderHUD
        validationStatus={validationStatus}
        busy={busy}
        operator="Operator"
        onClose={() => navigate(-1)}
      />

      {/* Body grid */}
      <main className="flex-1 min-h-0 grid gap-3 p-3 lg:p-4
                       grid-cols-1
                       lg:grid-cols-[280px_minmax(0,1fr)_360px]
                       lg:grid-rows-[minmax(0,1fr)]">
        {/* Stage — first on mobile, center on desktop */}
        <div className="order-1 lg:order-2 min-h-[260px] lg:min-h-0">
          <StageZone />
        </div>

        {/* Generator (right rail) */}
        <div className="order-2 lg:order-3 flex flex-col gap-3 min-h-[420px] lg:min-h-0">
          <div className="flex-1 min-h-0 glass-premium rounded-xl overflow-hidden">
            <Suspense
              fallback={
                <div className="h-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              }
            >
              <SwarmGPTPanel
                hideHeader
                onClose={() => navigate(-1)}
                onLog={(msg, level) => {
                  append(msg, level ?? 'info');
                  if (level === 'ai') setBusy(true);
                  if (level === 'ok' || level === 'warn') setBusy(false);
                }}
              />
            </Suspense>
          </div>
          {/* System log — under generator on desktop, after core on mobile */}
          <div className="hidden lg:block h-44 shrink-0">
            <SystemLog lines={lines} onClear={clear} />
          </div>
        </div>

        {/* Core — last on mobile, left on desktop */}
        <div className="order-3 lg:order-1 lg:row-start-1">
          <CorePanel />
        </div>

        {/* Mobile-only system log at the very bottom */}
        <div className="order-4 lg:hidden h-40">
          <SystemLog lines={lines} onClear={clear} />
        </div>
      </main>
    </div>
  );
}
