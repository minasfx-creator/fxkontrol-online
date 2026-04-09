/**
 * Performance Health Reporter — wraps PerformanceProfilerService
 */

import { getFrameHistory, getActiveAlerts as getPerfAlerts } from '@/core/performance/PerformanceProfilerService';
import { serviceRegistry, type HealthReporter } from '../ServiceRegistry';
import type { SubsystemHealth, HealthLevel } from '../ClusterHealthService';

const reporter: HealthReporter = {
  id: 'performance',
  label: 'Performance',
  weight: 0.3,

  getHealth(): SubsystemHealth {
    const alerts = getPerfAlerts();
    const frames = getFrameHistory();
    const lastFrame = frames.length > 0 ? frames[frames.length - 1] : null;
    const fps = lastFrame ? Math.round(1000 / Math.max(1, lastFrame.frameTimeMs)) : 60;

    let score = 100;
    let level: HealthLevel = 'healthy';

    if (fps < 20) { score = 20; level = 'critical'; }
    else if (fps < 30) { score = 50; level = 'degraded'; }
    else if (fps < 50) { score = 75; level = 'degraded'; }

    alerts.forEach(a => {
      if (a.type === 'PERF_CRITICAL' || a.type === 'GPU_CRASH') score -= 30;
      else score -= 15;
    });

    score = Math.max(0, Math.min(100, score));
    if (score < 30) level = 'critical';
    else if (score < 70) level = 'degraded';

    return {
      id: 'performance', label: 'Performance', level, score,
      details: `${fps} FPS, ${alerts.length} alerts`,
      lastUpdate: Date.now(),
      metrics: { fps, alerts: alerts.length },
    };
  },

  getAlertCount(): number {
    return getPerfAlerts().length;
  },
};

export const performanceHealthReporter = reporter;
export const unregisterPerformance = serviceRegistry.register(reporter);
