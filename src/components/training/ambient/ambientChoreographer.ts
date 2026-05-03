/**
 * Training v2.1 — Ambient choreographer.
 *
 * Pure scheduler emitting "ambient hints" used by AmbientNPCLayer
 * (e.g. roadie carries case A→B, dancer paces, walkie crackles).
 *
 * Density is configurable per chapter via `AmbientPreset`.
 */

import type { AmbientPreset } from '../missions/types';

export interface AmbientHint {
  id: string;
  npcId: string;
  /** Path waypoints in world space. */
  waypoints: [number, number, number][];
  /** ms — duration of one full traversal. */
  durationMs: number;
  /** Idle gesture override. */
  gesture?: 'walk' | 'stand-check' | 'crouch';
  /** Optional radio chatter line. */
  chatter?: string;
}

const HINT_BANK: AmbientHint[] = [
  {
    id: 'roadie-case-AB',
    npcId: 'roadie-veterano',
    waypoints: [[-12, 0.3, 6], [-2, 0.3, 6], [-2, 0.3, -2], [-12, 0.3, -2]],
    durationMs: 24000,
    gesture: 'walk',
  },
  {
    id: 'dancer-pace',
    npcId: 'dancarino-passagem',
    waypoints: [[-4, 0.9, -3], [4, 0.9, -3]],
    durationMs: 8000,
    gesture: 'walk',
  },
  {
    id: 'client-check-watch',
    npcId: 'cliente-corporativo',
    waypoints: [[8, 0.3, 2], [8, 0.3, 2]],
    durationMs: 5000,
    gesture: 'stand-check',
    chatter: 'Quanto falta?',
  },
  {
    id: 'dj-soundcheck',
    npcId: 'dj-residente',
    waypoints: [[0, 0.9, -6], [0, 0.9, -6]],
    durationMs: 30000,
    gesture: 'stand-check',
    chatter: 'Check, check… 1, 2.',
  },
  {
    id: 'walkie-radio-chatter',
    npcId: 'eletricista-radio',
    waypoints: [[0, -10, 0]],
    durationMs: 12000,
    chatter: '*kkkk* tô subindo a fase agora *kkkk*',
  },
];

const PRESET_DENSITY: Record<AmbientPreset, number> = {
  calm: 1,
  busy: 3,
  frantic: 5,
};

export interface AmbientChoreographerOpts {
  preset: AmbientPreset;
  /** Optional id allow-list (if omitted, draws from full bank). */
  allow?: string[];
  /** Deterministic seed for tests. */
  seed?: number;
}

export function pickAmbientHints(opts: AmbientChoreographerOpts): AmbientHint[] {
  const target = PRESET_DENSITY[opts.preset];
  const pool = opts.allow ? HINT_BANK.filter((h) => opts.allow!.includes(h.id)) : HINT_BANK.slice();
  // Deterministic when seed provided
  let i = opts.seed ?? 0;
  const out: AmbientHint[] = [];
  while (out.length < target && pool.length) {
    const idx = i % pool.length;
    out.push(pool.splice(idx, 1)[0]);
    i += 7;
  }
  return out;
}

/** Linear interpolation across waypoints; loops. */
export function sampleHintPosition(hint: AmbientHint, tMs: number): [number, number, number] {
  if (hint.waypoints.length === 0) return [0, 0, 0];
  if (hint.waypoints.length === 1) return hint.waypoints[0];
  const cyclic = [...hint.waypoints, hint.waypoints[0]];
  const segDur = hint.durationMs / (cyclic.length - 1);
  const cyclePos = (tMs % hint.durationMs) / segDur;
  const segIdx = Math.floor(cyclePos);
  const segT = cyclePos - segIdx;
  const a = cyclic[segIdx];
  const b = cyclic[Math.min(segIdx + 1, cyclic.length - 1)];
  return [
    a[0] + (b[0] - a[0]) * segT,
    a[1] + (b[1] - a[1]) * segT,
    a[2] + (b[2] - a[2]) * segT,
  ];
}
