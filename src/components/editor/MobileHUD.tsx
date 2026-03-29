/**
 * MobileHUD — Apple Dynamic Island–inspired top bar
 * Compact layout optimized for 375px mobile screens.
 */
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Square, AlertOctagon, Zap, Radio } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/useProjectStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useShowSettings } from '@/hooks/useShowSettings';

interface MobileHUDProps {
  onMenuOpen: () => void;
}

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

export default function MobileHUD({ onMenuOpen }: MobileHUDProps) {
  const navigate = useNavigate();
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
  const countdown = useMemo(() => getCountdown(settings?.show_date ?? null), [settings?.show_date]);

  const handlePanic = useCallback(() => {
    clearAll();
    setPlaying(false);
    setCurrentTime(0);
    haptics.panic();
  }, [clearAll, setPlaying, setCurrentTime]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Main HUD row */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1 mx-2 mt-1 gap-1">
        {/* Left: Timecode pill */}
        <div className={cn(
          "pointer-events-auto status-pill transition-all duration-300 shrink-0",
          isArmed && "ring-1 ring-destructive/40 shadow-[0_0_8px_hsl(var(--destructive)/0.15)]"
        )}>
          <Zap className={cn("w-3 h-3", isArmed ? "text-destructive" : "text-primary")} />
          <span className="font-mono text-[10px] font-semibold text-primary tabular-nums tracking-tight">
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

        {/* Center: Transport — compact 44px targets */}
        <div className="pointer-events-auto flex items-center gap-1">
          <button
            onClick={() => { haptics.tap(); setPlaying(!isPlaying); }}
            className="glass-button flex items-center justify-center w-11 h-11 active:scale-90 transition-transform"
          >
            {isPlaying
              ? <Pause className="w-5 h-5 text-foreground" />
              : <Play className="w-5 h-5 text-foreground ml-0.5" />
            }
          </button>
          <button
            onClick={() => { haptics.toggle(); setPlaying(false); setCurrentTime(0); }}
            className="glass-button flex items-center justify-center w-11 h-11 active:scale-90 transition-transform"
          >
            <Square className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Right: Compact action group */}
        <div className="pointer-events-auto flex items-center gap-1 shrink-0">
          {/* PANIC — only when armed, takes priority */}
          {isArmed && (
            <button
              onClick={handlePanic}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-destructive/90 armed-pulse active:scale-90 transition-transform"
            >
              <AlertOctagon className="w-5 h-5 text-destructive-foreground" />
            </button>
          )}

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
}
