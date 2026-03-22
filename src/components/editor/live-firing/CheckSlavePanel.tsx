/**
 * CheckSlavePanel — BR2049 Holographic Channel Diagnostics Terminal
 * 32-channel continuity testing with sequential scan animation
 */
import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, Battery, BatteryLow, Zap, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { SlaveStatus } from './types';

interface CheckSlavePanelProps {
  fs: boolean;
  pyroArm: boolean;
}

type ChannelResult = 'untested' | 'pass' | 'fail' | 'open' | 'short';

interface DiagChannel {
  position: number;
  connected: boolean;
  fired: boolean;
  resistance?: number;
  result: ChannelResult;
  testing: boolean;
}

const DEMO_SLAVES: SlaveStatus[] = Array.from({ length: 4 }, (_, i) => ({
  address: i,
  connected: i < 3,
  batteryVoltage: i < 3 ? 11.2 + Math.random() * 0.8 : undefined,
  signalStrength: i < 3 ? 70 + Math.floor(Math.random() * 30) : undefined,
  igniters: Array.from({ length: 32 }, (_, j) => ({
    position: j,
    connected: i < 3 && Math.random() > 0.12,
    fired: false,
    resistance: i < 3 ? 1.2 + Math.random() * 3.0 : undefined,
  })),
}));

const getResistanceColor = (r?: number) => {
  if (!r) return 'bg-muted-foreground/10';
  if (r < 2.0) return 'bg-green-500/70';
  if (r < 3.0) return 'bg-emerald-400/60';
  if (r < 3.5) return 'bg-amber-400/60';
  return 'bg-red-500/60';
};

const getResultIcon = (result: ChannelResult) => {
  switch (result) {
    case 'pass': return <CheckCircle className="w-3 h-3 text-green-400" />;
    case 'fail': return <XCircle className="w-3 h-3 text-red-400" />;
    case 'open': return <AlertTriangle className="w-3 h-3 text-amber-400" />;
    case 'short': return <Zap className="w-3 h-3 text-red-500" />;
    default: return null;
  }
};

