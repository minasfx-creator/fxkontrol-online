/**
 * PBUS Monitor Panel — Showven PyroSlave C16/X4 Control
 * Dual-band RSSI, 16-cue continuity grid, ARM/FIRE with deadman
 * Mobile-responsive with touch DEADMAN (800ms long-press)
 */

import { useState, useCallback, useRef } from 'react';
import { Radio, Battery, Shield, Zap, Signal, AlertTriangle, Wifi, WifiOff, RefreshCw, XCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePBusHardware } from '@/hooks/usePBusHardware';
import type { PBusDevice, PBusWirelessBand } from '@/lib/pbusProtocol';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function getRssiColor(rssi: number): string {
  if (rssi >= -60) return 'text-emerald-400';
  if (rssi >= -75) return 'text-amber-400';
  return 'text-red-400';
}

function getRssiBar(rssi: number): number {
  return Math.max(0, Math.min(100, ((rssi + 100) / 40) * 100));
}

function getCueColor(connected: boolean, fired: boolean, resistance: number): string {
  if (fired) return 'bg-muted-foreground/40 border-muted-foreground/60';
  if (!connected) return 'bg-red-500/20 border-red-500/40';
  if (resistance < 5) return 'bg-amber-500/20 border-amber-500/40'; // short
  return 'bg-emerald-500/20 border-emerald-500/40'; // good
}

