/**
 * Safety Health Reporter — wraps SafetyStateMachine + AuditTrail
 */

import { safetyStateMachine } from '@/core/safety/SafetyStateMachine';
import { safetyAuditTrail } from '@/core/safety/SafetyAuditTrail';
import { serviceRegistry, type HealthReporter } from '../ServiceRegistry';
import type { SubsystemHealth, HealthLevel } from '../ClusterHealthService';

const reporter: HealthReporter = {
  id: 'safety',
  label: 'Safety',
  weight: 0.4,

  getHealth(): SubsystemHealth {
    const state = safetyStateMachine.state;
    const conditions = safetyStateMachine.conditions;
    const violations = safetyAuditTrail.getAll().filter(e => e.event === 'VIOLATION').length;

    let score = 100;
    let level: HealthLevel = 'healthy';

    if (state === 'SAFE') { score = 0; level = 'critical'; }
    else if (violations > 5) { score = 40; level = 'degraded'; }
    else if (violations > 0) { score = 70; level = 'degraded'; }
    if (!conditions.linkStable) score -= 15;
    if (!conditions.validationPassed) score -= 10;

    score = Math.max(0, Math.min(100, score));
    if (score < 30) level = 'critical';
    else if (score < 70) level = 'degraded';

    return {
      id: 'safety', label: 'Safety', level, score,
      details: `State: ${state}, ${violations} violations`,
      lastUpdate: Date.now(),
      metrics: { state, violations, link: conditions.linkStable ? 'OK' : 'FAIL' },
    };
  },

  getAlertCount(): number {
    const state = safetyStateMachine.state;
    return state === 'SAFE' ? 1 : 0;
  },
};

export const safetyHealthReporter = reporter;
export const unregisterSafety = serviceRegistry.register(reporter);
