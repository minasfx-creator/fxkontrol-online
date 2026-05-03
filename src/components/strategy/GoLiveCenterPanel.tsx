/**
 * GoLiveCenterPanel — Source of operational trust (read-only GTM surface).
 * ─────────────────────────────────────────────────────────────────────────
 * Consome EXCLUSIVAMENTE os tokens canônicos do design system:
 *   • Vantablack stack:   bg-ds-background / bg-ds-surface-{deep,panel,elevated}
 *   • Cyan-dessat (sync): text-status-sync, border-ds-border-active, ring-field-cyan
 *   • Status semântico:   text-status-{ok,warn,fail,sync,disabled}
 *   • Segment chips:      text-segment-{pyro,sfx,drones,light,dmx}
 *
 * NUNCA renderiza CTA real (não arma, não dispara). É um espelho GTM do
 * Go-Live runbook descrito em docs/go-live-comercial-90d.md.
 */
import { ShieldCheck, Activity, Radio, FileCheck2, AlertTriangle } from 'lucide-react';

type GateStatus = 'ok' | 'warn' | 'fail' | 'sync' | 'disabled';

interface Gate {
  id: string;
  label: string;
  detail: string;
  status: GateStatus;
  segment?: 'pyro' | 'sfx' | 'drones' | 'light' | 'dmx';
}

const GATES: Gate[] = [
  { id: 'preflight', label: 'Preflight evidence', detail: 'Continuity, link health, weather, geofence', status: 'ok' },
  { id: 'rollback', label: 'Rollback validated', detail: 'Last 3 plan diffs reversible in <10s', status: 'ok' },
  { id: 'estop', label: 'E-STOP latency', detail: 'P99 < 50ms across last 10 cycles', status: 'sync' },
  { id: 'comms', label: 'Comms redundancy', detail: 'Serial · USB · Art-Net · BLE quorum', status: 'sync' },
  { id: 'pyro', label: 'Pyro continuity', detail: 'FXK16 banks A–D, all channels green', status: 'ok', segment: 'pyro' },
  { id: 'drones', label: 'Drone fleet', detail: 'GPS lock, battery >85%, mesh stable', status: 'warn', segment: 'drones' },
  { id: 'dmx', label: 'DMX universes', detail: 'Art-Net 4 universes, 33 PPS budget', status: 'ok', segment: 'dmx' },
  { id: 'signoff', label: 'Dual sign-off', detail: 'Engineering + Operations required', status: 'disabled' },
];

const STATUS_LABEL: Record<GateStatus, string> = {
  ok: 'READY',
  sync: 'SYNC',
  warn: 'REVIEW',
  fail: 'BLOCKED',
  disabled: 'PENDING',
};

const STATUS_DOT: Record<GateStatus, string> = {
  ok: 'bg-status-ok',
  sync: 'bg-status-sync',
  warn: 'bg-status-warn',
  fail: 'bg-status-fail',
  disabled: 'bg-status-disabled',
};

const STATUS_TEXT: Record<GateStatus, string> = {
  ok: 'text-status-ok',
  sync: 'text-status-sync',
  warn: 'text-status-warn',
  fail: 'text-status-fail',
  disabled: 'text-status-disabled',
};

const SEGMENT_TEXT: Record<NonNullable<Gate['segment']>, string> = {
  pyro: 'text-segment-pyro',
  sfx: 'text-segment-sfx',
  drones: 'text-segment-drones',
  light: 'text-segment-light',
  dmx: 'text-segment-dmx',
};

