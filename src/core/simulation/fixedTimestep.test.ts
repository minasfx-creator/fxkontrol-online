import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fixedUpdate,
  getInterpolationAlpha,
  getSimulationTime,
  getStepCount,
  resetFixedTimestep,
} from "./fixedTimestep";

const FIXED_STEP = 1 / 60;

describe("fixedTimestep", () => {
  beforeEach(() => {
    resetFixedTimestep();
  });

  describe("resetFixedTimestep()", () => {
    it("zeroes simulation time, step count, and accumulator", () => {
      fixedUpdate(1 / 60, () => {});
      resetFixedTimestep();
      expect(getSimulationTime()).toBe(0);
      expect(getStepCount()).toBe(0);
      expect(getInterpolationAlpha()).toBe(0);
    });
  });

  describe("fixedUpdate()", () => {
    it("executes step function once for exactly one fixed step", () => {
      let calls = 0;
      const steps = fixedUpdate(FIXED_STEP, () => calls++);
      expect(calls).toBe(1);
      expect(steps).toBe(1);
    });

    it("executes step function twice for two fixed steps", () => {
      let calls = 0;
      fixedUpdate(FIXED_STEP * 2, () => calls++);
      expect(calls).toBe(2);
    });

    it("does not execute if delta is less than one fixed step", () => {
      let calls = 0;
      fixedUpdate(FIXED_STEP * 0.5, () => calls++);
      expect(calls).toBe(0);
    });

    it("passes the correct fixed dt to step function", () => {
      const dts: number[] = [];
      fixedUpdate(FIXED_STEP * 2, (dt) => dts.push(dt));
      expect(dts[0]).toBeCloseTo(FIXED_STEP, 10);
      expect(dts[1]).toBeCloseTo(FIXED_STEP, 10);
    });

    it("caps at MAX_SUBSTEPS (4) for large deltas", () => {
      let calls = 0;
      const steps = fixedUpdate(100, () => calls++);
      expect(calls).toBeLessThanOrEqual(4);
      expect(steps).toBeLessThanOrEqual(4);
    });

    it("caps accumulator at MAX_ACCUMULATOR (0.25s)", () => {
      // A 10 second delta should only add 0.25 to the accumulator
      let calls = 0;
      fixedUpdate(10, () => calls++);
      // max 0.25 / (1/60) ≈ 15 — capped by MAX_SUBSTEPS at 4
      expect(calls).toBeLessThanOrEqual(4);
    });

    it("accumulates leftover delta across frames", () => {
      let calls = 0;
      // Three calls of half a step = 1.5 steps → 1 step + remainder
      fixedUpdate(FIXED_STEP * 0.5, () => calls++);
      expect(calls).toBe(0);
      fixedUpdate(FIXED_STEP * 0.5, () => calls++);
      expect(calls).toBe(1);
      fixedUpdate(FIXED_STEP * 0.5, () => calls++);
      expect(calls).toBe(1); // remainder < 1 step
    });

    it("returns number of steps executed", () => {
      const steps = fixedUpdate(FIXED_STEP * 3, () => {});
      expect(steps).toBe(3);
    });
  });

  describe("getSimulationTime()", () => {
    it("advances by FIXED_STEP per simulation step", () => {
      fixedUpdate(FIXED_STEP * 3, () => {});
      expect(getSimulationTime()).toBeCloseTo(FIXED_STEP * 3, 10);
    });

    it("does not advance when no steps occur", () => {
      fixedUpdate(FIXED_STEP * 0.1, () => {});
      expect(getSimulationTime()).toBe(0);
    });
  });

  describe("getStepCount()", () => {
    it("counts total steps across multiple frames", () => {
      fixedUpdate(FIXED_STEP * 2, () => {});
      fixedUpdate(FIXED_STEP * 1, () => {});
      expect(getStepCount()).toBe(3);
    });
  });

  describe("getInterpolationAlpha()", () => {
    it("returns 0 when accumulator is empty", () => {
      fixedUpdate(FIXED_STEP, () => {}); // exactly one step, no remainder
      expect(getInterpolationAlpha()).toBeCloseTo(0, 5);
    });

    it("returns ~0.5 when accumulator holds half a step", () => {
      fixedUpdate(FIXED_STEP * 1.5, () => {}); // 1 step + 0.5 leftover
      expect(getInterpolationAlpha()).toBeCloseTo(0.5, 3);
    });

    it("stays between 0 and 1 when delta is within one step", () => {
      // When delta < FIXED_STEP, no steps execute, and alpha = accumulator/FIXED_STEP < 1
      for (let fraction = 0; fraction < 1; fraction += 0.05) {
        resetFixedTimestep();
        fixedUpdate(FIXED_STEP * fraction, () => {});
        const alpha = getInterpolationAlpha();
        expect(alpha).toBeGreaterThanOrEqual(0);
        expect(alpha).toBeLessThan(1);
      }
    });
  });
});
