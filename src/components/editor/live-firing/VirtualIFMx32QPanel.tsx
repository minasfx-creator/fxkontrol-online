/**
 * VirtualIFMx32QPanel — Full visual replica of IFMx-i32Q field module
 * 32-igniter grid, LCD address, status LEDs, CDS charge, ARM/DISARM
 * Firing modes: Manual | Semi-Auto | Auto | UltraFire | Preset
 * Hardware Design tab with ESP32-S3 schematic
 */
import { useState, useCallback, useEffect } from 'react';
import { Power, Zap, Shield, ShieldAlert, Wifi, Usb, Radio, Battery, AlertTriangle, ChevronUp, ChevronDown, Activity, Play, Square, SkipForward, Download, Cpu, Wrench, Signal, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useFireOneModuleMode } from '@/hooks/useFireOneModuleMode';
import { useIsMobile } from '@/hooks/use-mobile';
import type { FiringMode } from '@/lib/fireoneModuleEmulator';

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
  const [activeTab, setActiveTab] = useState<string>('module');

  // E-STOP lockout countdown
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  useEffect(() => {
    if (!status?.estopLockoutEnd) return;
    const tick = () => {
      const remaining = Math.max(0, status.estopLockoutEnd - Date.now());
      setLockoutRemaining(remaining);
      if (remaining > 0) requestAnimationFrame(tick);
    };
    tick();
  }, [status?.estopLockoutEnd]);

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

  const handleSetMode = useCallback((mode: string) => {
    module.setFiringMode(mode as FiringMode);
  }, [module]);

  return (
    <div className={cn("flex flex-col gap-2", fs ? "p-4" : "p-2")}>
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 h-7">
          <TabsTrigger value="module" className="text-[9px] h-6"><Cpu className="w-3 h-3 mr-1" />Módulo</TabsTrigger>
          <TabsTrigger value="modes" className="text-[9px] h-6"><Zap className="w-3 h-3 mr-1" />Modos</TabsTrigger>
          <TabsTrigger value="hardware" className="text-[9px] h-6"><Wrench className="w-3 h-3 mr-1" />Hardware</TabsTrigger>
        </TabsList>

        {/* ─── MODULE TAB ─── */}
        <TabsContent value="module" className="mt-1 space-y-2">
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => powered ? module.powerOff() : module.powerOn()}
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

              {powered && status && (
                <div className="flex items-center gap-3 text-[8px] text-muted-foreground/50">
                  <span className="flex items-center gap-0.5">
                    <Battery className="w-3 h-3" />
                    <span className={status.batteryVoltage < 10 ? 'text-destructive' : ''}>{status.batteryVoltage.toFixed(1)}V</span>
                  </span>
                  <span>{connectedCount} conectados · {firedCount} disparados · {chargedCount} carregados</span>
                  {status.state === 'safe_sense' && (
                    <span className="text-amber-400">Safe-Sense: {Math.round(status.safeSenseProgress)}%</span>
                  )}
                  {status.state === 'estop_lockout' && lockoutRemaining > 0 && (
                    <span className="text-destructive font-bold animate-pulse">
                      🛑 LOCKOUT {(lockoutRemaining / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ARM / DISARM / E-STOP */}
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
                disabled={status?.state === 'safe_sense' || status?.state === 'idle' || status?.state === 'estop_lockout'}
              >
                {status?.firePowerOn ? (
                  <><ShieldAlert className="w-4 h-4 mr-1" /> ARMED</>
                ) : (
                  <><Shield className="w-4 h-4 mr-1" /> ARM</>
                )}
              </Button>
              <Button size="sm" variant="destructive" className="font-black uppercase text-xs px-4" onClick={module.eStop}>
                <AlertTriangle className="w-4 h-4 mr-1" /> E-STOP
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={handleContinuityCheck}>
                <Activity className="w-3 h-3 mr-1" /> CONT
              </Button>
            </div>
          )}

          {/* 32-Igniter Grid */}
          {powered && status && (
            <div className="grid grid-cols-4 gap-1">
              {status.igniters.map((ig, pin) => (
                <button
                  key={pin}
                  onClick={() => status.firePowerOn ? handleFire(pin) : togglePin(pin)}
                  onContextMenu={(e) => { e.preventDefault(); togglePin(pin); }}
                  className={cn(
                    "relative rounded-lg border transition-all flex flex-col items-center justify-center",
                    mob ? "h-14" : fs ? "h-12" : "h-10",
                    getIgniterColor(pin),
                    selectedPins.has(pin) && "ring-2 ring-primary/60",
                    status.presetPins.includes(pin) && "ring-2 ring-amber-400/60",
                    !ig.fired && ig.connected && status.firePowerOn && "hover:brightness-125 active:scale-95 cursor-pointer"
                  )}
                >
                  <span className={cn("font-mono font-bold", fs ? "text-xs" : "text-[9px]")}>{PIN_LABELS[pin]}</span>
                  {ig.connected && !ig.fired && (
                    <span className="text-[6px] text-muted-foreground/40">{ig.resistance.toFixed(1)}Ω</span>
                  )}
                  {ig.fired && <span className="text-[6px] text-muted-foreground/30">FIRED</span>}
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
              <Button size="sm" variant="destructive" className="flex-1 font-black" onClick={handleFireSelected} disabled={!status?.firePowerOn}>
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
          {bridgeStatus?.connected && bridgeStatus.transport === 'wifi_direct' && (
            <div className="rounded-lg border-2 border-red-500/40 bg-red-950/20 p-1.5 flex items-center gap-2 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-[8px] text-red-300 font-black uppercase">MODO REAL — Hardware Físico Conectado</span>
              <Badge className="ml-auto text-[6px] h-3 px-1 bg-red-600/80 border-transparent">REAL</Badge>
            </div>
          )}
          <div className={cn(
            "rounded-lg border p-2 space-y-1.5",
            bridgeStatus?.connected && bridgeStatus.transport === 'wifi_direct'
              ? "border-red-500/30 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              : bridgeStatus?.connected ? "border-emerald-500/30 bg-emerald-950/10" : "border-border/15 bg-card/20"
          )}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Hardware Bridge</span>
              <Badge
                variant={bridgeStatus?.connected ? 'default' : 'outline'}
                className={cn("text-[7px] h-3.5", bridgeStatus?.connected ? "bg-emerald-600/80" : "")}
              >
                {bridgeStatus?.connected
                  ? `${bridgeStatus.transport.toUpperCase()} · ${bridgeStatus.deviceName}`
                  : 'DESCONECTADO'}
              </Badge>
            </div>

            {/* 6 Transport Options */}
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: 'BLE', sub: '~30m', icon: Radio, action: module.connectBLE, transport: 'ble' as const },
                { label: 'BLE LR', sub: '~1km', icon: Satellite, action: module.connectBLELongRange, transport: 'ble_lr' as const },
                { label: 'Wi-Fi P2P', sub: 'Rádio', icon: Signal, action: () => module.connectWiFiDirect(), transport: 'wifi_direct' as const },
                { label: 'Wi-Fi AP', sub: 'ESP32', icon: Wifi, action: () => module.connectWS(), transport: 'websocket' as const },
                { label: 'USB', sub: 'OTG', icon: Usb, action: module.connectUSB, transport: 'usb' as const },
                { label: 'RELAY', sub: 'Direto', icon: Zap, action: module.connectDirectRelay, transport: 'direct_relay' as const },
              ].map(btn => {
                const isActive = bridgeStatus?.connected && bridgeStatus.transport === btn.transport;
                return (
                  <button
                    key={btn.label}
                    onClick={() => btn.action()}
                    className={cn(
                      "rounded-lg px-2 py-1.5 flex flex-col items-center gap-0.5 transition-all",
                      "border text-[7px] uppercase font-bold",
                      isActive
                        ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                        : "bg-muted/10 hover:bg-muted/20 text-muted-foreground/50 hover:text-foreground/70 border-border/10"
                    )}
                  >
                    <btn.icon className="w-3.5 h-3.5" />
                    <span>{btn.label}</span>
                    <span className={cn("text-[6px] font-normal", isActive ? "text-emerald-400/60" : "text-muted-foreground/30")}>{btn.sub}</span>
                  </button>
                );
              })}
            </div>

            {/* RSSI / Distance indicator */}
            {bridgeStatus?.connected && (bridgeStatus.rssi != null || bridgeStatus.estimatedDistance != null) && (
              <div className="flex items-center gap-2 px-1">
                <div className="flex gap-px items-end h-3">
                  {[0, 1, 2, 3].map(i => {
                    const strength = bridgeStatus.rssi != null
                      ? Math.max(0, Math.min(4, Math.floor((bridgeStatus.rssi + 100) / 15)))
                      : 2;
                    return (
                      <div
                        key={i}
                        className={cn("w-1 rounded-sm", i < strength ? "bg-emerald-400" : "bg-muted-foreground/20")}
                        style={{ height: `${(i + 1) * 25}%` }}
                      />
                    );
                  })}
                </div>
                {bridgeStatus.rssi != null && (
                  <span className="text-[7px] text-muted-foreground/50">{bridgeStatus.rssi} dBm</span>
                )}
                {bridgeStatus.estimatedDistance != null && (
                  <Badge variant="outline" className="text-[6px] h-3 px-1">
                    ~{bridgeStatus.estimatedDistance}m
                  </Badge>
                )}
              </div>
            )}

            {bridgeStatus?.connected && (
              <div className="flex items-center justify-between text-[7px] text-muted-foreground/40">
                <span>TX: {bridgeStatus.txBytes}B · RX: {bridgeStatus.rxBytes}B{bridgeStatus.firmwareVersion ? ` · FW: ${bridgeStatus.firmwareVersion}` : ''}</span>
                <button onClick={module.disconnectHardware} className="text-destructive/60 hover:text-destructive text-[7px]">
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
        </TabsContent>

        {/* ─── FIRING MODES TAB ─── */}
        <TabsContent value="modes" className="mt-1 space-y-2">
          {!powered ? (
            <div className="text-center text-muted-foreground/40 text-xs py-8">Ligue o módulo primeiro</div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-1">
                {(['manual', 'semi_auto', 'auto', 'ultrafire', 'preset'] as FiringMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => handleSetMode(mode)}
                    className={cn(
                      "rounded-lg border py-2 text-[8px] font-bold uppercase transition-all",
                      status?.firingMode === mode
                        ? "bg-primary/20 border-primary/60 text-primary"
                        : "bg-muted/10 border-border/20 text-muted-foreground/50 hover:bg-muted/20"
                    )}
                  >
                    {mode === 'semi_auto' ? 'Semi' : mode === 'ultrafire' ? 'Ultra' : mode}
                  </button>
                ))}
              </div>

              {/* Semi-Auto Controls */}
              {status?.firingMode === 'semi_auto' && (
                <div className="rounded-lg border border-border/20 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Semi-Auto Mode</span>
                    <Badge variant="outline" className="text-[7px]">
                      Evento {status.semiAutoIndex + 1}/{status.semiAutoEvents.length || '—'}
                    </Badge>
                  </div>
                  {status.semiAutoEvents.length > 0 ? (
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {status.semiAutoEvents.map((ev, i) => (
                        <div key={ev.id} className={cn(
                          "flex items-center gap-2 text-[8px] px-2 py-1 rounded",
                          i === status.semiAutoIndex ? "bg-primary/20 text-primary" :
                          i < status.semiAutoIndex ? "text-muted-foreground/30 line-through" : "text-muted-foreground/60"
                        )}>
                          <span className="font-mono w-4">{i + 1}</span>
                          <span>Pins: {ev.pins.map(p => p + 1).join(',')}</span>
                          <span className="ml-auto">{ev.duration}ms</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[8px] text-muted-foreground/40">Nenhum script carregado. Use a API para carregar eventos.</p>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="flex-1 text-[9px] h-7" onClick={() => module.stepEvent()} disabled={!status.firePowerOn}>
                      <SkipForward className="w-3 h-3 mr-1" /> STEP
                    </Button>
                    <Button size="sm" variant="outline" className="text-[9px] h-7" onClick={module.resetSemiAuto}>
                      Reset
                    </Button>
                  </div>
                </div>
              )}

              {/* Auto (Timecode) Controls */}
              {status?.firingMode === 'auto' && (
                <div className="rounded-lg border border-border/20 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Auto (Timecode)</span>
                    <Badge variant={status.autoRunning ? 'default' : 'outline'} className={cn("text-[7px]", status.autoRunning && "bg-emerald-600/80")}>
                      {status.autoRunning ? 'RUNNING' : 'STOPPED'}
                    </Badge>
                  </div>
                  {status.autoTotalMs > 0 && (
                    <div className="space-y-1">
                      <div className="h-2 bg-muted/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 transition-all"
                          style={{ width: `${status.autoTotalMs > 0 ? (status.autoElapsedMs / status.autoTotalMs) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[7px] text-muted-foreground/40">
                        <span>{(status.autoElapsedMs / 1000).toFixed(1)}s</span>
                        <span>{(status.autoTotalMs / 1000).toFixed(1)}s</span>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="flex-1 text-[9px] h-7" onClick={module.startAutoFire} disabled={status.autoRunning || !status.firePowerOn}>
                      <Play className="w-3 h-3 mr-1" /> START
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 text-[9px] h-7" onClick={module.stopAutoFire} disabled={!status.autoRunning}>
                      <Square className="w-3 h-3 mr-1" /> STOP
                    </Button>
                  </div>
                </div>
              )}

              {/* UltraFire Controls */}
              {status?.firingMode === 'ultrafire' && (
                <div className="rounded-lg border border-border/20 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground/60">UltraFire</span>
                    <Badge variant={status.ultraRunning ? 'default' : 'outline'} className={cn("text-[7px]", status.ultraRunning && "bg-amber-600/80")}>
                      {status.ultraRunning ? 'FIRING' : 'STANDBY'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {status.ultraSlots.map((slot, i) => (
                      <button
                        key={i}
                        onClick={() => module.setUltraSlot(i + 1)}
                        className={cn(
                          "rounded border py-1 text-[8px] font-bold",
                          i === status.ultraActiveSlot
                            ? "bg-primary/20 border-primary/60 text-primary"
                            : slot.loaded
                              ? "bg-emerald-950/20 border-emerald-700/30 text-emerald-400/60"
                              : "bg-muted/5 border-border/10 text-muted-foreground/30"
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  {status.ultraSlots[status.ultraActiveSlot]?.loaded && (
                    <div className="text-[7px] text-muted-foreground/40">
                      Slot {status.ultraActiveSlot + 1}: {status.ultraSlots[status.ultraActiveSlot].events.length} eventos
                      {status.ultraSlots[status.ultraActiveSlot].verifyCode && (
                        <span className="ml-2 text-primary/60">Code: {status.ultraSlots[status.ultraActiveSlot].verifyCode}</span>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="flex-1 text-[9px] h-7" onClick={module.startUltraFire} disabled={status.ultraRunning || !status.firePowerOn}>
                      <Play className="w-3 h-3 mr-1" /> RUN
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 text-[9px] h-7" onClick={module.stopUltraFire} disabled={!status.ultraRunning}>
                      <Square className="w-3 h-3 mr-1" /> STOP
                    </Button>
                  </div>
                </div>
              )}

              {/* Preset Controls */}
              {status?.firingMode === 'preset' && (
                <div className="rounded-lg border border-border/20 p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground/60">Preset Mode</span>
                    <span className="text-[7px] text-muted-foreground/40">{status.presetPins.length} pins selecionados</span>
                  </div>
                  <p className="text-[8px] text-muted-foreground/40">Toque nos ignitores na aba Módulo para selecionar. Depois pressione FIRE PRESET.</p>
                  <div className="flex gap-1">
                    <Button size="sm" variant="destructive" className="flex-1 text-[9px] h-7"
                      onClick={() => { module.setPreset(Array.from(selectedPins)); module.firePreset(); }}
                      disabled={selectedPins.size === 0 || !status.firePowerOn}
                    >
                      <Zap className="w-3 h-3 mr-1" /> FIRE PRESET
                    </Button>
                    <Button size="sm" variant="outline" className="text-[9px] h-7" onClick={() => { module.clearPreset(); setSelectedPins(new Set()); }}>
                      Clear
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ─── HARDWARE DESIGN TAB ─── */}
        <TabsContent value="hardware" className="mt-1 space-y-2">
          <div className="rounded-lg border border-border/20 p-3 space-y-3">
            <h3 className="text-[10px] font-black uppercase text-muted-foreground/60">Setup Simplificado: Celular + Bateria 12V + 32 Relés</h3>

            {/* Simplified Schematic */}
            <pre className="text-[7px] font-mono text-muted-foreground/50 bg-muted/5 rounded p-2 overflow-x-auto whitespace-pre leading-tight">{`
┌──────────────┐  USB-C OTG  ┌──────────────┐  Serial  ┌──────────────┐
│  CELULAR     │ ──────────► │ Adaptador    │ ───────► │ Arduino Nano │
│  (FX Kontrol)│             │ USB→Serial   │  TX/RX   │ (ATmega328)  │
│  WebSerial   │             │ CH340/CP2102 │  115200  │              │
└──────────────┘             └──────────────┘          └──────┬───────┘
                                                              │ D2-D9
                                                              │ + 4x 74HC595
                                                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Placa 32 Canais Relé (5V logic, 12V switching)                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ... ┌─────┐                      │
│  │ R01 │ │ R02 │ │ R03 │ │ R04 │     │ R32 │  IN ← Arduino pins   │
│  │ COM │ │ COM │ │ COM │ │ COM │     │ COM │  COM ← Bateria 12V+  │
│  │ NO  │ │ NO  │ │ NO  │ │ NO  │     │ NO  │  NO  → E-match       │
│  └─────┘ └─────┘ └─────┘ └─────┘     └─────┘                      │
└──────────────────────────────────────────────────────────────────────┘
           │                                            │
           └──── E-match ──── GND Bateria 12V ──────────┘

Protocolo Serial: FIRE:pin:ms\\n → OK:FIRE:pin\\n
                  RELAY:pin:ON\\n / RELAY:pin:OFF\\n
                  ESTOP\\n → OK:ESTOP\\n`}</pre>

            {/* Component List */}
            <div className="space-y-1">
              <h4 className="text-[9px] font-bold text-muted-foreground/60">Lista de Componentes (~$15-20)</h4>
              {[
                { item: 'Placa 32ch Relé (SainSmart/similar)', qty: '1x', price: '$10' },
                { item: 'Adaptador USB-C OTG', qty: '1x', price: '$1' },
                { item: 'Conversor USB-Serial CH340', qty: '1x', price: '$2' },
                { item: 'Arduino Nano (ATmega328)', qty: '1x', price: '$3' },
                { item: 'Bateria 12V 7Ah selada (ou LiPo 3S)', qty: '1x', price: '$5-8' },
                { item: 'Fios/conectores para E-matches', qty: '—', price: '$1' },
              ].map(c => (
                <div key={c.item} className="flex items-center text-[8px] text-muted-foreground/50">
                  <span className="flex-1">{c.item}</span>
                  <span className="w-8 text-right">{c.qty}</span>
                  <span className="w-10 text-right text-primary/60">{c.price}</span>
                </div>
              ))}
            </div>

            {/* Wiring Instructions */}
            <div className="space-y-1">
              <h4 className="text-[9px] font-bold text-muted-foreground/60">Montagem Passo-a-Passo</h4>
              <ol className="text-[8px] text-muted-foreground/40 space-y-0.5 list-decimal list-inside">
                <li>Conecte Arduino Nano à placa de relés (D2-D9 + 74HC595 para 32ch)</li>
                <li>Ligue COM de todos os relés ao terminal + da bateria 12V</li>
                <li>Ligue NO de cada relé ao terminal + do e-match correspondente</li>
                <li>Ligue terminal − dos e-matches ao GND da bateria 12V</li>
                <li>Conecte Arduino Nano via USB ao adaptador CH340</li>
                <li>Conecte CH340 via adaptador USB-C OTG ao celular</li>
                <li>No app: Hardware Bridge → RELAY → selecionar porta serial</li>
              </ol>
            </div>

            {/* Arduino Nano Firmware */}
            <div className="space-y-1">
              <h4 className="text-[9px] font-bold text-muted-foreground/60">Firmware Arduino Nano (~30 linhas)</h4>
              <pre className="text-[6.5px] font-mono text-emerald-400/60 bg-black/40 rounded p-2 overflow-x-auto whitespace-pre leading-tight">{`#include <Wire.h>
// 4x 74HC595 para 32 canais
#define DATA  11  // SER
#define CLOCK 12  // SRCLK
#define LATCH 13  // RCLK

uint32_t relayState = 0;

void shiftOut32(uint32_t mask) {
  digitalWrite(LATCH, LOW);
  for (int i = 31; i >= 0; i--) {
    digitalWrite(DATA, (mask >> i) & 1);
    digitalWrite(CLOCK, HIGH);
    delayMicroseconds(1);
    digitalWrite(CLOCK, LOW);
  }
  digitalWrite(LATCH, HIGH);
}

void firePin(int pin, int ms) {
  if (pin < 0 || pin > 31) return;
  ms = constrain(ms, 20, 1000);
  relayState |= (1UL << pin);
  shiftOut32(relayState);
  delay(ms);
  relayState &= ~(1UL << pin);
  shiftOut32(relayState);
}

void setup() {
  Serial.begin(115200);
  pinMode(DATA, OUTPUT);
  pinMode(CLOCK, OUTPUT);
  pinMode(LATCH, OUTPUT);
  shiftOut32(0);
}

void loop() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\\n');
  cmd.trim();
  if (cmd.startsWith("FIRE:")) {
    int c1 = cmd.indexOf(':', 5);
    int pin = cmd.substring(5, c1).toInt();
    int dur = cmd.substring(c1+1).toInt();
    firePin(pin, dur);
    Serial.println("OK:FIRE:" + String(pin));
  } else if (cmd == "ESTOP") {
    relayState = 0;
    shiftOut32(0);
    Serial.println("OK:ESTOP");
  } else if (cmd == "HEARTBEAT") {
    Serial.println("PONG");
  } else if (cmd == "VERSION") {
    Serial.println("VER:RELAY-1.0");
  }
}`}</pre>
            </div>

            {/* Connection mode info */}
            <div className="rounded border border-amber-500/20 bg-amber-950/10 p-2">
              <p className="text-[8px] text-amber-300/60">
                <strong>⚡ Modo Direct Relay:</strong> O celular envia comandos seriais diretamente via USB OTG.
                Sem Wi-Fi, sem Bluetooth, sem ESP32. O Arduino Nano atua apenas como ponte entre USB e os 32 relés.
                A bateria 12V alimenta diretamente os ignitores quando o relé fecha o circuito.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
