/**
 * ─── Safety Summary Bar ────────────────────────────────────────────
 * Fixed safety overview showing interlocks, blockers, telemetry stale,
 * non-integrated subsystems, simulated adapter count, allowed operations.
 * Always visible in command center views.
 */

import { useEffect, useState } from 'react';
import { useHardwareRegistry } from '@/core/hardware/useHardwareRegistry';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';
import { isDataStale, getProvenanceBadge } from '@/core/hardware/provenance';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle, Lock, Radio, Cpu, Eye } from 'lucide-react';

export default function SafetySummaryBar() {
  const { readiness, health, refresh, evaluateReadiness } = useHardwareRegistry();
  const [, setTick] = useState(0);

  useEffect(() => {
    refresh();
    evaluateReadiness();
    const id = setInterval(() => { refresh(); evaluateReadiness(); setTick(t => t + 1); }, 5000);
    return () => clearInterval(id);
  }, []);

  const provenances = unifiedHardwareRegistry.getAllProvenances();
  const simulatedCount = unifiedHardwareRegistry.getSimulatedCount();
  const totalAdapters = provenances.size;
  const mode = operationalModeGuard.mode;

  let staleCount = 0;
  let notIntegratedCount = 0;
  for (const [, prov] of provenances) {
    if (prov.integration_mode === 'not_integrated') notIntegratedCount++;
    else if (prov.integration_mode !== 'simulated' && isDataStale(prov)) staleCount++;
  }

  const blockers = readiness?.issues.filter(i => i.severity === 'error') ?? [];
  const warnings = readiness?.issues.filter(i => i.severity === 'warning') ?? [];

  return (
    <div className="border-b border-border/20 bg-card/30 px-4 py-2 flex items-center gap-4 text-[8px] font-mono flex-wrap">
      {/* Mode */}
      <div className="flex items-center gap-1.5">
        <Eye className="w-3 h-3 text-cyan-400" />
        <span className="text-muted-foreground uppercase">Mode:</span>
        <span className="text-cyan-400 font-bold uppercase">{mode}</span>
      </div>

      {/* Readiness */}
      <div className="flex items-center gap-1.5">
        <Shield className="w-3 h-3 text-muted-foreground" />
        <span className={cn('font-bold uppercase', {
          'text-emerald-400': readiness?.status?.includes('READY'),
          'text-red-400': readiness?.status === 'BLOCKED',
          'text-amber-400': !readiness,
        })}>
          {readiness?.status?.replace(/_/g, ' ') ?? 'EVALUATING'}
        </span>
      </div>

      {/* Blockers */}
      {blockers.length > 0 && (
        <div className="flex items-center gap-1">
          <Lock className="w-3 h-3 text-red-400" />
          <span className="text-red-400">{blockers.length} blocker(s)</span>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400">{warnings.length} warning(s)</span>
        </div>
      )}

      {/* Telemetry stale */}
      {staleCount > 0 && (
        <div className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400">{staleCount} stale</span>
        </div>
      )}

      {/* Simulated count */}
      <div className="flex items-center gap-1">
        <Cpu className="w-3 h-3 text-blue-400" />
        <span className="text-blue-400">{simulatedCount}/{totalAdapters} simulated</span>
      </div>

      {/* Not integrated */}
      {notIntegratedCount > 0 && (
        <span className="text-red-400">{notIntegratedCount} not integrated</span>
      )}

      {/* Allowed ops */}
      <div className="flex items-center gap-1 ml-auto">
        <span className="text-muted-foreground/50">OPS:</span>
        {readiness?.allowed_operations.map(op => (
          <span key={op} className="px-1 py-0.5 rounded text-[7px] bg-emerald-500/10 text-emerald-400">{op}</span>
        ))}
      </div>
    </div>
  );
}
