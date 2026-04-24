/**
 * CueKey — Hardware key replica with Lock/Tap mode + long-press to toggle mode.
 * Pure presentational; uses useLongPress for cleanup-safe hold detection.
 */
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/hooks/editor';
import { FIRING_RULES } from './constants';
import type { CueEntry } from './types';

interface CueKeyProps {
  index: number;
  cue?: CueEntry;
  firing: boolean;
  onPress: () => void;
  onRelease: () => void;
  onLongPress: () => void;
  pyroArmed: boolean;
  dmxArmed: boolean;
  fs: boolean;
  mobile?: boolean;
}

export default function CueKey({
  index, cue, firing, onPress, onRelease, onLongPress, pyroArmed, dmxArmed, fs, mobile,
}: CueKeyProps) {
  const isArmed = pyroArmed || dmxArmed;
  const hasAssignment = !!cue;
  const isLocked = cue?.keyMode === 'lock';
  const isBig = fs && mobile;

  // Long-press = toggle mode. Press / release = fire / stop. Cleanup is automatic.
  const longPress = useLongPress({
    delay: 800,
    onLongPress,
    onClick: () => { /* press already triggered fire on mousedown */ },
  });

  const handleDown = () => {
    onPress();
    longPress.onMouseDown();
  };
  const handleUp = () => {
    longPress.onMouseUp();
    onRelease();
  };
  const handleLeave = () => {
    longPress.onMouseLeave();
    if (firing && !isLocked) onRelease();
  };

  return (
    <button
      onMouseDown={handleDown}
      onMouseUp={handleUp}
      onMouseLeave={handleLeave}
      onTouchStart={(e) => { e.preventDefault(); handleDown(); }}
      onTouchEnd={(e) => { e.preventDefault(); handleUp(); }}
      onTouchCancel={longPress.onTouchCancel}
      disabled={!isArmed || !hasAssignment}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-md transition-all select-none border-2",
        isBig ? "min-h-[72px] rounded-xl" : fs ? "min-h-[100px] rounded-lg" : "min-h-[52px]",
        firing
          ? "bg-red-600 border-red-400 scale-[0.96]"
          : isArmed && hasAssignment
            ? "bg-[hsl(220_12%_12%)] border-border/50 hover:bg-[hsl(220_12%_16%)] active:scale-[0.96] active:bg-red-700/80 cursor-pointer"
            : hasAssignment
              ? "bg-[hsl(220_10%_10%)] border-border/20"
              : "bg-[hsl(220_10%_7%)] border-border/10"
      )}
      style={firing ? { boxShadow: '0 0 20px rgba(255,60,30,0.5)' } : undefined}
    >
      <div className={cn(
        "absolute rounded-full",
        isBig ? "w-2.5 h-2.5 top-1.5 left-1.5" : fs ? "w-3 h-3 top-1.5 left-1.5" : "w-1.5 h-1.5 top-0.5 left-0.5",
        firing ? "bg-red-400" : isArmed && hasAssignment ? "bg-green-500" : "bg-muted-foreground/20"
      )} style={firing ? { boxShadow: '0 0 6px #ff4444' } : isArmed && hasAssignment ? { boxShadow: '0 0 4px #22cc44' } : undefined} />

      {isLocked && (
        <Lock className={cn(
          "absolute text-amber-400/50",
          isBig ? "w-3 h-3 top-1.5 right-1.5" : fs ? "w-3 h-3 top-1.5 right-1.5" : "w-2 h-2 top-0.5 right-0.5"
        )} />
      )}

      <span className={cn(
        "font-mono font-bold",
        isBig ? "text-[9px] mb-0.5" : fs ? "text-xs mb-1" : "text-[8px]",
        firing ? "text-white" : "text-muted-foreground/50"
      )}>KEY{index + 1}</span>

      {cue ? (
        <>
          <span className={cn(
            "font-black uppercase tracking-wide leading-tight text-center px-0.5 truncate w-full",
            isBig ? "text-[10px]" : fs ? "text-sm" : "text-[10px]",
            firing ? "text-white" : "text-foreground/80"
          )} style={{ color: firing ? undefined : cue.keyColor }}>
            {cue.keyLabel || cue.effect}
          </span>
          <span className={cn(
            "font-mono",
            isBig ? "text-[8px] mt-0.5" : fs ? "text-[10px] mt-0.5" : "text-[10px]",
            firing ? "text-red-200" : "text-muted-foreground/40"
          )}>
            {cue.deviceIds.length}dev · {FIRING_RULES.find(r => r.key === cue.firingRule)?.label}
          </span>
        </>
      ) : (
        <span className={cn(isBig ? "text-xs" : fs ? "text-sm" : "text-[8px]", "text-muted-foreground/20")}>—</span>
      )}
    </button>
  );
}
