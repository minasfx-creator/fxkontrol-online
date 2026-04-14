/**
 * ─── Timeline Scrubber ──────────────────────────────────────────────
 * Visual tick-space → pixel-space scrubber for VersioningPanel.
 * Shows snapshot markers, current tick, draggable playhead → ROLLBACK.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { commandBus } from '@/core/command/CommandBus';
import { lockstep } from '@/core/reliability/lockstepEngine';
import type { Snapshot } from '@/core/state/SnapshotManager';

interface TimelineScrubberProps {
  snapshots: readonly Snapshot[];
  className?: string;
}

export default function TimelineScrubber({ snapshots, className }: TimelineScrubberProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragTick, setDragTick] = useState<number | null>(null);
  const [currentTick, setCurrentTick] = useState(lockstep.getTickCount());

  // Poll current tick
  useEffect(() => {
    const id = setInterval(() => setCurrentTick(lockstep.getTickCount()), 500);
    return () => clearInterval(id);
  }, []);

  const maxTick = Math.max(currentTick, 1);

  const tickToPercent = useCallback((tick: number) => {
    return Math.min(100, Math.max(0, (tick / maxTick) * 100));
  }, [maxTick]);

  const percentToTick = useCallback((pct: number) => {
    return Math.round((pct / 100) * maxTick);
  }, [maxTick]);

  const getPercentFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const pct = getPercentFromEvent(e);
    setDragTick(percentToTick(pct));
  }, [getPercentFromEvent, percentToTick]);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const pct = getPercentFromEvent(e);
      setDragTick(percentToTick(pct));
    };

    const handleUp = () => {
      if (dragTick !== null && dragTick < currentTick) {
        // Find nearest snapshot at or before dragTick
        let targetTick = dragTick;
        for (const snap of snapshots) {
          if (snap.tick <= dragTick) targetTick = snap.tick;
        }
        commandBus.dispatch({ type: 'ROLLBACK', targetTick });
      }
      setDragging(false);
      setDragTick(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dragTick, currentTick, snapshots, getPercentFromEvent, percentToTick]);

  // Touch support
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!barRef.current || !e.touches[0]) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
    setDragging(true);
    setDragTick(percentToTick(pct));
  }, [percentToTick]);

  useEffect(() => {
    if (!dragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!barRef.current || !e.touches[0]) return;
      const rect = barRef.current.getBoundingClientRect();
      const pct = Math.min(100, Math.max(0, ((e.touches[0].clientX - rect.left) / rect.width) * 100));
      setDragTick(percentToTick(pct));
    };

    const handleTouchEnd = () => {
      if (dragTick !== null && dragTick < currentTick) {
        let targetTick = dragTick;
        for (const snap of snapshots) {
          if (snap.tick <= dragTick) targetTick = snap.tick;
        }
        commandBus.dispatch({ type: 'ROLLBACK', targetTick });
      }
      setDragging(false);
      setDragTick(null);
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging, dragTick, currentTick, snapshots, percentToTick]);

  const playheadPct = dragging && dragTick !== null
    ? tickToPercent(dragTick)
    : tickToPercent(currentTick);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
        <span>Tick 0</span>
        <span className="font-mono-code">
          {dragging && dragTick !== null ? `→ ${dragTick}` : `Tick ${currentTick}`}
        </span>
        <span>Tick {maxTick}</span>
      </div>

      {/* Scrubber bar */}
      <div
        ref={barRef}
        className="relative h-4 bg-surface-2/60 rounded-full cursor-pointer select-none touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Progress fill */}
        <div
          className="absolute inset-y-0 left-0 bg-primary/20 rounded-full"
          style={{ width: `${tickToPercent(currentTick)}%` }}
        />

        {/* Snapshot markers */}
        {snapshots.map((snap) => (
          <div
            key={snap.tick}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/70 border border-primary"
            style={{ left: `${tickToPercent(snap.tick)}%`, transform: 'translate(-50%, -50%)' }}
            title={`Snapshot @ tick ${snap.tick}`}
          />
        ))}

        {/* Playhead */}
        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 transition-colors",
            dragging
              ? "bg-destructive border-destructive scale-125"
              : "bg-primary border-primary-foreground"
          )}
          style={{ left: `${playheadPct}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {dragging && (
        <p className="text-[9px] text-destructive text-center animate-pulse">
          Solte para rollback ao snapshot mais próximo
        </p>
      )}
    </div>
  );
}
