/**
 * Showven device limits validator.
 *
 * Enforces physical limits per Showven Hardware Library:
 *  - SPARKULAR: min 6 s cooldown per device, max 60 s continuous
 *  - Sonicboom: min 200 ms between shots, max 8 shots / 10 s
 *  - PyroAdaptor: min 100 ms between fires per channel
 *
 * Devices are inferred from EFFECT_LIBRARY meta on each TimelineItem
 * (effectId → category). When the meta is missing we degrade gracefully.
 */

import type { ValidationContext, ValidationIssue, Validator } from '../types';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';

interface DeviceRule {
  matchCategory: RegExp;
  minGapMs: number;
  windowMs?: number;
  maxInWindow?: number;
  label: string;
  code: string;
}

const RULES: DeviceRule[] = [
  {
    matchCategory: /sparkular/i,
    minGapMs: 6000,
    label: 'SPARKULAR',
    code: 'SHOWVEN_SPARKULAR_COOLDOWN',
  },
  {
    matchCategory: /sonicboom|sonic[\s_-]?boom/i,
    minGapMs: 200,
    windowMs: 10_000,
    maxInWindow: 8,
    label: 'Sonicboom',
    code: 'SHOWVEN_SONICBOOM_LIMIT',
  },
  {
    matchCategory: /pyro[\s_-]?adaptor|pyroadaptor/i,
    minGapMs: 100,
    label: 'PyroAdaptor',
    code: 'SHOWVEN_PYROADAPTOR_GAP',
  },
];

function effectCategory(effectId: string): string {
  const e = EFFECT_LIBRARY.find((x) => x.id === effectId);
  // EffectLibrary entries vary; try a few common keys.
  const anyE = e as unknown as { category?: string; type?: string; name?: string };
  return (anyE?.category ?? anyE?.type ?? anyE?.name ?? '').toString();
}

export const showvenValidators: Validator[] = [
  function showvenDeviceLimits(ctx: ValidationContext): ValidationIssue[] {
    if (ctx.segment !== 'PYRO' && ctx.segment !== 'SFX') return [];
    const items = useProjectStore.getState().timelineItems;
    const out: ValidationIssue[] = [];

    // Group by (rule, deviceKey) where deviceKey ≈ positionId (one device per position)
    for (const rule of RULES) {
      const groups = new Map<string, { t: number; pid?: string }[]>();
      for (const it of items) {
        const cat = effectCategory(it.effectId);
        if (!rule.matchCategory.test(cat)) continue;
        const key = it.positionId ?? '__global__';
        const list = groups.get(key) ?? [];
        list.push({ t: it.startTime * 1000, pid: it.positionId });
        groups.set(key, list);
      }
      for (const [key, list] of groups) {
        list.sort((a, b) => a.t - b.t);
        // Min gap
        for (let i = 1; i < list.length; i++) {
          const gap = list[i].t - list[i - 1].t;
          if (gap < rule.minGapMs) {
            out.push({
              severity: 'error',
              code: rule.code,
              message: `${rule.label} (${key}): ${gap.toFixed(0)} ms between fires (min ${rule.minGapMs} ms).`,
              positionId: list[i].pid,
            });
            break;
          }
        }
        // Window saturation
        if (rule.windowMs && rule.maxInWindow) {
          for (let i = 0; i < list.length; i++) {
            let count = 1;
            for (let j = i + 1; j < list.length; j++) {
              if (list[j].t - list[i].t > rule.windowMs) break;
              count++;
            }
            if (count > rule.maxInWindow) {
              out.push({
                severity: 'error',
                code: rule.code + '_WINDOW',
                message: `${rule.label} (${key}): ${count} fires in ${(rule.windowMs / 1000).toFixed(0)} s (max ${rule.maxInWindow}).`,
                positionId: list[i].pid,
              });
              break;
            }
          }
        }
      }
    }

    return out;
  },
];