function DeviceCard({ device, onArm, onDisarm, onFire, onCueStatus, onSetBand, isMobile }: {
  device: PBusDevice;
  onArm: (addr: number) => void;
  onDisarm: (addr: number) => void;
  onFire: (addr: number, cue: number) => void;
  onCueStatus: (addr: number) => void;
  onSetBand: (addr: number, band: PBusWirelessBand) => void;
  isMobile: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [deadman, setDeadman] = useState(false);
  const [deadmanProgress, setDeadmanProgress] = useState(0);
  const deadmanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadmanAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startDeadman = useCallback(() => {
    if (isMobile) {
      // 800ms long-press with progress ring
      let progress = 0;
      deadmanAnimRef.current = setInterval(() => {
        progress += 5;
        setDeadmanProgress(Math.min(100, (progress / 80) * 100));
      }, 50);
      deadmanTimer.current = setTimeout(() => {
        setDeadman(true);
        setDeadmanProgress(100);
        if (deadmanAnimRef.current) clearInterval(deadmanAnimRef.current);
        if (navigator.vibrate) navigator.vibrate([100]);
      }, 800);
    } else {
      setDeadman(true);
    }
  }, [isMobile]);

  const endDeadman = useCallback(() => {
    if (deadmanTimer.current) { clearTimeout(deadmanTimer.current); deadmanTimer.current = null; }
    if (deadmanAnimRef.current) { clearInterval(deadmanAnimRef.current); deadmanAnimRef.current = null; }
    setDeadman(false);
    setDeadmanProgress(0);
  }, []);

  return (
    <div className="rounded-lg border border-border/20 bg-card/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/5 transition-colors"
      >
        <Radio className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-bold text-foreground">
          {device.type} #{device.address}
        </span>
        <Badge variant={device.armed ? 'destructive' : 'outline'} className="text-[8px] h-4 px-1.5 ml-1">
          {device.armed ? 'ARMED' : 'SAFE'}
        </Badge>

        {/* Battery */}
        <div className="ml-auto flex items-center gap-1.5 text-[9px]">
          <Battery className={cn("w-3 h-3", device.batteryV >= 11.5 ? 'text-emerald-400' : device.batteryV >= 11 ? 'text-amber-400' : 'text-red-400')} />
          <span className="text-muted-foreground">{device.batteryV.toFixed(1)}V</span>
        </div>

        {/* Dual-band RSSI */}
        <div className="flex items-center gap-1 text-[8px]">
          <span className={getRssiColor(device.rssi433)}>433:{device.rssi433}dBm</span>
          <span className="text-muted-foreground/30">|</span>
          <span className={getRssiColor(device.rssi868)}>868:{device.rssi868}dBm</span>
        </div>

        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", !expanded && "-rotate-90")} />
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Band selector */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-muted-foreground">Band:</span>
            <Select value={device.activeBand} onValueChange={(v) => onSetBand(device.address, v as PBusWirelessBand)}>
              <SelectTrigger className="h-6 text-[9px] w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="433M">433 MHz</SelectItem>
                <SelectItem value="868M">868 MHz</SelectItem>
                <SelectItem value="dual">Auto (Dual)</SelectItem>
              </SelectContent>
            </Select>

            {/* RSSI bars */}
            <div className="flex-1 flex items-center gap-1">
              <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", device.rssi433 >= -60 ? 'bg-emerald-500' : device.rssi433 >= -75 ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width: `${getRssiBar(device.rssi433)}%` }} />
              </div>
              <div className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", device.rssi868 >= -60 ? 'bg-emerald-500' : device.rssi868 >= -75 ? 'bg-amber-500' : 'bg-red-500')}
                  style={{ width: `${getRssiBar(device.rssi868)}%` }} />
              </div>
            </div>
          </div>

          {/* Cue grid — 4x4 on mobile, 8x2 on desktop */}
          <div className={cn("grid gap-1", isMobile ? "grid-cols-4" : "grid-cols-8")}>
            {Array.from({ length: device.channels }, (_, i) => {
              const cue = device.cueStates[i];
              const color = cue ? getCueColor(cue.connected, cue.fired, cue.resistance) : 'bg-muted/20 border-muted/40';
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (device.armed && deadman) {
                      onFire(device.address, i);
                      if (navigator.vibrate) navigator.vibrate(30);
                    } else toast.warning('ARM + DEADMAN required to fire');
                  }}
                  className={cn(
                    "rounded border text-[9px] font-mono font-bold transition-all hover:scale-105 active:scale-95",
                    isMobile ? "h-12 text-xs" : "h-8",
                    color,
                    device.armed && deadman && "cursor-crosshair"
                  )}
                  title={cue ? `Cue ${i + 1}: ${cue.resistance.toFixed(1)}Ω ${cue.connected ? 'OK' : 'OPEN'} ${cue.fired ? '(FIRED)' : ''}` : `Cue ${i + 1}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Controls */}
          <div className={cn("flex items-center gap-1.5", isMobile && "flex-col")}>
            <div className="flex items-center gap-1.5 w-full">
              <Button size="sm" variant="outline" className={cn("text-[9px] flex-1", isMobile ? "h-10" : "h-7")} onClick={() => onCueStatus(device.address)}>
                <RefreshCw className="w-3 h-3 mr-1" /> Continuity
              </Button>
              {device.armed ? (
                <Button size="sm" variant="outline" className={cn("text-[9px] flex-1 border-emerald-500/30 text-emerald-400", isMobile ? "h-10" : "h-7")} onClick={() => onDisarm(device.address)}>
                  <Shield className="w-3 h-3 mr-1" /> DISARM
                </Button>
              ) : (
                <Button size="sm" variant="destructive" className={cn("text-[9px] flex-1", isMobile ? "h-10" : "h-7")} onClick={() => onArm(device.address)}>
                  <Zap className="w-3 h-3 mr-1" /> ARM
                </Button>
              )}
            </div>
            <Button
              size="sm"
              variant={deadman ? 'destructive' : 'outline'}
              className={cn(
                "text-[9px] px-4 relative overflow-hidden",
                isMobile ? "h-14 w-full text-sm font-black" : "h-7",
                deadman && "animate-pulse"
              )}
              onMouseDown={startDeadman}
              onMouseUp={endDeadman}
              onMouseLeave={endDeadman}
              onTouchStart={(e) => { e.preventDefault(); startDeadman(); }}
              onTouchEnd={(e) => { e.preventDefault(); endDeadman(); }}
              onTouchCancel={endDeadman}
            >
              {isMobile && deadmanProgress > 0 && deadmanProgress < 100 && (
                <div className="absolute inset-0 bg-red-500/20 transition-all" style={{ width: `${deadmanProgress}%` }} />
              )}
              <span className="relative z-10">DEADMAN{isMobile && !deadman ? ' (pressione 0.8s)' : ''}</span>
            </Button>
          </div>

          {/* FW & Serial */}
          <div className="flex items-center gap-2 text-[8px] text-muted-foreground/50">
            <span>FW: {device.firmwareVersion}</span>
            {device.serialNumber && <span>S/N: {device.serialNumber}</span>}
            <span className="ml-auto">{device.channels} cues</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PBusMonitorPanel() {
  const isMobile = useIsMobile();
  const pbus = usePBusHardware();
  const deviceList = Array.from(pbus.devices.values());
  const [estopHeld, setEstopHeld] = useState(false);
  const estopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEstopStart = useCallback(() => {
    if (isMobile) {
      estopTimer.current = setTimeout(() => {
        pbus.emergencyStop();
        toast.error('🔴 EMERGENCY STOP — All devices disarmed');
        if (navigator.vibrate) navigator.vibrate([200, 50, 200]);
        setEstopHeld(false);
      }, 500);
      setEstopHeld(true);
    } else {
      pbus.emergencyStop();
      toast.error('🔴 EMERGENCY STOP — All devices disarmed');
    }
  }, [isMobile, pbus]);

  const handleEstopEnd = useCallback(() => {
    if (estopTimer.current) { clearTimeout(estopTimer.current); estopTimer.current = null; }
    setEstopHeld(false);
  }, []);

  const handleConnect = useCallback(async () => {
    try {
      await pbus.connect();
      toast.success('PBUS connected — scanning devices...');
      await pbus.discoverDevices(64);
      toast.success(`Found ${pbus.deviceCount} PBUS devices`);
    } catch (err: any) {
      toast.error(`PBUS: ${err.message}`);
    }
  }, [pbus]);

  return (
    <div className="space-y-2">
      {/* Connection bar */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-border/20 bg-card/30">
        {pbus.isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
        )}
        <span className="text-[10px] font-bold text-foreground flex-1">
          PBUS {pbus.isConnected ? `— ${pbus.deviceCount} devices` : '— Disconnected'}
        </span>
        {pbus.isConnected && (
          <Badge variant="outline" className="text-[8px] h-4 px-1.5">
            Best: {pbus.bestBand}
          </Badge>
        )}
        {pbus.isConnected ? (
          <>
            <Button size="sm" variant="ghost" className="h-6 text-[9px] px-2" onClick={() => pbus.discoverDevices(64)}>
              <RefreshCw className={cn("w-3 h-3", pbus.scanning && "animate-spin")} />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[9px] px-2 text-red-400" onClick={pbus.disconnect}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" className="h-6 text-[9px] px-3" onClick={handleConnect}>
            Connect PBUS
          </Button>
        )}
      </div>

      {/* E-STOP — long-press on mobile */}
      {pbus.isConnected && (
        <Button
          variant="destructive"
          className={cn("w-full font-black tracking-wider", isMobile ? "h-14 text-base" : "h-8 text-[10px]")}
          onMouseDown={handleEstopStart}
          onMouseUp={handleEstopEnd}
          onMouseLeave={handleEstopEnd}
          onTouchStart={(e) => { e.preventDefault(); handleEstopStart(); }}
          onTouchEnd={(e) => { e.preventDefault(); handleEstopEnd(); }}
          onTouchCancel={handleEstopEnd}
        >
          <XCircle className={cn(isMobile ? "w-5 h-5" : "w-3.5 h-3.5", "mr-1.5")} />
          EMERGENCY STOP {isMobile ? '(pressione 0.5s)' : ''}
        </Button>
      )}

      {/* Device list — horizontal scroll-snap on mobile */}
      {pbus.isConnected && (
        <ScrollArea className={cn(isMobile ? "max-h-[500px]" : "max-h-[400px]")}>
          <div className={cn("space-y-2", isMobile && "snap-x snap-mandatory")}>
            {deviceList.length === 0 && !pbus.scanning && (
              <div className="text-center py-6 text-[10px] text-muted-foreground/50">
                <Radio className="w-6 h-6 mx-auto mb-2 opacity-30" />
                No PBUS devices found. Click refresh to scan.
              </div>
            )}
            {pbus.scanning && deviceList.length === 0 && (
              <div className="text-center py-6 text-[10px] text-muted-foreground">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
                Scanning PBUS addresses 1-64...
              </div>
            )}
            {deviceList.map(d => (
              <DeviceCard
                key={d.address}
                device={d}
                onArm={pbus.armDevice}
                onDisarm={pbus.disarmDevice}
                onFire={pbus.fireCue}
                onCueStatus={pbus.requestCueStatus}
                onSetBand={pbus.setBand}
                isMobile={isMobile}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Stats footer */}
      {pbus.isConnected && (
        <div className="flex items-center justify-between text-[8px] text-muted-foreground/40 px-1">
          <span>TX: {(pbus.txBytes / 1024).toFixed(1)}KB</span>
          <span>RX: {(pbus.rxBytes / 1024).toFixed(1)}KB</span>
          {pbus.worstBattery !== null && (
            <span className={pbus.worstBattery < 11 ? 'text-red-400' : ''}>
              Worst batt: {pbus.worstBattery.toFixed(1)}V
            </span>
          )}
        </div>
      )}
    </div>
  );
}
