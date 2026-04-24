import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { lazyRetry } from '@/lib/lazyRetry';
import { Sparkles } from 'lucide-react';

const SwarmGPTPanel = lazy(lazyRetry(() => import('@/components/editor/SwarmGPTPanel')));

/**
 * SwarmGPT hub page — central place for AI choreography generation.
 * Wraps the existing SwarmGPTPanel as a full-page experience so the
 * editor and dashboard no longer need duplicated entries.
 */
export default function SwarmGPTPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-[100dvh] w-full bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 sm:px-6 h-14 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div
          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'hsl(32 100% 50% / 0.12)' }}
        >
          <Sparkles className="h-4 w-4" style={{ color: 'hsl(32 100% 50%)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold tracking-wide text-foreground truncate">SwarmGPT</h1>
          <p className="text-[10px] text-muted-foreground font-mono-code truncate">
            AI choreography hub — refiner → planner → critic → enhancer → compiler
          </p>
        </div>
      </header>

      {/* Content: reuse SwarmGPTPanel as the page body */}
      <main className="flex-1 min-h-0 relative">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        >
          <div className="absolute inset-0 overflow-hidden">
            <SwarmGPTPanel onClose={() => navigate(-1)} />
          </div>
        </Suspense>
      </main>
    </div>
  );
}
