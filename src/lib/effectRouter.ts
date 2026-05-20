/**
 * effectRouter — pure mirror of TimelineEffects routing in
 * src/components/editor/skycanvas/FireworkRenderer.tsx (1716..1775).
 *
 * Given an Effect, returns which renderer component will instantiate and an
 * estimated spawn count (particles / shots / beams). Used by the E2E coverage
 * spec and the /dev/effects-e2e visual harness to score each library entry
 * without mounting React-Three-Fiber.
 *
 * Keep in sync with TimelineEffects. Pure, sync, no side effects.
 */

import type { Effect } from '@/data/effectLibrary';

export type RendererKind =
  | 'mine'
  | 'candle'
  | 'waterfall'
  | 'gerb'
  | 'flame'
  | 'girandola'
  | 'cake'
  | 'laser'
  | 'moving-head'
  | 'cryo-jet'
  | 'confetti'
  | 'fog'
  | 'haze'
  | 'snow'
  | 'bubble'
  | 'comet'
  | 'multi-burst'
  | 'fan'
  | 'rocket'
  | 'firework-burst'
  | 'light-point'        // fallback — anything that fell through
  | 'unrouted';          // type/partType unrecognised → SHOULD NOT happen for a healthy library

export interface RouterDecision {
  kind: RendererKind;
  /** lower bound on particles/shots/beams the renderer will spawn */
  expectedSpawn: number;
  /** true when this is the catch-all LightPoint (means upstream forgot to map) */
  isFallback: boolean;
  reason: string;
}

const SHELL_PATTERNS = new Set([
  'peony', 'chrysanthemum', 'willow', 'kamuro', 'crossette', 'palm', 'ring',
  'brocade', 'spider', 'horsetail', 'dahlia', 'diadem', 'comet', 'salute',
  'strobe', 'falling-leaves',
]);

export function routeEffect(effect: Effect): RouterDecision {
  const pt = effect.partType;
  const eid = effect.id || '';
  const t = effect.type;

  // 1) partType-based routing (mirrors lines 1716..1724)
  if (pt === 'mine') return ok('mine', 24, 'partType=mine');
  if (pt === 'candle') return ok('candle', effect.shotCount || 8, 'partType=candle');
  if (pt === 'waterfall') return ok('waterfall', 60, 'partType=waterfall');
  if (pt === 'gerb') return ok('gerb', 40, 'partType=gerb');
  if (pt === 'flame') return ok('flame', 30, 'partType=flame');
  if (pt === 'girandola') return ok('girandola', 20, 'partType=girandola');
  if (pt === 'cake') return ok('cake', effect.shotCount || 25, 'partType=cake');
  if (pt === 'laser') return ok('laser', effect.beamCount || 8, 'partType=laser');
  if (pt === 'light' && effect.beamType) return ok('moving-head', 1, `partType=light beamType=${effect.beamType}`);

  // 2) SFX id matches (lines 1726..1732)
  if (eid === 'sfx-01' || eid === 'sfx-02') return ok('cryo-jet', 20, `eid=${eid}`);
  if (eid === 'sfx-06' || eid === 'sfx-07') return ok('confetti', 80, `eid=${eid}`);
  if (eid === 'sfx-08') return ok('fog', 1, 'eid=sfx-08');
  if (eid === 'sfx-09') return ok('haze', 1, 'eid=sfx-09');
  if (eid === 'sfx-10') return ok('snow', 40, 'eid=sfx-10');
  if (eid === 'sfx-11') return ok('bubble', 30, 'eid=sfx-11');

  // 3) prefix matches (lines 1734..1736)
  if (eid.startsWith('comet-')) return ok('comet', 40, 'id startsWith comet-');
  if (eid.startsWith('mburst-')) return ok('multi-burst', eid === 'mburst-02' ? 5 : 3, 'id startsWith mburst-');
  if (eid.startsWith('fan-')) return ok('fan', 30, 'id startsWith fan-');

  // 4) partType rocket
  if (pt === 'rocket') return ok('rocket', 80, 'partType=rocket');

  // 4b) Showven SFX vendor pack — name-based heuristic (mirrors FireworkRenderer).
  const nm = (effect.name || '').toUpperCase();
  if (pt === 'sfx' || (t === 'sfx' && !pt)) {
    if (nm.includes('SBOOM') || nm.includes('SONIC BOOM') || nm.includes('SMOKE JET') || nm.includes('FOG JET')) {
      return ok('fog', 1, 'sfx + SBOOM/smoke-jet');
    }
    if (nm.includes('FLAMER') || nm.includes('SVCFLM') || nm.includes('FLAME')) {
      return ok('flame', 30, 'sfx + flamer');
    }
    return ok('gerb', 40, 'sfx default (sparkular/gerb surrogate)');
  }

  // 4c) Lancework / static set-pieces → Flame surrogate.
  if (pt === 'set_piece') return ok('flame', 20, 'partType=set_piece (flame surrogate)');


  // 5) type-level fallbacks (1756..1775)
  if (t === 'firework') {
    const pat = effect.pattern;
    if (!pat || SHELL_PATTERNS.has(pat)) return ok('firework-burst', 80, `type=firework pattern=${pat || '(default peony)'}`);
    return ok('firework-burst', 80, `type=firework pattern=${pat} (unknown pattern but still routed)`);
  }

  // Drone or unrouted light: real codepath renders LightPoint
  if (t === 'drone' || t === 'light') {
    return { kind: 'light-point', expectedSpawn: 1, isFallback: true, reason: `type=${t} → LightPoint fallback (no renderer)` };
  }

  // SFX / laser without explicit mapping → fallback
  return { kind: 'unrouted', expectedSpawn: 0, isFallback: true, reason: `unrouted: type=${t} partType=${pt} id=${eid}` };
}

function ok(kind: RendererKind, spawn: number, reason: string): RouterDecision {
  return { kind, expectedSpawn: spawn, isFallback: false, reason };
}

/** True iff the effect will produce a real renderer (not LightPoint fallback). */
export function isFullyRouted(effect: Effect): boolean {
  return !routeEffect(effect).isFallback;
}
