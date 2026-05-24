/**
 * Guided Mode — Curated Show Presets
 * ────────────────────────────────────────────────────────────
 * Maps (eventType × system × scale) → a base recipe of generator calls
 * (cakes + drone formations) that can be applied to ShowPlan via the
 * existing CommandBus events (`viewport-tools:generate-*`).
 *
 * Pure data + factory functions. No store mutation, no IO.
 * Per WorkMode policy (design): never blocks; warnings only.
 */

import type { CakeParams } from '@/features/viewport-tools/generators/cakeGenerator';
import type { FormationParams } from '@/features/viewport-tools/generators/droneFormationGenerator';

export type EventType =
  | 'wedding'
  | 'corporate'
  | 'newyear'
  | 'concert'
  | 'sports'
  | 'festival';

export type ShowSystem = 'pyro' | 'drones' | 'hybrid';
export type ShowScale = 'small' | 'medium' | 'large';

export interface GuidedAnswers {
  eventType: EventType;
  system: ShowSystem;
  scale: ShowScale;
  durationSec: number;
  /** Anchor pyro position id for cake generators. */
  anchorPositionId?: string;
  anchor?: { x: number; y: number; z: number };
  /** Default effectId used by cakes (must exist in effects library). */
  defaultEffectId?: string;
}

export interface GuidedRecipe {
  /** Human-readable label rendered in the wizard summary card. */
  label: string;
  description: string;
  cakes: CakeParams[];
  formations: FormationParams[];
  /** Tags rendered as chips on the summary card. */
  tags: string[];
  /** Friendly safety/operational notes for the operator. */
  notes: string[];
}

export const EVENT_LABELS: Record<EventType, string> = {
  wedding: 'Casamento',
  corporate: 'Corporativo',
  newyear: 'Réveillon',
  concert: 'Show / Concerto',
  sports: 'Esportivo',
  festival: 'Festival',
};

export const SYSTEM_LABELS: Record<ShowSystem, string> = {
  pyro: 'Pirotecnia',
  drones: 'Drones',
  hybrid: 'Pyro + Drones',
};

export const SCALE_LABELS: Record<ShowScale, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
};

const SCALE_FACTOR: Record<ShowScale, number> = {
  small: 0.6,
  medium: 1.0,
  large: 1.6,
};

const DRONE_BASE: Record<ShowScale, number> = {
  small: 60,
  medium: 150,
  large: 300,
};

/**
 * Build the cake list for a given event/scale.
 * Cakes are positioned around the anchor with stagger so they read
 * as "intro → buildup → finale" on the timeline.
 */
function buildCakes(a: GuidedAnswers): CakeParams[] {
  const f = SCALE_FACTOR[a.scale];
  const anchor = a.anchor ?? { x: 0, y: 0, z: 0 };
  const anchorId = a.anchorPositionId ?? 'guided-anchor';
  const effectId = a.defaultEffectId ?? 'comet-gold';
  const dur = a.durationSec;

  const intro: CakeParams = {
    anchorPositionId: anchorId,
    anchor,
    effectId,
    shots: Math.round(12 * f),
    staggerMs: 180,
    spreadDeg: 60,
    startTime: Math.max(0, dur * 0.05),
    tilt: 8,
    bearingDeg: 0,
    rows: 1,
    sweep: 'linear',
  };

  const buildup: CakeParams = {
    anchorPositionId: anchorId,
    anchor,
    effectId,
    shots: Math.round(24 * f),
    staggerMs: 120,
    spreadDeg: 100,
    startTime: dur * 0.35,
    tilt: 6,
    rows: 2,
    rowGapMs: 250,
    sweep: 'pingpong',
  };

  const finale: CakeParams = {
    anchorPositionId: anchorId,
    anchor,
    effectId,
    shots: Math.round(48 * f),
    staggerMs: 80,
    spreadDeg: 140,
    startTime: dur * 0.78,
    tilt: 4,
    rows: 3,
    rowGapMs: 180,
    sweep: 'inout',
  };

  return [intro, buildup, finale];
}

/**
 * Build the formation list for a given event/scale.
 * Formations are time-spaced across the duration.
 */
