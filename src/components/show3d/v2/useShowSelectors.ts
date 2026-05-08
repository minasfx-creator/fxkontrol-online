/**
 * SkyCanvas 2.0 — Pure store selectors.
 *
 * IMPORTANT: selectors here are STRUCTURAL only — they intentionally do NOT
 * depend on `currentTime`. Time-dependent state (which explosion is in its
 * burst window, which drone is pulsing) is evaluated per-frame by the
 * layers themselves through `useShowTimeRef`, so the React tree never
 * re-renders at the timeline tick rate.
 */
import { useMemo } from 'react';
import { useProjectStore } from '@/store/useProjectStore';
import type { Effect } from '@/data/effectLibrary';
import {
  resolveEffectLedAccurate,
  ledAccurateColor,
} from '@/data/effectsLibraries/resolveEffect';
import type { Vec3 } from './types';

// Unified lookup: legacy EFFECT_LIBRARY ∪ Finale-imported parts (527),
// with Effect.color already passed through the VDL render-accurate pipeline.
const getEffect = (id: string): Effect | undefined => resolveEffectLedAccurate(id);

// ──────────────────────────────────────────────────────────────────────────
// Drones / lights — structural list (per-frame "active" computed in layer)
// ──────────────────────────────────────────────────────────────────────────

export interface DronePadInfo {
  id: string;
  position: Vec3;
  color: string;
}

/** Stable cue window per pad (used by layer to decide pulse on/off per frame). */
export interface DroneCueWindow {
  positionId: string;
  start: number;
  end: number;
}

export interface DroneStructure {
  pads: DronePadInfo[];
  cues: DroneCueWindow[];
}

export function useDroneStructure(): DroneStructure {
  const positions = useProjectStore((s) => s.positions);
  const timelineItems = useProjectStore((s) => s.timelineItems);

  return useMemo(() => {
    const pads = positions
      .filter((p) => p.type === 'drone-pad' || p.type === 'light')
      .map<DronePadInfo>((p) => ({
        id: p.id,
        position: [p.x, Math.max(p.y, 1), p.z],
        color: ledAccurateColor(p.color, '#2dd4ff'),
      }));

    const cues: DroneCueWindow[] = [];
    for (const item of timelineItems) {
      const eff = getEffect(item.effectId);
      if (!eff || (eff.type !== 'drone' && eff.type !== 'light')) continue;
      const dur = item.durationOverride ?? eff.duration ?? 1;
      const end = item.startTime + dur;
      if (item.positionId) cues.push({ positionId: item.positionId, start: item.startTime, end });
      item.positionIds?.forEach((id) =>
        cues.push({ positionId: id, start: item.startTime, end }),
      );
    }
    return { pads, cues };
  }, [positions, timelineItems]);
}

// ──────────────────────────────────────────────────────────────────────────
// Pyro launch pads (markers)
// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────
// Firework bursts — structural (windows + origin), age computed per-frame
// ──────────────────────────────────────────────────────────────────────────

export interface BurstSpec {
  id: string;
  origin: Vec3;
  color: string;
  /** Absolute show-time when burst becomes visible. */
  burstStart: number;
  /** Absolute show-time when burst fades out. */
  burstEnd: number;
  /** Burst lifetime (s). */
  life: number;
  /** Apex height (m). */
  height: number;
}

export function useBurstSpecs(): BurstSpec[] {
  const positions = useProjectStore((s) => s.positions);
  const timelineItems = useProjectStore((s) => s.timelineItems);
  const cueMarkers = useProjectStore((s) => s.cueMarkers);

  return useMemo(() => {
    const list: BurstSpec[] = [];

    if (timelineItems.length > 0) {
      const positionMap = new Map<string, { x: number; y: number; z: number }>();
      for (const p of positions) positionMap.set(p.id, { x: p.x, y: p.y, z: p.z });

      for (const item of timelineItems) {
        const eff = getEffect(item.effectId);
        if (!eff || eff.type !== 'firework') continue;

        const burstStart = item.startTime + (eff.prefire ?? 0);
        const life = item.durationOverride ?? eff.duration ?? 2.5;
        const burstEnd = burstStart + life;

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
          color: item.colorOverride
            ? ledAccurateColor(item.colorOverride)
            : (eff.color || '#FFD700'),
          burstStart,
          burstEnd,
          life,
          height,
        });
      }
    }

    // Cue markers from the legacy timeline (drag-drop). Each cue produces
    // one synthesized firework burst at a deterministic sky origin so the
    // operator gets visible feedback when Play crosses its time.
    for (const cue of cueMarkers) {
      // Deterministic hash → spread bursts over a 60×60m area around origin.
      let h = 2166136261 >>> 0;
      for (let i = 0; i < cue.id.length; i++) {
        h ^= cue.id.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      const angle = (h & 0xffff) / 0xffff * Math.PI * 2;
      const radius = 5 + ((h >>> 16) & 0xff) / 255 * 25;
      const height = 55 + ((h >>> 8) & 0x1f);
      const life = 2.5;
      list.push({
        id: `cue-${cue.id}`,
        origin: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
        color: ledAccurateColor(cue.color || '#FFD700'),
        burstStart: cue.time,
        burstEnd: cue.time + life,
        life,
        height,
      });
    }

    return list;
  }, [positions, timelineItems, cueMarkers]);
}
