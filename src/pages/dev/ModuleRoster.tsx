/**
 * ─── ModuleRoster — live inventory page ──────────────────────────
 *
 * Lists every FireOne module the fleet has heard from, plus address
 * gaps inside the known range.
 *
 * Per row:
 *   • State:   NOT INTEGRATED (never replied) | OFFLINE (stale >5s)
 *              | ONLINE (lastReplyAt within 5s)
 *   • Address (slat 1..99)
 *   • Cue count (igniters with continuity OK / total connected)
 *   • COM LED — pulses on real telemetry frames
 *   • RSSI / Battery (only when telemetry exists; otherwise "—")
 *   • Link mode chip (WIRED / WIRELESS / FALLBACK)
 *
 * Honesty contract: nothing here is synthesised. If the bus is silent,
 * rows show "NOT INTEGRATED" with no fake metrics.
 */

import { useEffect, useMemo, useState } from 'react';
import { CircleDot, Cable, RadioTower, Wifi, Battery, Activity } from 'lucide-react';
import { useFireOneFleet } from '@/features/fieldbus/useFireOneFleet';
import { cn } from '@/lib/utils';
import FXK32QControlPanel from '@/components/dev/fxk32q/FXK32QControlPanel';

const STALE_MS = 5000;

type RowState = 'NOT_INTEGRATED' | 'OFFLINE' | 'ONLINE';

interface Row {
  address: number;
  state: RowState;
  cuesOk: number;
  cuesConnected: number;
  rssiDbm: number | null;
  batteryV: number | null;
  mode: 'wired' | 'wireless' | 'fallback' | null;
  fw: string | null;
  lastReplyAt: number | null;
  comPulse: boolean;
}

