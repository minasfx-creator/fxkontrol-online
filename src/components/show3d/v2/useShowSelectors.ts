/**
 * SkyCanvas 2.0 — Pure store selectors.
 *
 * Mantém toda a lógica de leitura do ShowPlan fora dos componentes de render,
 * de modo que cada layer só receba dados prontos e enxutos.
 */
import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY, type Effect } from '@/data/effectLibrary';
import type { ActiveDrone, ActiveExplosion, Vec3 } from './types';

const EFFECT_BY_ID: Record<string, Effect> = Object.fromEntries(
  EFFECT_LIBRARY.map((e) => [e.id, e]),
);

const getEffect = (id: string): Effect | undefined => EFFECT_BY_ID[id];

/** Drone/light pads + which ones are firing right now. */
export function useActiveDrones(): ActiveDrone[] {
  const positions = useProjectStore((s) => s.positions);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const currentTime = useProjectStore((s) => s.currentTime);

  return useMemo(() => {
    const pads = positions.filter(
      (p) => p.type === 'drone-pad' || p.type === 'light',
    );
    if (pads.length === 0) return [];

    const activeIds = new Set<string>();
    for (const item of timelineItems) {
      const eff = getEffect(item.effectId);
      if (!eff || (eff.type !== 'drone' && eff.type !== 'light')) continue;
      const dur = item.durationOverride ?? eff.duration ?? 1;
      if (currentTime >= item.startTime && currentTime <= item.startTime + dur) {
        if (item.positionId) activeIds.add(item.positionId);
        item.positionIds?.forEach((id) => activeIds.add(id));
      }
    }

    return pads.map((p) => ({
      id: p.id,
      position: [p.x, Math.max(p.y, 1), p.z] as Vec3,
      color: p.color || '#2dd4ff',
      active: activeIds.has(p.id),
    }));
  }, [positions, timelineItems, currentTime]);
}

/** Pyro launch markers on the ground. */
export function usePyroPads(): Array<{ id: string; position: Vec3 }> {
  const positions = useProjectStore((s) => s.positions);
  return useMemo(
    () =>
      positions
        .filter((p) => p.type === 'pyro')
        .map((p) => ({ id: p.id, position: [p.x, 0.05, p.z] as Vec3 })),
    [positions],
  );
}

/** Active firework explosions whose burst window contains currentTime. */
export function useActiveExplosions(): ActiveExplosion[] {
  const positions = useProjectStore((s) => s.positions);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const currentTime = useProjectStore((s) => s.currentTime);

  return useMemo(() => {
    if (timelineItems.length === 0) return [];

    const positionMap = new Map<string, { x: number; y: number; z: number }>();
    for (const p of positions) positionMap.set(p.id, { x: p.x, y: p.y, z: p.z });

    const list: ActiveExplosion[] = [];
    for (const item of timelineItems) {
      const eff = getEffect(item.effectId);
      if (!eff || eff.type !== 'firework') continue;

      const burstStart = item.startTime + (eff.prefire ?? 0);
      const life = item.durationOverride ?? eff.duration ?? 2.5;
      const burstEnd = burstStart + life;
      if (currentTime < burstStart || currentTime > burstEnd) continue;

      const pos = item.positionId ? positionMap.get(item.positionId) : undefined;
      const height = eff.heightMeters ?? 60;
      const origin: Vec3 = [
        pos?.x ?? item.position?.x ?? 0,
        (pos?.y ?? item.position?.y ?? 0) + height,
        pos?.z ?? item.position?.z ?? 0,
      ];

      list.push({
        id: item.id,
        origin,
        color: item.colorOverride || eff.color || '#FFD700',
        age: currentTime - burstStart,
        life,
        height,
      });
    }
    return list;
  }, [positions, timelineItems, currentTime]);
}
