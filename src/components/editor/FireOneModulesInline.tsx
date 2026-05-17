/**
 * FireOneModulesInline — compact roster of FXK / FXK-M1 / IFMx-i32Q / ESP32
 * modules currently seen by the Pyro Console, regardless of transport
 * (RS-485 / USB / BLE / BLE-LR / WebSocket / Wi-Fi-Direct / Art-Net / 2-Wire),
 * **grouped by controller** (XL4 Gateway / XL2 Gateway / RS-485 Cable / …).
 *
 * Honest hardware: rows reflect what `useFireOneHardware().modules` actually
 * contains (sourced from the controller AND moduleAggregator). Empty roster =
 * "no modules answered yet" — never synthesised. Read-only: this component
 * never arms/disarms/fires.
 */
import { useMemo } from 'react';
import { Cpu, Battery, Signal, Radio, Cable, RefreshCcw, AlertTriangle, Bluetooth, Wifi, Antenna, Plug } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FireOneModuleStatus } from '@/lib/fireoneProtocol';

export interface FireOneModulesInlineProps {
  modules: Map<number, FireOneModuleStatus>;
  isConnected: boolean;
  /** Optional aggregator-derived rows (used when two controllers reply on the
   *  same address — Map<number> would collapse them). Merged with `modules`
   *  by `controllerId#address`. */
  extraRows?: FireOneModuleStatus[];
  onRescan?: (controllerId?: string) => void | Promise<void>;
  /** Optional cap so the dropdown stays compact on the hub. */
  maxRows?: number;
}