export default function CheckSlavePanel({ fs, pyroArm }: CheckSlavePanelProps) {
  const [slaves] = useState<SlaveStatus[]>(DEMO_SLAVES);
  const [selectedSlave, setSelectedSlave] = useState<number>(0);
  const [channels, setChannels] = useState<DiagChannel[]>(() =>
    DEMO_SLAVES[0]?.igniters.map(ig => ({
      ...ig,
      result: 'untested' as ChannelResult,
      testing: false,
    })) ?? []
  );
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(-1);

  const currentSlave = slaves[selectedSlave];

  const selectSlave = useCallback((idx: number) => {
    setSelectedSlave(idx);
    const slave = slaves[idx];
    if (slave) {
      setChannels(slave.igniters.map(ig => ({
        ...ig,
        result: 'untested',
        testing: false,
      })));
      setScanProgress(-1);
    }
  }, [slaves]);

  const testChannel = useCallback((pos: number) => {
    setChannels(prev => prev.map(ch =>
      ch.position === pos ? { ...ch, testing: true } : ch
    ));
    setTimeout(() => {
      setChannels(prev => prev.map(ch => {
        if (ch.position !== pos) return ch;
        let result: ChannelResult = 'fail';
        if (ch.connected && ch.resistance) {
          if (ch.resistance < 4.0) result = 'pass';
          else result = 'open';
        } else if (!ch.connected) {
          result = Math.random() > 0.8 ? 'short' : 'open';
        }
        return { ...ch, testing: false, result };
      }));
    }, 300 + Math.random() * 200);
  }, []);

  const scanAll = useCallback(() => {
    if (scanning) return;
    setScanning(true);
    setScanProgress(0);
    setChannels(prev => prev.map(ch => ({ ...ch, result: 'untested', testing: false })));

    const total = channels.length;
    let i = 0;
    const next = () => {
      if (i >= total) {
        setScanning(false);
        setScanProgress(-1);
        return;
      }
      setScanProgress(i);
      setChannels(prev => prev.map((ch, idx) =>
        idx === i ? { ...ch, testing: true } : ch
      ));
      const currentI = i;
      setTimeout(() => {
        setChannels(prev => prev.map((ch, idx) => {
          if (idx !== currentI) return ch;
          let result: ChannelResult = 'fail';
          if (ch.connected && ch.resistance) {
            result = ch.resistance < 4.0 ? 'pass' : 'open';
          } else {
            result = Math.random() > 0.8 ? 'short' : 'open';
          }
          return { ...ch, testing: false, result };
        }));
        i++;
        next();
      }, 80 + Math.random() * 60);
    };
    next();
  }, [scanning, channels.length]);

  const passCount = channels.filter(c => c.result === 'pass').length;
  const failCount = channels.filter(c => c.result === 'fail' || c.result === 'short').length;
  const openCount = channels.filter(c => c.result === 'open').length;

  return (
    <div className="flex flex-col h-full br2049-rain" style={{ background: 'hsl(220 18% 3%)' }}>
      {/* Header — BR2049 Terminal */}
      <div
        className={cn("flex items-center justify-between border-b", fs ? "px-4 py-2.5" : "px-2 py-1.5")}
        style={{ borderColor: 'hsl(32 100% 50% / 0.1)', background: 'hsl(220 14% 5%)' }}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full animate-amber-pulse" style={{ background: 'hsl(32 100% 50%)' }} />
          <span
            className={cn("font-mono font-bold uppercase tracking-[0.25em]", fs ? "text-[10px]" : "text-[8px]")}
            style={{ color: 'hsl(32 100% 60%)' }}
          >
            DIAGNOSTICS TERMINAL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={scanAll}
            disabled={scanning || !currentSlave?.connected}
            className={cn("font-mono text-[8px] tracking-wider uppercase", fs ? "h-7 px-3" : "h-5 px-2")}
            style={{ color: 'hsl(32 100% 55%)' }}
          >
            <RefreshCw className={cn(fs ? "w-3 h-3 mr-1" : "w-2.5 h-2.5 mr-0.5", scanning && "animate-spin")} />
            SCAN ALL
          </Button>
        </div>
      </div>

      {/* Slave selector */}
      <div
        className={cn("flex gap-1 border-b", fs ? "px-4 py-2" : "px-2 py-1")}
        style={{ borderColor: 'hsl(32 100% 50% / 0.06)', background: 'hsl(220 14% 4%)' }}
      >
        {slaves.map((slave, i) => (
          <button
            key={i}
            onClick={() => selectSlave(i)}
            className={cn(
              "flex items-center gap-1.5 rounded border transition-all",
              fs ? "px-3 py-2 text-[9px]" : "px-2 py-1 text-[8px]",
              selectedSlave === i
                ? "border-[hsl(32_100%_50%/0.4)] text-[hsl(32_100%_65%)]"
                : slave.connected
                  ? "border-border/15 text-muted-foreground/50 hover:border-border/30"
                  : "border-border/5 text-muted-foreground/20"
            )}
            style={selectedSlave === i ? { background: 'hsl(32 100% 50% / 0.08)' } : { background: 'hsl(220 12% 6%)' }}
          >
            {slave.connected
              ? <Wifi className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5", "text-green-400/60")} />
              : <WifiOff className={cn(fs ? "w-3 h-3" : "w-2.5 h-2.5")} />
            }
            <span className="font-mono font-bold">ADDR {String(i).padStart(2, '0')}</span>
          </button>
        ))}
      </div>

      {/* Slave telemetry bar */}
      {currentSlave && (
        <div
          className={cn("flex items-center gap-3 border-b", fs ? "px-4 py-2 text-[9px]" : "px-2 py-1.5 text-[8px]")}
          style={{ borderColor: 'hsl(32 100% 50% / 0.06)', background: 'hsl(220 12% 4%)' }}
        >
          <div className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", currentSlave.connected ? "bg-green-500 shadow-[0_0_6px_#22cc44]" : "bg-red-500")} />
            <span className={cn("font-mono font-bold", currentSlave.connected ? "text-green-400/70" : "text-red-400/70")}>
              {currentSlave.connected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          {currentSlave.batteryVoltage && (
            <div className="flex items-center gap-1 text-muted-foreground/40 font-mono">
              {currentSlave.batteryVoltage > 11
                ? <Battery className="w-3 h-3 text-green-400/60" />
                : <BatteryLow className="w-3 h-3 text-amber-400" />
              }
              {currentSlave.batteryVoltage.toFixed(2)}V
            </div>
          )}
          {currentSlave.signalStrength !== undefined && (
            <span className="text-muted-foreground/40 font-mono">RF: {currentSlave.signalStrength}%</span>
          )}

          {/* Scan progress bar */}
          {scanning && (
            <div className="flex-1 ml-2">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(220 12% 8%)' }}>
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${((scanProgress + 1) / 32) * 100}%`,
                    background: 'linear-gradient(90deg, hsl(32 100% 50% / 0.6), hsl(32 100% 60%))',
                    boxShadow: '0 0 8px hsl(32 100% 50% / 0.4)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Summary counters */}
          {!scanning && channels.some(c => c.result !== 'untested') && (
            <div className="flex items-center gap-3 ml-auto font-mono font-bold">
              <span className="text-green-400/80">✓ {passCount}</span>
              <span className="text-red-400/80">✗ {failCount}</span>
              <span className="text-amber-400/80">○ {openCount}</span>
            </div>
          )}
        </div>
      )}

      {/* 32-Channel Grid */}
      <div className={cn("flex-1 overflow-y-auto", fs ? "p-4" : "p-2")}>
        {currentSlave?.connected ? (
          <div className={cn("grid", fs ? "grid-cols-8 gap-2" : "grid-cols-8 gap-1")} style={{ maxWidth: fs ? 640 : 400, margin: '0 auto' }}>
            {channels.map((ch) => (
              <button
                key={ch.position}
                onClick={() => !scanning && testChannel(ch.position)}
                disabled={scanning}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-lg border transition-all",
                  fs ? "h-16 min-w-[60px]" : "h-11 min-w-[40px]",
                  ch.testing && "animate-channel-scan",
                  ch.result === 'pass'
                    ? "border-green-500/40"
                    : ch.result === 'fail' || ch.result === 'short'
                      ? "border-red-500/40"
                      : ch.result === 'open'
                        ? "border-amber-500/30"
                        : ch.connected
                          ? "border-border/20 hover:border-[hsl(32_100%_50%/0.3)]"
                          : "border-border/10"
                )}
                style={{
                  background: ch.testing
                    ? 'hsl(32 100% 50% / 0.1)'
                    : ch.result === 'pass'
                      ? 'hsl(120 70% 38% / 0.08)'
                      : ch.result === 'fail' || ch.result === 'short'
                        ? 'hsl(0 85% 48% / 0.08)'
                        : ch.result === 'open'
                          ? 'hsl(45 100% 50% / 0.05)'
                          : 'hsl(220 14% 6%)',
                }}
              >
                {/* Channel number */}
                <span className={cn(
                  "font-mono font-black",
                  fs ? "text-sm" : "text-[10px]",
                  ch.connected ? "text-foreground/70" : "text-muted-foreground/20"
                )}>
                  {(ch.position + 1).toString().padStart(2, '0')}
                </span>

                {/* Resistance bar */}
                {ch.resistance !== undefined && ch.connected && (
                  <div className={cn("w-[80%] rounded-full overflow-hidden mt-0.5", fs ? "h-1.5" : "h-1")} style={{ background: 'hsl(220 12% 8%)' }}>
                    <div
                      className={cn("h-full rounded-full transition-all", getResistanceColor(ch.resistance))}
                      style={{ width: `${Math.min(100, (ch.resistance / 4.5) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Resistance value */}
                {ch.resistance !== undefined && ch.connected && (
                  <span className={cn("font-mono text-muted-foreground/30", fs ? "text-[7px]" : "text-[6px]")}>
                    {ch.resistance.toFixed(1)}Ω
                  </span>
                )}

                {/* Result icon */}
                {ch.result !== 'untested' && (
                  <div className="absolute top-0.5 right-0.5">
                    {getResultIcon(ch.result)}
                  </div>
                )}

                {/* Status dot */}
                <div className={cn(
                  "absolute top-0.5 left-0.5 rounded-full",
                  fs ? "w-2 h-2" : "w-1.5 h-1.5",
                  ch.testing
                    ? "bg-[hsl(32_100%_50%)] shadow-[0_0_6px_hsl(32_100%_50%/0.6)]"
                    : ch.connected
                      ? "bg-green-500/60 shadow-[0_0_3px_#22cc44]"
                      : "bg-red-500/30"
                )} />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground/20 text-sm font-mono">SLAVE OFFLINE — NO DATA</span>
          </div>
        )}
      </div>

      {/* Legend bar */}
      <div
        className={cn("flex items-center justify-center gap-5 border-t", fs ? "py-2.5 text-[8px]" : "py-1.5 text-[7px]")}
        style={{ borderColor: 'hsl(32 100% 50% / 0.06)', background: 'hsl(220 14% 4%)' }}
      >
        <div className="flex items-center gap-1"><CheckCircle className="w-2.5 h-2.5 text-green-400" /><span className="text-muted-foreground/40 font-mono">PASS</span></div>
        <div className="flex items-center gap-1"><XCircle className="w-2.5 h-2.5 text-red-400" /><span className="text-muted-foreground/40 font-mono">FAIL</span></div>
        <div className="flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5 text-amber-400" /><span className="text-muted-foreground/40 font-mono">OPEN</span></div>
        <div className="flex items-center gap-1"><Zap className="w-2.5 h-2.5 text-red-500" /><span className="text-muted-foreground/40 font-mono">SHORT</span></div>
        <div className="flex items-center gap-1 ml-2"><span className="text-muted-foreground/25 font-mono">CLICK CHANNEL TO TEST</span></div>
      </div>
    </div>
  );
}
