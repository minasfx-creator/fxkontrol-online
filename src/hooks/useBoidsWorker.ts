/**
 * useBoidsWorker — React hook that owns a single BoidsWorkerClient
 * for the lifetime of the component. Returns a stable handle so call
 * sites can `init()`, `step(dt)`, `setConfig()`, and `readPositions()`
 * without paying the worker boot cost on every render.
 *
 * Drop-in replacement strategy for legacy `stepBoids` consumers:
 *   const boids = useBoidsWorker();
 *   useEffect(() => { boids.init(initialAgents); }, []);
 *   useFrame((_, dt) => {
 *     void boids.step(dt);
 *     const { data, n } = boids.readPositions(); // zero-copy read
 *     // hand `data` to instancing matrix updater
 *   });
 *
 * Falling back to main-thread `stepBoids` is automatic if Worker
 * construction is denied (CSP, Safari quirks, sandbox preview).
 */
import { useEffect, useRef } from 'react';
import { BoidsWorkerClient } from '@/lib/boids/BoidsWorkerClient';

export function useBoidsWorker(): BoidsWorkerClient {
  const ref = useRef<BoidsWorkerClient | null>(null);
  if (ref.current === null) {
    ref.current = new BoidsWorkerClient();
  }
  useEffect(() => {
    return () => {
      ref.current?.dispose();
      ref.current = null;
    };
  }, []);
  return ref.current!;
}
