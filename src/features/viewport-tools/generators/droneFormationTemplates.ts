/**
 * Drone Formation Templates (curated library)
 * ────────────────────────────────────────────────────────────
 * A read-only catalog of pre-tuned `FormationParams` presets that map
 * to common show beats: opening reveal, brand logo, finale, ambient
 * background, etc. Each template carries:
 *
 *   - `id`           stable key for analytics + persistence
 *   - `category`     bucket for the marketplace UI
 *   - `tags`         search facets
 *   - `recommendedDroneCount` lower/upper guidance
 *   - `params`       the canonical `FormationParams` payload
 *   - `safetyNote`   human-readable warning (optional)
 *
 * Templates are PURE DATA — no IO, no store mutations. The dialog hands
 * the params straight into `generateDroneFormationDetailed()` which is
 * what already runs collision validation.
 *
 * NEVER bypass collision/digital-twin gates with a template — the
 * generator runs the same validation regardless of source.
 */

import type { FormationParams, FormationShape } from './droneFormationGenerator';

export type TemplateCategory =
  | 'opening'
  | 'brand'
  | 'finale'
  | 'ambient'
  | 'transition'
  | 'demo';

export interface DroneFormationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  shape: FormationShape;
  recommendedDroneCount: { min: number; max: number };
  params: Omit<FormationParams, 'startTime'>;
  safetyNote?: string;
  /** Dimensionless score 1-5 for UX badges. */
  difficulty: 1 | 2 | 3 | 4 | 5;
}

