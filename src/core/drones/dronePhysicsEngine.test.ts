import { describe, it, expect } from "vitest";
import {
  stepDronePhysics,
  validateWaypointTransition,
  createDroneState,
  DRONE_MODELS,
  DroneState,
} from "./dronePhysicsEngine";

function makeDrone(
  x = 0,
  y = 10,
  z = 0,
  modelKey = "show_drone_light",
): DroneState {
  return createDroneState(x, y, z, modelKey);
}

describe("dronePhysicsEngine", () => {
  describe("DRONE_MODELS", () => {
    it("defines expected preset models", () => {
      expect(DRONE_MODELS).toHaveProperty("show_drone_light");
      expect(DRONE_MODELS).toHaveProperty("show_drone_heavy");
      expect(DRONE_MODELS).toHaveProperty("racing_drone");
      expect(DRONE_MODELS).toHaveProperty("cargo_drone");
    });

    it("racing drone has higher maxSpeed than cargo drone", () => {
      expect(DRONE_MODELS.racing_drone.maxSpeed).toBeGreaterThan(
        DRONE_MODELS.cargo_drone.maxSpeed,
      );
    });
  });

  describe("createDroneState()", () => {
    it("creates drone at given position", () => {
      const drone = createDroneState(10, 20, 30);
      expect(drone.x).toBe(10);
      expect(drone.y).toBe(20);
      expect(drone.z).toBe(30);
    });

    it("starts with zero velocity", () => {
      const drone = createDroneState(0, 10, 0);
      expect(drone.vx).toBe(0);
      expect(drone.vy).toBe(0);
      expect(drone.vz).toBe(0);
    });

    it("sets target to initial position", () => {
      const drone = createDroneState(5, 15, 25);
      expect(drone.tx).toBe(5);
      expect(drone.ty).toBe(15);
      expect(drone.tz).toBe(25);
    });

    it("falls back to show_drone_light for unknown model", () => {
      const drone = createDroneState(0, 10, 0, "nonexistent");
      expect(drone.model.name).toBe(DRONE_MODELS.show_drone_light.name);
    });

    it("uses specified model", () => {
      const drone = createDroneState(0, 10, 0, "racing_drone");
      expect(drone.model.name).toBe(DRONE_MODELS.racing_drone.name);
    });
  });

  describe("stepDronePhysics()", () => {
    it("returns true when drone is within 0.5m of target", () => {
      const drone = makeDrone(0, 10, 0);
      drone.tx = 0.3; // within 0.5m
      drone.ty = 10;
      drone.tz = 0;
      const arrived = stepDronePhysics(drone, 1 / 60);
      expect(arrived).toBe(true);
    });

    it("returns false when drone is far from target", () => {
      const drone = makeDrone(0, 10, 0);
      drone.tx = 100;
      drone.ty = 10;
      drone.tz = 0;
      const arrived = stepDronePhysics(drone, 1 / 60);
      expect(arrived).toBe(false);
    });

    it("moves drone toward target", () => {
      const drone = makeDrone(0, 10, 0);
      drone.tx = 10;
      drone.ty = 10;
      drone.tz = 0;
      stepDronePhysics(drone, 1 / 60);
      expect(drone.x).toBeGreaterThan(0);
    });

    it("decelerates velocity on arrival", () => {
      const drone = makeDrone(0, 10, 0);
      drone.vx = 5;
      drone.vy = 0;
      drone.vz = 0;
      drone.tx = 0; // already at target
      drone.ty = 10;
      drone.tz = 0;
      stepDronePhysics(drone, 1 / 60);
      expect(Math.abs(drone.vx)).toBeLessThan(5); // decelerated
    });

    it("clamps horizontal speed to maxSpeed", () => {
      const drone = makeDrone(0, 10, 0);
      drone.vx = 1000; // far above max
      drone.vz = 0;
      drone.tx = 100;
      drone.ty = 10;
      drone.tz = 0;
      stepDronePhysics(drone, 1 / 60);
      const hSpeed = Math.sqrt(drone.vx ** 2 + drone.vz ** 2);
      expect(hSpeed).toBeLessThanOrEqual(drone.model.maxSpeed + 0.001);
    });

    it("clamps vertical speed to maxVerticalSpeed", () => {
      const drone = makeDrone(0, 10, 0);
      drone.vy = 1000;
      drone.ty = 1000;
      stepDronePhysics(drone, 1 / 60);
      expect(Math.abs(drone.vy)).toBeLessThanOrEqual(
        drone.model.maxVerticalSpeed + 0.001,
      );
    });

    it("keeps drone above ground (y >= 0.1)", () => {
      const drone = makeDrone(0, 0.05, 0); // below ground
      drone.ty = -10;
      drone.vy = -5;
      stepDronePhysics(drone, 1 / 60);
      expect(drone.y).toBeGreaterThanOrEqual(0.1);
    });

    it("applies wind drift proportional to windSensitivity", () => {
      // Target drones far in the Z direction so there is no X-axis target pull.
      // Wind in X-axis will be the sole contributor to vx.
      // show_drone_light: windForce_x = 10 * 0.6 / 1.2 = 5 m/s²
      // cargo_drone:      windForce_x = 10 * 0.3 / 8.0 = 0.375 m/s²
      const drone1 = makeDrone(0, 10, 0, "show_drone_light");
      const drone2 = makeDrone(0, 10, 0, "cargo_drone");
      drone1.tx = 0; drone1.ty = 10; drone1.tz = 1000;
      drone2.tx = 0; drone2.ty = 10; drone2.tz = 1000;
      const wind: [number, number, number] = [10, 0, 0];
      stepDronePhysics(drone1, 1 / 60, wind);
      stepDronePhysics(drone2, 1 / 60, wind);
      // Show drone (higher sensitivity) should drift more in x than cargo drone
      expect(Math.abs(drone1.vx)).toBeGreaterThan(Math.abs(drone2.vx));
    });

    it("updates heading when drone is moving fast enough", () => {
      const drone = makeDrone(0, 10, 0);
      drone.vx = 5;
      drone.vz = 5;
      drone.heading = 0;
      drone.tx = 100;
      drone.ty = 10;
      drone.tz = 100;
      stepDronePhysics(drone, 0.5);
      // heading should have changed toward movement direction
      expect(drone.heading).not.toBe(0);
    });
  });

  describe("validateWaypointTransition()", () => {
    const model = DRONE_MODELS.show_drone_light;

    it("returns valid=true for achievable transition", () => {
      const result = validateWaypointTransition(
        { x: 0, y: 10, z: 0 },
        { x: 1, y: 10, z: 0 },
        1,
        model,
      );
      expect(result.valid).toBe(true);
    });

    it("returns valid=false when horizontal speed exceeds max", () => {
      const result = validateWaypointTransition(
        { x: 0, y: 10, z: 0 },
        { x: 1000, y: 10, z: 0 }, // 1000m in 1s >> maxSpeed
        1,
        model,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Speed/);
    });

    it("clamps target position when speed exceeds max", () => {
      const result = validateWaypointTransition(
        { x: 0, y: 10, z: 0 },
        { x: 1000, y: 10, z: 0 },
        1,
        model,
      );
      // Clamped x should be at most maxSpeed * timeDelta
      expect(result.x).toBeLessThanOrEqual(model.maxSpeed * 1);
    });

    it("returns valid=false when vertical speed exceeds max", () => {
      // Need to keep total dist under maxSpeed * 1.2 so horizontal check passes,
      // but vertical component > maxVerticalSpeed * 1.2 = 6 m/s.
      // Use dy=10, dx=dz=0 → requiredSpeed=10 which is less than 12*1.2=14.4.
      const result = validateWaypointTransition(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 10, z: 0 }, // 10m vertical in 1s > maxVerticalSpeed(5)*1.2
        1,
        model,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Vertical speed/);
    });

    it("clamps vertical target position", () => {
      const result = validateWaypointTransition(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 10, z: 0 }, // 10m vertical in 1s → clamped to maxVerticalSpeed * 1
        1,
        model,
      );
      expect(result.y).toBeLessThanOrEqual(model.maxVerticalSpeed * 1 + 0.01);
    });

    it("passes with a very small timeDelta (nearly instantaneous, within limits)", () => {
      const result = validateWaypointTransition(
        { x: 0, y: 10, z: 0 },
        { x: 0, y: 10, z: 0 }, // same position
        0.001,
        model,
      );
      expect(result.valid).toBe(true);
    });
  });
});
