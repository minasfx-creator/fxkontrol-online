/**
 * MobileHUD — Apple Dynamic Island–inspired top bar
 * Compact layout optimized for 375px mobile screens.
 */
import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Square, AlertOctagon, Zap, Radio, ScanEye, Crosshair, MapPin } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { usePlaybackState, useEditorMode, useHardwareStatus } from '@/hooks/useEditorUI';
import { useProjectStore } from '@/store/useProjectStore';
import { useShowSettings } from '@/hooks/useShowSettings';
import { useSceneStore } from '@/store/useSceneStore';
import { timelineClock } from '@/core/timeline/TimelineClock';
import { timelineTransport } from '@/core/transport/timelineTransport';

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
}

function getCountdown(showDate: string | null): string | null {
  if (!showDate) return null;
  const diff = new Date(showDate).getTime() - Date.now();
  if (diff <= 0) return 'LIVE';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `T-${days}d`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `T-${hours}h${mins}m`;
}

export default React.memo(function MobileHUD() {
  const navigate = useNavigate();
  const { currentTime, isPlaying, setPlaying, setCurrentTime, duration, playbackSpeed, timelineSource } = usePlaybackState();
  const { editorMode, isPlacingMode } = useEditorMode();
  const { activeEffects, clearAll, usbConnected, smpteRunning, isArmed } = useHardwareStatus();
  const positions = useProjectStore(s => s.positions);
  const selectedIds = useProjectStore(s => s.selectedPositionIds);
  const { settings } = useShowSettings();
  const arMode = useSceneStore(s => s.environment.arMode);
  const updateEnvironment = useSceneStore(s => s.updateEnvironment);
  const countdown = useMemo(() => getCountdown(settings?.show_date ?? null), [settings?.show_date]);

  const handleARToggle = useCallback(() => {
    const next = !arMode;
    updateEnvironment({ arMode: next });
    haptics.arToggle(next);
  }, [arMode, updateEnvironment]);

  const handlePanic = useCallback(() => {
    clearAll();
    timelineTransport.stop();
    haptics.panic();
  }, [clearAll]);

  // Diagnostic chip: surfaces non-obvious states that could explain a frozen UI.
  const diagnosticChip = useMemo(() => {
    if (timelineSource === 'external') return { label: 'EXT', tone: 'accent' as const };
    if (playbackSpeed === 0) return { label: '0×', tone: 'warning' as const };
    if (duration > 0 && currentTime >= duration - 0.001) return { label: 'END', tone: 'warning' as const };
    return null;
  }, [timelineSource, playbackSpeed, duration, currentTime]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
      {/* Main HUD row */}
      <div className="flex items-center justify-between px-2 pt-1 pb-1 mx-2 gap-1 min-w-0">
        {/* Left: Timecode pill or Placing Mode indicator */}
        {isPlacingMode ? (
          <div className="pointer-events-auto status-pill shrink-0 ring-1 ring-accent/40 mode-indicator-pulse" style={{ background: 'hsl(var(--accent) / 0.1)' }}>
            <Crosshair className="w-3 h-3 text-accent" />
            <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Placing</span>
          </div>
        ) : (
          <div className={cn(
            "pointer-events-auto status-pill transition-all duration-300 shrink-0",
            isArmed && "ring-1 ring-destructive/40 shadow-[0_0_8px_hsl(var(--destructive)/0.15)]"
          )}>
            <Zap className={cn("w-3 h-3", isArmed ? "text-destructive" : "text-primary")} />
            <span className="font-mono text-[10px] font-semibold text-primary tabular-nums tracking-tight truncate max-w-[80px]">
              {formatTimecode(currentTime)}
            </span>
            {isArmed && (
              <span className="text-[8px] font-bold text-destructive animate-pulse ml-0.5">ARM</span>
            )}
            {countdown && !isArmed && (
              <span className={cn("text-[8px] font-bold ml-0.5", countdown === 'LIVE' ? "text-destructive" : "text-accent")}>
                {countdown}
              </span>
            )}
          </div>
        )}

        {/* Position count badge */}
        {positions.length > 0 && !isPlacingMode && (
          <div className="pointer-events-none status-pill shrink-0 px-1.5">
            <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{positions.length} POS</span>
          </div>
        )}

        {/* Diagnostic chip (only shows when timeline is in a non-obvious state) */}
        {diagnosticChip && (
          <div className={cn(
            "pointer-events-none status-pill shrink-0 px-1.5 ring-1",
            diagnosticChip.tone === 'warning' && "ring-[hsl(var(--warning)/0.4)]",
            diagnosticChip.tone === 'accent' && "ring-[hsl(var(--accent)/0.4)]"
          )}>
            <span className={cn(
              "text-[9px] font-bold tabular-nums",
              diagnosticChip.tone === 'warning' && "text-[hsl(var(--warning))]",
              diagnosticChip.tone === 'accent' && "text-[hsl(var(--accent))]"
            )}>{diagnosticChip.label}</span>
          </div>
        )}

        {/* Center: Transport — compact 44px targets */}
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            onClick={() => { haptics.tap(); timelineTransport.toggle(); }}
            className="glass-button flex items-center justify-center w-11 h-11 active:scale-90 transition-transform"
          >
            {isPlaying
              ? <Pause className="w-5 h-5 text-foreground" />
              : <Play className="w-5 h-5 text-foreground ml-0.5" />
            }
          </button>
          <button
            onClick={() => { haptics.toggle(); timelineTransport.stop(); }}
            className="glass-button flex items-center justify-center w-11 h-11 active:scale-90 transition-transform"
          >
            <Square className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Right: Compact action group */}
        <div className="pointer-events-auto flex items-center gap-1 shrink-0">
          {/* AR Toggle pill */}
          <button
            onClick={handleARToggle}
            className={cn(
              "flex items-center justify-center gap-0.5 px-2 h-8 rounded-lg text-[9px] font-bold tracking-wider transition-all active:scale-90",
              arMode
                ? "bg-[hsl(var(--fxk-magenta)/0.2)] ring-1 ring-[hsl(var(--fxk-magenta)/0.5)] text-[hsl(var(--fxk-magenta))]"
                : "glass-button text-muted-foreground"
            )}
          >
            <ScanEye className="w-3.5 h-3.5" />
            AR
          </button>
          {/* PANIC — only when armed, takes priority */}
          {isArmed && (
            <button
              onClick={handlePanic}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-destructive/90 armed-pulse active:scale-90 transition-transform"
            >
              <AlertOctagon className="w-5 h-5 text-destructive-foreground" />
            </button>
          )}

          {/* Geo location button */}
          <button
            onClick={() => { haptics.tap(); window.dispatchEvent(new Event('open-geo-setup')); }}
            className="glass-button flex items-center justify-center w-11 h-11 active:scale-90 transition-transform"
          >
            <MapPin className="w-4 h-4 text-foreground" />
          </button>

          {/* Hardware status indicator */}
          <button
            onClick={() => { haptics.tap(); navigate('/command?mode=hardware'); }}
            className={cn(
              "glass-button relative flex items-center justify-center w-11 h-11 active:scale-90 transition-transform",
              (usbConnected || smpteRunning) && "ring-1 ring-[hsl(var(--success)/0.4)]"
            )}
          >
            <Radio className="w-4 h-4 text-foreground" />
            {(usbConnected || smpteRunning) && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))]" />
            )}
          </button>

        </div>
      </div>
    </div>
  );
});
