/**
 * FXK16FieldSettingsPanel — Operator-facing configuration card for the
 * FXK16 FieldTest harness.
 *
 * Surfaces:
 *   • Device picker — lists FXK16 entries known to portRegistry; "Auto"
 *     means use the first available device.
 *   • Transport preference (auto / USB / BLE).
 *   • Test mode (manual, self-test, continuity sweep, burst).
 *   • Mode-specific parameters (duration, channel, sweep interval, burst).
 *   • Auto-disarm timeout + batch-confirm safety toggle.
 *
 * State is persisted via fxk16FieldConfigStore (localStorage).
 * NEVER stores ARM state — that is session-scoped by design.
 */
import { useMemo } from 'react';
import {
  Settings, Cable, Usb, Bluetooth, Wand2, Shield, RotateCcw,
  ChevronDown, ChevronUp, Activity, Flame, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useFxk16FieldConfig } from '@/hooks/useFxk16FieldConfig';
import { useState, useEffect, useCallback } from 'react';
import { portRegistry, type PortRegistryEntry } from '@/core/discovery/portRegistry';
import { useFXK16Bridge } from '@/hooks/useFXK16Bridge';
import { cn } from '@/lib/utils';
import type { Fxk16TestMode, Fxk16TransportPref } from '@/components/field/fxk16FieldConfigStore';

const MODE_OPTIONS: { id: Fxk16TestMode; label: string; sub: string; icon: typeof Wand2 }[] = [
  { id: 'manual',            label: 'Manual',     sub: 'fire por canal',         icon: Flame },
  { id: 'self_test',         label: 'Self-test',  sub: 'arm→fire ch1→disarm',    icon: Activity },
  { id: 'continuity_sweep',  label: 'Sweep',      sub: 'todos canais sequencial', icon: Wand2 },
  { id: 'burst',             label: 'Burst',      sub: 'N pulsos no mesmo canal', icon: Zap },
];

const TRANSPORT_OPTIONS: { id: Fxk16TransportPref; label: string; icon: typeof Cable }[] = [
  { id: 'auto', label: 'AUTO', icon: Cable },
  { id: 'usb',  label: 'USB',  icon: Usb },
  { id: 'ble',  label: 'BLE',  icon: Bluetooth },
];

interface FXK16Device {
  key: string;
  label: string;
  transport: 'usb' | 'ble' | 'unknown';
  lastSeen: number;
}

function isFxk16Entry(e: PortRegistryEntry): boolean {
  const label = (e.lastLabel ?? '').toUpperCase();
  return label.includes('FXK16') || label.includes('FXK-PYRO') || label.startsWith('FXK');
}

function entryTransport(e: PortRegistryEntry): FXK16Device['transport'] {
  if (e.preferredTransport === 'serial' || e.preferredTransport === 'webusb') return 'usb';
  if (e.preferredTransport === 'ble') return 'ble';
  if (e.host) return 'usb'; // net-attached not relevant for FXK16; treat as wired
  return 'unknown';
}

