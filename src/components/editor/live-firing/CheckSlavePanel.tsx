/**
 * Check Slave Panel — Igniter status grid (16 positions per slave)
 * Matches FXcommander Check Slave interface
 */
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Battery, BatteryLow } from 'lucide-react';
import type { SlaveStatus, IgniterStatus } from './types';
import { IGNITER_POSITIONS } from './constants';

interface CheckSlavePanelProps {
  fs: boolean;
  pyroArm: boolean;
}

const DEMO_SLAVES: SlaveStatus[] = Array.from({ length: 4 }, (_, i) => ({
  address: i,
  connected: i < 3,
  batteryVoltage: i < 3 ? 11.2 + Math.random() * 0.8 : undefined,
  signalStrength: i < 3 ? 70 + Math.floor(Math.random() * 30) : undefined,
  igniters: Array.from({ length: 16 }, (_, j) => ({
    position: j,
    connected: i < 3 && Math.random() > 0.15,
    fired: false,
    resistance: i < 3 ? 1.5 + Math.random() * 2.5 : undefined,
  })),
}));

export default function CheckSlavePanel({ fs, pyroArm }: CheckSlavePanelProps) {
  const [slaves, setSlaves] = useState<SlaveStatus[]>(DEMO_SLAVES);
  const [selectedSlave, setSelectedSlave] = useState<number>(0);
  const [scanning, setScanning] = useState(false);
  const [sceneName] = useState('Manual Fire SCENE0');

  const handleScan = useCallback(() => {
    setScanning(true);
    setTimeout(() => {
      setSlaves(prev => prev.map(s => ({
        ...s,
        igniters: s.igniters.map(ig => ({
          ...ig,
          connected: s.connected && Math.random() > 0.1,
        })),
      })));
      setScanning(false);
    }, 1500);
  }, []);

  const currentSlave = slaves[selectedSlave];
  const totalConnected = currentSlave?.igniters.filter(i => i.connected).length ?? 0;
  const totalPositions = IGNITER_POSITIONS;

  const hexLabel = (n: number) => n.toString(16).toUpperCase();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b border-border/15",
        fs ? "px-4 py-2" : "px-2 py-1"
      )} style={{ background: 'hsl(220 10% 8%)' }}>
        <div className="flex items-center gap-2">
          <span className={cn("font-bold text-muted-foreground/50 uppercase tracking-wider", fs ? "text-[10px]" : "text-[8px]")}>Check Slave</span>
          <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[9px]" : "text-[8px]")}>{sceneName}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleScan} disabled={scanning}
          className={cn(fs ? "h-7 w-7" : "h-5 w-5")}>
          <RefreshCw className={cn(fs ? "w-3.5 h-3.5" : "w-2.5 h-2.5", scanning && "animate-spin")} />
        </Button>
      </div>

      {/* Slave selector */}
      <div className={cn(
        "flex gap-1 border-b border-border/15",
        fs ? "px-4 py-2" : "px-2 py-1"
      )} style={{ background: 'hsl(220 12% 7%)' }}>
        {slaves.map((slave, i) => (
          <button key={i} onClick={() => setSelectedSlave(i)}
            className={cn(
              "flex items-center gap-1 rounded border transition-all",
              fs ? "px-3 py-2 text-[10px]" : "px-2 py-1 text-[8px]",
              selectedSlave === i
                ? "bg-primary/15 border-primary/40 text-primary"
                : slave.connected
                  ? "bg-surface-2/30 border-border/15 text-foreground/50 hover:bg-surface-3/40"
                  : "bg-surface-1/10 border-border/5 text-muted-foreground/20"
            )}>
            {slave.connected ? <Wifi className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-green-400/60")} /> : <WifiOff className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5")} />}
            <span className="font-bold">Addr {String(i).padStart(2, '0')}</span>
          </button>
        ))}
      </div>

      {/* Slave info */}
      {currentSlave && (
        <div className={cn(
          "flex items-center gap-3 border-b border-border/15",
          fs ? "px-4 py-2 text-[9px]" : "px-2 py-1 text-[8px]"
        )} style={{ background: 'hsl(220 10% 7%)' }}>
          <div className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", currentSlave.connected ? "bg-green-500" : "bg-red-500")} />
            <span className={cn("font-bold", currentSlave.connected ? "text-green-400/70" : "text-red-400/70")}>
              {currentSlave.connected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
          {currentSlave.batteryVoltage && (
            <div className="flex items-center gap-1 text-muted-foreground/40">
              {currentSlave.batteryVoltage > 11 ?
                <Battery className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-green-400/60")} /> :
                <BatteryLow className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-amber-400")} />}
              <span className="font-mono">{currentSlave.batteryVoltage.toFixed(2)}V</span>
            </div>
          )}
          {currentSlave.signalStrength !== undefined && (
            <span className="text-muted-foreground/40 font-mono">RF: {currentSlave.signalStrength}%</span>
          )}
          <span className={cn(
            "font-bold ml-auto",
            totalConnected === totalPositions ? "text-green-400/70" : totalConnected > 0 ? "text-amber-400/70" : "text-red-400/70"
          )}>
            {totalConnected}/{totalPositions} igniters
          </span>
        </div>
      )}

      {/* Igniter grid — 4x4 (positions 0-F) */}
      <div className={cn(
        "flex-1 flex items-center justify-center",
        fs ? "p-6" : "p-3"
      )}>
        {currentSlave ? (
          <div className={cn("grid grid-cols-4", fs ? "gap-3" : "gap-1.5")} style={{ maxWidth: fs ? 400 : 220 }}>
            {currentSlave.igniters.map((ig) => (
              <div key={ig.position} className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 transition-all",
                fs ? "h-20 w-20" : "h-12 w-12",
                ig.fired ? "bg-amber-600/20 border-amber-500/50" :
                ig.connected ? "bg-green-600/15 border-green-500/40" :
                "bg-red-600/10 border-red-500/20"
              )}>
                {/* Position label */}
                <span className={cn(
                  "font-mono font-black",
                  fs ? "text-lg" : "text-xs",
                  ig.connected ? "text-foreground/70" : "text-muted-foreground/20"
                )}>
                  {hexLabel(ig.position)}
                </span>
                {/* Status indicator */}
                <div className={cn(
                  "absolute top-1 right-1 rounded-full",
                  fs ? "w-2.5 h-2.5" : "w-1.5 h-1.5",
                  ig.fired ? "bg-amber-400 shadow-[0_0_4px_#ffaa00]" :
                  ig.connected ? "bg-green-500 shadow-[0_0_4px_#22cc44]" :
                  "bg-red-500/40"
                )} />
                {/* Resistance */}
                {ig.resistance !== undefined && ig.connected && (
                  <span className={cn(
                    "font-mono text-muted-foreground/30",
                    fs ? "text-[8px]" : "text-[8px]"
                  )}>
                    {ig.resistance.toFixed(1)}Ω
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground/20 text-sm">No slave selected</span>
        )}
      </div>

      {/* Legend */}
      <div className={cn(
        "flex items-center justify-center gap-4 border-t border-border/15",
        fs ? "py-2 text-[9px]" : "py-1 text-[8px]"
      )} style={{ background: 'hsl(220 12% 6%)' }}>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-muted-foreground/40">Connected</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500/40" /><span className="text-muted-foreground/40">Missing</span></div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-muted-foreground/40">Fired</span></div>
      </div>
    </div>
  );
}
