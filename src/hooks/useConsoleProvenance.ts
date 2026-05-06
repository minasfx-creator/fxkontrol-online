/**
 * ─── useConsoleProvenance ───────────────────────────────────────────
 * Resolve the honesty mode for a Round-15 console based on whether a
 * recognised live device of the requested controller family is present
 * in `deviceAggregator`.
 *
 * Returns 'live_read_only' when at least one online device of the
 * matching kind is present, 'simulated' otherwise. Never reports
 * 'replay'/'not_integrated' here — those are reserved for replay tools
 * and adapters explicitly missing.
 */
import { useEffect, useState } from 'react';
import { deviceAggregator } from '@/core/discovery/DeviceAggregator';
import { resolveControllerProfile } from '@/core/discovery/controllerRegistry';
import type { IntegrationMode } from '@/core/hardware/provenance';
import type { ControllerKind } from '@/core/discovery/controllerRegistry';

export function useConsoleProvenance(kinds: ControllerKind[]): IntegrationMode {
  const [mode, setMode] = useState<IntegrationMode>('simulated');

  useEffect(() => {
    function recompute() {
      const devices = deviceAggregator.getDevices();
      const hit = devices.some((d) => {
        if (!d.online) return false;
        const profile = resolveControllerProfile(d);
        return profile ? kinds.includes(profile.kind) : false;
      });
      setMode(hit ? 'live_read_only' : 'simulated');
    }
    recompute();
    const off = deviceAggregator.watch(recompute);
    return () => { try { off(); } catch { /* noop */ } };
  }, [kinds.join('|')]);

  return mode;
}

export default useConsoleProvenance;