export default function FXK16FieldSettingsPanel() {
  const { config, set, reset } = useFxk16FieldConfig();
  const bridge = useFXK16Bridge();
  const [open, setOpen] = useState(true);
  const [devices, setDevices] = useState<FXK16Device[]>([]);

  // Refresh the device picker from portRegistry. Cheap synchronous read.
  const refreshDevices = useCallback(() => {
    const entries = portRegistry.list().filter(isFxk16Entry);
    setDevices(entries.map((e) => ({
      key: e.key,
      label: e.lastLabel || e.key,
      transport: entryTransport(e),
      lastSeen: e.lastSeen,
    })).sort((a, b) => b.lastSeen - a.lastSeen));
  }, []);

  useEffect(() => {
    refreshDevices();
    // Re-poll when the bridge connection state flips — a fresh connect may
    // upsert a new entry.
    const id = setInterval(refreshDevices, 3000);
    return () => clearInterval(id);
  }, [refreshDevices, bridge.isConnected]);

  const selectedDeviceLabel = useMemo(() => {
    if (!config.deviceKey) return 'Auto (primeiro disponível)';
    return devices.find((d) => d.key === config.deviceKey)?.label ?? config.deviceKey;
  }, [config.deviceKey, devices]);

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 backdrop-blur-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-card/50 transition-colors"
      >
        <Settings className="w-3.5 h-3.5 text-[hsl(190_100%_60%)]" />
        <span className="text-[10px] font-mono font-bold tracking-[0.18em] uppercase text-foreground/85">
          FXK16 · CONFIG
        </span>
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-cyan-500/40 text-cyan-300">
          {MODE_OPTIONS.find((m) => m.id === config.mode)?.label.toUpperCase()}
        </Badge>
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-blue-500/40 text-blue-300">
          {config.transport.toUpperCase()}
        </Badge>
        <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono border-foreground/20 text-muted-foreground/80 truncate max-w-[140px]">
          {selectedDeviceLabel}
        </Badge>
        <span className="ml-auto">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground/60" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />}
        </span>
      </button>

      {open && (
        <div className="border-t border-border/30 p-3 space-y-4">
          {/* ── Device picker ─────────────────────────────────── */}
          <section className="space-y-1.5">
            <Label className="text-[9px] font-mono tracking-[0.18em] uppercase text-muted-foreground/70">
              Dispositivo FXK16
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => set({ deviceKey: null })}
                className={cn(
                  'h-7 px-2 rounded-md border text-[10px] font-mono font-bold transition-all',
                  config.deviceKey === null
                    ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                    : 'border-border/40 bg-card/30 text-muted-foreground/70 hover:bg-card/60',
                )}
              >
                AUTO
              </button>
              {devices.length === 0 && (
                <span className="text-[10px] font-mono text-muted-foreground/40 self-center">
                  Nenhum FXK16 pareado — conecte pela aba acima ou /pairing
                </span>
              )}
              {devices.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => set({ deviceKey: d.key })}
                  className={cn(
                    'h-7 px-2 rounded-md border text-[10px] font-mono font-bold transition-all flex items-center gap-1.5 max-w-[220px]',
                    config.deviceKey === d.key
                      ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-300'
                      : 'border-border/40 bg-card/30 text-muted-foreground/80 hover:bg-card/60',
                  )}
                  title={d.key}
                >
                  {d.transport === 'usb' && <Usb className="w-3 h-3 shrink-0" />}
                  {d.transport === 'ble' && <Bluetooth className="w-3 h-3 shrink-0" />}
                  {d.transport === 'unknown' && <Cable className="w-3 h-3 shrink-0" />}
                  <span className="truncate">{d.label}</span>
                </button>
              ))}
              <Button size="sm" variant="ghost" onClick={refreshDevices} className="h-7 text-[10px] gap-1 ml-auto">
                <RotateCcw className="w-3 h-3" /> Refresh
              </Button>
            </div>
          </section>

          {/* ── Transport ────────────────────────────────────── */}
          <section className="space-y-1.5">
            <Label className="text-[9px] font-mono tracking-[0.18em] uppercase text-muted-foreground/70">
              Transporte preferido
            </Label>
            <div className="flex gap-1.5">
              {TRANSPORT_OPTIONS.map((t) => {
                const Icon = t.icon;
                const active = config.transport === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => set({ transport: t.id })}
                    className={cn(
                      'flex-1 h-8 rounded-md border text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all',
                      active
                        ? 'border-blue-500/60 bg-blue-950/40 text-blue-300'
                        : 'border-border/40 bg-card/30 text-muted-foreground/70 hover:bg-card/60',
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Operation mode ───────────────────────────────── */}
          <section className="space-y-1.5">
            <Label className="text-[9px] font-mono tracking-[0.18em] uppercase text-muted-foreground/70">
              Modo de operação
            </Label>
            <div className="grid grid-cols-2 gap-1.5">
              {MODE_OPTIONS.map((m) => {
                const Icon = m.icon;
                const active = config.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set({ mode: m.id })}
                    className={cn(
                      'h-12 rounded-md border text-left px-2.5 py-1 transition-all flex items-center gap-2',
                      active
                        ? 'border-orange-500/60 bg-orange-950/30 text-orange-200'
                        : 'border-border/40 bg-card/30 text-muted-foreground/70 hover:bg-card/60',
                    )}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', active && 'text-orange-300')} />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[10px] font-mono font-bold uppercase">{m.label}</span>
                      <span className="text-[9px] font-mono text-muted-foreground/60">{m.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Mode-specific params ─────────────────────────── */}
          <section className="grid grid-cols-2 gap-2">
            <NumField
              label="DURATION (ms)"
              value={config.durationMs}
              min={1}
              max={10_000}
              onChange={(v) => set({ durationMs: v })}
            />
            <NumField
              label="DEFAULT CHANNEL"
              value={config.defaultChannel}
              min={1}
              max={16}
              onChange={(v) => set({ defaultChannel: v })}
            />
            {config.mode === 'continuity_sweep' && (
              <NumField
                label="SWEEP INTERVAL (ms)"
                value={config.sweepIntervalMs}
                min={50}
                max={5_000}
                onChange={(v) => set({ sweepIntervalMs: v })}
              />
            )}
            {config.mode === 'burst' && (
              <>
                <NumField
                  label="BURST REPEAT"
                  value={config.burstRepeat}
                  min={1}
                  max={50}
                  onChange={(v) => set({ burstRepeat: v })}
                />
                <NumField
                  label="BURST INTERVAL (ms)"
                  value={config.burstIntervalMs}
                  min={50}
                  max={5_000}
                  onChange={(v) => set({ burstIntervalMs: v })}
                />
              </>
            )}
          </section>

          {/* ── Safety guards ────────────────────────────────── */}
          <section className="rounded-md border border-amber-500/20 bg-amber-950/10 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] font-mono font-bold tracking-[0.18em] uppercase text-amber-300/90">
                Safety guards
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 items-end">
              <NumField
                label="AUTO-DISARM (ms, 0=off)"
                value={config.autoDisarmAfterMs}
                min={0}
                max={600_000}
                step={1000}
                onChange={(v) => set({ autoDisarmAfterMs: v })}
              />
              <label className="flex items-center justify-between gap-2 h-9 px-2 rounded-md border border-border/40 bg-card/30">
                <span className="text-[10px] font-mono text-foreground/80">
                  Confirmar BATCH
                </span>
                <Switch
                  checked={config.confirmBatch}
                  onCheckedChange={(v) => set({ confirmBatch: !!v })}
                />
              </label>
            </div>
          </section>

          {/* ── Footer ───────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[9px] font-mono text-muted-foreground/50">
              Persistido em localStorage · não salva ARM (session-scoped)
            </span>
            <Button size="sm" variant="ghost" onClick={reset} className="h-6 text-[9px] gap-1">
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
function NumField({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] font-mono tracking-[0.18em] uppercase text-muted-foreground/70">
        {label}
      </span>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const raw = parseInt(e.target.value || `${min}`, 10);
          if (Number.isFinite(raw)) onChange(Math.max(min, Math.min(max, raw)));
        }}
        className="h-8 text-xs font-mono"
      />
    </label>
  );
}
