/**
 * TimelineHealthLogPopover — operator-visible event log of the last few
 * stall detections recorded by `useTimelineClockHealthCheck`.
 *
 * Why a separate panel
 *   The toast notifications surfaced by the watchdog are ephemeral and easy
 *   to miss during a busy show. The status badge says *what is happening
 *   now*, the settings popover says *how the watchdog is tuned*, but the
 *   operator also needs a short-term history to answer "did the timeline
 *   wobble during that last cue?" without scraping the dev console. The
 *   `timelineHealthStore` already keeps a 20-event ring buffer; this
 *   component is a thin viewer over it.
 *
 * Each row shows:
 *   - wall-clock timestamp (HH:MM:SS),
 *   - how long the clock was frozen (ms / s),
 *   - which recovery path was used (External Sync vs Local Driver),
 *   - a flag when drift correction glided the clock back to audio
 *     instead of hard-snapping.
 *
 * The log is purely informational and lives entirely in memory — clearing
 * it is safe and only affects this UI surface.
 */
import { ScrollText, Trash2, Radio, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Root as RealPopover,
  Trigger as RealPopoverTrigger,
  Portal as RealPopoverPortal,
  Content as RealPopoverContent,
} from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import { useTimelineHealth } from '@/hooks/useTimelineHealth';
import {
  timelineHealthStore,
  type TimelineHealthEvent,
} from '@/core/health/timelineHealthStore';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatStall(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms} ms`;
}

interface RowProps {
  event: TimelineHealthEvent;
}

function EventRow({ event }: RowProps) {
  const isExternal = event.recoveryPath === 'audio-resync';
  const Icon = isExternal ? Radio : Cpu;
  return (
    <li className="flex items-start gap-2 rounded-md border border-border/30 bg-muted/10 px-2 py-1.5">
      <Icon
        className={cn(
          'mt-0.5 h-3 w-3 shrink-0',
          isExternal ? 'text-accent' : 'text-amber-400',
        )}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] tabular-nums text-foreground">
            {formatTime(event.timestamp)}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            stalled {formatStall(event.stalledForMs)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant="outline"
            className={cn(
              'h-4 px-1 text-[9px] uppercase tracking-wider',
              isExternal
                ? 'border-accent/40 text-accent'
                : 'border-amber-400/40 text-amber-400',
            )}
          >
            {isExternal ? 'External sync' : 'Local driver'}
          </Badge>
          {event.wasExternalSource && !isExternal && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] uppercase tracking-wider border-muted text-muted-foreground"
            >
              ext source dropped
            </Badge>
          )}
          {event.softAligned && (
            <Badge
              variant="outline"
              className="h-4 px-1 text-[9px] uppercase tracking-wider border-emerald-500/40 text-emerald-400"
            >
              glided
            </Badge>
          )}
        </div>
      </div>
    </li>
  );
}

export function TimelineHealthLogPopover() {
  const { events } = useTimelineHealth();
  const hasEvents = events.length > 0;

  return (
    <RealPopover>
      <RealPopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-5 w-5 rounded-md text-muted-foreground hover:bg-muted/15 hover:text-foreground',
            hasEvents && 'text-foreground',
          )}
          title={hasEvents ? `${events.length} recovery event(s)` : 'No recovery events'}
          aria-label="Open playback health event log"
        >
          <ScrollText className="h-3 w-3" />
          {hasEvents && (
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400"
              aria-hidden="true"
            />
          )}
        </Button>
      </RealPopoverTrigger>
      <RealPopoverPortal>
        <RealPopoverContent
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-50 w-80 rounded-lg border border-border/40 bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                Playback Health
              </p>
              <p className="text-[10px] text-muted-foreground">
                Last {events.length || 'no'} stall recovery
                {events.length === 1 ? '' : 's'} during this session.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasEvents}
              onClick={() => timelineHealthStore._clearEvents()}
              className="h-6 gap-1 px-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          </div>
          <Separator className="mb-2" />
          {hasEvents ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </ul>
          ) : (
            <div className="rounded-md border border-dashed border-border/40 bg-muted/5 px-3 py-6 text-center">
              <p className="text-[11px] text-muted-foreground">
                No stalls detected.
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Recovery events will appear here as the watchdog intervenes.
              </p>
            </div>
          )}
        </RealPopoverContent>
      </RealPopoverPortal>
    </RealPopover>
  );
}
