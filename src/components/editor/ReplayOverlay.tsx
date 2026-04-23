/**
 * ─── Replay Overlay ─────────────────────────────────────────────────
 * Shows during active replay: progress, speed controls, tick counter.
 */

import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, FastForward, Rewind } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { replayEngine, type ReplayState } from '@/core/engine/ReplayEngine';
import { commandBus } from '@/core/command/CommandBus';

const SPEEDS = [0.25, 0.5, 1, 2] as const;

export function ReplayOverlay() {
  const [state, setState] = useState<ReplayState>(replayEngine.getState());
  const [progress, setProgress] = useState(0);
  const [currentTick, setCurrentTick] = useState(0);
  const [targetTick, setTargetTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const sync = () => {
      setState(replayEngine.getState());
      setProgress(replayEngine.getProgress() * 100);
      setCurrentTick(replayEngine.getCurrentTick());
      setTargetTick(replayEngine.getTargetTick());
    };

    sync();
    return replayEngine.subscribe(sync);
  }, []);

  const handleStop = useCallback(() => {
    commandBus.dispatch({ type: 'REPLAY_STOP' });
    replayEngine.stop();
  }, []);

  const handleTogglePause = useCallback(() => {
    setPaused(p => !p);
  }, []);

  const handleSpeed = useCallback((s: number) => {
    setSpeed(s);
    commandBus.dispatch({ type: 'REPLAY_SPEED', speed: s });
  }, []);

  if (state === 'idle') return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto">
      <div className="bg-card/95 backdrop-blur-md border border-primary/30 rounded-lg p-3 shadow-2xl min-w-[320px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] animate-pulse">
            REPLAY MODE
          </Badge>
          <span className="text-[10px] font-mono text-muted-foreground">
            {currentTick} / {targetTick}
          </span>
        </div>

        {/* Progress */}
        <Progress value={progress} className="h-1.5 mb-2" />

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleTogglePause}
            >
              {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={handleStop}
            >
              <Square className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Speed controls */}
          <div className="flex items-center gap-0.5">
            {SPEEDS.map(s => (
              <Button
                key={s}
                size="sm"
                variant={speed === s ? 'default' : 'ghost'}
                className="h-6 px-1.5 text-[10px] font-mono"
                onClick={() => handleSpeed(s)}
              >
                {s}x
              </Button>
            ))}
          </div>
        </div>

        {/* Status */}
        {state === 'done' && (
          <div className="mt-2 text-center text-[10px] text-green-400 font-mono">
            ✓ REPLAY COMPLETE
          </div>
        )}
      </div>
    </div>
  );
}
