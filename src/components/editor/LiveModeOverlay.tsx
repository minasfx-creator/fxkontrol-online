/**
 * LiveModeOverlay — Dedicated LIVE show control UI
 * Replaces all editor chrome with mission-critical controls only.
 */
import { useCallback, useMemo } from 'react';
import { Play, Pause, Square, ShieldAlert, ShieldCheck, LogOut, AlertOctagon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useProjectStore } from '@/store/useProjectStore';
import { useDisplayStore } from '@/store/useDisplayStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import { useSMPTEStore } from '@/store/useSMPTEStore';
import { useHoldToConfirm } from '@/hooks/useHoldToConfirm';
import { useShowSettings } from '@/hooks/useShowSettings';

type ShowState = 'READY' | 'ARMED' | 'LIVE' | 'STOPPED';

function formatTC(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

/** SVG ring progress for hold-to-confirm */
function HoldRing({ progress, size = 64, stroke = 3, color = 'hsl(var(--destructive))' }: { progress: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg className="absolute inset-0 -rotate-90 pointer-events-none" width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={circ * (1 - progress)} strokeLinecap="round" opacity={progress > 0 ? 1 : 0} />
    </svg>
  );
}

export default function LiveModeOverlay() {
  const currentTime = useProjectStore(s => s.currentTime);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const setPlaying = useProjectStore(s => s.setPlaying);
  const setCurrentTime = useProjectStore(s => s.setCurrentTime);
  const setOperationMode = useDisplayStore(s => s.setOperationMode);
  const activeEffects = useLiveSfxStore(s => s.activeEffects);
  const clearAll = useLiveSfxStore(s => s.clearAll);
  const usbConnected = useUSBDeviceStore(s => s.dmxDevices.length > 0);
  const smpteRunning = useSMPTEStore(s => s.running);

  const isArmed = activeEffects.length > 0;
  const showState: ShowState = isPlaying ? 'LIVE' : isArmed ? 'ARMED' : 'READY';

  // Hold-to-ARM
  const armHold = useHoldToConfirm({
    duration: 500,
    onConfirm: () => { haptics.arm(); },
    hapticOnConfirm: 'arm',
  });

  // Hold-to-EXIT
  const exitHold = useHoldToConfirm({
    duration: 1000,
    onConfirm: () => {
      haptics.disarm();
      setOperationMode('design');
    },
    hapticOnConfirm: 'toggle',
  });

  // E-STOP
  const handlePanic = useCallback(() => {
    clearAll();
    setPlaying(false);
    setCurrentTime(0);
    haptics.panic();
  }, [clearAll, setPlaying, setCurrentTime]);

  const stateColors: Record<ShowState, string> = {
    READY: 'text-[hsl(var(--success))]',
    ARMED: 'text-[hsl(var(--warning))]',
    LIVE: 'text-[hsl(var(--destructive))]',
    STOPPED: 'text-[hsl(var(--muted-foreground))]',
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* ── Top Bar: Timecode + State ── */}
      <div className="pointer-events-auto flex items-center justify-between px-4 pt-3 pb-2">
        {/* Timecode */}
        <div className="status-pill">
          <span className="font-mono text-base font-bold text-primary tabular-nums tracking-tight">
            {formatTC(currentTime)}
          </span>
        </div>

        {/* State Machine */}
        <div className="flex items-center gap-3">
          {(['READY', 'ARMED', 'LIVE'] as ShowState[]).map(st => (
            <div key={st} className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-2.5 h-2.5 rounded-full transition-all duration-300',
                showState === st
                  ? cn('scale-125', st === 'READY' && 'bg-[hsl(var(--success))] shadow-[0_0_8px_hsl(var(--success)/0.6)]', st === 'ARMED' && 'bg-[hsl(var(--warning))] shadow-[0_0_8px_hsl(var(--warning)/0.6)] animate-pulse', st === 'LIVE' && 'bg-[hsl(var(--destructive))] shadow-[0_0_8px_hsl(var(--destructive)/0.6)] animate-pulse')
                  : 'bg-[hsl(var(--muted-foreground)/0.2)]'
              )} />
              <span className={cn('text-[8px] font-tactical', showState === st ? stateColors[st] : 'text-[hsl(var(--muted-foreground)/0.3)]')}>
                {st}
              </span>
            </div>
          ))}
        </div>

        {/* Connection indicators */}
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', usbConnected ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--muted-foreground)/0.2)]')} />
          <div className={cn('w-2 h-2 rounded-full', smpteRunning ? 'bg-[hsl(var(--warning))]' : 'bg-[hsl(var(--muted-foreground)/0.2)]')} />
        </div>
      </div>

      {/* ── Bottom Controls ── */}
      <div className="absolute bottom-0 left-0 right-0 pb-6 px-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
        <div className="pointer-events-auto flex items-end justify-between">
          {/* Left: ARM/DISARM (hold) */}
          <div className="relative">
            <button
              onPointerDown={armHold.startHold}
              onPointerUp={armHold.cancelHold}
              onPointerLeave={armHold.cancelHold}
              className={cn(
                'relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95',
                isArmed
                  ? 'bg-[hsl(var(--warning)/0.15)] border-2 border-[hsl(var(--warning)/0.4)]'
                  : 'bg-[hsl(var(--muted)/0.8)] border border-[hsl(var(--border))]'
              )}
            >
              <HoldRing progress={armHold.progress} color="hsl(var(--warning))" />
              {isArmed
                ? <ShieldAlert className="w-7 h-7 text-[hsl(var(--warning))]" />
                : <ShieldCheck className="w-7 h-7 text-[hsl(var(--muted-foreground))]" />
              }
            </button>
            <span className="block text-center text-[9px] font-tactical text-[hsl(var(--muted-foreground))] mt-1">
              {isArmed ? 'ARMED' : 'ARM'}
            </span>
          </div>

          {/* Center: Transport */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { haptics.tap(); setPlaying(!isPlaying); }}
              className="w-16 h-16 rounded-2xl glass-button flex items-center justify-center active:scale-90 transition-transform"
            >
              {isPlaying
                ? <Pause className="w-7 h-7 text-foreground" />
                : <Play className="w-7 h-7 text-foreground ml-0.5" />
              }
            </button>

            {/* E-STOP */}
            <button
              onClick={() => { haptics.panic(); handlePanic(); }}
              className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center active:scale-90 transition-transform',
                'bg-[hsl(var(--destructive)/0.9)] armed-pulse'
              )}
            >
              <AlertOctagon className="w-7 h-7 text-[hsl(var(--destructive-foreground))]" />
            </button>

            <button
              onClick={() => { haptics.toggle(); setPlaying(false); setCurrentTime(0); }}
              className="w-14 h-14 rounded-2xl glass-button flex items-center justify-center active:scale-90 transition-transform"
            >
              <Square className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>

          {/* Right: EXIT LIVE (hold 1s) */}
          <div className="relative">
            <button
              onPointerDown={exitHold.startHold}
              onPointerUp={exitHold.cancelHold}
              onPointerLeave={exitHold.cancelHold}
              className="relative w-16 h-16 rounded-2xl glass-button flex items-center justify-center active:scale-95 transition-transform"
            >
              <HoldRing progress={exitHold.progress} color="hsl(var(--primary))" />
              <LogOut className="w-6 h-6 text-[hsl(var(--muted-foreground))]" />
            </button>
            <span className="block text-center text-[9px] font-tactical text-[hsl(var(--muted-foreground))] mt-1">
              EXIT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
