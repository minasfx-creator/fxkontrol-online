/**
 * ─── Reopen Match Policy Selector ──────────────────────────────────
 * Compact toggle that lets the operator pick how persisted port-registry
 * entries are keyed — either by VID:PID (any unit of the same family)
 * or VID:PID + USB serial (a specific physical unit, WebUSB only).
 *
 * Affects:
 *  - The `keyFor()` helper used by every discoverer / recordSuccess call.
 *  - Auto-reopen on next session (a serial-keyed entry will not match
 *    a different physical adapter even if VID:PID is identical).
 */

import { useReopenMatchPolicy, type ReopenMatchPolicy } from '@/core/discovery/useReopenMatchPolicy';
import { Fingerprint, Cable } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS: {
  value: ReopenMatchPolicy;
  label: string;
  hint: string;
  Icon: typeof Cable;
}[] = [
  {
    value: 'vidpid',
    label: 'VID:PID',
    hint: 'Qualquer unidade do mesmo modelo (troca de cabo/dongle reaproveita)',
    Icon: Cable,
  },
  {
    value: 'vidpid+serial',
    label: 'VID:PID + Serial',
    hint: 'Pin físico — só reabre o exato mesmo nº de série (apenas WebUSB)',
    Icon: Fingerprint,
  },
];

export function ReopenMatchPolicySelector() {
  const policy = useReopenMatchPolicy(s => s.policy);
  const setPolicy = useReopenMatchPolicy(s => s.setPolicy);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] font-mono uppercase tracking-wider text-muted-foreground/70">
        Auto-reopen:
      </span>
      <div className="inline-flex rounded border border-border/40 bg-card/40 overflow-hidden">
        {OPTIONS.map(opt => {
          const active = policy === opt.value;
          const Icon = opt.Icon;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPolicy(opt.value)}
              title={opt.hint}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-wider transition-colors',
                active
                  ? 'bg-cyan-500/15 text-cyan-300'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
              )}
              aria-pressed={active}
            >
              <Icon className="w-2.5 h-2.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
