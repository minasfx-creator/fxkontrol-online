/**
 * MobileHUD — Apple Dynamic Island–inspired top bar
 * Clean, minimal, high-information density for show operators.
 */
import { useState, useCallback, useMemo } from 'react';
import { Play, Pause, Square, Menu, AlertOctagon, Zap, ShieldAlert, MapPin } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useDisplayStore } from '@/store/useDisplayStore';
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
  if (days > 0) return `T-${days}d`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `T-${hours}h${mins}m`;
}

export default function MobileHUD({ onOpenPanel, onMenuOpen }: MobileHUDProps) {
  const currentTime = useProjectStore(s => s.currentTime);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const gpsOrigin = useProjectStore(s => s.gpsOrigin);
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const clearAll = useLiveSfxStore(s => s.clearAll);
  const usbConnected = useUSBDeviceStore(s => s.dmxDevices.length > 0);
  const smpteRunning = useSMPTEStore(s => s.running);
  const { settings } = useShowSettings();

  const openGeoSetup = useCallback(() => {
    haptics.tap();
    window.dispatchEvent(new Event('open-geo-setup'));
  }, []);
  const isArmed = activeEffects.length > 0;

  const countdown = useMemo(() => getCountdown(settings?.show_date ?? null), [settings?.show_date]);

  const handlePanic = useCallback(() => {
    clearAll();
    setPlaying(false);
    setCurrentTime(0);
    haptics.panic();
  }, [clearAll, setPlaying, setCurrentTime]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Location quick-access pill — positioned below HUD bar */}
      <button
        onClick={openGeoSetup}
        className="pointer-events-auto absolute top-[72px] left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--surface-0)/0.85)] backdrop-blur-xl border border-[hsl(var(--border)/0.2)] shadow-lg active:scale-95 transition-transform"
      >
        <MapPin className="w-3.5 h-3.5 text-[hsl(var(--safety))]" />
        <span className="text-[10px] font-mono text-[hsl(var(--foreground)/0.8)] tracking-tight">
          {gpsOrigin.lat.toFixed(4)}°, {gpsOrigin.lng.toFixed(4)}°
        </span>
      </button>

      <div className="flex items-center justify-between px-3 pt-2 pb-1 mx-3 mt-1">
        {/* Left: Timecode pill (Dynamic Island style) */}
        <div className={cn(
          "pointer-events-auto status-pill transition-all duration-300",
          isArmed && "ring-1 ring-destructive/40 shadow-[0_0_8px_hsl(var(--destructive)/0.15)]"
        )}>
          <Zap className={cn("w-3 h-3", isArmed ? "text-destructive" : "text-primary")} />
          <span className="font-mono text-[11px] font-semibold text-primary tabular-nums tracking-tight">
            {formatTimecode(currentTime)}
          </span>
          {isArmed && (
            <span className="text-[9px] font-bold text-destructive animate-pulse ml-1">
              ARMED
            </span>
          )}
          {countdown && !isArmed && (
            <span className={cn(
              "text-[9px] font-bold ml-1",
              countdown === 'LIVE' ? "text-destructive" : "text-accent"
            )}>
              {countdown}
            </span>
          )}
        </div>

        {/* Center: Transport controls — 56px targets */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => { haptics.tap(); setPlaying(!isPlaying); }}
            className="glass-button flex items-center justify-center w-14 h-14 active:scale-90 transition-transform"
          >
            {isPlaying
              ? <Pause className="w-6 h-6 text-foreground" />
              : <Play className="w-6 h-6 text-foreground ml-0.5" />
            }
          </button>
          <button
            onClick={() => { haptics.toggle(); setPlaying(false); setCurrentTime(0); }}
            className="glass-button flex items-center justify-center w-14 h-14 active:scale-90 transition-transform"
          >
            <Square className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Right: LIVE mode + PANIC + Menu */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 mr-1">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              usbConnected ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--muted-foreground)/0.3)]"
            )} />
            <div className={cn(
              "w-1.5 h-1.5 rounded-full transition-colors",
              smpteRunning ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--muted-foreground)/0.3)]"
            )} />
          </div>

          {/* LIVE mode toggle */}
          <button
            onClick={() => { haptics.showMode(true); useDisplayStore.getState().setOperationMode('live'); }}
            className="glass-button flex items-center justify-center w-14 h-14 active:scale-90 transition-transform"
          >
            <ShieldAlert className="w-5 h-5 text-[hsl(var(--warning))]" />
          </button>

          {/* PANIC — only when armed */}
          {isArmed && (
            <button
              onClick={handlePanic}
              className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/90 armed-pulse active:scale-90 transition-transform"
            >
              <AlertOctagon className="w-6 h-6 text-destructive-foreground" />
            </button>
          )}

          <button
            onClick={() => { haptics.tap(); onMenuOpen(); }}
            className="glass-button flex items-center justify-center w-14 h-14 active:scale-90 transition-transform"
          >
            <Menu className="w-6 h-6 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}