export default function ModuleRoster() {
  const fleet = useFireOneFleet();
  const { state } = fleet;
  // Tick every 500ms to refresh OFFLINE/COM-LED visuals from timestamps.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 500);
    return () => window.clearInterval(id);
  }, []);

  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    const seen = Object.values(state.modules).map((m): Row => {
      const linkReply = (m as any).connectionMode === 'wireless'
        ? state.radio.lastReplyAt
        : state.cable.lastReplyAt;
      const last = linkReply ?? null;
      const ageMs = last ? now - last : Infinity;
      const rowState: RowState = ageMs <= STALE_MS ? 'ONLINE' : 'OFFLINE';
      const connected = m.igniters.filter(i => i.connected).length;
      const ok        = m.igniters.filter(i => i.connected && i.continuityOk).length;
      return {
        address: m.moduleAddress,
        state: rowState,
        cuesOk: ok,
        cuesConnected: connected,
        rssiDbm: typeof m.rssiDbm === 'number' ? m.rssiDbm : null,
        batteryV: m.batteryVoltage > 0 ? m.batteryVoltage : null,
        mode: ((m as any).connectionMode as Row['mode']) ?? null,
        fw: m.firmwareVersion || null,
        lastReplyAt: last,
        comPulse: last !== null && (now - last) < 800,
      };
    }).sort((a, b) => a.address - b.address);

    // Fill placeholder NOT_INTEGRATED rows for addresses 1..maxKnown that
    // never replied (so the operator sees the gap honestly).
    const maxAddr = seen.reduce((mx, r) => Math.max(mx, r.address), 0);
    const present = new Set(seen.map(r => r.address));
    const gaps: Row[] = [];
    for (let a = 1; a <= maxAddr; a++) {
      if (!present.has(a)) {
        gaps.push({
          address: a, state: 'NOT_INTEGRATED', cuesOk: 0, cuesConnected: 0,
          rssiDbm: null, batteryV: null, mode: null, fw: null,
          lastReplyAt: null, comPulse: false,
        });
      }
    }
    return [...seen, ...gaps].sort((a, b) => a.address - b.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.modules, state.cable.lastReplyAt, state.radio.lastReplyAt]);

  const counts = useMemo(() => {
    const c = { online: 0, offline: 0, notIntegrated: 0 };
    for (const r of rows) {
      if (r.state === 'ONLINE') c.online++;
      else if (r.state === 'OFFLINE') c.offline++;
      else c.notIntegrated++;
    }
    return c;
  }, [rows]);

  return (
    <div className="w-full min-h-dvh bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[hsl(190_70%_58%)]" />
            <h1 className="text-sm font-mono font-bold tracking-[0.2em] uppercase text-[hsl(190_70%_58%)]">
              Module Roster · FireOne Fleet
            </h1>
          </div>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            Live inventory of every slat the bus has acknowledged. State is derived
            from real telemetry timestamps — no synthetic data.
          </p>
        </div>

        {/* Aggregate strip */}
        <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex items-center gap-4 flex-wrap text-[10px] font-mono">
          <span className="text-emerald-400">ONLINE: <span className="text-foreground">{counts.online}</span></span>
          <span className="text-amber-400">OFFLINE: <span className="text-foreground">{counts.offline}</span></span>
          <span className="text-muted-foreground">NOT INTEGRATED: <span className="text-foreground">{counts.notIntegrated}</span></span>
          <span className="ml-auto text-muted-foreground">
            Link: <span className="text-foreground">{state.link.toUpperCase()}</span> · Mode: <span className="text-foreground">{state.mode.toUpperCase()}</span>
          </span>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border/40 overflow-hidden overflow-x-auto">
          <table className="w-full text-[11px] font-mono min-w-[720px]">
            <thead className="bg-card/40 text-muted-foreground">
              <tr className="text-left">
                <th className="px-3 py-2 w-12">COM</th>
                <th className="px-3 py-2 w-16">ADDR</th>
                <th className="px-3 py-2 w-32">STATE</th>
                <th className="px-3 py-2 w-24">LINK</th>
                <th className="px-3 py-2 w-24">CUES</th>
                <th className="px-3 py-2 w-24">RSSI</th>
                <th className="px-3 py-2 w-24">BAT</th>
                <th className="px-3 py-2">FW</th>
                <th className="px-3 py-2 w-32">LAST</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  No module heard from the bus yet. Open the FireOne panel to connect cable or wireless.
                </td></tr>
              )}
              {rows.map(r => (
                <tr key={r.address} className="border-t border-border/30 hover:bg-card/20">
                  <td className="px-3 py-2">
                    <CircleDot className={cn(
                      'w-3 h-3 transition-colors',
                      r.state === 'ONLINE'
                        ? r.comPulse ? 'text-emerald-400 animate-pulse' : 'text-emerald-500/70'
                        : r.state === 'OFFLINE' ? 'text-amber-400' : 'text-muted-foreground/40',
                    )} />
                  </td>
                  <td className="px-3 py-2 text-foreground">{r.address.toString().padStart(2, '0')}</td>
                  <td className="px-3 py-2">
                    <span className={cn(
                      'text-[10px] font-bold tracking-[0.16em] px-1.5 py-0.5 rounded border',
                      r.state === 'ONLINE'         && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
                      r.state === 'OFFLINE'        && 'bg-amber-500/10 text-amber-400 border-amber-500/30',
                      r.state === 'NOT_INTEGRATED' && 'bg-muted/20 text-muted-foreground border-border/30',
                    )}>
                      {r.state.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.mode ? (
                      <span className="inline-flex items-center gap-1 text-[10px]">
                        {r.mode === 'wired'
                          ? <Cable className="w-3 h-3 text-emerald-400" />
                          : r.mode === 'fallback'
                            ? <RadioTower className="w-3 h-3 text-amber-400" />
                            : <RadioTower className="w-3 h-3 text-cyan-400" />}
                        <span className="text-foreground">{r.mode.toUpperCase()}</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.cuesConnected > 0 ? (
                      <span className="text-foreground">
                        {r.cuesOk}<span className="text-muted-foreground">/{r.cuesConnected}</span>
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.rssiDbm !== null ? (
                      <span className={cn('inline-flex items-center gap-1', r.rssiDbm < -85 ? 'text-amber-400' : 'text-foreground')}>
                        <Wifi className="w-3 h-3" /> {r.rssiDbm}dBm
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.batteryV !== null ? (
                      <span className={cn('inline-flex items-center gap-1', r.batteryV < 11.0 ? 'text-amber-400' : 'text-foreground')}>
                        <Battery className="w-3 h-3" /> {r.batteryV.toFixed(1)}V
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.fw ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.lastReplyAt ? `${Math.round((Date.now() - r.lastReplyAt) / 1000)}s ago` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] font-mono text-muted-foreground/60">
          ONLINE = telemetry within {STALE_MS / 1000}s · OFFLINE = telemetry stale ·
          NOT INTEGRATED = address slot inside fleet range that never replied · COM LED pulses on each frame.
        </p>

        {/* FXK32Q dedicated bench panel */}
        <FXK32QControlPanel />
      </div>
    </div>
  );
}
