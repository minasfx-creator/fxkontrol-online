/**
 * useTransportReadiness — reactive readiness snapshot.
 *
 * Recomputes on:
 *   - mount
 *   - window focus / visibility change
 *   - online/offline events
 *   - manual refresh()
 *   - whenever `connectedTransports` map changes
 */
import { useCallback, useEffect, useState } from 'react';
import {
  detectReadiness,
  type ReadinessSnapshot,
  type TransportKey,
} from '@/lib/transportReadiness';

export interface UseTransportReadinessReturn {
  snapshot: ReadinessSnapshot;
  refresh: () => void;
}

export function useTransportReadiness(
  connectedTransports: Partial<Record<TransportKey, boolean>> = {},
): UseTransportReadinessReturn {
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot>(() =>
    detectReadiness(connectedTransports),
  );

  const refresh = useCallback(() => {
    setSnapshot(detectReadiness(connectedTransports));
  }, [connectedTransports]);

  // Recompute when connectivity map shifts.
  useEffect(() => {
    setSnapshot(detectReadiness(connectedTransports));
  }, [connectedTransports]);

  // Recompute on focus / visibility / network changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => setSnapshot(detectReadiness(connectedTransports));
    window.addEventListener('focus', onChange);
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    document.addEventListener('visibilitychange', onChange);
    return () => {
      window.removeEventListener('focus', onChange);
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
      document.removeEventListener('visibilitychange', onChange);
    };
  }, [connectedTransports]);

  return { snapshot, refresh };
}
