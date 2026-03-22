/**
 * VirtualIFMx32QPanel — Full visual replica of IFMx-i32Q field module
 * 32-igniter grid, LCD address, status LEDs, CDS charge, ARM/DISARM
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Power, Zap, Shield, ShieldAlert, Wifi, Usb, Radio, Battery, Signal, AlertTriangle, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFireOneModuleMode } from '@/hooks/useFireOneModuleMode';
import { useIsMobile } from '@/hooks/use-mobile';

interface VirtualIFMx32QProps {
  fs?: boolean;
}

const PIN_LABELS = Array.from({ length: 32 }, (_, i) => (i + 1).toString().padStart(2, '0'));

export default function VirtualIFMx32QPanel({ fs = false }: VirtualIFMx32QProps) {
  const mob = useIsMobile();
  const module = useFireOneModuleMode();
  const { status, powered, bridgeStatus } = module;
  const [selectedPins, setSelectedPins] = useState<Set<number>>(new Set());
  const [fireDuration, setFireDuration] = useState(200);
  const [flashPins, setFlashPins] = useState<Set<number>>(new Set());

  // Flash effect on fire
  const flashPin = useCallback((pin: number) => {
    setFlashPins(prev => new Set(prev).add(pin));
    setTimeout(() => setFlashPins(prev => {
      const next = new Set(prev);
      next.delete(pin);
      return next;
    }), fireDuration + 100);
  }, [fireDuration]);

  const handleFire = useCallback(async (pin: number) => {
    if (!status?.firePowerOn) {
      toast.error('Módulo não armado');
      return;
    }
    const ok = await module.fire(pin, fireDuration);
    if (ok) flashPin(pin);
  }, [status, module, fireDuration, flashPin]);

  const handleFireSelected = useCallback(async () => {
    if (selectedPins.size === 0) return;
    const pins = Array.from(selectedPins);
    const results = await module.fireGroup(pins, fireDuration);
    results.forEach((ok, i) => { if (ok) flashPin(pins[i]); });
    setSelectedPins(new Set());
  }, [selectedPins, module, fireDuration, flashPin]);

  const togglePin = useCallback((pin: number) => {
    setSelectedPins(prev => {
      const next = new Set(prev);
      next.has(pin) ? next.delete(pin) : next.add(pin);
      return next;
    });
  }, []);

  const handleContinuityCheck = useCallback(async () => {
    toast.info('Verificando continuidade...');
    await module.readAllContinuity();
    toast.success('Continuidade verificada');
  }, [module]);

  const getIgniterColor = (pin: number) => {
    if (!status) return 'bg-muted/20 border-border/20';
    const ig = status.igniters[pin];
    if (!ig) return 'bg-muted/20 border-border/20';
    if (flashPins.has(pin)) return 'bg-amber-500/80 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]';
    if (ig.fired) return 'bg-muted/10 border-muted/20 opacity-40';
    if (!ig.connected) return 'bg-red-950/30 border-red-800/30';
    if (ig.cdsVoltage < 8) return 'bg-amber-950/30 border-amber-700/30';
    return 'bg-emerald-950/30 border-emerald-600/40';
  };

  const getCdsPercent = (pin: number) => {
    if (!status) return 0;
    const ig = status.igniters[pin];
    return ig ? Math.round((ig.cdsVoltage / 11.5) * 100) : 0;
  };

  const connectedCount = status?.igniters.filter(i => i.connected && !i.fired).length ?? 0;
  const firedCount = status?.igniters.filter(i => i.fired).length ?? 0;
  const chargedCount = status?.igniters.filter(i => i.cdsVoltage >= 8 && !i.fired).length ?? 0;

  return (
    <div className={cn("flex flex-col gap-2", fs ? "p-4" : "p-2")}>
      {/* Module Header — LCD + Power */}
      <div className={cn(
        "rounded-xl border-2 transition-all",
        status?.firePowerOn
          ? "border-red-500/60 bg-red-950/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
          : powered
            ? "border-emerald-500/40 bg-card/50"
            : "border-border/20 bg-card/30"
      )}>
        <div className="p-3 space-y-2">
          {/* Top bar: Power + LCD + Status LEDs */}
          <div className="flex items-center gap-3">
            {/* Power button */}
            <button
              onClick={powered ? module.powerOff : module.powerOn}
              className={cn(
                "rounded-full w-10 h-10 flex items-center justify-center transition-all border-2",
                powered
                  ? "bg-emerald-600/20 border-emerald-500/60 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                  : "bg-muted/10 border-border/30 text-muted-foreground/40 hover:border-border/60"
              )}
            >
              <Power className="w-5 h-5" />
            </button>

            {/* LCD Address Display */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => module.setAddress((status?.address ?? 1) - 1)}
                className="rounded px-1 py-0.5 bg-muted/10 hover:bg-muted/20 text-muted-foreground/50"
                disabled={!powered}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className={cn(
                "font-mono font-black text-2xl px-3 py-1 rounded-lg border min-w-[60px] text-center",
                powered
                  ? "bg-black border-emerald-800/40 text-emerald-400 shadow-[inset_0_0_8px_rgba(16,185,129,0.1)]"
                  : "bg-black/50 border-border/20 text-muted-foreground/20"
              )}>
                {powered ? String(status?.address ?? 1).padStart(2, '0') : '--'}
              </div>
              <button
                onClick={() => module.setAddress((status?.address ?? 1) + 1)}
                className="rounded px-1 py-0.5 bg-muted/10 hover:bg-muted/20 text-muted-foreground/50"
                disabled={!powered}
              >
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>

            {/* Status LEDs */}
            <div className="flex flex-col gap-0.5 ml-auto">
              {[
                { label: 'F.P', active: status?.firePowerOn, color: 'bg-red-500', glow: 'shadow-[0_0_6px_rgba(239,68,68,0.6)]' },
                { label: 'COM', active: status?.communicating, color: 'bg-green-500', glow: 'shadow-[0_0_6px_rgba(16,185,129,0.6)]' },
                { label: 'RF', active: status?.rfActive || bridgeStatus?.connected, color: 'bg-blue-400', glow: 'shadow-[0_0_6px_rgba(96,165,250,0.6)]' },
                { label: 'CHG', active: status?.charging, color: 'bg-amber-400', glow: 'shadow-[0_0_6px_rgba(251,191,36,0.6)]' },
              ].map(led => (
                <div key={led.label} className="flex items-center gap-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    led.active ? cn(led.color, led.glow) : "bg-muted/20"
                  )} />
                  <span className="text-[7px] font-bold text-muted-foreground/50 uppercase">{led.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info bar */}
          {powered && status && (
            <div className="flex items-center gap-3 text-[8px] text-muted-foreground/50">
              <span className="flex items-center gap-0.5">
                <Battery className="w-3 h-3" />
                <span className={status.batteryVoltage < 10 ? 'text-destructive' : ''}>{status.batteryVoltage.toFixed(1)}V</span>
              </span>
              <span>
                {connectedCount} conectados · {firedCount} disparados · {chargedCount} carregados
              </span>
              {status.safeSenseProgress < 100 && status.state === 'safe_sense' && (
                <span className="text-amber-400">Safe-Sense: {Math.round(status.safeSenseProgress)}%</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ARM / DISARM / E-STOP Controls */}
      {powered && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={status?.firePowerOn ? 'destructive' : 'default'}
            className={cn(
              "flex-1 font-black uppercase text-xs",
              status?.firePowerOn
                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                : "bg-emerald-700 hover:bg-emerald-600"
            )}
            onClick={() => status?.firePowerOn ? module.disarm() : module.arm()}
            disabled={status?.state === 'safe_sense' || status?.state === 'idle'}
          >
            {status?.firePowerOn ? (
              <><ShieldAlert className="w-4 h-4 mr-1" /> ARMED</>
            ) : (
              <><Shield className="w-4 h-4 mr-1" /> ARM</>
            )}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="font-black uppercase text-xs px-4"
            onClick={module.eStop}
          >
            <AlertTriangle className="w-4 h-4 mr-1" /> E-STOP
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={handleContinuityCheck}
          >
            <Activity className="w-3 h-3 mr-1" /> CONT
          </Button>
        </div>
      )}

      {/* 32-Igniter Grid (4 columns × 8 rows) */}
      {powered && status && (
        <div className="grid grid-cols-4 gap-1">
          {status.igniters.map((ig, pin) => (
            <button
              key={pin}
              onClick={() => status.firePowerOn ? handleFire(pin) : togglePin(pin)}
              onContextMenu={(e) => { e.preventDefault(); togglePin(pin); }}
              className={cn(
                "relative rounded-lg border transition-all",
                "flex flex-col items-center justify-center",
                mob ? "h-14" : fs ? "h-12" : "h-10",
                getIgniterColor(pin),
                selectedPins.has(pin) && "ring-2 ring-primary/60",
                !ig.fired && ig.connected && status.firePowerOn && "hover:brightness-125 active:scale-95 cursor-pointer"
              )}
            >
              <span className={cn("font-mono font-bold", fs ? "text-xs" : "text-[9px]")}>
                {PIN_LABELS[pin]}
              </span>
              {/* Resistance */}
              {ig.connected && !ig.fired && (
                <span className="text-[6px] text-muted-foreground/40">{ig.resistance.toFixed(1)}Ω</span>
              )}
              {ig.fired && (
                <span className="text-[6px] text-muted-foreground/30">FIRED</span>
              )}
              {/* CDS charge bar */}
              {!ig.fired && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 rounded-b-lg overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all",
                      ig.cdsVoltage >= 8 ? "bg-emerald-500/60" : ig.cdsVoltage >= 4 ? "bg-amber-500/60" : "bg-red-500/40"
                    )}
                    style={{ width: `${getCdsPercent(pin)}%` }}
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Fire selected group */}
      {powered && selectedPins.size > 0 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            className="flex-1 font-black"
            onClick={handleFireSelected}
            disabled={!status?.firePowerOn}
          >
            <Zap className="w-4 h-4 mr-1" /> FIRE {selectedPins.size} SELECIONADOS
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-muted-foreground/50">Dur:</span>
            <input
              type="number"
              value={fireDuration}
              onChange={e => setFireDuration(Math.max(20, Math.min(1000, parseInt(e.target.value) || 200)))}
              className="w-14 h-6 text-[9px] bg-muted/10 border border-border/20 rounded px-1 text-center"
            />
            <span className="text-[7px] text-muted-foreground/40">ms</span>
          </div>
        </div>
      )}

      {/* Hardware Bridge Status */}
      <div className={cn(
        "rounded-lg border p-2 space-y-1",
        bridgeStatus?.connected
          ? "border-emerald-500/30 bg-emerald-950/10"
          : "border-border/15 bg-card/20"
      )}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Hardware Bridge</span>
          <Badge
            variant={bridgeStatus?.connected ? 'default' : 'outline'}
            className={cn("text-[7px] h-3.5", bridgeStatus?.connected ? "bg-emerald-600/80" : "")}
          >
            {bridgeStatus?.connected ? `${bridgeStatus.transport.toUpperCase()} · ${bridgeStatus.deviceName}` : 'SIM'}
          </Badge>
        </div>
        <div className="flex gap-1">
          {[
            { label: 'BLE', icon: Radio, action: module.connectBLE },
            { label: 'USB', icon: Usb, action: module.connectUSB },
            { label: 'Wi-Fi', icon: Wifi, action: () => module.connectWS() },
          ].map(btn => (
            <button
              key={btn.label}
              onClick={() => btn.action()}
              className={cn(
                "flex-1 rounded px-2 py-1 flex items-center justify-center gap-1 transition-colors",
                "bg-muted/10 hover:bg-muted/20 text-muted-foreground/50 hover:text-foreground/70",
                "text-[8px] uppercase font-bold border border-border/10"
              )}
            >
              <btn.icon className="w-3 h-3" />
              {btn.label}
            </button>
          ))}
        </div>
        {bridgeStatus?.connected && (
          <div className="flex items-center justify-between text-[7px] text-muted-foreground/40">
            <span>TX: {bridgeStatus.txBytes}B · RX: {bridgeStatus.rxBytes}B</span>
            <button
              onClick={module.disconnectHardware}
              className="text-destructive/60 hover:text-destructive text-[7px]"
            >
              Desconectar
            </button>
          </div>
        )}
      </div>

      {/* Not powered message */}
      {!powered && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/30 space-y-2">
          <Power className="w-10 h-10" />
          <span className="text-xs">Pressione POWER para ligar o módulo</span>
          <span className="text-[8px]">IFMx-i32Q Virtual · 32 canais · CDS</span>
        </div>
      )}
    </div>
  );
}
