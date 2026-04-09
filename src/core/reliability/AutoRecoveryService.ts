/**
 * ─── Auto-Recovery Service ──────────────────────────────────────────
 * Retries failed services with exponential backoff (1s→2s→4s→8s→16s).
 * Reports recovery/permanent failure to ClusterHealthService.
 * Propagates degradation to dependents via ServiceRegistry dependency graph.
 */

import { clusterHealthService } from '@/core/cluster/ClusterHealthService';
import { serviceRegistry } from '@/core/cluster/ServiceRegistry';
import { toast } from 'sonner';

export type RecoveryState = 'pending' | 'recovering' | 'recovered' | 'failed' | 'tripped';

export interface RecoveryStatus {
  label: string;
  state: RecoveryState;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  trippedUpstreams: string[];
}

interface RecoverableService {
  label: string;
  bootFn: () => void;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number | null;
  state: RecoveryState;
  timerId: ReturnType<typeof setTimeout> | null;
}

const MAX_ATTEMPTS = 5;
const BASE_DELAY = 1000;

class AutoRecoveryService {
  private services = new Map<string, RecoverableService>();

  register(label: string, bootFn: () => void) {
    this.services.set(label, {
      label,
      bootFn,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetryAt: null,
      state: 'pending',
      timerId: null,
    });
  }

  /** Check if all upstream dependencies are healthy (not tripped) */
  getUpstreamStatus(label: string): { allHealthy: boolean; trippedUpstreams: string[] } {
    const reporter = serviceRegistry.get(label);
    if (!reporter?.dependsOn?.length) return { allHealthy: true, trippedUpstreams: [] };

    const trippedUpstreams: string[] = [];
    for (const depId of reporter.dependsOn) {
      if (this.isTripped(depId)) {
        trippedUpstreams.push(depId);
      }
    }
    return { allHealthy: trippedUpstreams.length === 0, trippedUpstreams };
  }

  /** Propagate degradation incidents to all dependents of a tripped service */
  private propagateDegradation(label: string) {
    const dependents = serviceRegistry.getDependents(label);
    for (const dep of dependents) {
      clusterHealthService.reportBootFailure(
        dep.id,
        `Degraded: upstream dependency "${label}" is tripped`
      );
      console.warn(`[AutoRecovery] ${dep.id} degraded — upstream "${label}" tripped`);
    }
  }

  scheduleRecovery(label: string) {
    const svc = this.services.get(label);
    if (!svc) return;

    if (svc.attempts >= svc.maxAttempts) {
      svc.state = 'tripped';
      clusterHealthService.reportBootFailure(label, `Circuit breaker aberto — ${label} falhou ${svc.maxAttempts}x`);
      toast.error(`🔌 ${label} — circuit breaker aberto após ${svc.maxAttempts} tentativas`, { duration: 8000 });
      console.error(`[AutoRecovery] ${label} circuit breaker tripped after ${svc.maxAttempts} attempts`);
      this.propagateDegradation(label);
      return;
    }

    // Check upstream health before attempting recovery
    const upstream = this.getUpstreamStatus(label);
    if (!upstream.allHealthy) {
      const delay = BASE_DELAY * Math.pow(2, svc.attempts);
      svc.nextRetryAt = Date.now() + delay;
      svc.state = 'pending';
      console.log(`[AutoRecovery] ${label} retry deferred — upstream(s) tripped: ${upstream.trippedUpstreams.join(', ')}`);
      svc.timerId = setTimeout(() => this.scheduleRecovery(label), delay);
      return;
    }

    const delay = BASE_DELAY * Math.pow(2, svc.attempts);
    svc.nextRetryAt = Date.now() + delay;
    svc.state = 'pending';

    console.log(`[AutoRecovery] ${label} retry #${svc.attempts + 1} in ${delay}ms`);

    svc.timerId = setTimeout(() => {
      svc.state = 'recovering';
      svc.attempts++;
      try {
        svc.bootFn();
        svc.state = 'recovered';
        svc.nextRetryAt = null;
        svc.timerId = null;
        clusterHealthService.reportRecovery(label, `${label} recuperado após ${svc.attempts} tentativa(s)`);
        toast.success(`✅ ${label} recuperado com sucesso`);
        console.log(`[AutoRecovery] ${label} recovered after ${svc.attempts} attempt(s)`);
      } catch (e) {
        console.warn(`[AutoRecovery] ${label} retry #${svc.attempts} failed:`, e);
        clusterHealthService.reportBootFailure(label, `Retry #${svc.attempts} failed: ${String(e)}`);
        this.scheduleRecovery(label);
      }
    }, delay);
  }

  getStatus(): RecoveryStatus[] {
    return Array.from(this.services.values()).map(s => ({
      label: s.label,
      state: s.state,
      attempts: s.attempts,
      maxAttempts: s.maxAttempts,
      nextRetryAt: s.nextRetryAt,
      trippedUpstreams: this.getUpstreamStatus(s.label).trippedUpstreams,
    }));
  }

  manualReset(label: string) {
    const svc = this.services.get(label);
    if (!svc || svc.state !== 'tripped') return;
    svc.attempts = 0;
    svc.state = 'pending';
    svc.nextRetryAt = null;
    console.log(`[AutoRecovery] ${label} manually reset by operator`);
    toast(`🔄 ${label} — reset manual iniciado`);
    this.scheduleRecovery(label);
  }

  isTripped(label: string): boolean {
    return this.services.get(label)?.state === 'tripped';
  }

  dispose() {
    for (const svc of this.services.values()) {
      if (svc.timerId) clearTimeout(svc.timerId);
    }
    this.services.clear();
  }
}

export const autoRecoveryService = new AutoRecoveryService();
