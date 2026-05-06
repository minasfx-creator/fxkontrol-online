/**
 * VVIZ ↔ Three.js coordinate transform
 * ────────────────────────────────────
 * Finale 3D / VVIZ ground frame (ENU, right-handed):
 *   X = East,  Y = North,  Z = Up
 *   Heading = degrees clockwise from North (compass)
 *
 * Three.js render frame (right-handed, Y-up):
 *   X = East (Right),  Y = Up,  Z = South (toward viewer when camera looks -Z North)
 *
 * Mapping (preserves handedness, no scale):
 *   three.x =  vviz.x        // East stays East
 *   three.y =  vviz.z        // VVIZ Up → Three Y
 *   three.z = -vviz.y        // VVIZ North → Three -Z
 *
 * Heading mapping:
 *   Finale heading is CW from +Y(North). Three Y-rotation is CCW from -Z(North).
 *   Both originate at North, but spin opposite ⇒ headingThree = -headingFinale.
 *
 * Reference: docs/architecture (Finale 3D HPR/PTS — YZX Euler) +
 * mem://arquitetura/coordenadas-rotacao-finale-3d-hpr-pts.
 */

export type VvizAxesMode =
  | 'enu_to_three'   // canonical Finale/VVIZ → Three.js (default)
  | 'legacy_zflip'   // historical: only Z negated (kept for round-trip backward compat)
  | 'pass';          // file already authored in Three.js frame (coordinateFrame: "threejs")

export interface Vec3 { x: number; y: number; z: number }

export function resolveAxesMode(coordinateFrame: string | undefined): VvizAxesMode {
  if (!coordinateFrame) return 'enu_to_three';
  const f = coordinateFrame.toLowerCase().trim();
  if (f === 'threejs' || f === 'opengl' || f === 'r3f') return 'pass';
  if (f === 'legacy' || f === 'zflip') return 'legacy_zflip';
  // 'vviz', 'finale3d', 'standard', 'enu', anything unknown → canonical ENU
  return 'enu_to_three';
}

/** Transform a point from the VVIZ source frame into Three.js render space. */
export function transformPoint(x: number, y: number, z: number, mode: VvizAxesMode): Vec3 {
  // `+ 0` collapses negative-zero so equality checks remain stable.
  switch (mode) {
    case 'pass':
      return { x: x + 0, y: y + 0, z: z + 0 };
    case 'legacy_zflip':
      return { x: x + 0, y: y + 0, z: -z + 0 };
    case 'enu_to_three':
    default:
      return { x: x + 0, y: z + 0, z: -y + 0 };
  }
}

/**
 * Transform a delta sample in-place semantics. Same linear map as transformPoint
 * (rotations/permutations, no translation), so deltas use the identical formula.
 */
export function transformDelta(dx: number, dy: number, dz: number, mode: VvizAxesMode): Vec3 {
  return transformPoint(dx, dy, dz, mode);
}

/**
 * Convert Finale/VVIZ heading (degrees, CW from North) into a Three.js Y-rotation
 * heading expressed in the same units (degrees, CCW from North/-Z).
 * Output is normalised to (-180, 180].
 */
export function transformHeadingDegrees(headingDeg: number, mode: VvizAxesMode): number {
  if (!Number.isFinite(headingDeg)) return 0;
  const raw = mode === 'pass' ? headingDeg : -headingDeg;
  // Normalise to (-180, 180]
  let h = raw % 360;
  if (h > 180) h -= 360;
  else if (h <= -180) h += 360;
  return h;
}
