/**
 * TimelineHealthBadge — compact status pill shown in the timeline header.
 *
 * Reflects the operational status of the master `timelineClock`, derived by
 * `useTimelineClockHealthCheck`. It uses semantic Tailwind tokens so it
 * follows the project's command-grade palette:
 *
 *   - 'idle'      → muted token, no glow.       Operator paused intentionally.
 *   - 'running'   → success token (green).      Clock advancing normally.
 *   - 'stalled'   → destructive token (red),    Clock frozen under Play —
 *                   pulsing.                    watchdog about to recover.
 *   - 'recovered' → warning token (amber),      Watchdog just intervened.
 *                   pulses for ~2.5s.
 *
 * The badge is purely informational — it never advances time. Hovering shows
 * a tooltip with the current `stalledForMs` and the last recovery path so
 * operators can audit what the watchdog did.
 */
import { Activity, AlertTriangle, CheckCircle2, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTimelineHealth } from '@/hooks/useTimelineHealth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const STATUS_STYLES: Record<
  ReturnType<typeof useTimelineHealth>['status'],
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }>; pulse: boolean }
> = {
  idle: {
    label: 'IDLE',
    className: 'border-border/40 bg-muted/15 text-muted-foreground',
    Icon: Pause,
    pulse: false,
  },
  running: {
    label: 'RUNNING',
    className: 'border-success/40 bg-success/10 text-success',
    Icon: Activity,
    pulse: false,
  },
  stalled: {
    label: 'STALLED',
    className: 'border-destructive/50 bg-destructive/15 text-destructive',
    Icon: AlertTriangle,
    pulse: true,
  },
  recovered: {
    label: 'RECOVERED',
    className: 'border-warning/50 bg-warning/15 text-warning',
    Icon: CheckCircle2,
    pulse: true,
  },
};

export function TimelineHealthBadge() {
  const health = useTimelineHealth();
  const style = STATUS_STYLES[health.status];
  const Icon = style.Icon;

  const tooltipBody = (() => {
    switch (health.status) {
      case 'idle':
        return 'Timeline clock is paused. Press Play to start advancing.';
      case 'running':
        return 'Timeline clock is advancing normally.';
      case 'stalled':
        return `Clock has not advanced for ${health.stalledForMs}ms. The watchdog is attempting recovery.`;
      case 'recovered':
        return health.lastRecoveryPath === 'audio-resync'
          ? 'Watchdog re-locked the clock to audio.currentTime and retried playback.'
          : 'Watchdog restarted the local lockstep playback driver.';
    }
  })();

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            role="status"
            aria-live="polite"
            aria-label={`Timeline clock status: ${style.label}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider tabular-nums',
              style.className,
              style.pulse && 'animate-pulse',
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            <span>{style.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tooltipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
