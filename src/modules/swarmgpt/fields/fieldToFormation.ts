/**
 * Bridge: VectorField → DroneFormation.
 * Samples the field deterministically and emits a `custom`-shape formation
 * compatible with the SwarmGPT 2.0 domain types.
 */
import type { DroneFormation } from "../types";
import { makeId } from "../utils/ids";
import { sampleField } from "./sampleField";
import type { FieldToFormationOptions, VectorField } from "./types";

export function fieldToDroneFormation(
  field: VectorField,
  options: FieldToFormationOptions & { minDistance?: number },
): DroneFormation {
  const points = sampleField(field, {
    bounds: options.bounds,
    count: options.droneCount,
    seed: options.seed,
    minDistance: options.minDistance,
    minDensity: 0.03,
  });

  return {
    id: options.id ?? makeId("field_formation"),
    name: options.name,
    shape: "custom",
    startTime: options.startTime,
    duration: options.duration,
    points,
    color: options.color,
    description: `Generated from vector field: ${field.name}`,
  };
}
