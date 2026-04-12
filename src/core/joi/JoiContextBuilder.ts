/**
 * ─── JoiContextBuilder — System Context Assembler ──────────────────
 * Aggregates real-time data from all core subsystems into a structured
 * JoiSystemContext object for injection into AI conversations.
 * 
 * Sources: ShowPlan, VerificationEngine, ReadinessEvaluator,
 * UnifiedHardwareRegistry, ExportCoordinator, DeviceEventLog,
 * OperationalModeGuard, SafetyAuditTrail
 */

import { useProjectStore } from '@/store/useProjectStore';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { readinessEvaluator } from '@/core/hardware/ReadinessEvaluator';
import { unifiedHardwareRegistry } from '@/core/hardware/UnifiedHardwareRegistry';
import { exportCoordinator } from '@/core/export/ExportCoordinator';
import { deviceEventLog } from '@/core/hardware/DeviceEventLog';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';
import { verificationLog } from '@/core/verification/VerificationLog';
import { getProvenanceBadge, type IntegrationMode } from '@/core/hardware/provenance';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

export interface JoiSystemContext {
  showPlan: {
    projectName: string;
    positionCount: number;
    timelineItemCount: number;
    droneFormationCount: number;
    duration: number;
    currentTime: number;
    positions: string;
    effectsSummary: string;
    recentItems: string;
  };
  verification: {
    level: string;
    totalChecks: number;
    passed: number;
    failed: number;
    blockers: string[];
    lastRunAt: number;
  };
  readiness: {
    status: string;
    mode: string;
    allowedOps: string[];
    blockedOps: string[];
    issues: string[];
    warnings: string[];
  };
  hardware: {
    totalAdapters: number;
    online: number;
    simulatedCount: number;
    healthScore: number;
    errors: number;
    warnings: number;
    devices: { id: string; label: string; mode: string; badge: string; online: boolean }[];
  };
  exports: {
    lastAttempts: { target: string; success: boolean; timestamp: number; issues: string[] }[];
  };
  operational: {
    currentMode: string;
    recentEvents: string[];
    verificationRunCount: number;
  };
}

class JoiContextBuilder {
  /** Build complete system context for AI injection */
  build(): JoiSystemContext {
    const store = useProjectStore.getState();

    // ShowPlan context
    const positionsSummary = store.positions.length > 0
      ? store.positions.map(p => `${p.name}(${p.type})@(${p.x.toFixed(1)},${p.z.toFixed(1)})${p.section ? `[${p.section}]` : ''}`).join('; ')
      : 'Nenhuma';

    const effectCounts = new Map<string, number>();
    store.timelineItems.forEach(item => {
      const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      effectCounts.set(effect?.name || item.effectId, (effectCounts.get(effect?.name || item.effectId) || 0) + 1);
    });
    const effectsSummary = effectCounts.size > 0
      ? Array.from(effectCounts.entries()).map(([n, c]) => `${n}×${c}`).join(', ')
      : 'Nenhum';

    const recentItems = store.timelineItems.slice(-20).map(item => {
      const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
      return `${item.id}[${effect?.name || item.effectId}@${item.positionName || '?'},t=${item.startTime.toFixed(1)}s]`;
    }).join(', ') || 'Nenhum';

    // Verification
    const vResult = verificationEngine.run();
    const blockers = vResult.issues.filter(i => !i.passed && i.severity === 'error').map(i => `${i.label}: ${i.detail}`);

    // Readiness
    const readiness = readinessEvaluator.evaluate();

    // Hardware
    const health = unifiedHardwareRegistry.getSystemHealth();
    const simulatedCount = unifiedHardwareRegistry.getSimulatedCount();
    const devices = unifiedHardwareRegistry.getDevices().map(d => {
      const mode = (d.metadata?.integration_mode as IntegrationMode) || 'simulated';
      return {
        id: d.id,
        label: d.label,
        mode,
        badge: getProvenanceBadge(mode).label,
        online: d.connection_state === 'online',
      };
    });

    // Exports
    const exportHistory = exportCoordinator.getHistory().slice(-5);

    // Operational
    const recentEvents = deviceEventLog.getRecent(10).map(e => `[${new Date(e.timestamp).toLocaleTimeString()}] ${e.device_id}: ${e.message}`);

    return {
      showPlan: {
        projectName: store.projectName,
        positionCount: store.positions.length,
        timelineItemCount: store.timelineItems.length,
        droneFormationCount: store.droneFormations.length,
        duration: store.duration,
        currentTime: store.currentTime,
        positions: positionsSummary,
        effectsSummary,
        recentItems,
      },
      verification: {
        level: vResult.level,
        totalChecks: vResult.summary.total,
        passed: vResult.summary.passed,
        failed: vResult.summary.failed,
        blockers,
        lastRunAt: vResult.timestamp,
      },
      readiness: {
        status: readiness.status,
        mode: readiness.mode,
        allowedOps: readiness.allowed_operations,
        blockedOps: readiness.blocked_operations,
        issues: readiness.issues.map(i => `[${i.severity}] ${i.source}: ${i.message}`),
        warnings: readiness.warnings,
      },
      hardware: {
        totalAdapters: health.total,
        online: health.online,
        simulatedCount,
        healthScore: health.score,
        errors: health.errors,
        warnings: health.warnings,
        devices,
      },
      exports: {
        lastAttempts: exportHistory.map(a => ({ target: a.target, success: a.success, timestamp: a.timestamp, issues: a.issues })),
      },
      operational: {
        currentMode: operationalModeGuard.mode,
        recentEvents,
        verificationRunCount: verificationLog.getAll().length,
      },
    };
  }

