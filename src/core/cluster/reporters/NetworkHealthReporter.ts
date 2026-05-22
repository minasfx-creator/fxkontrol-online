/**
 * Network Health Reporter — wraps NetworkHealthService + FieldBus
 */

import { networkHealthService } from '@/core/network/NetworkHealthService';
import { fieldBus } from '@/core/reliability';
import { serviceRegistry, type HealthReporter } from '../ServiceRegistry';
import type { SubsystemHealth, HealthLevel } from '../ClusterHealthService';

const reporter: HealthReporter = {
  id: 'network',
  label: 'Network',
  weight: 0.3,

  getHealth(): SubsystemHealth {
    const alerts = networkHealthService.getActiveAlerts();
    const lossPercent = networkHealthService.getPacketLossPercent();
    const rttHistory = networkHealthService.getRTTHistory();
    const currentRtt = rttHistory.length > 0 ? rttHistory[rttHistory.length - 1].rttMs : 0;
    const busState = fieldBus.getState();

    let score = 100;
    let level: HealthLevel = 'healthy';

    if (currentRtt > 200) score -= 40;
    else if (currentRtt > 100) score -= 20;
    if (lossPercent > 15) score -= 40;
    else if (lossPercent > 5) score -= 20;
    if (busState.failoverCount > 0) score -= 10;

    alerts.forEach(a => {
      if (a.type === 'NETWORK_DOWN') score -= 30;
      else score -= 10;
    });

    score = Math.max(0, Math.min(100, score));
    if (score < 30) level = 'critical';
    else if (score < 70) level = 'degraded';

    return {
      id: 'network', label: 'Network', level, score,
      details: `RTT ${currentRtt.toFixed(0)}ms, Loss ${lossPercent.toFixed(1)}%`,
      lastUpdate: Date.now(),
      metrics: { rtt: Math.round(currentRtt), loss: `${lossPercent.toFixed(1)}%`, failovers: busState.failoverCount },
    };
  },

  getAlertCount(): number {
    return networkHealthService.getActiveAlerts().length;
  },
};

export const networkHealthReporter = reporter;
export const unregisterNetwork = serviceRegistry.register(reporter);
