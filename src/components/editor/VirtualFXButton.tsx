/**
 * VirtualFXButton — Showven FXbutton/PyroMote Wireless Remote Replica
 * 1/4/8 channel modes with slide-to-unlock safety and haptic feedback
 */
import { useState, useCallback, useRef } from 'react';
import { Radio, Lock, Unlock, Signal, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ButtonMode = '1' | '4' | '8';

const BUTTON_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];

interface VirtualFXButtonProps {
  fs?: boolean;
}

export default function VirtualFXButton({ fs = false }: VirtualFXButtonProps) {
  const isMobile = useIsMobile();
  const pbus = usePBusHardware();
  const [mode, setMode] = useState<ButtonMode>('4');
  const [unlocked, setUnlocked] = useState(false);
  const [firing, setFiring] = useState<Set<number>>(new Set());
  const [slideProgress, setSlideProgress] = useState(0);
  const slideRef = useRef<{ startX: number } | null>(null);
  const [pairing, setPairing] = useState<Record<number, { deviceAddr: number; cueIndex: number }>>({});

  const buttonCount = parseInt(mode);

  const handleSlideStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    slideRef.current = { startX: x };
    setSlideProgress(0);
  }, []);

  const handleSlideMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!slideRef.current) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const dx = x - slideRef.current.startX;
    const pct = Math.max(0, Math.min(100, (dx / 200) * 100));
    setSlideProgress(pct);
    if (pct >= 100) {
      setUnlocked(true);
      slideRef.current = null;
      setSlideProgress(0);
      if (navigator.vibrate) navigator.vibrate([50, 20, 50]);
      toast.success('🔓 FXbutton UNLOCKED');
    }
  }, []);

  const handleSlideEnd = useCallback(() => {
    slideRef.current = null;
    if (slideProgress < 100) setSlideProgress(0);
  }, [slideProgress]);

  const handleFire = useCallback((idx: number) => {
    if (!unlocked) { toast.warning('Deslize para desbloquear primeiro'); return; }
    if (navigator.vibrate) navigator.vibrate(30);
    setFiring(prev => new Set(prev).add(idx));

    // Route to PBUS hardware if paired and connected
    const pair = pairing[idx];
    if (pbus.isConnected && pair) {
      pbus.fireCue(pair.deviceAddr, pair.cueIndex, 1500).catch(() => {});
    }

    setTimeout(() => {
      setFiring(prev => { const n = new Set(prev); n.delete(idx); return n; });
    }, 1500);
    toast.info(`CH ${idx + 1} FIRED${pair ? ` · PBUS ${pair.deviceAddr}:${pair.cueIndex}` : ''}`);
  }, [unlocked, pbus, pairing]);

  const mob = isMobile;

  return (
    <div className="flex flex-col h-full select-none" style={{ background: 'hsl(220 12% 6%)' }}>
      {/* Header */}
      <div className={cn("flex items-center justify-between border-b border-border/15", fs ? "px-4 py-2.5" : "px-2 py-1.5")} style={{ background: 'hsl(220 15% 8%)' }}>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <span className={cn("font-black text-foreground tracking-wider", fs ? "text-xs" : "text-[10px]")}>FXbutton™</span>
          <Badge variant={unlocked ? 'default' : 'outline'} className={cn("text-[7px] h-4 px-1.5", unlocked ? 'bg-green-600/80' : '')}>
            {unlocked ? 'UNLOCKED' : 'LOCKED'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mode} onValueChange={(v) => { setMode(v as ButtonMode); setUnlocked(false); }}>
            <SelectTrigger className="h-6 w-16 text-[9px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 CH</SelectItem>
              <SelectItem value="4">4 CH</SelectItem>
              <SelectItem value="8">8 CH</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Signal className={cn("w-3 h-3", pbus.isConnected ? 'text-green-400' : 'text-muted-foreground/20')} />
            <span className={cn("text-[8px] font-mono", pbus.isConnected ? 'text-green-400/70' : 'text-muted-foreground/30')}>
              {pbus.isConnected ? 'PAIRED' : 'UNPAIRED'}
            </span>
          </div>
        </div>
      </div>

      {/* Slide to unlock */}
      {!unlocked && (
        <div className={cn("border-b border-border/15", fs ? "px-6 py-4" : "px-3 py-3")} style={{ background: 'hsl(220 10% 7%)' }}>
          <div
            className="relative h-12 rounded-full bg-muted/10 border border-border/20 overflow-hidden cursor-pointer"
            onMouseDown={handleSlideStart}
            onMouseMove={handleSlideMove}
            onMouseUp={handleSlideEnd}
            onMouseLeave={handleSlideEnd}
            onTouchStart={handleSlideStart}
            onTouchMove={handleSlideMove}
            onTouchEnd={handleSlideEnd}
          >
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30 text-[10px] font-bold uppercase tracking-widest select-none pointer-events-none">
              Deslize para desbloquear →
            </div>
            <div
              className="absolute left-1 top-1 bottom-1 w-10 rounded-full bg-primary/80 flex items-center justify-center transition-transform"
              style={{ transform: `translateX(${(slideProgress / 100) * 150}px)` }}
            >
              <Lock className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        </div>
      )}

      {/* Lock button when unlocked */}
      {unlocked && (
        <div className={cn("flex justify-end border-b border-border/15", fs ? "px-4 py-1.5" : "px-2 py-1")} style={{ background: 'hsl(120 30% 8%)' }}>
          <button onClick={() => { setUnlocked(false); setFiring(new Set()); toast.info('🔒 FXbutton locked'); }}
            className="flex items-center gap-1 text-[9px] text-amber-400/60 hover:text-amber-400 transition-colors">
            <Unlock className="w-3 h-3" /> Bloquear
          </button>
        </div>
      )}

      {/* Fire buttons */}
      <div className={cn("flex-1 overflow-y-auto", fs ? "p-4" : "p-3")}>
        <div className={cn("grid gap-3", buttonCount <= 4 ? (mob ? "grid-cols-2" : "grid-cols-2") : (mob ? "grid-cols-2" : "grid-cols-4"))}>
          {Array.from({ length: buttonCount }, (_, i) => {
            const isFiring = firing.has(i);
            const color = BUTTON_COLORS[i % BUTTON_COLORS.length];
            return (
              <button
                key={i}
                onMouseDown={() => handleFire(i)}
                onTouchStart={(e) => { e.preventDefault(); handleFire(i); }}
                disabled={!unlocked}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-2xl border-2 transition-all select-none",
                  buttonCount === 1 ? "min-h-[200px]" : mob ? "min-h-[100px]" : fs ? "min-h-[90px]" : "min-h-[70px]",
                  isFiring
                    ? "scale-[0.93]"
                    : unlocked
                      ? "hover:scale-[1.02] active:scale-[0.93] cursor-pointer"
                      : "opacity-30"
                )}
                style={{
                  backgroundColor: isFiring ? color + '40' : color + '15',
                  borderColor: isFiring ? color : color + '40',
                  boxShadow: isFiring ? `0 0 24px ${color}60` : undefined,
                }}
              >
                <Zap className={cn(
                  mob ? "w-8 h-8" : fs ? "w-6 h-6" : "w-5 h-5",
                  isFiring && "animate-pulse"
                )} style={{ color: isFiring ? '#fff' : color }} />
                <span className={cn(
                  "font-black uppercase mt-1",
                  mob ? "text-base" : fs ? "text-sm" : "text-xs"
                )} style={{ color: isFiring ? '#fff' : color + 'cc' }}>
                  CH {i + 1}
                </span>
                {isFiring && (
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 animate-ping opacity-20" style={{ backgroundColor: color }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
