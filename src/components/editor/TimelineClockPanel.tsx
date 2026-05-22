import { Clock3, Link2, Radio } from 'lucide-react';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

function formatSeconds(value: number) {
  return value.toFixed(3);
}

export default function TimelineClockPanel() {
  const currentTime = useProjectStore((s) => s.currentTime);
  const duration = useProjectStore((s) => s.duration);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const playbackSpeed = useProjectStore((s) => s.playbackSpeed);
  const timelineSource = useProjectStore((s) => s.timelineSource);
  const timelineLastExternalSync = useProjectStore((s) => s.timelineLastExternalSync);
  const timelineDriftSec = useProjectStore((s) => s.timelineDriftSec);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-background/40 px-3 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-foreground">
        <Clock3 className="h-3.5 w-3.5 text-primary" />
        <span>{formatSeconds(currentTime)}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground">{formatSeconds(duration)}</span>
      </div>

      <div className="h-4 w-px bg-border/20" />

      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
        <span className={cn('h-1.5 w-1.5 rounded-full', isPlaying ? 'bg-primary animate-pulse' : 'bg-muted')} />
        {isPlaying ? 'play' : 'pause'}
      </div>

      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
        <Radio className="h-3 w-3" />
        {playbackSpeed.toFixed(2)}x
      </div>

      <div className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-muted-foreground">
        <Link2 className="h-3 w-3" />
        {timelineSource}
      </div>

      <div className="text-[9px] font-mono tabular-nums text-muted-foreground">
        Δ {formatSeconds(timelineDriftSec)}s
      </div>

      {timelineLastExternalSync && (
        <div className="text-[9px] font-mono tabular-nums text-muted-foreground/70">
          ext {new Date(timelineLastExternalSync).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}