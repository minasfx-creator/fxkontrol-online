/**
 * DRONES segment validators (MVP 1).
 *
 * Currently focused on collision proximity in horizontal plane between
 * selected drone-pad positions. Altitude / formation / RTH validation
 * will be added once ShowPlan exposes the corresponding fields.
 */

import type { ValidationContext, ValidationIssue, Validator } from '../types';
import { useProjectStore } from '@/store/useProjectStore';

const MIN_HORIZONTAL_DIST_M = 1.5;

export const dronesValidators: Validator[] = [
  function dronesProximity(ctx: ValidationContext): ValidationIssue[] {
    if (ctx.segment !== 'DRONES') return [];
    const positions = useProjectStore.getState().positions;
    const sel = ctx.selectionIds
      .map((id) => positions.find((p) => p.id === id && p.type === 'drone-pad'))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
    const out: ValidationIssue[] = [];
    for (let i = 0; i < sel.length; i++) {
      for (let j = i + 1; j < sel.length; j++) {
        const a = sel[i];
        const b = sel[j];
        const dx = a.x - b.x;
        const dz = a.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d < MIN_HORIZONTAL_DIST_M) {
          out.push({
            severity: 'warn',
            code: 'DRONES_PROXIMITY',
            message: `Pads "${a.name}" and "${b.name}" are ${d.toFixed(2)} m apart (< ${MIN_HORIZONTAL_DIST_M} m).`,
            positionId: a.id,
          });
        }
      }
    }
    return out;
  },
];
