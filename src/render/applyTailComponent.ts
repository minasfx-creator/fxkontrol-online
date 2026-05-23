/**
 * applyTailComponent — bridge from Effect.tailRef → TailComponentPart → render params.
 *
 * Pure helper. Renderer-agnostic. Consumed by particle/comet renderers when
 * an Effect declares a tail reference like "[Brocade Tail Medium]".
 */
import type { Effect } from '@/data/effectLibrary';
import { findTailComponent, type TailComponentPart } from '@/data/tailComponentCatalog';

export interface TailRenderParams {
  /** Resolved tail component, or null if ref absent/unresolvable. */
  component: TailComponentPart | null;
  /** Suggested particle count factor (×base). */
  densityFactor: number;
  /** Suggested lifetime in seconds. */
  lifetimeS: number;
  /** Suggested trail color (first palette entry or fallback). */
  trailColor: string;
  /** Whether to render as strobe (intermittent emission). */
  strobe: boolean;
  /** Strobe frequency in Hz (0 when strobe=false). */
  strobeFreqHz: number;
  /** Source: 'tail-component' when ref resolved, 'effect-fallback' otherwise. */
  source: 'tail-component' | 'effect-fallback';
}

const LENGTH_TO_LIFETIME_S: Record<string, number> = {
  short: 0.45,
  medium: 0.85,
  long: 1.4,
};

const SIZE_TO_DENSITY: Record<string, number> = {
  small: 0.7,
  medium: 1.0,
  large: 1.4,
};

/**
 * Resolve render params for an effect's tail, honest about source.
 * If the effect has no tailRef, returns sensible fallbacks.
 */
export function resolveTailRenderParams(effect: Pick<Effect, 'tailRef' | 'color'>): TailRenderParams {
  const fallbackColor = effect.color ?? '#FFE2AE';
  if (!effect.tailRef) {
    return {
      component: null,
      densityFactor: 1.0,
      lifetimeS: 0.7,
      trailColor: fallbackColor,
      strobe: false,
      strobeFreqHz: 0,
      source: 'effect-fallback',
    };
  }
  const c = findTailComponent(effect.tailRef);
  if (!c) {
    return {
      component: null,
      densityFactor: 1.0,
      lifetimeS: 0.7,
      trailColor: fallbackColor,
      strobe: false,
      strobeFreqHz: 0,
      source: 'effect-fallback',
    };
  }
  const lifetimeS = c.life ?? LENGTH_TO_LIFETIME_S[c.length ?? ''] ?? 0.85;
  const sizeFactor = SIZE_TO_DENSITY[c.size ?? ''] ?? 1.0;
  const densityFactor = (c.density ?? 1.0) * sizeFactor;
  const trailColor = c.color[0] ?? fallbackColor;
  return {
    component: c,
    densityFactor,
    lifetimeS,
    trailColor,
    strobe: c.strobe,
    strobeFreqHz: c.strobeFreqHz ?? 0,
    source: 'tail-component',
  };
}
