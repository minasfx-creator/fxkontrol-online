/**
 * FireOne stagger validator — FXK-PYRO 2.0 array/pin stagger rules.
 *
 * Rules (per FireOne System memory):
 *  - MIN_PIN_STAGGER_MS: cues on the SAME (rack/tube) pin must be ≥ 250 ms apart
 *  - MIN_ARRAY_STAGGER_MS: cues on the same rack must be ≥ 50 ms apart
 *  - MAX_PARALLEL_PINS_PER_RACK: warn if >16 pins fire simultaneously per rack
 *  - PIN_RANGE: tube must be 1..16 (FXK16 module)
 *
 * Reads timelineItems via useProjectStore. Pure / non-mutating.
 */

import type { ValidationContext, ValidationIssue, Validator } from '../types';
import { useProjectStore } from '@/store/useProjectStore';

const MIN_PIN_STAGGER_MS = 250;
const MIN_ARRAY_STAGGER_MS = 50;
const MAX_PARALLEL_PINS_PER_RACK = 16;
const SIMULTANEOUS_WINDOW_MS = 5;

export const fireoneValidators: Validator[] = [
  function fireOnePinStagger(ctx: ValidationContext): ValidationIssue[] {
    if (ctx.segment !== 'PYRO') return [];
    const items = useProjectStore.getState().timelineItems;
    const out: ValidationIssue[] = [];

    // Group cues by rack/tube key
    const byPin = new Map<string, { t: number; pid?: string }[]>();
    const byRack = new Map<string | number, { t: number; tube?: number; pid?: string }[]>();

    for (const it of items) {
      if (it.rack === undefined || it.tube === undefined) continue;
      if (it.tube < 1 || it.tube > 16) {
        out.push({
          severity: 'error',
          code: 'FIREONE_PIN_OUT_OF_RANGE',
          message: `Cue on rack ${it.rack} uses tube ${it.tube} (must be 1..16).`,
          positionId: it.positionId,
        });
        continue;
      }
      const pinKey = `${it.rack}:${it.tube}`;
      const pinList = byPin.get(pinKey) ?? [];
      pinList.push({ t: it.startTime * 1000, pid: it.positionId });
      byPin.set(pinKey, pinList);

      const rackList = byRack.get(it.rack) ?? [];
      rackList.push({ t: it.startTime * 1000, tube: it.tube, pid: it.positionId });
      byRack.set(it.rack, rackList);
    }

    // Pin stagger
    for (const [pinKey, list] of byPin) {
      list.sort((a, b) => a.t - b.t);
      for (let i = 1; i < list.length; i++) {
        const gap = list[i].t - list[i - 1].t;
        if (gap < MIN_PIN_STAGGER_MS) {
          out.push({
            severity: 'error',
            code: 'FIREONE_PIN_STAGGER',
            message: `Pin ${pinKey} fires twice within ${gap.toFixed(0)} ms (min ${MIN_PIN_STAGGER_MS} ms).`,
            positionId: list[i].pid,
          });
          break;
        }
      }
    }

    // Array (rack) stagger + parallel saturation
    for (const [rack, list] of byRack) {
      list.sort((a, b) => a.t - b.t);
      for (let i = 1; i < list.length; i++) {
        const gap = list[i].t - list[i - 1].t;
        if (gap > 0 && gap < MIN_ARRAY_STAGGER_MS) {
          out.push({
            severity: 'warn',
            code: 'FIREONE_ARRAY_STAGGER',
            message: `Rack ${rack}: cues ${gap.toFixed(0)} ms apart (recommended ≥ ${MIN_ARRAY_STAGGER_MS} ms).`,
            positionId: list[i].pid,
          });
          break;
        }
      }
      // Parallel saturation: count cues in 5 ms windows
      let i = 0;
      while (i < list.length) {
        let j = i;
        const windowEnd = list[i].t + SIMULTANEOUS_WINDOW_MS;
        while (j < list.length && list[j].t <= windowEnd) j++;
        const parallel = j - i;
        if (parallel > MAX_PARALLEL_PINS_PER_RACK) {
          out.push({
            severity: 'error',
            code: 'FIREONE_PARALLEL_OVERLOAD',
            message: `Rack ${rack}: ${parallel} pins fire within ${SIMULTANEOUS_WINDOW_MS} ms (FXK16 limit ${MAX_PARALLEL_PINS_PER_RACK}).`,
            positionId: list[i].pid,
          });
          break;
        }
        i = j;
      }
    }

    return out;
  },
];
