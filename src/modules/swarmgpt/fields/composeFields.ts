/**
 * Field composition — sum, blend, mirror.
 * `combineFields` is the primary scene-builder; `blendFields` drives transitions.
 */
import type { VectorField } from "./types";
import { add, clamp01, scale, ZERO_VEC3 } from "./vector";

export function combineFields(fields: VectorField[]): VectorField {
  return {
    id: "combined_field",
    name: "Combined Field",
    density: (point) => {
      let total = 0;
      for (const field of fields) total += field.density(point);
      return clamp01(total);
    },
    flow: (point, time) => {
      if (fields.length === 0) return ZERO_VEC3;
      let total = ZERO_VEC3;
      for (const field of fields) {
        const weight = field.density(point);
        total = add(total, scale(field.flow(point, time), weight));
      }
      return total;
    },
    color: (point) => {
      let bestColor: string | undefined;
      let bestDensity = -Infinity;
      for (const field of fields) {
        const c = field.color?.(point);
        if (!c) continue;
        const d = field.density(point);
        if (d > bestDensity) {
          bestDensity = d;
          bestColor = c;
        }
      }
      return bestColor;
    },
    metadata: { type: "combined", fieldCount: fields.length },
  };
}

export function blendFields(a: VectorField, b: VectorField, t: number): VectorField {
  const blend = clamp01(t);
  const inv = 1 - blend;

  return {
    id: `${a.id}_blend_${b.id}`,
    name: `${a.name} → ${b.name}`,
    density: (point) => clamp01(a.density(point) * inv + b.density(point) * blend),
    flow: (point, time) =>
      add(scale(a.flow(point, time), inv), scale(b.flow(point, time), blend)),
    color: (point) => (blend < 0.5 ? a.color?.(point) : b.color?.(point)),
    metadata: { type: "blend", from: a.id, to: b.id, blend },
  };
}

export function mirrorFieldX(field: VectorField): VectorField {
  return {
    ...field,
    id: `${field.id}_mirror_x`,
    name: `${field.name} Mirror X`,
    density: (point) => field.density({ ...point, x: -point.x }),
    flow: (point, time) => {
      const mirrored = field.flow({ ...point, x: -point.x }, time);
      return { ...mirrored, x: -mirrored.x };
    },
    color: field.color
      ? (point) => field.color?.({ ...point, x: -point.x })
      : undefined,
    metadata: { ...field.metadata, mirrored: "x" },
  };
}
