/**
 * VirtualZK6200 — Showven ZK6200/6300 Host Controller Replica
 * 20 or 30 zone grid, ARM key, DEADMAN, mode selector, DMX addressing
 */
import { useState, useCallback, useRef } from 'react';
import { Shield, Hand, Zap, Radio, Clock, Play, Square, Settings, AlertTriangle, Wifi } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ZKMode = 'manual' | 'timecode' | 'sequence' | 'test';
type ZKModel = '6200' | '6300';

interface VirtualZK6200Props {
  fs?: boolean;
}

export default function VirtualZK6200({ fs = false }: VirtualZK6200Props) {
  const isMobile = useIsMobile();
  const pbus = usePBusHardware();
  const [model, setModel] = useState<ZKModel>('6200');
  const [mode, setMode] = useState<ZKMode>('manual');
  const [armed, setArmed] = useState(false);
  const [deadman, setDeadman] = useState(false);
  const [firingZones, setFiringZones] = useState<Set<number>>(new Set());
  const [dmxBase, setDmxBase] = useState(1);
  const deadmanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const zoneCount = model === '6300' ? 30 : 20;

  const [slavePairing, setSlavePairing] = useState<Record<number, { addr: number; cue: number }>>({});

  const handleArm = useCallback(() => {
    if (armed) {
      setArmed(false);
      setFiringZones(new Set());
      if (pbus.isConnected) pbus.disarmAll().catch(() => {});
      toast.info('ZK' + model + ' DISARMED');
    } else {
      setArmed(true);
      if (pbus.isConnected) pbus.armAll().catch(() => {});
      toast.warning('⚠️ ZK' + model + ' ARMED', { duration: 3000 });
      haptics.arm();
    }
  }, [armed, model, pbus]);

  const handleDeadmanStart = useCallback(() => {
    if (isMobile) {
      deadmanTimer.current = setTimeout(() => {
        setDeadman(true);
        haptics.deadman();
      }, 800);
    } else {
      setDeadman(true);
    }
  }, [isMobile]);

  const handleDeadmanEnd = useCallback(() => {
    if (deadmanTimer.current) { clearTimeout(deadmanTimer.current); deadmanTimer.current = null; }
    setDeadman(false);
  }, []);

  const fireZone = useCallback((zone: number) => {
    if (!armed || !deadman) {
      toast.warning('ARM + DEADMAN necessários');
      return;
    }
    haptics.fire();
    setFiringZones(prev => new Set(prev).add(zone));

    // Route to PBUS hardware if connected and paired
    const pairing = slavePairing[zone];
    if (pbus.isConnected && pairing) {
      pbus.fireCue(pairing.addr, pairing.cue, 2000).catch(() => {});
    }

    // Auto-stop after 2s
    setTimeout(() => {
      setFiringZones(prev => { const n = new Set(prev); n.delete(zone); return n; });
    }, 2000);
    toast.info(`Zone ${zone + 1} FIRED · DMX ${dmxBase + zone * 6}${pairing ? ` · PBUS ${pairing.addr}:${pairing.cue}` : ''}`);
  }, [armed, deadman, dmxBase, pbus, slavePairing]);

  const handlePanic = useCallback(() => {
    setFiringZones(new Set());
    setArmed(false);
    setDeadman(false);
    if (pbus.isConnected) pbus.emergencyStop().catch(() => {});
    haptics.panic();
    toast.error('🚨 ZK' + model + ' EMERGENCY STOP');
  }, [model, pbus]);

  const mob = isMobile;

  return (
    <div className="flex flex-col h-full select-none" style={{ background: 'hsl(220 12% 6%)' }}>
      {/* Header */}
      <div className={cn("flex items-center justify-between border-b border-border/15", fs ? "px-4 py-2.5" : "px-2 py-1.5")} style={{ background: 'hsl(220 15% 8%)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-gradient-to-b from-amber-500 to-amber-700 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-black" />
          </div>
          <div>
            <span className={cn("font-black text-foreground tracking-wider", fs ? "text-xs" : "text-[10px]")}>ZK{model}</span>
            <span className={cn("text-muted-foreground/40 ml-2", fs ? "text-[9px]" : "text-[7px]")}>FX KONTROL</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={model} onValueChange={(v) => setModel(v as ZKModel)}>
            <SelectTrigger className="h-6 w-20 text-[9px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6200">ZK6200</SelectItem>
              <SelectItem value="6300">ZK6300</SelectItem>
            </SelectContent>
          </Select>
          {pbus.isConnected && <Badge variant="outline" className="text-[7px] h-4 px-1 border-green-500/30 text-green-400">LIVE</Badge>}
          {!pbus.isConnected && <Badge variant="outline" className="text-[7px] h-4 px-1">SIM</Badge>}
        </div>
      </div>

      {/* ARM + DEADMAN bar */}
      <div className={cn("flex items-center gap-2 border-b", armed ? "border-red-800/30" : "border-border/15", fs ? "px-4 py-2" : "px-2 py-1.5")} style={{ background: armed ? 'hsl(0 40% 8%)' : 'hsl(220 12% 7%)' }}>
        <button onClick={handleArm}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded border-2 font-black uppercase transition-all",
            mob ? "py-3 text-[11px]" : fs ? "py-2.5 text-xs" : "py-1.5 text-[9px]",
            armed ? "bg-red-600/20 border-red-500/60 text-red-400" : "bg-card/30 border-border/20 text-muted-foreground/40 hover:border-border/40"
          )}>
          <Shield className={cn(mob ? "w-4 h-4" : "w-3.5 h-3.5")} />
          {armed ? 'ARMED ●' : 'ARM KEY'}
        </button>
        <button
          onMouseDown={handleDeadmanStart} onMouseUp={handleDeadmanEnd} onMouseLeave={handleDeadmanEnd}
          onTouchStart={(e) => { e.preventDefault(); handleDeadmanStart(); }}
          onTouchEnd={(e) => { e.preventDefault(); handleDeadmanEnd(); }}
          onTouchCancel={handleDeadmanEnd}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded border-2 font-black uppercase transition-all",
            mob ? "flex-1 py-3 text-[10px]" : fs ? "w-20 py-2.5 text-[10px]" : "w-14 py-1.5 text-[8px]",
            deadman ? "bg-green-600/30 border-green-500/60 text-green-400" : "bg-card/30 border-border/20 text-muted-foreground/30"
          )}>
          <Hand className={cn(mob ? "w-4 h-4" : "w-3 h-3")} />
          {mob && 'DEADMAN'}
        </button>
      </div>

      {/* Mode selector */}
      <div className={cn("flex border-b border-border/15", fs ? "px-2" : "px-1")} style={{ background: 'hsl(220 10% 7%)' }}>
        {(['manual', 'timecode', 'sequence', 'test'] as ZKMode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn(
              "flex-1 font-bold uppercase tracking-wider transition-all border-b-2",
              mob ? "py-2.5 text-[10px]" : fs ? "py-2 text-[9px]" : "py-1.5 text-[7px]",
              mode === m ? "text-foreground/80 border-primary" : "text-muted-foreground/25 border-transparent hover:text-muted-foreground/50"
            )}>{m}</button>
        ))}
      </div>

      {/* Status bar */}
      <div className={cn("flex items-center justify-between border-b border-border/10 text-muted-foreground/40", fs ? "px-4 py-1.5 text-[9px]" : "px-2 py-1 text-[7px]")} style={{ background: 'hsl(220 10% 7%)' }}>
        <span className="font-mono">DMX Base: {dmxBase}</span>
        <span className="font-mono">{zoneCount} Zones</span>
        <span className="font-mono flex items-center gap-1">
          <Wifi className="w-3 h-3" />
          {pbus.isConnected ? `${pbus.deviceCount} slaves` : 'No Link'}
        </span>
      </div>

      {/* Zone grid */}
      <div className={cn("flex-1 overflow-y-auto", fs ? "p-3" : "p-2")}>
        <div className={cn("grid gap-1.5", mob ? "grid-cols-4" : fs ? "grid-cols-5" : "grid-cols-5")}>
          {Array.from({ length: zoneCount }, (_, i) => {
            const isFiring = firingZones.has(i);
            const canFire = armed && deadman;
            return (
              <button
                key={i}
                onMouseDown={() => fireZone(i)}
                onTouchStart={(e) => { e.preventDefault(); fireZone(i); }}
                disabled={!canFire}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border-2 transition-all select-none",
                  mob ? "min-h-[72px] rounded-xl" : fs ? "min-h-[64px]" : "min-h-[48px]",
                  isFiring
                    ? "bg-red-600/30 border-red-400 scale-[0.95]"
                    : canFire
                      ? "bg-card/20 border-border/30 hover:bg-card/40 active:scale-[0.93] active:bg-red-700/40 cursor-pointer"
                      : "bg-card/10 border-border/10 opacity-40"
                )}
                style={isFiring ? { boxShadow: '0 0 16px rgba(255,60,30,0.3)' } : undefined}
              >
                <span className={cn("font-mono font-bold", mob ? "text-lg" : fs ? "text-base" : "text-xs", isFiring ? "text-red-300" : "text-foreground/70")}>
                  {i + 1}
                </span>
                <span className={cn("font-mono text-muted-foreground/30", mob ? "text-[8px]" : "text-[7px]")}>
                  CH {dmxBase + i * 6}
                </span>
                {isFiring && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse rounded-b-lg" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* PANIC */}
      <div className={cn("border-t-2 border-border/20", fs ? "p-3" : "p-2")} style={{ background: 'hsl(220 12% 6%)' }}>
        <button onClick={handlePanic}
          className={cn(
            "w-full rounded-lg font-black uppercase transition-all",
            "bg-gradient-to-b from-red-700 to-red-900 text-white/90 hover:from-red-600 active:scale-[0.97]",
            "border-2 border-red-600/50 flex items-center justify-center gap-2",
            mob ? "h-14 text-base tracking-[0.25em]" : fs ? "h-12 text-sm tracking-[0.2em]" : "h-9 text-[10px] tracking-[0.2em]"
          )}>
          <AlertTriangle className={cn(mob ? "w-5 h-5" : "w-4 h-4")} />
          E-STOP
        </button>
      </div>
    </div>
  );
}
