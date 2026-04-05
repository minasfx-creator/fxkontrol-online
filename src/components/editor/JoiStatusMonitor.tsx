/**
 * JoiStatusMonitor — Mini HUD with cinematic Joi avatar
 * Shows FPS, drone count, connection status
 */
import { useState, useEffect, useRef } from 'react';
import JoiCinematicHologram from '@/components/JoiCinematicHologram';
import { useProjectStore } from '@/store/useProjectStore';
import { cn } from '@/lib/utils';

export default function JoiStatusMonitor() {
  const positions = useProjectStore(s => s.positions);
  const timelineItems = useProjectStore(s => s.timelineItems);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const [fps, setFps] = useState(60);
  const frameTimesRef = useRef<number[]>([]);
  const lastRef = useRef(performance.now());

  useEffect(() => {
    let raf: number;
    const tick = () => {
      const now = performance.now();
      const delta = now - lastRef.current;
      lastRef.current = now;
      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 30) frameTimesRef.current.shift();
      const avg = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
      setFps(Math.round(1000 / avg));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const droneCount = positions.filter(p => p.type === 'drone-pad').length;
  const cueCount = timelineItems.length;

  return (
    <div className="absolute top-3 right-14 z-30 flex items-center gap-2">
      <div className="flex items-center gap-1 bg-background/60 backdrop-blur-xl border border-border/15 rounded-xl px-2 py-1">
        <span className={cn(
          "text-[9px] font-mono-code tabular-nums",
          fps >= 50 ? "text-emerald-400" : fps >= 30 ? "text-warning" : "text-destructive"
        )}>
          {fps} FPS
        </span>
        <span className="w-px h-3 bg-border/20" />
        <span className="text-[9px] font-mono-code text-muted-foreground">
          {positions.length} pos
        </span>
        {droneCount > 0 && (
          <>
            <span className="w-px h-3 bg-border/20" />
            <span className="text-[9px] font-mono-code text-accent-foreground">
              {droneCount} 🛸
            </span>
          </>
        )}
        <span className="w-px h-3 bg-border/20" />
        <span className="text-[9px] font-mono-code text-muted-foreground">
          {cueCount} cues
        </span>
      </div>

      <div className="cursor-pointer hover:brightness-125 transition-all" title="AI Companion">
        <JoiCinematicHologram
          size="sm"
          state={isPlaying ? 'active' : 'idle'}
        />
      </div>
    </div>
  );
}
