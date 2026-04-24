/**
 * Field primitives — building blocks for cinematic swarm scenes.
 *
 * Each primitive is a pure factory returning a `Field`. Compose them with
 * `combineFields` / `blendFields` from ./composition.
 */
import { dot, length, normalize, sub, distance, type Vec3 } from './vec3';
import type { Field } from './types';

/**
 * coneBeamField — Volumetric beam (lighthouse / aerial laser) emanating from
 * `origin` along unit `dir`. Density falls off outside the cone half-angle and
 * with distance. The flow component adds a subtle vertical sway so particles
 * inside the beam appear to drift, matching the reference image.
 */
export function coneBeamField(
  origin: Vec3,
  dir: Vec3,
  halfAngleRad: number,
  options: { distanceFalloff?: number; swayAmplitude?: number; color?: string } = {},
): Field {
  const cosHalfAngle = Math.cos(halfAngleRad);
  const dirN = normalize(dir);
  const falloff = options.distanceFalloff ?? 0.2;
  const sway = options.swayAmplitude ?? 0.2;
  const colorStr = options.color;

  return {
    density: (p) => {
      const v = sub(p, origin);
      const lv = length(v);
      if (lv < 1e-6) return 1;
      const cosTheta = (v.x * dirN.x + v.y * dirN.y + v.z * dirN.z) / lv;
      if (cosTheta < cosHalfAngle) return 0;
      // Smooth edge inside the cone.
      const angularFalloff = (cosTheta - cosHalfAngle) / (1 - cosHalfAngle);
      return angularFalloff / (1 + lv * falloff);
    },
    flow: (p, t) => ({
      x: 0,
      y: Math.sin(t + p.x * 0.1) * sway,
      z: 0,
    }),
    color: colorStr ? () => colorStr : undefined,
  };
}

/**
 * gaussianClusterField — Soft 3D gaussian "blob" — used for the bright purple
 * clusters in the reference image. Standard deviation `sigma` controls width.
 */
export function gaussianClusterField(
  center: Vec3,
  sigma: number,
  options: { peak?: number; color?: string } = {},
): Field {
  const peak = options.peak ?? 1;
  const twoSigmaSq = 2 * sigma * sigma;
  const colorStr = options.color;

  return {
    density: (p) => {
      const d2 = (p.x - center.x) ** 2 + (p.y - center.y) ** 2 + (p.z - center.z) ** 2;
      return peak * Math.exp(-d2 / twoSigmaSq);
    },
    flow: () => ({ x: 0, y: 0, z: 0 }),
    color: colorStr ? () => colorStr : undefined,
  };
}

/**
 * sphereShellField — Hollow sphere shell (ring-of-light effects).
 * Density peaks at distance ≈ `radius` from `center`, with `thickness` falloff.
 */
export function sphereShellField(
  center: Vec3,
  radius: number,
  thickness: number,
  options: { color?: string } = {},
): Field {
  const t2 = 2 * thickness * thickness;
  const colorStr = options.color;

  return {
    density: (p) => {
      const d = distance(p, center);
      const r = d - radius;
      return Math.exp(-(r * r) / t2);
    },
    flow: () => ({ x: 0, y: 0, z: 0 }),
    color: colorStr ? () => colorStr : undefined,
  };
}

/**
 * halfSpaceField — Density 1 above (or below) a plane; used to clip scenes
 * to "above the horizon" or similar.
 */
export function halfSpaceField(planePoint: Vec3, planeNormal: Vec3): Field {
  const n = normalize(planeNormal);
  return {
    density: (p) => {
      const v = sub(p, planePoint);
      return dot(v, n) > 0 ? 1 : 0;
    },
    flow: () => ({ x: 0, y: 0, z: 0 }),
  };
}

/**
 * vortexField — Tangential flow around a vertical axis through `center`.
 * Density is uniform; combine with another field to constrain it.
 */
export function vortexField(center: Vec3, strength: number): Field {
  return {
    density: () => 1,
    flow: (p) => {
      const dx = p.x - center.x;
      const dz = p.z - center.z;
      const r = Math.sqrt(dx * dx + dz * dz) + 1e-6;
      // Tangent in the XZ plane: rotate radial by 90°.
      return { x: -dz / r * strength, y: 0, z: dx / r * strength };
    },
  };
}
