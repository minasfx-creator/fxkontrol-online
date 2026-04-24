/**
 * Field composition — sum, blend, mirror, transform.
 *
 * `combineFields` is associative density-additive composition (good for
 * "render all of these at once"). `blendFields` is parameterized linear
 * interpolation between two fields (good for continuous transitions).
 */
import type { Field } from './types';
import type { Vec3 } from './vec3';

/** Density-additive composition. Color is taken from the densest contributor at p. */
export function combineFields(fields: Field[]): Field {
  if (fields.length === 0) {
    return { density: () => 0, flow: () => ({ x: 0, y: 0, z: 0 }) };
  }
  if (fields.length === 1) return fields[0];

  return {
    density: (p) => {
      let sum = 0;
      for (let i = 0; i < fields.length; i++) sum += fields[i].density(p);
      return sum;
    },
    flow: (p, t) => {
      let x = 0, y = 0, z = 0;
      for (let i = 0; i < fields.length; i++) {
        const v = fields[i].flow(p, t);
        x += v.x; y += v.y; z += v.z;
      }
      return { x, y, z };
    },
    color: (p) => {
      let bestD = -Infinity;
      let bestColor: string | undefined;
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        if (!f.color) continue;
        const d = f.density(p);
        if (d > bestD) { bestD = d; bestColor = f.color(p); }
      }
      return bestColor ?? '#ffffff';
    },
  };
}

/** Linear interpolation between two fields. `t` is clamped to [0,1]. */
export function blendFields(a: Field, b: Field, t: number): Field {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const inv = 1 - k;
  return {
    density: (p) => a.density(p) * inv + b.density(p) * k,
    flow: (p, time) => {
      const fa = a.flow(p, time);
      const fb = b.flow(p, time);
      return {
        x: fa.x * inv + fb.x * k,
        y: fa.y * inv + fb.y * k,
        z: fa.z * inv + fb.z * k,
      };
    },
    color: a.color || b.color
      ? (p) => (k < 0.5 ? (a.color?.(p) ?? b.color?.(p) ?? '#fff') : (b.color?.(p) ?? a.color?.(p) ?? '#fff'))
      : undefined,
  };
}

/**
 * mirrorField — Returns a field that is the original union'd with its mirror
 * across the given axis (default X). Density is the max so the mirror never
 * cancels the original.
 */
export function mirrorField(field: Field, axis: 'x' | 'y' | 'z' = 'x'): Field {
  const flip = (p: Vec3): Vec3 => {
    if (axis === 'x') return { x: -p.x, y: p.y, z: p.z };
    if (axis === 'y') return { x: p.x, y: -p.y, z: p.z };
    return { x: p.x, y: p.y, z: -p.z };
  };
  return {
    density: (p) => Math.max(field.density(p), field.density(flip(p))),
    flow: (p, t) => {
      const original = field.flow(p, t);
      const mirroredP = flip(p);
      const mf = field.flow(mirroredP, t);
      // The mirrored flow's component along `axis` must also flip.
      if (axis === 'x') return { x: (original.x - mf.x) * 0.5, y: (original.y + mf.y) * 0.5, z: (original.z + mf.z) * 0.5 };
      if (axis === 'y') return { x: (original.x + mf.x) * 0.5, y: (original.y - mf.y) * 0.5, z: (original.z + mf.z) * 0.5 };
      return { x: (original.x + mf.x) * 0.5, y: (original.y + mf.y) * 0.5, z: (original.z - mf.z) * 0.5 };
    },
    color: field.color,
  };
}

/** Multiply density by a scalar (boost / attenuate). */
export function scaleField(field: Field, factor: number): Field {
  return {
    density: (p) => field.density(p) * factor,
    flow: field.flow,
    color: field.color,
  };
}