function fmtAge(ts: number | undefined, now: number): string {
  if (!ts) return '—';
  const s = Math.round((now - ts) / 1000);
  if (s < 1) return 'now';
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

function transportIcon(t: FireOneModuleStatus['transport'] | undefined) {
  switch (t) {
    case 'ble':
    case 'ble_lr': return Bluetooth;
    case 'usb':
    case 'direct_relay': return Plug;
    case 'websocket':
    case 'wifi_direct': return Wifi;
    case 'artnet': return Antenna;
    case 'two_wire': return Cable;
    case 'serial':
    default: return Cable;
  }
}

function transportLabel(m: FireOneModuleStatus): string {
  if (m.transport === 'ble') return 'BLE';
  if (m.transport === 'ble_lr') return 'BLE-LR';
  if (m.transport === 'usb') return 'USB';
  if (m.transport === 'direct_relay') return 'RELAY';
  if (m.transport === 'websocket') return 'WS';
  if (m.transport === 'wifi_direct') return 'WiFi-D';
  if (m.transport === 'artnet') return 'ArtNet';
  if (m.transport === 'two_wire') return '2-Wire';
  if (m.transport === 'serial') return 'RS485';
  if (m.connectionMode === 'fallback') return 'WL-FB';
  if (m.connectionMode === 'wireless') return 'WL';
  return 'RS485';
}

function controllerHeaderLabel(m: FireOneModuleStatus): string {
  return m.controllerLabel ?? `${transportLabel(m)}${m.controllerId ? ` · ${m.controllerId.slice(-6)}` : ''}`;
}

const MODEL_COLOR: Record<string, string> = {
  'FXK': 'text-orange-400',
  'FXK-M1': 'text-cyan-300',
  'IFMx-i32Q': 'text-amber-400',
  'ESP32-Generic': 'text-fuchsia-400',
  'Unknown': 'text-muted-foreground/60',
};

interface ControllerGroup {
  key: string;
  label: string;
  controllerId?: string;
  rows: FireOneModuleStatus[];
  sample: FireOneModuleStatus;
}

export default function FireOneModulesInline({
  modules,
  isConnected,
  extraRows,
  onRescan,
  maxRows = 16,
}: FireOneModulesInlineProps) {
  const now = Date.now();

  // Merge map + extraRows, deduped by `${controllerId ?? '_'}#${addr}`.
  const merged = useMemo(() => {
    const out = new Map<string, FireOneModuleStatus>();
    const put = (m: FireOneModuleStatus) => {
      const k = `${m.controllerId ?? '_'}#${m.moduleAddress}`;
      out.set(k, m);
    };
    modules.forEach(put);
    extraRows?.forEach(put);
    return Array.from(out.values()).sort((a, b) => a.moduleAddress - b.moduleAddress);
  }, [modules, extraRows]);

  // Group by controllerLabel → list of rows per controller.
  const groups = useMemo<ControllerGroup[]>(() => {
    const byKey = new Map<string, ControllerGroup>();
    for (const m of merged) {
      const label = controllerHeaderLabel(m);
      const key = m.controllerId ?? label;
      let g = byKey.get(key);
      if (!g) {
        g = { key, label, controllerId: m.controllerId, rows: [], sample: m };
        byKey.set(key, g);
      }
      g.rows.push(m);
    }
    return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [merged]);

  const totalRows = merged.length;

  if (!isConnected && totalRows === 0) {
    return (
      <div className="text-[8px] font-mono text-muted-foreground/60 px-2 py-1.5 italic">
        Conecte (USB / BLE / Wi-Fi / RS-485 / 2-Wire / Art-Net) para enxergar módulos.
      </div>
    );
  }

  return (
    <div className="border-t border-border/10 mt-1.5 pt-1.5 space-y-1.5" data-testid="fireone-modules-inline">
      <div className="flex items-center justify-between px-1">
        <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
          Módulos FXK / FXK-M1 ({totalRows}) · {groups.length} controlador{groups.length === 1 ? '' : 'es'}
        </span>
        {onRescan && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void onRescan(undefined); }}
            className="inline-flex items-center gap-1 text-[8px] font-mono text-cyan-400/80 hover:text-cyan-300"
            data-testid="fireone-rescan"
          >
            <RefreshCcw className="w-2.5 h-2.5" /> rescan all
          </button>
        )}
      </div>

      {totalRows === 0 ? (
        <div className="flex items-center gap-1 text-[8px] font-mono text-amber-400/80 px-1 py-1">
          <AlertTriangle className="w-2.5 h-2.5" />
          Nenhum módulo respondeu via BLE / USB / Wi-Fi / Art-Net / 2-Wire / RS-485 ainda.
        </div>
      ) : (
        groups.map((g) => {
          const GroupIcon = transportIcon(g.sample.transport);
          const shown = g.rows.slice(0, maxRows);
          const overflow = Math.max(0, g.rows.length - shown.length);
          return (
            <div key={g.key} className="rounded border border-border/10 overflow-hidden" data-testid={`fireone-controller-group-${g.controllerId ?? g.label}`}>
              <div className="flex items-center justify-between bg-cyan-500/5 border-b border-border/10 px-1.5 py-1">
                <span className="inline-flex items-center gap-1 text-[8px] font-mono uppercase tracking-wider text-cyan-300/90">
                  <GroupIcon className="w-2.5 h-2.5" />
                  {g.label}
                  <span className="text-muted-foreground/60">({g.rows.length})</span>
                </span>
                {onRescan && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); void onRescan(g.controllerId); }}
                    className="inline-flex items-center gap-1 text-[8px] font-mono text-cyan-400/80 hover:text-cyan-300"
                    data-testid={`fireone-rescan-${g.controllerId ?? g.label}`}
                  >
                    <RefreshCcw className="w-2.5 h-2.5" /> rescan
                  </button>
                )}
              </div>
              <table className="w-full text-[8px] font-mono">
                <thead className="bg-muted/20 text-muted-foreground/70">
                  <tr>
                    <th className="text-left px-1.5 py-1 w-8">Addr</th>
                    <th className="text-left px-1.5 py-1 w-16">Model</th>
                    <th className="text-left px-1.5 py-1 w-14">Link</th>
                    <th className="text-left px-1.5 py-1 w-10">FW</th>
                    <th className="text-right px-1.5 py-1 w-12">Sig</th>
                    <th className="text-right px-1.5 py-1 w-10">Bat</th>
                    <th className="text-right px-1.5 py-1 w-10">Ign</th>
                    <th className="text-right px-1.5 py-1">Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((m) => {
                    const TransportI = transportIcon(m.transport);
                    const live = m.igniters?.filter((i) => i.connected && !i.fired).length ?? 0;
                    const total = m.igniters?.length ?? 0;
                    const ageMs = m.lastSeen ? now - m.lastSeen : null;
                    const stale = ageMs != null && ageMs > 5_000;
                    const rssi = m.rssiDbm;
                    const model = m.model ?? 'Unknown';
                    return (
                      <tr key={`${g.key}-${model}-${m.moduleAddress}`} className={cn('border-t border-border/10', stale && 'opacity-60')}>
                        <td className="px-1.5 py-1 font-bold text-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Cpu className={cn('w-2.5 h-2.5', MODEL_COLOR[model] ?? 'text-orange-400')} />
                            {m.moduleAddress}
                          </span>
                        </td>
                        <td className={cn('px-1.5 py-1 font-bold', MODEL_COLOR[model] ?? 'text-foreground')}>
                          {model}
                        </td>
                        <td className="px-1.5 py-1">
                          <span className="inline-flex items-center gap-0.5 text-cyan-400/80">
                            <TransportI className="w-2.5 h-2.5" /> {transportLabel(m)}
                          </span>
                        </td>
                        <td className="px-1.5 py-1 text-muted-foreground">{m.firmwareVersion ?? '—'}</td>
                        <td className="px-1.5 py-1 text-right">
                          {rssi != null && rssi !== 0 ? (
                            <span className={cn(
                              'inline-flex items-center gap-0.5 justify-end',
                              rssi > -60 ? 'text-emerald-400' : rssi > -75 ? 'text-amber-400' : 'text-red-400',
                            )}>
                              <Signal className="w-2.5 h-2.5" />{rssi}
                            </span>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-1.5 py-1 text-right">
                          {m.batteryVoltage != null && m.batteryVoltage > 0 ? (
                            <span className={cn(
                              'inline-flex items-center gap-0.5 justify-end',
                              m.batteryVoltage < 3.3 ? 'text-red-400' : 'text-emerald-400/80',
                            )}>
                              <Battery className="w-2.5 h-2.5" />{m.batteryVoltage.toFixed(1)}
                            </span>
                          ) : <span className="text-muted-foreground/50">—</span>}
                        </td>
                        <td className="px-1.5 py-1 text-right text-foreground">
                          <span className={cn(live === 0 && total > 0 && 'text-amber-400')}>{live}/{total || '—'}</span>
                        </td>
                        <td className="px-1.5 py-1 text-right text-muted-foreground">{fmtAge(m.lastSeen, now)}</td>
                      </tr>
                    );
                  })}
                  {overflow > 0 && (
                    <tr className="border-t border-border/10">
                      <td colSpan={8} className="px-1.5 py-1 text-center text-muted-foreground/60">
                        + {overflow} mais (abrir painel para detalhes)
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
// suppressed unused warnings — these icons are part of the public legend
void Radio;
