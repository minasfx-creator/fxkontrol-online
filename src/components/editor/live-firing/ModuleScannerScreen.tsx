/**
 * ModuleScannerScreen — Digital holographic module scanner display
 * BR2049 aesthetic: amber HUD, radar sweep, click-to-select modules
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Search, Wifi, WifiOff, Usb, Signal, Battery, Activity, Zap, Radio } from 'lucide-react';
import type { WirelessConnectionMode } from '@/lib/fireoneProtocol';

interface ScannerModule {
  address: number;
  connected: boolean;
  armed: boolean;
  batteryVoltage: number;
  signalStrength: number;
  temperature: number;
  connectionMode?: WirelessConnectionMode;
  rssiDbm?: number;
  packetLoss?: number;
  igniters: { connected: boolean; fired: boolean }[];
}

interface ModuleScannerScreenProps {
  modules: ScannerModule[];
  selectedModule: number;
  onSelectModule: (addr: number) => void;
  onScan: () => Promise<void>;
  scanning: boolean;
  scanProgress: number;
  sz: 'xl' | 'fs' | 'sm';
  isMobile: boolean;
}

export default function ModuleScannerScreen({
  modules, selectedModule, onSelectModule, onScan, scanning, scanProgress, sz, isMobile,
}: ModuleScannerScreenProps) {
  const [radarAngle, setRadarAngle] = useState(0);
  const [showScreen, setShowScreen] = useState(false);
  const [autoDiscovery, setAutoDiscovery] = useState(false);
  const [telemetryPulse, setTelemetryPulse] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [scanCycle, setScanCycle] = useState(0);
  const radarRef = useRef<number | null>(null);
  const autoDiscoveryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const telemetryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Radar sweep animation — runs when scanning OR auto-discovery is active
  const radarActive = scanning || autoDiscovery;
  useEffect(() => {
    if (!radarActive) { setRadarAngle(0); return; }
    const speed = autoDiscovery && !scanning ? 1.5 : 3;
    const animate = () => {
      setRadarAngle(prev => (prev + speed) % 360);
      radarRef.current = requestAnimationFrame(animate);
    };
    radarRef.current = requestAnimationFrame(animate);
    return () => { if (radarRef.current) cancelAnimationFrame(radarRef.current); };
  }, [radarActive, scanning, autoDiscovery]);

  // Auto-discovery: trigger scan every 5 seconds
  useEffect(() => {
    if (!autoDiscovery) {
      if (autoDiscoveryRef.current) clearInterval(autoDiscoveryRef.current);
      return;
    }
    // Immediate first scan
    onScan().then(() => {
      setLastScanTime(Date.now());
      setScanCycle(prev => prev + 1);
    });
    autoDiscoveryRef.current = setInterval(() => {
      onScan().then(() => {
        setLastScanTime(Date.now());
        setScanCycle(prev => prev + 1);
      });
    }, 5000);
    return () => { if (autoDiscoveryRef.current) clearInterval(autoDiscoveryRef.current); };
  }, [autoDiscovery, onScan]);

  // Telemetry pulse animation (heartbeat every 2s)
  useEffect(() => {
    if (!autoDiscovery) {
      if (telemetryRef.current) clearInterval(telemetryRef.current);
      return;
    }
    telemetryRef.current = setInterval(() => {
      setTelemetryPulse(true);
      setTimeout(() => setTelemetryPulse(false), 400);
    }, 2000);
    return () => { if (telemetryRef.current) clearInterval(telemetryRef.current); };
  }, [autoDiscovery]);

  const onlineModules = modules.filter(m => m.connected);
  const armedCount = modules.filter(m => m.armed).length;

  const getConnectionIcon = (mode?: WirelessConnectionMode) => {
    if (mode === 'wireless') return Wifi;
    if (mode === 'fallback') return WifiOff;
    return Usb;
  };

  const getConnectionLabel = (mode?: WirelessConnectionMode) => {
    if (mode === 'wireless') return 'RF';
    if (mode === 'fallback') return 'FB';
    return 'RS485';
  };

  const getSignalBars = (strength: number) => {
    const bars = Math.ceil(strength / 20);
    return Math.min(5, Math.max(0, bars));
  };

  const getSignalColor = (strength: number) => {
    if (strength > 80) return 'hsl(120 70% 45%)';
    if (strength > 60) return 'hsl(32 100% 50%)';
    if (strength > 40) return 'hsl(32 100% 50%)';
    return 'hsl(0 80% 50%)';
  };

  const getBatteryColor = (voltage: number) => {
    if (voltage > 11.5) return 'hsl(120 70% 40%)';
    if (voltage > 11) return 'hsl(45 100% 50%)';
    return 'hsl(0 80% 50%)';
  };

  const isCompact = sz === 'sm';
  const radarSize = isCompact ? 100 : sz === 'fs' ? 130 : 160;

  return (
    <div className={cn(
      "border-t shrink-0 transition-all",
      showScreen ? "" : "cursor-pointer"
    )} style={{
      background: 'linear-gradient(180deg, hsl(220 15% 5%) 0%, hsl(220 18% 3%) 100%)',
      borderColor: 'hsl(32 100% 50% / 0.12)',
    }}>
      {/* Toggle Bar */}
      <button
        onClick={() => setShowScreen(!showScreen)}
        className={cn(
          "w-full flex items-center gap-3 font-mono transition-all",
          isCompact ? "px-3 py-1.5" : "px-4 py-2",
        )}
        style={{ background: 'hsl(220 15% 6% / 0.8)' }}
      >
        {/* Radar mini icon */}
        <div className="relative shrink-0" style={{ width: 18, height: 18 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7" fill="none" stroke="hsl(32 100% 50% / 0.25)" strokeWidth="0.5" />
            <circle cx="9" cy="9" r="4" fill="none" stroke="hsl(32 100% 50% / 0.15)" strokeWidth="0.5" />
            <line x1="9" y1="9" x2="9" y2="2" stroke="hsl(32 100% 50% / 0.6)" strokeWidth="1"
              transform={`rotate(${radarActive ? radarAngle : 0} 9 9)`} />
            {onlineModules.map((m, i) => {
              const angle = (i / Math.max(modules.length, 1)) * Math.PI * 2 - Math.PI / 2;
              const r = 5;
              return (
                <circle key={m.address}
                  cx={9 + Math.cos(angle) * r} cy={9 + Math.sin(angle) * r} r="1.5"
                  fill={m.armed ? 'hsl(0 80% 50%)' : 'hsl(32 100% 50%)'}
                />
              );
            })}
          </svg>
          {radarActive && (
            <div className="absolute inset-0 rounded-full" style={{
              boxShadow: '0 0 6px hsl(32 100% 50% / 0.3)',
            }} />
          )}
        </div>

        <span className={cn("font-bold tracking-[0.15em] uppercase",
          isCompact ? "text-[9px]" : "text-[10px]",
        )} style={{ color: 'hsl(32 100% 50% / 0.7)' }}>
          MODULE SCANNER
        </span>

        {/* Inline status */}
        <div className={cn("flex items-center gap-2", isCompact ? "text-[8px]" : "text-[9px]")}>
          <span className="text-green-400/70">{onlineModules.length} ONLINE</span>
          <span className="text-muted-foreground/30">/ {modules.length}</span>
          {armedCount > 0 && <span className="text-red-400 font-bold">{armedCount} ARMED</span>}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {autoDiscovery && (
            <span className={cn("font-bold", isCompact ? "text-[8px]" : "text-[9px]")}
              style={{ color: 'hsl(120 70% 45% / 0.8)' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full mr-1" style={{
                background: 'hsl(120 70% 45%)',
                boxShadow: '0 0 4px hsl(120 70% 45% / 0.5)',
                animation: 'pulse 2s infinite',
              }} />
              AUTO · #{scanCycle}
            </span>
          )}
          {scanning && !autoDiscovery && (
            <span className={cn("font-bold animate-pulse", isCompact ? "text-[8px]" : "text-[9px]")}
              style={{ color: 'hsl(32 100% 50%)' }}>
              SCANNING...
            </span>
          )}
          <div className={cn(
            "transition-transform duration-200",
            showScreen ? "rotate-180" : ""
          )} style={{ color: 'hsl(32 100% 50% / 0.4)' }}>▼</div>
        </div>
      </button>

      {/* Scanner Screen */}
      {showScreen && (
        <div className={cn("transition-all overflow-hidden",
          isCompact ? "px-3 pb-3" : "px-4 pb-4"
        )}>
          {/* Scan progress bar */}
          {scanning && (
            <div className="w-full h-[2px] rounded-full overflow-hidden mb-3" style={{ background: 'hsl(220 10% 10%)' }}>
              <div className="h-full rounded-full transition-all" style={{
                width: `${scanProgress}%`,
                background: 'linear-gradient(90deg, hsl(32 100% 50%), hsl(38 100% 60%))',
                boxShadow: '0 0 8px hsl(32 100% 50% / 0.5)',
              }} />
            </div>
          )}

          <div className={cn("flex gap-3", isMobile ? "flex-col" : "")}>
            {/* Radar display */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="relative" style={{ width: radarSize, height: radarSize }}>
                <svg width={radarSize} height={radarSize} viewBox="0 0 200 200" className="block">
                  {/* Background grid */}
                  <defs>
                    <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="hsl(32 100% 50%)" stopOpacity="0.03" />
                      <stop offset="100%" stopColor="hsl(220 15% 3%)" stopOpacity="0.8" />
                    </radialGradient>
                    <filter id="radarGlow">
                      <feGaussianBlur stdDeviation="2" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <circle cx="100" cy="100" r="90" fill="url(#radarBg)" stroke="hsl(32 100% 50% / 0.15)" strokeWidth="1" />
                  <circle cx="100" cy="100" r="60" fill="none" stroke="hsl(32 100% 50% / 0.08)" strokeWidth="0.5" />
                  <circle cx="100" cy="100" r="30" fill="none" stroke="hsl(32 100% 50% / 0.06)" strokeWidth="0.5" />
                  {/* Cross lines */}
                  <line x1="100" y1="10" x2="100" y2="190" stroke="hsl(32 100% 50% / 0.06)" strokeWidth="0.5" />
                  <line x1="10" y1="100" x2="190" y2="100" stroke="hsl(32 100% 50% / 0.06)" strokeWidth="0.5" />

                  {/* Sweep line */}
                  {scanning && (
                    <g filter="url(#radarGlow)">
                      <line x1="100" y1="100" x2="100" y2="12" stroke="hsl(32 100% 50% / 0.8)" strokeWidth="1.5"
                        transform={`rotate(${radarAngle} 100 100)`} />
                      {/* Sweep cone */}
                      <path d={`M 100 100 L ${100 + 85 * Math.sin((radarAngle - 30) * Math.PI / 180)} ${100 - 85 * Math.cos((radarAngle - 30) * Math.PI / 180)} A 85 85 0 0 1 ${100 + 85 * Math.sin(radarAngle * Math.PI / 180)} ${100 - 85 * Math.cos(radarAngle * Math.PI / 180)} Z`}
                        fill="hsl(32 100% 50% / 0.06)" />
                    </g>
                  )}

                  {/* Module dots positioned around radar */}
                  {modules.map((m, i) => {
                    const angle = (i / modules.length) * Math.PI * 2 - Math.PI / 2;
                    const distance = m.connected ? 30 + (m.signalStrength / 100) * 50 : 75;
                    const cx = 100 + Math.cos(angle) * distance;
                    const cy = 100 + Math.sin(angle) * distance;
                    const isSelected = m.address === selectedModule;
                    const dotColor = m.armed ? 'hsl(0 80% 50%)' : m.connected ? 'hsl(32 100% 55%)' : 'hsl(0 0% 25%)';
                    const dotR = isSelected ? 8 : 5;

                    return (
                      <g key={m.address}
                        onClick={() => m.connected && onSelectModule(m.address)}
                        className={m.connected ? 'cursor-pointer' : ''}
                      >
                        {/* Selection ring */}
                        {isSelected && (
                          <circle cx={cx} cy={cy} r={dotR + 4} fill="none"
                            stroke="hsl(32 100% 50%)" strokeWidth="1" strokeDasharray="3 2"
                            opacity="0.6">
                            <animateTransform attributeName="transform" type="rotate"
                              from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="4s" repeatCount="indefinite" />
                          </circle>
                        )}
                        {/* Module dot */}
                        <circle cx={cx} cy={cy} r={dotR} fill={dotColor}
                          stroke={isSelected ? 'hsl(32 100% 70%)' : 'none'} strokeWidth="1.5"
                          filter={m.connected ? 'url(#radarGlow)' : undefined}
                          opacity={m.connected ? 1 : 0.3} />
                        {/* Label */}
                        <text x={cx} y={cy + (isSelected ? 16 : 13)}
                          textAnchor="middle" fill={isSelected ? 'hsl(32 100% 60%)' : 'hsl(32 100% 50% / 0.5)'}
                          fontSize={isSelected ? "9" : "7"} fontFamily="monospace" fontWeight="bold">
                          {String(m.address).padStart(2, '0')}
                        </text>
                        {/* Armed indicator */}
                        {m.armed && (
                          <circle cx={cx} cy={cy} r={dotR + 2} fill="none"
                            stroke="hsl(0 80% 50% / 0.6)" strokeWidth="1">
                            <animate attributeName="r" from={dotR + 2} to={dotR + 6} dur="1s" repeatCount="indefinite" />
                            <animate attributeName="opacity" from="0.6" to="0" dur="1s" repeatCount="indefinite" />
                          </circle>
                        )}
                      </g>
                    );
                  })}

                  {/* Center crosshair */}
                  <circle cx="100" cy="100" r="3" fill="hsl(32 100% 50% / 0.3)" />
                  <circle cx="100" cy="100" r="1" fill="hsl(32 100% 50% / 0.8)" />
                </svg>

                {/* Corner brackets */}
                {['top-0 left-0 border-l-2 border-t-2', 'top-0 right-0 border-r-2 border-t-2',
                  'bottom-0 left-0 border-l-2 border-b-2', 'bottom-0 right-0 border-r-2 border-b-2'
                ].map((cls, i) => (
                  <div key={i} className={cn("absolute w-3 h-3 pointer-events-none", cls)}
                    style={{ borderColor: 'hsl(32 100% 50% / 0.2)' }} />
                ))}
              </div>

              {/* Scan + Auto-Discovery buttons */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={onScan}
                  disabled={scanning || autoDiscovery}
                  className={cn(
                    "rounded-lg border font-mono font-bold uppercase tracking-[0.15em] transition-all flex items-center gap-1.5",
                    isCompact ? "px-3 py-1.5 text-[9px]" : "px-4 py-2 text-[10px]",
                    scanning
                      ? "border-primary/40 text-primary"
                      : "border-primary/25 text-primary/70 hover:border-primary/50 hover:text-primary"
                  )}
                  style={{
                    background: scanning ? 'hsl(32 100% 50% / 0.08)' : 'hsl(32 100% 50% / 0.04)',
                    boxShadow: scanning ? '0 0 12px hsl(32 100% 50% / 0.15)' : undefined,
                  }}
                >
                  <Search className={cn(isCompact ? "w-3 h-3" : "w-3.5 h-3.5", scanning && "animate-pulse")} />
                  SCAN
                </button>

                <button
                  onClick={() => setAutoDiscovery(!autoDiscovery)}
                  className={cn(
                    "rounded-lg border font-mono font-bold uppercase tracking-[0.1em] transition-all flex items-center gap-1.5",
                    isCompact ? "px-3 py-1.5 text-[9px]" : "px-4 py-2 text-[10px]",
                    autoDiscovery
                      ? "text-green-400 border-green-500/40"
                      : "border-primary/20 text-primary/50 hover:border-primary/40 hover:text-primary/80"
                  )}
                  style={{
                    background: autoDiscovery ? 'hsl(120 70% 45% / 0.08)' : 'hsl(32 100% 50% / 0.03)',
                    boxShadow: autoDiscovery ? '0 0 12px hsl(120 70% 45% / 0.15)' : undefined,
                  }}
                >
                  <Activity className={cn(isCompact ? "w-3 h-3" : "w-3.5 h-3.5", autoDiscovery && "animate-pulse")} />
                  {autoDiscovery ? 'AUTO ●' : 'AUTO'}
                </button>
              </div>

              {/* Auto-discovery status */}
              {autoDiscovery && (
                <div className={cn("mt-1.5 text-center font-mono",
                  isCompact ? "text-[7px]" : "text-[8px]"
                )} style={{ color: 'hsl(120 70% 45% / 0.5)' }}>
                  CYCLE #{scanCycle} · INTERVAL 5s
                  {lastScanTime && (
                    <span className="ml-2" style={{ color: 'hsl(32 100% 50% / 0.3)' }}>
                      LAST: {new Date(lastScanTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Module list */}
            <div className="flex-1 min-w-0">
              <div className={cn("grid gap-1.5",
                isMobile ? "grid-cols-1" : sz === 'xl' ? "grid-cols-3" : "grid-cols-2"
              )}>
                {modules.map(m => {
                  const ConnIcon = getConnectionIcon(m.connectionMode);
                  const connLabel = getConnectionLabel(m.connectionMode);
                  const bars = getSignalBars(m.signalStrength);
                  const isSelected = m.address === selectedModule;
                  const igOk = m.igniters.filter(i => i.connected && !i.fired).length;
                  const igFired = m.igniters.filter(i => i.fired).length;

                  return (
                    <button
                      key={m.address}
                      onClick={() => m.connected && onSelectModule(m.address)}
                      disabled={!m.connected}
                      className={cn(
                        "rounded-lg border p-2 font-mono transition-all text-left relative overflow-hidden",
                        isSelected
                          ? m.armed
                            ? "border-red-500/40 bg-red-600/10"
                            : "border-primary/40 bg-primary/8"
                          : m.armed
                            ? "border-red-500/20 bg-red-600/5 hover:bg-red-600/10"
                            : m.connected
                              ? "border-border/15 bg-[hsl(220_12%_7%)] hover:bg-[hsl(220_12%_10%)] hover:border-primary/25"
                              : "border-border/5 bg-[hsl(220_12%_4%)] opacity-40"
                      )}
                    >
                      {/* Telemetry pulse flash */}
                      {autoDiscovery && m.connected && telemetryPulse && (
                        <div className="absolute inset-0 pointer-events-none rounded-lg transition-opacity duration-300" style={{
                          background: 'hsl(32 100% 50% / 0.04)',
                          boxShadow: 'inset 0 0 8px hsl(32 100% 50% / 0.06)',
                        }} />
                      )}
                      {/* Selected glow edge */}
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{
                          background: m.armed ? 'hsl(0 80% 50%)' : 'hsl(32 100% 50%)',
                          boxShadow: `0 0 8px ${m.armed ? 'hsl(0 80% 50% / 0.4)' : 'hsl(32 100% 50% / 0.4)'}`,
                        }} />
                      )}

                      {/* Top row: name + status */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-2 h-2 rounded-full shrink-0",
                            m.armed ? "bg-red-500" :
                            m.connected ? "bg-green-500" : "bg-muted-foreground/15"
                          )} style={{
                            boxShadow: m.armed
                              ? '0 0 6px hsl(0 80% 50% / 0.5)'
                              : m.connected ? '0 0 4px hsl(120 70% 45% / 0.4)' : 'none',
                          }} />
                          <span className={cn("font-bold",
                            isCompact ? "text-[9px]" : "text-[10px]",
                            isSelected ? "text-foreground/80" : m.connected ? "text-foreground/60" : "text-muted-foreground/20"
                          )}>
                            FM-{String(m.address).padStart(2, '0')}
                          </span>
                        </div>
                        {m.armed && (
                          <span className={cn("font-bold text-red-400 uppercase tracking-wider",
                            isCompact ? "text-[7px]" : "text-[8px]"
                          )} style={{ textShadow: '0 0 4px hsl(0 80% 50% / 0.3)' }}>
                            ARMED
                          </span>
                        )}
                      </div>

                      {m.connected && (
                        <>
                          {/* Connection + Signal row */}
                          <div className="flex items-center gap-2 mb-1">
                            <div className={cn("flex items-center gap-1 rounded px-1.5 py-0.5 border",
                              m.connectionMode === 'wireless' ? "border-cyan-500/20 bg-cyan-400/5" :
                              m.connectionMode === 'fallback' ? "border-amber-500/20 bg-amber-400/5" :
                              "border-green-500/15 bg-green-400/5"
                            )}>
                              <ConnIcon className={cn("w-2.5 h-2.5",
                                m.connectionMode === 'wireless' ? "text-cyan-400" :
                                m.connectionMode === 'fallback' ? "text-amber-400 animate-pulse" :
                                "text-green-400/60"
                              )} />
                              <span className={cn("font-bold",
                                isCompact ? "text-[7px]" : "text-[8px]",
                                m.connectionMode === 'wireless' ? "text-cyan-400/80" :
                                m.connectionMode === 'fallback' ? "text-amber-400/80" :
                                "text-green-400/50"
                              )}>{connLabel}</span>
                            </div>

                            {/* Signal bars */}
                            <div className="flex items-end gap-[1px]">
                              {[1, 2, 3, 4, 5].map(bar => (
                                <div key={bar}
                                  className="rounded-t"
                                  style={{
                                    width: 3,
                                    height: bar * 2 + 2,
                                    background: bar <= bars ? getSignalColor(m.signalStrength) : 'hsl(0 0% 15%)',
                                    opacity: bar <= bars ? 1 : 0.3,
                                  }}
                                />
                              ))}
                            </div>
                            <span className={cn("text-muted-foreground/40", isCompact ? "text-[7px]" : "text-[8px]")}>
                              {Math.round(m.signalStrength)}%
                            </span>
                          </div>

                          {/* Telemetry row */}
                          <div className={cn("flex items-center gap-2", isCompact ? "text-[7px]" : "text-[8px]")}>
                            {/* Battery */}
                            <div className="flex items-center gap-0.5">
                              <svg width="14" height="8" viewBox="0 0 14 8">
                                <rect x="0.5" y="0.5" width="11" height="7" rx="1" fill="none"
                                  stroke="hsl(var(--muted-foreground) / 0.2)" strokeWidth="0.6" />
                                <rect x="11.5" y="2" width="1.5" height="4" rx="0.5"
                                  fill="hsl(var(--muted-foreground) / 0.15)" />
                                <rect x="1.5" y="1.5" rx="0.5"
                                  width={`${Math.min(9, (m.batteryVoltage / 12.8) * 9)}`} height="5"
                                  fill={getBatteryColor(m.batteryVoltage)} />
                              </svg>
                              <span className="text-muted-foreground/40">{m.batteryVoltage.toFixed(1)}V</span>
                            </div>

                            {/* Temp */}
                            <span className="text-muted-foreground/30">{Math.round(m.temperature)}°C</span>

                            {/* Igniter count */}
                            <span className="ml-auto text-primary/50">
                              <Zap className="w-2 h-2 inline" /> {igOk}
                              {igFired > 0 && <span className="text-muted-foreground/20 ml-0.5">/{igFired}↯</span>}
                            </span>
                          </div>

                          {/* RSSI for wireless */}
                          {m.rssiDbm !== undefined && (
                            <div className={cn("mt-0.5 flex items-center gap-1", isCompact ? "text-[7px]" : "text-[8px]")}>
                              <Radio className="w-2 h-2 text-cyan-400/40" />
                              <span className={cn(
                                m.rssiDbm > -60 ? "text-green-400/60" : m.rssiDbm > -75 ? "text-amber-400/60" : "text-red-400/60"
                              )}>{m.rssiDbm}dBm</span>
                              {m.packetLoss !== undefined && m.packetLoss > 0 && (
                                <span className="text-amber-400/50">{m.packetLoss}% loss</span>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {!m.connected && (
                        <div className={cn("text-muted-foreground/15 uppercase text-center mt-1",
                          isCompact ? "text-[7px]" : "text-[8px]"
                        )}>
                          OFFLINE
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Summary footer */}
              <div className={cn("flex items-center gap-4 mt-2 font-mono border-t pt-2",
                isCompact ? "text-[8px]" : "text-[9px]"
              )} style={{ borderColor: 'hsl(32 100% 50% / 0.08)' }}>
                <span style={{ color: 'hsl(32 100% 50% / 0.5)' }}>
                  ● {onlineModules.length}/{modules.length} ONLINE
                </span>
                <span className={cn(armedCount > 0 ? "text-red-400/70" : "text-muted-foreground/25")}>
                  ● {armedCount} ARMED
                </span>
                <span className="text-green-400/50">
                  ● SIG {onlineModules.length > 0
                    ? (onlineModules.reduce((s, m) => s + m.signalStrength, 0) / onlineModules.length).toFixed(0)
                    : 0}%
                </span>
                <span className="ml-auto text-muted-foreground/20">
                  TAP MODULE → FIRE CONSOLE
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
