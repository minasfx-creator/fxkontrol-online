/**
 * MobileHUD — Transparent top bar (Free Fire style)
 * Always visible over 3D world. Shows timecode, transport, connection status, PANIC.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, Square, Menu, AlertOctagon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useShowSettings } from '@/hooks/useShowSettings';
import type { PanelId } from '@/components/editor/PanelTabBar';

interface MobileHUDProps {
  onOpenPanel: (id: PanelId) => void;
  onMenuOpen: () => void;
}

function formatTimecode(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function getCountdown(showDate: string | null): string | null {
  if (!showDate) return null;
  const diff = new Date(showDate).getTime() - Date.now();
  if (diff <= 0) return 'LIVE';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `T-${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `T-${hours}h ${mins}m`;
}

export default function MobileHUD({ onOpenPanel, onMenuOpen }: MobileHUDProps) {
  const currentTime = useProjectStore(s => s.currentTime);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const clearAll = useLiveSfxStore(s => s.clearAll);
  const usbConnected = useUSBDeviceStore(s => s.dmxDevices.length > 0);
  const smpteRunning = useSMPTEStore(s => s.running);
  const { settings } = useShowSettings();
  const isArmed = activeEffects.length > 0;
  const [showMenu, setShowMenu] = useState(false);

  const countdown = useMemo(() => getCountdown(settings?.show_date ?? null), [settings?.show_date]);

  const handlePanic = useCallback(() => {
    clearAll();
    setPlaying(false);
    setCurrentTime(0);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
  }, [clearAll, setPlaying, setCurrentTime]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="pointer-events-auto glass-hud flex items-center justify-between px-3 py-1.5 mx-2 mt-1 rounded-xl">
        {/* Left: Logo + Timecode */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4 text-primary glow-active" />
            <span className="text-[9px] font-bold text-primary tracking-wider">FXK</span>
          </div>
          <div className="font-mono-code text-sm font-semibold text-primary tabular-nums tracking-tight">
            {formatTimecode(currentTime)}
          </div>
          {countdown && (
            <span className={cn(
              "text-[8px] font-bold px-1.5 py-0.5 rounded-full",
              countdown === 'LIVE'
                ? "bg-destructive/30 text-destructive animate-pulse-glow"
                : "bg-accent/20 text-accent"
            )}>
              {countdown}
            </span>
          )}
        </div>

        {/* Center: Transport */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPlaying(!isPlaying)}
            className="touch-target flex items-center justify-center w-8 h-8 rounded-full glass-card transition-all active:scale-90"
          >
            {isPlaying
              ? <Pause className="w-4 h-4 text-primary" />
              : <Play className="w-4 h-4 text-primary ml-0.5" />
            }
          </button>
          <button
            onClick={stopPlayback}
            className="touch-target flex items-center justify-center w-8 h-8 rounded-full glass-card transition-all active:scale-90"
          >
            <Square className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Right: Status + PANIC + Menu */}
        <div className="flex items-center gap-2">
          {/* Connection dots */}
          <div className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", usbConnected ? "bg-primary animate-pulse-glow" : "bg-muted-foreground/40")} title="USB" />
            <div className={cn("w-2 h-2 rounded-full", smpteRunning ? "bg-warning" : "bg-muted-foreground/40")} title="SMPTE" />
          </div>

          {/* PANIC — only when armed */}
          {isArmed && (
            <button
              onClick={handlePanic}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-destructive/80 border border-destructive animate-pulse-glow active:scale-90 transition-transform"
            >
              <AlertOctagon className="w-4 h-4 text-destructive-foreground" />
            </button>
          )}

          <button
            onClick={onMenuOpen}
            className="touch-target flex items-center justify-center w-8 h-8 rounded-full glass-card active:scale-90 transition-transform"
          >
            <Menu className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
