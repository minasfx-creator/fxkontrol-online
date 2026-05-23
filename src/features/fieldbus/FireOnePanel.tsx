/**
 * ─── FireOnePanel — XLII+ / XL4-3 live operations ─────────────────
 *
 * Real-time view + control surface for FireOne firing modules.
 * Every write call goes through useFireOneFleet (which routes through
 * uiCommandGateway). Telemetry is read-only off the serial transport.
 */

import { useMemo, useState } from 'react';
import {
  Cable, ShieldCheck, ShieldOff, Wifi, WifiOff, Activity, Zap,
  PlugZap, Power, AlertTriangle, RadioTower, CircleDot, Battery,
} from 'lucide-react';
import { useFireOneFleet, type FireOneLinkMode } from '@/features/fieldbus/useFireOneFleet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MODE_OPTIONS: { value: FireOneLinkMode; label: string; icon: typeof Cable }[] = [
  { value: 'cable',    label: 'CABLE',    icon: Cable      },
  { value: 'wireless', label: 'WIRELESS', icon: RadioTower },
  { value: 'auto',     label: 'AUTO',     icon: Wifi       },
];

const STATE_TONE: Record<string, string> = {
  connected:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  connecting:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  error:        'bg-red-500/15 text-red-400 border-red-500/30',
  disconnected: 'bg-muted/15 text-muted-foreground border-border/30',
};

