/**
 * ─── DevSimulationPanel ────────────────────────────────────────────
 * Dev-only UI to drive the TransportEmulator against the live bridge.
 * Lets QA simulate BLE/WiFi pathologies without burning real hardware.
 *
 * Renders a no-op in production builds (guarded by import.meta.env.DEV).
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { TransportEmulator } from '@/dev/transportEmulator';
import { EMU_PROFILES, EMU_PROFILE_DESCRIPTIONS, type EmuProfileName } from '@/dev/emulatorProfiles';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { FlaskConical, PlugZap, Radio, Download, Trash2, Play, Square, Upload, SkipForward, Pause } from 'lucide-react';

const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;

export default function DevSimulationPanel() {
  const [enabled, setEnabled] = useState(false);
  const [profile, setProfile] = useState<EmuProfileName>('CLEAN');
  const [latency, setLatency] = useState(0);
  const [jitter, setJitter] = useState(0);
  const [loss, setLoss] = useState(0);
  const [tx, setTx] = useState(0);
  const [rx, setRx] = useState(0);
  const [connected, setConnected] = useState(true);
  const emuRef = useRef<TransportEmulator | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardown = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    if (emuRef.current) { emuRef.current.destroy(); emuRef.current = null; }
    setTx(0); setRx(0); setConnected(true);
  }, []);

  const spinUp = useCallback((p: EmuProfileName) => {
    teardown();
    const cfg = { ...EMU_PROFILES[p] } as { mode: string; latencyMs?: number; jitterMs?: number; lossRate?: number };
    const emu = new TransportEmulator(EMU_PROFILES[p]);
    emuRef.current = emu;
    setLatency(cfg.latencyMs ?? 0);
    setJitter(cfg.jitterMs ?? 0);
    setLoss((cfg.lossRate ?? 0) * 100);
    setConnected(true);
    emu.onStateChange(s => setConnected(s === 'connected'));
    tickRef.current = setInterval(() => {
      const trace = emu.exportTrace().frames;
      setTx(trace.filter(f => f.dir === 'tx').length);
      setRx(trace.filter(f => f.dir === 'rx').length);
    }, 250);
  }, [teardown]);

  useEffect(() => () => teardown(), [teardown]);

  useEffect(() => {
    if (enabled) spinUp(profile);
    else teardown();
  }, [enabled, profile, spinUp, teardown]);

  // Live slider overrides
  useEffect(() => { emuRef.current?.setLatency(latency); }, [latency]);
  useEffect(() => { emuRef.current?.setJitter(jitter); }, [jitter]);
  useEffect(() => { emuRef.current?.setLossRate(loss / 100); }, [loss]);

  const handleExport = () => {
    if (!emuRef.current) return;
    const trace = emuRef.current.exportTrace();
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emu-trace-${profile}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isDev) return null;

  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-2 font-mono">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-amber-400" />
        <span className="text-[10px] font-bold tracking-widest text-foreground uppercase">Dev Simulation Panel</span>
        <span className="text-[7px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">DEV ONLY</span>
        <Button size="sm" variant={enabled ? 'destructive' : 'default'}
          className="h-6 px-2 text-[8px] ml-auto"
          onClick={() => setEnabled(e => !e)}>
          {enabled ? <Square className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
          {enabled ? 'STOP' : 'START EMULATOR'}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[7px] text-muted-foreground uppercase">Failure Profile</span>
          <select
            disabled={!enabled}
            value={profile}
            onChange={(e) => setProfile(e.target.value as EmuProfileName)}
            className="text-[9px] bg-background border border-border/40 rounded px-2 py-1 disabled:opacity-40"
          >
            {(Object.keys(EMU_PROFILES) as EmuProfileName[]).map(p => (
              <option key={p} value={p}>{p} — {EMU_PROFILE_DESCRIPTIONS[p]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2 items-end">
          <Stat label="TX" value={tx} color="text-cyan-400" />
          <Stat label="RX" value={rx} color="text-emerald-400" />
          <Stat label="LINK" value={connected ? 'UP' : 'DOWN'} color={connected ? 'text-emerald-400' : 'text-red-400'} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-1">
        <SliderRow label={`Latency ${latency}ms`} value={latency} max={500} step={5} onChange={setLatency} disabled={!enabled} />
        <SliderRow label={`Jitter ±${jitter}ms`} value={jitter} max={200} step={5} onChange={setJitter} disabled={!enabled} />
        <SliderRow label={`Loss ${loss.toFixed(0)}%`} value={loss} max={100} step={1} onChange={setLoss} disabled={!enabled} />
      </div>

      <div className="flex items-center gap-1 mt-1">
        <Button size="sm" variant="ghost" disabled={!enabled} onClick={() => emuRef.current?.forceDisconnect()}
          className="h-6 px-2 text-[8px] gap-1 text-red-400">
          <PlugZap className="w-3 h-3" /> DISCONNECT
        </Button>
        <Button size="sm" variant="ghost" disabled={!enabled} onClick={() => emuRef.current?.reconnect()}
          className="h-6 px-2 text-[8px] gap-1 text-emerald-400">
          <Radio className="w-3 h-3" /> RECONNECT
        </Button>
        <Button size="sm" variant="ghost" disabled={!enabled} onClick={handleExport}
          className="h-6 px-2 text-[8px] gap-1 text-cyan-400">
          <Download className="w-3 h-3" /> EXPORT TRACE
        </Button>
        <Button size="sm" variant="ghost" disabled={!enabled} onClick={() => emuRef.current?.resetLog()}
          className="h-6 px-2 text-[8px] gap-1 text-muted-foreground ml-auto">
          <Trash2 className="w-3 h-3" /> CLEAR
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-end">
      <span className="text-[7px] text-muted-foreground uppercase">{label}</span>
      <span className={cn('text-xs font-bold', color)}>{value}</span>
    </div>
  );
}

function SliderRow({ label, value, max, step, onChange, disabled }: {
  label: string; value: number; max: number; step: number; onChange: (n: number) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[7px] text-muted-foreground uppercase">{label}</span>
      <Slider value={[value]} max={max} step={step} onValueChange={(v) => onChange(v[0])} disabled={disabled} />
    </div>
  );
}
