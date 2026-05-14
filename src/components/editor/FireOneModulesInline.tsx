/**
 * FireOneModulesInline — compact roster of IFMx-i32Q modules currently
 * seen by the connected FireOne controller (XL4/XL2/Wi-Fi Direct).
 *
 * Honest hardware: rows reflect what `useFireOneHardware().modules`
 * actually contains. Empty roster = "no modules answered yet" — never
 * synthesised. Read-only: this component never arms/disarms/fires.
 */
import { useMemo } from 'react';
import { Cpu, Battery, Signal, Radio, Cable, RefreshCcw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FireOneModuleStatus } from '@/lib/fireoneProtocol';

export interface FireOneModulesInlineProps {
  modules: Map<number, FireOneModuleStatus>;
  isConnected: boolean;
  onRescan?: () => void | Promise<void>;
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

function modeIcon(mode: FireOneModuleStatus['connectionMode']) {
  if (mode === 'wireless' || mode === 'fallback') return Radio;
  return Cable;
}

function modeLabel(m: FireOneModuleStatus): string {
  if (m.connectionMode === 'fallback') return 'WL-FB';
  if (m.connectionMode === 'wireless') return 'WL';
  if (m.connectionMode === 'wired') return 'RS485';
  return m.wireless ? 'WL' : 'RS485';
}

export default function FireOneModulesInline({
  modules,
  isConnected,
  onRescan,
  maxRows = 16,
}: FireOneModulesInlineProps) {
  const now = Date.now();
  const rows = useMemo(
    () => Array.from(modules.values()).sort((a, b) => a.moduleAddress - b.moduleAddress),
    [modules],
  );
  const shown = rows.slice(0, maxRows);
  const overflow = Math.max(0, rows.length - shown.length);

  if (!isConnected) {
    return (
      <div className="text-[8px] font-mono text-muted-foreground/60 px-2 py-1.5 italic">
        Conecte o controlador para enxergar módulos.
      </div>
    );
  }

  return (
    <div className="border-t border-border/10 mt-1.5 pt-1.5" data-testid="fireone-modules-inline">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground">
          Módulos IFMx-i32Q ({rows.length})
        </span>
        {onRescan && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void onRescan(); }}
            className="inline-flex items-center gap-1 text-[8px] font-mono text-cyan-400/80 hover:text-cyan-300"
            data-testid="fireone-rescan"
          >
            <RefreshCcw className="w-2.5 h-2.5" /> rescan
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="flex items-center gap-1 text-[8px] font-mono text-amber-400/80 px-1 py-1">
          <AlertTriangle className="w-2.5 h-2.5" />
          Nenhum módulo respondeu ao IDENTIFY ainda.
        </div>
      ) : (
        <div className="rounded border border-border/10 overflow-hidden">
          <table className="w-full text-[8px] font-mono">
            <thead className="bg-muted/20 text-muted-foreground/70">
              <tr>
                <th className="text-left px-1.5 py-1 w-8">Addr</th>
                <th className="text-left px-1.5 py-1 w-10">Link</th>
                <th className="text-left px-1.5 py-1 w-10">FW</th>
                <th className="text-right px-1.5 py-1 w-12">Sig</th>
                <th className="text-right px-1.5 py-1 w-10">Bat</th>
                <th className="text-right px-1.5 py-1 w-10">Ign</th>
                <th className="text-right px-1.5 py-1">Seen</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const Icon = modeIcon(m.connectionMode);
                const live = m.igniters?.filter((i) => i.connected && !i.fired).length ?? 0;
                const total = m.igniters?.length ?? 0;
                const ageMs = m.lastSeen ? now - m.lastSeen : null;
                const stale = ageMs != null && ageMs > 5_000;
                const rssi = m.rssiDbm;
                return (
                  <tr key={m.moduleAddress} className={cn('border-t border-border/10', stale && 'opacity-60')}>
                    <td className="px-1.5 py-1 font-bold text-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Cpu className="w-2.5 h-2.5 text-orange-400" />
                        {m.moduleAddress}
                      </span>
                    </td>
                    <td className="px-1.5 py-1">
                      <span className={cn(
                        'inline-flex items-center gap-0.5',
                        m.connectionMode === 'fallback' ? 'text-amber-400' : 'text-cyan-400/80',
                      )}>
                        <Icon className="w-2.5 h-2.5" /> {modeLabel(m)}
                      </span>
                    </td>
                    <td className="px-1.5 py-1 text-muted-foreground">{m.firmwareVersion ?? '—'}</td>
                    <td className="px-1.5 py-1 text-right">
                      {rssi != null ? (
                        <span className={cn(
                          'inline-flex items-center gap-0.5 justify-end',
                          rssi > -60 ? 'text-emerald-400' : rssi > -75 ? 'text-amber-400' : 'text-red-400',
                        )}>
                          <Signal className="w-2.5 h-2.5" />{rssi}
                        </span>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-1.5 py-1 text-right">
                      {m.batteryVoltage != null ? (
                        <span className={cn(
                          'inline-flex items-center gap-0.5 justify-end',
                          m.batteryVoltage < 3.3 ? 'text-red-400' : 'text-emerald-400/80',
                        )}>
                          <Battery className="w-2.5 h-2.5" />{m.batteryVoltage.toFixed(1)}
                        </span>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-1.5 py-1 text-right text-foreground">
                      <span className={cn(live === 0 && total > 0 && 'text-amber-400')}>{live}/{total || 32}</span>
                    </td>
                    <td className="px-1.5 py-1 text-right text-muted-foreground">{fmtAge(m.lastSeen, now)}</td>
                  </tr>
                );
              })}
              {overflow > 0 && (
                <tr className="border-t border-border/10">
                  <td colSpan={7} className="px-1.5 py-1 text-center text-muted-foreground/60">
                    + {overflow} mais (abrir painel para detalhes)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