export default function FireOnePanel() {
  const fleet = useFireOneFleet();
  const { state } = fleet;
  const slats = useMemo(
    () => Object.values(state.modules).sort((a, b) => a.moduleAddress - b.moduleAddress),
    [state.modules],
  );
  const [selectedSlat, setSelectedSlat] = useState<number | null>(null);

  const linkOk = state.link === 'connected';

  // Fleet-wide aggregates (honest: only over actually-replied slats)
  const wired    = slats.filter(s => (s as any).connectionMode === 'wired').length;
  const wireless = slats.filter(s => (s as any).connectionMode === 'wireless').length;
  const wlSlats  = slats.filter(s => typeof s.rssiDbm === 'number');
  const avgRssi  = wlSlats.length
    ? Math.round(wlSlats.reduce((a, s) => a + (s.rssiDbm ?? 0), 0) / wlSlats.length)
    : null;
  const minBat   = slats.length
    ? Math.min(...slats.map(s => s.batteryVoltage || 99))
    : null;
  const batLow   = minBat !== null && minBat < 11.0;

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Cable className="w-4 h-4 text-[hsl(190_70%_58%)]" />
            <h1 className="text-sm font-mono font-bold tracking-[0.2em] uppercase text-[hsl(190_70%_58%)]">
              FireOne XL4-3 / XLII+ — Live Ops
            </h1>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            USB-FTDI direct link (9600 8N1). Continuity, RSSI and continuity probes
            are read-only telemetry. ARM / FIRE / E-STOP go through the unified
            UI Command Gateway with hold-to-confirm.
          </p>
        </div>

        {/* Connection bar — per-link badges + mode toggle */}
        <div className="rounded-lg border border-border/40 bg-card/30 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-mono font-bold tracking-[0.18em] px-2 py-1 rounded border inline-flex items-center gap-1', STATE_TONE[state.cable.state])}>
              <Cable className="w-3 h-3" /> CABLE · {state.cable.state.toUpperCase()}
            </span>
            <span className={cn('text-[10px] font-mono font-bold tracking-[0.18em] px-2 py-1 rounded border inline-flex items-center gap-1', STATE_TONE[state.radio.state])}>
              <RadioTower className="w-3 h-3" /> RADIO · {state.radio.state.toUpperCase()}
            </span>
            {state.error && (
              <span className="text-[10px] font-mono text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {state.error}
              </span>
            )}
            <div className="ml-auto inline-flex rounded border border-border/40 overflow-hidden">
              {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button key={value}
                  onClick={() => fleet.setMode(value)}
                  aria-pressed={state.mode === value}
                  className={cn(
                    'px-2 py-1 text-[10px] font-mono inline-flex items-center gap-1 border-r border-border/40 last:border-r-0 transition-colors',
                    state.mode === value
                      ? 'bg-[hsl(190_70%_58%)]/20 text-[hsl(190_70%_58%)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/40',
                  )}
                >
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Fleet aggregates strip */}
          <div className="flex items-center gap-3 flex-wrap text-[10px] font-mono text-muted-foreground">
            <span>Slats: <span className="text-foreground">{slats.length}</span></span>
            <span>Wired: <span className="text-foreground">{wired}</span></span>
            <span>Wireless: <span className="text-foreground">{wireless}</span></span>
            {avgRssi !== null && (
              <span className={cn('inline-flex items-center gap-1', avgRssi < -85 && 'text-amber-400')}>
                <Wifi className="w-3 h-3" /> avg {avgRssi} dBm
              </span>
            )}
            {minBat !== null && (
              <span className={cn('inline-flex items-center gap-1', batLow && 'text-amber-400')}>
                <Battery className="w-3 h-3" /> min {minBat.toFixed(1)} V
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-2">
              {!linkOk ? (
                <Button size="sm" onClick={() => void fleet.connect()} className="h-7 text-[10px] font-mono">
                  <PlugZap className="w-3 h-3 mr-1" /> CONNECT
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => void fleet.disconnect()} className="h-7 text-[10px] font-mono">
                  <Power className="w-3 h-3 mr-1" /> DISCONNECT
                </Button>
              )}
            </span>
          </div>
        </div>

        {/* Global ARM / DISARM / E-STOP */}
        <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex items-center gap-2 flex-wrap">
          <Button size="sm" disabled={!linkOk} onClick={fleet.arm}
            className="h-8 text-[10px] font-mono gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-30">
            <ShieldCheck className="w-3 h-3" /> ARM
          </Button>
          <Button size="sm" disabled={!linkOk} onClick={fleet.disarm}
            variant="outline" className="h-8 text-[10px] font-mono gap-1">
            <ShieldOff className="w-3 h-3" /> DISARM
          </Button>
          <Button size="sm" onClick={fleet.eStop}
            className="h-8 text-[10px] font-mono gap-1 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30">
            <Power className="w-3 h-3" /> E-STOP
          </Button>
          <span className="text-[9px] font-mono text-muted-foreground/70 ml-auto">
            Hold-to-Confirm aplicado downstream pelo SafetyStateMachine.
          </span>
        </div>

        {/* No modules */}
        {linkOk && slats.length === 0 && (
          <div className="rounded-lg border border-border/40 bg-card/20 p-6 text-center text-xs font-mono text-muted-foreground/80 space-y-2">
            <Activity className="w-4 h-4 mx-auto text-amber-400" />
            <p>No live FireOne module detected on the bus.</p>
            <p className="text-[10px]">Send IDENTIFY again or check RS-485 wiring.</p>
          </div>
        )}

        {/* Slat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {slats.map(slat => {
            const open = selectedSlat === slat.moduleAddress;
            return (
              <div key={slat.moduleAddress}
                className={cn(
                  'rounded-lg border p-3 space-y-2 transition-colors',
                  slat.armed ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border/40 bg-card/30',
                )}>
                <div className="flex items-center gap-2">
                  <CircleDot className={cn('w-3 h-3', slat.armed ? 'text-emerald-400' : 'text-muted-foreground')} />
                  <span className="text-[11px] font-mono font-bold tracking-[0.18em] text-foreground">
                    SLAT {slat.moduleAddress.toString().padStart(2, '0')}
                  </span>
                  {slat.connectionMode && (
                    <span className={cn(
                      'text-[8px] font-mono font-bold tracking-[0.16em] px-1.5 py-0.5 rounded border',
                      slat.connectionMode === 'wired'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : slat.connectionMode === 'fallback'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
                    )}>
                      {slat.connectionMode.toUpperCase()}
                    </span>
                  )}
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                    fw {slat.firmwareVersion || '?'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-muted-foreground">
                  <span className={cn(slat.batteryVoltage > 0 && slat.batteryVoltage < 11.0 && 'text-amber-400')}>
                    Bat <span className="text-foreground">{slat.batteryVoltage.toFixed(1)}V</span>
                  </span>
                  <span>T <span className="text-foreground">{slat.temperature.toFixed(0)}°C</span></span>
                  <span className={cn(
                    'flex items-center gap-1',
                    typeof slat.rssiDbm === 'number' && slat.rssiDbm < -85 && 'text-amber-400',
                  )}>
                    {slat.wireless ? <Wifi className="w-3 h-3 text-cyan-400" /> : <WifiOff className="w-3 h-3" />}
                    <span className="text-foreground">
                      {typeof slat.rssiDbm === 'number' ? `${slat.rssiDbm}dBm` : '—'}
                    </span>
                  </span>
                </div>

                {/* Igniter grid 32 */}
                <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
                  {Array.from({ length: 32 }, (_, i) => {
                    const ig = slat.igniters.find(x => x.position === i + 1);
                    const cls = !ig
                      ? 'bg-muted/20'
                      : !ig.connected
                        ? 'bg-amber-500/40'
                        : ig.continuityOk
                          ? 'bg-emerald-500/60'
                          : 'bg-red-500/60';
                    return (
                      <button key={i}
                        title={`cue ${i + 1}${ig ? ` · ${ig.resistance.toFixed(1)}Ω` : ''}`}
                        onClick={() => fleet.fire(slat.moduleAddress, i + 1)}
                        disabled={!linkOk}
                        className={cn('h-3 rounded-sm', cls, 'hover:ring-1 hover:ring-cyan-300/60 disabled:opacity-40')}
                      />
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 flex-wrap pt-1">
                  <Button size="sm" variant="outline" onClick={() => fleet.continuityCheck(slat.moduleAddress)}
                    className="h-6 text-[9px] font-mono gap-1">
                    <Zap className="w-3 h-3" /> CONTINUITY
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => fleet.queryWireless(slat.moduleAddress)}
                    className="h-6 text-[9px] font-mono gap-1">
                    <RadioTower className="w-3 h-3" /> RADIO
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedSlat(open ? null : slat.moduleAddress)}
                    className="h-6 text-[9px] font-mono ml-auto">
                    {open ? 'HIDE' : 'DETAILS'}
                  </Button>
                </div>

                {open && (
                  <div className="mt-2 rounded border border-border/40 bg-background/40 p-2 space-y-1 text-[9px] font-mono">
                    <div>Channel: {slat.wirelessChannel ?? '—'} · Loss: {slat.packetLoss?.toFixed(1) ?? '—'}%</div>
                    <div>Mode: {slat.connectionMode ?? '—'} · UltraFire: {slat.ultraFireVerified ? 'verified' : 'unverified'}</div>
                    {slat.errors.length > 0 && (
                      <div className="text-red-400">{slat.errors.join(' · ')}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
