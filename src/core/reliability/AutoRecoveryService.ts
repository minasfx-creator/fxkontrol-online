/**
 * ─── Auto-Recovery Service ──────────────────────────────────────────
 * Retries failed services with exponential backoff (1s→2s→4s→8s→16s).
 * Reports recovery/permanent failure to ClusterHealthService.
 */

import { clusterHealthService } from '@/core/cluster/ClusterHealthService';
import { toast } from 'sonner';

export type RecoveryState = 'pending' | 'recovering' | 'recovered' | 'failed' | 'tripped';

export interface RecoveryStatus {
  label: string;
  state: RecoveryState;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number | null;
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

  scheduleRecovery(label: string) {
    const svc = this.services.get(label);
    if (!svc) return;

    if (svc.attempts >= svc.maxAttempts) {
      svc.state = 'failed';
      toast.error(`💀 ${label} — recovery falhou após ${svc.maxAttempts} tentativas`, { duration: 8000 });
      console.error(`[AutoRecovery] ${label} permanently failed after ${svc.maxAttempts} attempts`);
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
    }));
  }

  dispose() {
    for (const svc of this.services.values()) {
      if (svc.timerId) clearTimeout(svc.timerId);
    }
    this.services.clear();
  }
}

export const autoRecoveryService = new AutoRecoveryService();