function buildFormations(a: GuidedAnswers, themeColor: string): FormationParams[] {
  const count = DRONE_BASE[a.scale];
  const dur = a.durationSec;
  const radius = a.scale === 'large' ? 70 : a.scale === 'medium' ? 45 : 28;
  const heightBase = a.scale === 'large' ? 90 : 60;

  const slow: FormationParams = {
    shape: 'circle',
    droneCount: count,
    height: heightBase,
    radius,
    spacing: 3,
    startTime: Math.max(0, dur * 0.1),
    transitionDuration: 8,
    holdDuration: 14,
    color: themeColor,
  };

  const mid: FormationParams = {
    shape: a.eventType === 'wedding' ? 'heart' : a.eventType === 'sports' ? 'star' : 'sphere',
    droneCount: count,
    height: heightBase + 10,
    radius: radius * 0.9,
    spacing: 3,
    startTime: dur * 0.4,
    transitionDuration: 10,
    holdDuration: 18,
    color: themeColor,
    starPoints: 5,
  };

  const peak: FormationParams = {
    shape: 'helix',
    droneCount: count,
    height: heightBase + 25,
    radius: radius * 1.1,
    spacing: 2.5,
    startTime: dur * 0.72,
    transitionDuration: 12,
    holdDuration: 16,
    color: themeColor,
  };

  return [slow, mid, peak];
}

const THEME_COLOR: Record<EventType, string> = {
  wedding: '#FFD7A8',
  corporate: '#7CC8FF',
  newyear: '#FFE066',
  concert: '#C77DFF',
  sports: '#FF8A3D',
  festival: '#5BE7B5',
};

/**
 * Compute the recipe (no mutation). The wizard renders this object
 * before "Apply" and the apply step dispatches generator events.
 */
export function buildRecipe(a: GuidedAnswers): GuidedRecipe {
  const themeColor = THEME_COLOR[a.eventType];
  const cakes = a.system === 'drones' ? [] : buildCakes(a);
  const formations = a.system === 'pyro' ? [] : buildFormations(a, themeColor);

  const totalShots = cakes.reduce((s, c) => s + c.shots * (c.rows ?? 1), 0);
  const totalDrones = formations[0]?.droneCount ?? 0;

  const tags: string[] = [
    EVENT_LABELS[a.eventType],
    SYSTEM_LABELS[a.system],
    SCALE_LABELS[a.scale],
    `${a.durationSec}s`,
  ];
  if (cakes.length) tags.push(`${totalShots} shots`);
  if (formations.length) tags.push(`${totalDrones} drones`);

  const notes: string[] = [];
  if (cakes.length && a.system === 'hybrid') {
    notes.push('Pyro e Drones compartilham a janela temporal — revise sobreposição na timeline.');
  }
  if (formations.length && totalDrones >= 200) {
    notes.push('Frota grande: confirme bateria e janela de voo antes do ARM.');
  }
  if (a.scale === 'large' && a.durationSec < 180) {
    notes.push('Show grande em janela curta — densidade alta, considere aumentar a duração.');
  }
  notes.push('Modo Guiado cria uma BASE — você pode ajustar tudo no painel de tools depois.');

  return {
    label: `${EVENT_LABELS[a.eventType]} · ${SYSTEM_LABELS[a.system]} · ${SCALE_LABELS[a.scale]}`,
    description:
      'Receita curada com intro / buildup / finale e formações temáticas. Tudo é editável após aplicar.',
    cakes,
    formations,
    tags,
    notes,
  };
}

/**
 * Apply a recipe by dispatching the same CustomEvents the toolbar already
 * listens to. Keeps the canonical command path (UI → CommandBus) intact —
 * no direct store mutation here.
 */
export function applyRecipe(recipe: GuidedRecipe): { cakes: number; formations: number } {
  for (const c of recipe.cakes) {
    window.dispatchEvent(new CustomEvent('viewport-tools:generate-cake', { detail: c }));
  }
  for (const f of recipe.formations) {
    window.dispatchEvent(new CustomEvent('viewport-tools:generate-drone-formation', { detail: f }));
  }
  return { cakes: recipe.cakes.length, formations: recipe.formations.length };
}