export function GoLiveCenterPanel() {
  const okCount = GATES.filter((g) => g.status === 'ok' || g.status === 'sync').length;
  const total = GATES.length;
  const blockers = GATES.filter((g) => g.status === 'fail' || g.status === 'warn');

  return (
    <div className="space-y-ds-4">
      {/* Header strip */}
      <div className="rounded-ds-md border border-ds-border-active/40 bg-ds-surface-deep p-ds-3">
        <div className="flex items-center justify-between gap-ds-3 flex-wrap">
          <div className="flex items-center gap-ds-3">
            <ShieldCheck className="h-5 w-5 text-status-sync" />
            <div>
              <p className="text-[10px] ds-mono uppercase tracking-[0.25em] text-ds-text-muted">
                Go-Live Center · Operational Trust
              </p>
              <h2 className="text-ds-h3 text-ds-text-primary">
                {okCount}/{total} gates verified
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-ds-2 text-[10px] ds-mono uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5 text-status-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-status-ok" /> OK
            </span>
            <span className="inline-flex items-center gap-1.5 text-status-sync">
              <span className="h-1.5 w-1.5 rounded-full bg-status-sync" /> SYNC
            </span>
            <span className="inline-flex items-center gap-1.5 text-status-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-status-warn" /> WARN
            </span>
            <span className="inline-flex items-center gap-1.5 text-status-fail">
              <span className="h-1.5 w-1.5 rounded-full bg-status-fail" /> FAIL
            </span>
          </div>
        </div>
      </div>

      {/* Gates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-ds-3">
        {GATES.map((g) => (
          <div
            key={g.id}
            className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-3 hover:bg-ds-surface-elevated transition-colors"
          >
            <div className="flex items-start justify-between gap-ds-2">
              <div className="flex items-center gap-ds-2">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[g.status]}`} />
                <h3 className="text-xs font-semibold text-ds-text-primary">{g.label}</h3>
                {g.segment && (
                  <span className={`text-[10px] ds-mono uppercase tracking-wider ${SEGMENT_TEXT[g.segment]}`}>
                    {g.segment}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ds-mono uppercase tracking-wider ${STATUS_TEXT[g.status]}`}>
                {STATUS_LABEL[g.status]}
              </span>
            </div>
            <p className="text-[11px] text-ds-text-secondary mt-1.5 ml-4">{g.detail}</p>
          </div>
        ))}
      </div>

      {/* Footer rails */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-ds-3">
        <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-3">
          <div className="flex items-center gap-ds-2 mb-ds-2">
            <Activity className="h-3.5 w-3.5 text-status-sync" />
            <h4 className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-secondary">
              Telemetry windows
            </h4>
          </div>
          <ul className="text-[11px] text-ds-text-primary space-y-1">
            <li>E-STOP <span className="text-status-sync ds-mono">&lt;50ms</span></li>
            <li>Black box <span className="text-status-sync ds-mono">100ms</span></li>
            <li>Heartbeat <span className="text-status-sync ds-mono">10Hz</span></li>
          </ul>
        </div>
        <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-3">
          <div className="flex items-center gap-ds-2 mb-ds-2">
            <Radio className="h-3.5 w-3.5 text-status-sync" />
            <h4 className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-secondary">
              Transports
            </h4>
          </div>
          <ul className="text-[11px] text-ds-text-primary space-y-1">
            <li>Serial <span className="text-status-ok ds-mono">PRIMARY</span></li>
            <li>USB <span className="text-status-ok ds-mono">FALLBACK</span></li>
            <li>Art-Net <span className="text-status-ok ds-mono">FALLBACK</span></li>
            <li>BLE <span className="text-status-disabled ds-mono">BANNED IN REAL</span></li>
          </ul>
        </div>
        <div className="rounded-ds-md border border-ds-border-default bg-ds-surface-panel p-ds-3">
          <div className="flex items-center gap-ds-2 mb-ds-2">
            <FileCheck2 className="h-3.5 w-3.5 text-status-sync" />
            <h4 className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-secondary">
              Sign-off
            </h4>
          </div>
          <ul className="text-[11px] text-ds-text-primary space-y-1">
            <li>Engineering <span className="text-status-disabled ds-mono">PENDING</span></li>
            <li>Operations <span className="text-status-disabled ds-mono">PENDING</span></li>
            <li>Plan hash <span className="text-ds-text-muted ds-mono">—</span></li>
          </ul>
        </div>
      </div>

      {blockers.length > 0 && (
        <div className="rounded-ds-md border border-status-warn/40 bg-ds-surface-panel p-ds-3">
          <div className="flex items-center gap-ds-2">
            <AlertTriangle className="h-4 w-4 text-status-warn" />
            <p className="text-xs text-ds-text-primary">
              {blockers.length} gate(s) require review before commercial Go-Live.
            </p>
          </div>
        </div>
      )}

      <p className="text-[10px] ds-mono uppercase tracking-wider text-ds-text-muted">
        Read-only GTM mirror. Real arming, firing and E-STOP live in the operational console (uiCommandGateway).
      </p>
    </div>
  );
}
