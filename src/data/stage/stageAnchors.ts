/**
 * Stage Anchors — typed coordinate handles for procedural stage models.
 *
 * Bumps `STAGE_ANCHORS_VERSION` whenever positions or kinds change.
 * Seeds reference anchors by `id`; a mismatched version invalidates the seed.
 */

export type StageAnchorKind =
  | 'mine-front'
  | 'mine-mid'
  | 'mine-back'
  | 'co2-jet-l'
  | 'co2-jet-r'
  | 'mover-truss'
  | 'led-wall'
  | 'pa-cluster';

export interface StageAnchor {
  id: string;
  kind: StageAnchorKind;
  /** [x, y, z] in metres, stage-local — y is up, z is forward toward audience. */
  position: [number, number, number];
  rotation?: [number, number, number];
}

export const STAGE_ANCHORS_VERSION = 1;

/** Festival main-stage anchor table (default: 18×12 deck, 14×8 LED wall). */
export const FESTIVAL_STAGE_ANCHORS: ReadonlyArray<StageAnchor> = [
  // Front-row mines (3, evenly spaced across 16m)
  { id: 'mine-front-l', kind: 'mine-front', position: [-6, 1.2, 5] },
  { id: 'mine-front-c', kind: 'mine-front', position: [0, 1.2, 5] },
  { id: 'mine-front-r', kind: 'mine-front', position: [6, 1.2, 5] },
  // Mid-deck mines (2)
  { id: 'mine-mid-l', kind: 'mine-mid', position: [-4, 1.2, 0] },
  { id: 'mine-mid-r', kind: 'mine-mid', position: [4, 1.2, 0] },
  // Back-deck mine (1)
  { id: 'mine-back-c', kind: 'mine-back', position: [0, 1.2, -4] },
  // CO₂ jets (4 — left/right pairs, front + mid)
  { id: 'co2-front-l', kind: 'co2-jet-l', position: [-8, 1.2, 4] },
  { id: 'co2-front-r', kind: 'co2-jet-r', position: [8, 1.2, 4] },
  { id: 'co2-mid-l', kind: 'co2-jet-l', position: [-8, 1.2, -2] },
  { id: 'co2-mid-r', kind: 'co2-jet-r', position: [8, 1.2, -2] },
  // LED wall (centre, back of deck)
  { id: 'led-wall', kind: 'led-wall', position: [0, 5, -5.5] },
  // PA hangs
  { id: 'pa-l', kind: 'pa-cluster', position: [-10, 8, 4] },
  { id: 'pa-r', kind: 'pa-cluster', position: [10, 8, 4] },
];

export function findAnchor(id: string): StageAnchor | undefined {
  return FESTIVAL_STAGE_ANCHORS.find((a) => a.id === id);
}

export function resolveAnchorPosition(
  ref: string | { x: number; y: number; z: number },
): { x: number; y: number; z: number } | null {
  if (typeof ref !== 'string') return ref;
  const a = findAnchor(ref);
  if (!a) return null;
  return { x: a.position[0], y: a.position[1], z: a.position[2] };
}
