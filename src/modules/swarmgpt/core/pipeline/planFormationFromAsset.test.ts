import { describe, expect, it } from "vitest";
import { planFormationFromAsset } from "./planFormationFromAsset";

const previousPoints = [
  { x: 0, y: 0, z: 0 },
  { x: 5, y: 0, z: 0 },
];

describe("planFormationFromAsset", () => {
  it("creates a formation plan from point-cloud assets and snaps cue time", () => {
    const plan = planFormationFromAsset(
      {
        type: "point_cloud",
        points: [
          { x: 1, y: 0, z: 0 },
          { x: 6, y: 0, z: 0 },
          { x: 100, y: 100, z: 100 },
        ],
      },
      previousPoints,
      {
        droneCount: 2,
        minDistance: 1,
        maxSpeed: 10,
        duration: 1,
        cueTime: 0.61,
        beatGrid: {
          bpm: 120,
          offsets: [0, 0.5, 1],
        },
      },
    );

    expect(plan.formation.points).toHaveLength(2);
    expect(plan.transition.fromCount).toBe(2);
    expect(plan.transition.toCount).toBe(2);
    expect(plan.validation.valid).toBe(true);
    expect(plan.fidelity.pointCoverage).toBeGreaterThan(0);
    expect(plan.snappedTime).toBe(0.5);
  });

  it("reports violations when speed and spacing constraints are not met", () => {
    const plan = planFormationFromAsset(
      {
        type: "point_cloud",
        points: [
          { x: 100, y: 0, z: 0 },
          { x: 100.2, y: 0, z: 0 },
        ],
      },
      previousPoints,
      {
        droneCount: 2,
        minDistance: 1,
        maxSpeed: 1,
        duration: 1,
        cueTime: 0.1,
      },
    );

    expect(plan.validation.valid).toBe(false);
    expect(plan.validation.violations.join(" ")).toContain("maxSpeedExceeded");
    expect(plan.validation.violations.join(" ")).toContain("minDistanceViolation");
    expect(plan.snappedTime).toBe(0.1);
  });
});
