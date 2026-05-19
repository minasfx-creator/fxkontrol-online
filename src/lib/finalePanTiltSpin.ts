/**
 * Finale 3D — Effects coordinate system (Pan, Tilt, Spin).
 *
 * Pure data-in/data-out helper. See docs/reference/finale-pan-tilt-spin.md.
 *
 * Euler order (canonical, per Finale 3D docs Table 1):
 *   v' = v · Ry(spin) · Rx(tilt) · Ry(pan)
 * Or equivalently for column vectors / matrix-multiplied column-major:
 *   M = Ry(pan) · Rx(tilt) · Ry(spin)
 *
 * Right Hand Rule: thumb along axis, fingers curl positive direction.
 * - +pan  → yoke rotates right (CCW from above) on global Y.
 * - +tilt → head pivots toward viewer on global X.
 * - +spin → gobo rotates right (CCW along beam) on global Y.
 */

export interface PTS {
  pan: number;
  tilt: number;
  spin: number;
}

const DEG = Math.PI / 180;

/** Wrap an angle into `(-180, +180]`. */
function wrap180(deg: number): number {
  let d = ((deg + 180) % 360 + 360) % 360 - 180;
  // Force half-open interval (-180, 180] → if exactly -180 promote to +180.
  if (d === -180) d = 180;
  return d;
}

export function normalizePan(deg: number): number {
  return wrap180(deg);
}

export function normalizeSpin(deg: number): number {
  return wrap180(deg);
}

/**
 * Tilt is constrained to `[0, 180]`. Negative tilt reflects via pan+180,
 * because `Rx(-t) · Ry(p) ≡ Ry(p+180) · Rx(t) · Ry(...)` after canonical
 * folding. We expose the simple absolute-value+wrap behavior used by Finale
 * during conversion (the renderer never sees negative tilt).
 */
export function normalizeTilt(deg: number): number {
  // Reduce mod 360, then fold the negative half into positive by reflection.
  let t = ((deg % 360) + 360) % 360;
  if (t > 180) t = 360 - t;
  return t;
}

/**
 * Normalize a PTS triple. Handles the gimbal-lock cases at tilt=0 / tilt=180:
 * pan and spin redundantly rotate around global Y, so we collapse to
 * `spin = 0` and fold any spin into pan (Finale's documented convention).
 */
export function normalizePTS(pts: PTS): PTS {
  const tiltN = normalizeTilt(pts.tilt);
  // Detect gimbal-lock alignment.
  const LOCK_EPS = 1e-6;
  const atZero = Math.abs(tiltN) < LOCK_EPS;
  const atFlip = Math.abs(tiltN - 180) < LOCK_EPS;

  if (atZero) {
    return {
      pan: normalizePan(pts.pan + pts.spin),
      tilt: 0,
      spin: 0,
    };
  }
  if (atFlip) {
    // At tilt=180, pan and spin rotate Y in opposite effective senses;
    // canonical fold per docs is spin=0, pan absorbs (pan − spin).
    return {
      pan: normalizePan(pts.pan - pts.spin),
      tilt: 180,
      spin: 0,
    };
  }
  return {
    pan: normalizePan(pts.pan),
    tilt: tiltN,
    spin: normalizeSpin(pts.spin),
  };
}

/** 4×4 column-major rotation around Y by `deg`. */
function ry(deg: number): number[] {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  // column-major
  return [
     c, 0, -s, 0,
     0, 1,  0, 0,
     s, 0,  c, 0,
     0, 0,  0, 1,
  ];
}

/** 4×4 column-major rotation around X by `deg`. */
function rx(deg: number): number[] {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [
    1, 0,  0, 0,
    0, c,  s, 0,
    0,-s,  c, 0,
    0, 0,  0, 1,
  ];
}

/** Column-major 4×4 multiply: result = a · b. */
function mul4(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row + k * 4] * b[k + col * 4];
      }
      out[row + col * 4] = sum;
    }
  }
  return out;
}

/**
 * Compose the canonical PTS rotation matrix.
 *
 * Per docs Table 1 (row-vector convention `v' = v · R1 · R2 · R3`):
 *   R1 = Ry(spin), R2 = Rx(tilt), R3 = Ry(pan)
 * For column vectors, the equivalent is `M = Ry(pan) · Rx(tilt) · Ry(spin)`.
 * We return the column-vector form.
 */
export function ptsToMatrix(pts: PTS): number[] {
  return mul4(mul4(ry(pts.pan), rx(pts.tilt)), ry(pts.spin));
}

/**
 * Beam direction after PTS rotation.
 * Identity beam aims +Y (straight up) when pan=tilt=spin=0.
 */
export function ptsBeamDirection(pts: PTS): [number, number, number] {
  const m = ptsToMatrix(pts);
  // Apply M to (0,1,0,1); for the beam direction we only need the rotational
  // part applied to (0,1,0,0).
  const x = m[0 + 1 * 4] * 1;
  const y = m[1 + 1 * 4] * 1;
  const z = m[2 + 1 * 4] * 1;
  return [x, y, z];
}

/**
 * Canonical "audience-facing" spin for a cake/fan tilted via pan+tilt.
 * Per docs: tilted fan cake faces audience again with `spin = -pan`.
 */
export function audienceFacingSpinForTilted(panDeg: number): number {
  return normalizeSpin(-panDeg);
}
