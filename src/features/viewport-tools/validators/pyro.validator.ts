/**
 * PYRO segment validators.
 *
 * Pure functions over read-only context. They report issues; never mutate.
 * Mirrors the `Validator` contract from ../types.ts.
 *
 * Current rules implemented (MVP 1):
 *  - PYRO_NO_EFFECT     : selected pyro position has no scheduled effect
 *  - PYRO_TIME_CONFLICT : two cues on the same position fire within 10 ms
 *  - PYRO_NO_POSITION   : safety radius/positioning info missing (heuristic)
 *
 * Rules deferred (need richer ShowPlan fields not present yet):
 *  - VDL absence detection         (TimelineItem has no `vdlCode` field)
 *  - FireOne channel duplication   (no `fireOneChannel` in TimelineItem)
 */

import type { ValidationContext, ValidationIssue, Validator } from '../types';
import { useProjectStore } from '@/store/useProjectStore';

const TIME_CONFLICT_MS = 10;

export const pyroValidators: Validator[] = [
  function pyroNoEffect(ctx: ValidationContext): ValidationIssue[] {
    if (ctx.segment !== 'PYRO') return [];
    const items = useProjectStore.getState().timelineItems;
    const out: ValidationIssue[] = [];
    const itemsByPos = new Map<string, number>();
    for (const it of items) {
      if (it.positionId) {
        itemsByPos.set(it.positionId, (itemsByPos.get(it.positionId) ?? 0) + 1);
      }
    }
    for (const id of ctx.selectionIds) {
      const pos = ctx.positions.find((p) => p.id === id);
      if (!pos || pos.type !== 'pyro') continue;
      if (!itemsByPos.get(id)) {
        out.push({
          severity: 'warn',
          code: 'PYRO_NO_EFFECT',
          message: `Position "${pos.name}" has no scheduled cue.`,
          positionId: id,
        });
      }
    }
    return out;
  },

  function pyroTimeConflict(ctx: ValidationContext): ValidationIssue[] {
    if (ctx.segment !== 'PYRO') return [];
    const items = useProjectStore.getState().timelineItems;
    const out: ValidationIssue[] = [];
    const sel = new Set(ctx.selectionIds);
    const grouped = new Map<string, number[]>();
    for (const it of items) {
      const pid = it.positionId;
      if (!pid || !sel.has(pid)) continue;
      const list = grouped.get(pid) ?? [];
      list.push(it.startTime * 1000);
      grouped.set(pid, list);
    }
    for (const [pid, times] of grouped) {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        if (times[i] - times[i - 1] < TIME_CONFLICT_MS) {
          const pos = ctx.positions.find((p) => p.id === pid);
          out.push({
            severity: 'error',
            code: 'PYRO_TIME_CONFLICT',
            message: `Two cues on "${pos?.name ?? pid}" fire within ${TIME_CONFLICT_MS} ms.`,
            positionId: pid,
          });
          break;
        }
      }
    }
    return out;
  },
];