/** Curated template library — extend freely, IDs are stable. */
export const DRONE_FORMATION_TEMPLATES: DroneFormationTemplate[] = [
  {
    id: 'opening-halo',
    name: 'Halo Reveal',
    description: 'Slow-rising 80-drone circle that frames the stage during intro.',
    category: 'opening',
    tags: ['circle', 'intro', 'wide'],
    shape: 'circle',
    recommendedDroneCount: { min: 60, max: 120 },
    difficulty: 1,
    params: {
      shape: 'circle',
      droneCount: 80,
      radius: 35,
      spacing: 2.5,
      height: 45,
      rotation: 0,
      transitionDuration: 6,
      holdDuration: 8,
      color: '#00e5ff',
    },
  },
  {
    id: 'opening-spiral-rise',
    name: 'Spiral Rise',
    description: 'Triple-turn spiral building from center — great after countdown.',
    category: 'opening',
    tags: ['spiral', 'energy', 'vertical'],
    shape: 'spiral',
    recommendedDroneCount: { min: 80, max: 200 },
    difficulty: 2,
    params: {
      shape: 'spiral',
      droneCount: 120,
      radius: 30,
      spacing: 2,
      height: 30,
      rotation: 0,
      transitionDuration: 8,
      holdDuration: 6,
      color: '#a855f7',
    },
  },
  {
    id: 'brand-logo-text',
    name: 'Brand Text "FXK"',
    description: 'ASCII text glyph at 60m altitude — swap text param to brand.',
    category: 'brand',
    tags: ['text', 'logo', 'brand'],
    shape: 'text',
    recommendedDroneCount: { min: 60, max: 300 },
    difficulty: 3,
    params: {
      shape: 'text',
      droneCount: 120,
      radius: 30,
      spacing: 2.5,
      height: 60,
      rotation: 0,
      transitionDuration: 7,
      holdDuration: 12,
      color: '#ffffff',
      text: 'FXK',
    },
    safetyNote: 'Use min spacing ≥2.5m for legibility at long viewing distance.',
  },
  {
    id: 'brand-heart',
    name: 'Heart Icon',
    description: 'Iconic heart shape — wedding, brand love moments.',
    category: 'brand',
    tags: ['heart', 'love', 'icon'],
    shape: 'heart',
    recommendedDroneCount: { min: 80, max: 200 },
    difficulty: 2,
    params: {
      shape: 'heart',
      droneCount: 120,
      radius: 25,
      spacing: 2,
      height: 50,
      rotation: 0,
      transitionDuration: 6,
      holdDuration: 10,
      color: '#ff3366',
    },
  },
  {
    id: 'brand-star',
    name: '5-Point Star',
    description: 'Classic 5-point star — anthem moments, awards.',
    category: 'brand',
    tags: ['star', 'icon', 'anthem'],
    shape: 'star',
    recommendedDroneCount: { min: 80, max: 200 },
    difficulty: 2,
    params: {
      shape: 'star',
      droneCount: 100,
      radius: 28,
      spacing: 2,
      height: 50,
      rotation: 0,
      transitionDuration: 6,
      holdDuration: 10,
      color: '#ffd700',
      starPoints: 5,
    },
  },
  {
    id: 'finale-sphere',
    name: 'Finale Sphere',
    description: 'Fibonacci-distributed 3D sphere — climactic finale.',
    category: 'finale',
    tags: ['sphere', '3d', 'climax'],
    shape: 'sphere',
    recommendedDroneCount: { min: 150, max: 500 },
    difficulty: 4,
    params: {
      shape: 'sphere',
      droneCount: 250,
      radius: 25,
      spacing: 2,
      height: 70,
      rotation: 0,
      transitionDuration: 8,
      holdDuration: 12,
      color: '#00ffaa',
    },
    safetyNote: 'Sphere requires R≥20m and ≥150 drones for even Fibonacci coverage.',
  },
  {
    id: 'finale-cube',
    name: 'Cube Shell',
    description: 'Hollow cube shell rotating slowly — geometric finale.',
    category: 'finale',
    tags: ['cube', 'geometric', '3d'],
    shape: 'cube',
    recommendedDroneCount: { min: 120, max: 400 },
    difficulty: 4,
    params: {
      shape: 'cube',
      droneCount: 200,
      radius: 25,
      spacing: 3,
      height: 50,
      rotation: 30,
      transitionDuration: 8,
      holdDuration: 10,
      color: '#00bfff',
    },
  },
  {
    id: 'finale-helix',
    name: 'DNA Helix',
    description: 'Vertical climbing helix — epic vertical finale.',
    category: 'finale',
    tags: ['helix', 'vertical', '3d'],
    shape: 'helix',
    recommendedDroneCount: { min: 100, max: 300 },
    difficulty: 3,
    params: {
      shape: 'helix',
      droneCount: 180,
      radius: 18,
      spacing: 2,
      height: 30,
      rotation: 0,
      transitionDuration: 8,
      holdDuration: 10,
      color: '#ff6600',
    },
  },
  {
    id: 'ambient-grid',
    name: 'Ambient Grid',
    description: 'Calm orthogonal grid — background fill between cues.',
    category: 'ambient',
    tags: ['grid', 'background', 'fill'],
    shape: 'grid',
    recommendedDroneCount: { min: 64, max: 256 },
    difficulty: 1,
    params: {
      shape: 'grid',
      droneCount: 100,
      radius: 25,
      spacing: 3,
      height: 40,
      rotation: 0,
      transitionDuration: 5,
      holdDuration: 15,
      color: '#3366ff',
    },
  },
  {
    id: 'transition-wave',
    name: 'Sine Wave',
    description: 'Sweeping sine wave — energetic transition between scenes.',
    category: 'transition',
    tags: ['wave', 'transition', 'motion'],
    shape: 'wave',
    recommendedDroneCount: { min: 50, max: 150 },
    difficulty: 1,
    params: {
      shape: 'wave',
      droneCount: 80,
      radius: 35,
      spacing: 2,
      height: 35,
      rotation: 0,
      transitionDuration: 4,
      holdDuration: 4,
      color: '#00e5ff',
    },
  },
  {
    id: 'demo-mini-circle',
    name: 'Demo Mini-Circle',
    description: 'Small 24-drone ring — perfect for indoor demos and showcases.',
    category: 'demo',
    tags: ['demo', 'small', 'indoor'],
    shape: 'circle',
    recommendedDroneCount: { min: 12, max: 48 },
    difficulty: 1,
    params: {
      shape: 'circle',
      droneCount: 24,
      radius: 8,
      spacing: 2,
      height: 12,
      rotation: 0,
      transitionDuration: 4,
      holdDuration: 6,
      color: '#00e5ff',
    },
  },
];

export function getTemplate(id: string): DroneFormationTemplate | undefined {
  return DRONE_FORMATION_TEMPLATES.find((t) => t.id === id);
}

export function listTemplatesByCategory(): Record<TemplateCategory, DroneFormationTemplate[]> {
  const out = {
    opening: [],
    brand: [],
    finale: [],
    ambient: [],
    transition: [],
    demo: [],
  } as Record<TemplateCategory, DroneFormationTemplate[]>;
  for (const t of DRONE_FORMATION_TEMPLATES) out[t.category].push(t);
  return out;
}

/** Material-friendly category labels for UI chips. */
export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  opening: 'Opening',
  brand: 'Brand / Logo',
  finale: 'Finale',
  ambient: 'Ambient',
  transition: 'Transition',
  demo: 'Demo',
};