  /** Serialize context as a system message string */
  toSystemMessage(): string {
    const ctx = this.build();
    return `[SYSTEM CONTEXT — FX KONTROL STATE]

## ShowPlan
- Projeto: ${ctx.showPlan.projectName}
- Posições: ${ctx.showPlan.positionCount} | Efeitos: ${ctx.showPlan.timelineItemCount} | Formações drone: ${ctx.showPlan.droneFormationCount}
- Duração: ${ctx.showPlan.duration}s | Tempo atual: ${ctx.showPlan.currentTime.toFixed(1)}s
- Posições: ${ctx.showPlan.positions}
- Efeitos: ${ctx.showPlan.effectsSummary}
- Itens recentes (IDs): ${ctx.showPlan.recentItems}

## Verification
- Level: ${ctx.verification.level}
- Checks: ${ctx.verification.passed}/${ctx.verification.totalChecks} passed, ${ctx.verification.failed} failed
- Blockers: ${ctx.verification.blockers.length > 0 ? ctx.verification.blockers.join('; ') : 'Nenhum'}

## Readiness
- Status: ${ctx.readiness.status}
- Mode: ${ctx.readiness.mode}
- Allowed: ${ctx.readiness.allowedOps.join(', ') || 'Nenhuma'}
- Blocked: ${ctx.readiness.blockedOps.join(', ') || 'Nenhuma'}
- Issues: ${ctx.readiness.issues.length > 0 ? ctx.readiness.issues.join('; ') : 'Nenhum'}

## Hardware (${ctx.hardware.online}/${ctx.hardware.totalAdapters} online, ${ctx.hardware.simulatedCount} SIMULATED, score: ${ctx.hardware.healthScore})
${ctx.hardware.devices.map(d => `- ${d.label}: ${d.badge} | ${d.online ? 'ONLINE' : 'OFFLINE'}`).join('\n')}

## Operational Mode: ${ctx.operational.currentMode}
- Verification runs: ${ctx.operational.verificationRunCount}
- Recent events: ${ctx.operational.recentEvents.length > 0 ? ctx.operational.recentEvents.slice(0, 5).join('; ') : 'Nenhum'}

## Export History
${ctx.exports.lastAttempts.length > 0 ? ctx.exports.lastAttempts.map(a => `- ${a.target}: ${a.success ? 'OK' : 'FAILED'} (${a.issues.join(', ') || 'sem issues'})`).join('\n') : '- Nenhuma exportação registrada'}`;
  }
}

export const joiContextBuilder = new JoiContextBuilder();
