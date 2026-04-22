import { describe, it, expect, beforeEach } from "vitest";
import { lockstep } from "./lockstepEngine";

describe("LockstepEngine", () => {
  beforeEach(() => {
    lockstep.reset();
  });

  describe("initial state", () => {
    it("is not running after reset", () => {
      expect(lockstep.isRunning()).toBe(false);
    });

    it("has zero sim time and tick count", () => {
      expect(lockstep.getSimTime()).toBe(0);
      expect(lockstep.getTickCount()).toBe(0);
    });
  });

  describe("start() / stop()", () => {
    it("starts the engine", () => {
      lockstep.start();
      expect(lockstep.isRunning()).toBe(true);
    });

    it("stops the engine", () => {
      lockstep.start();
      lockstep.stop();
      expect(lockstep.isRunning()).toBe(false);
    });

    it("does not advance when stopped", () => {
      lockstep.tick(1);
      expect(lockstep.getTickCount()).toBe(0);
      expect(lockstep.getSimTime()).toBe(0);
    });
  });

  describe("register() / unregister()", () => {
    it("registers a system", () => {
      lockstep.register("geo", () => {}, 10);
      lockstep.start();
      const steps = lockstep.tick(1 / 60);
      expect(steps).toBeGreaterThanOrEqual(1);
    });

    it("warns but does not duplicate on double registration", () => {
      lockstep.register("physics", () => {});
      lockstep.register("physics", () => {}); // duplicate
      const report = lockstep.getPerformanceReport();
      expect(report.filter((r) => r.id === "physics")).toHaveLength(1);
    });

    it("unregisters a system", () => {
      const calls: number[] = [];
      lockstep.register("audio", (t) => calls.push(t), 1);
      lockstep.unregister("audio");
      lockstep.start();
      lockstep.tick(1 / 60);
      expect(calls).toHaveLength(0);
    });
  });

  describe("tick()", () => {
    it("returns 0 when not running", () => {
      lockstep.register("tiles", () => {});
      expect(lockstep.tick(1)).toBe(0);
    });

    it("executes subsystems with fixed step ~1/60s", () => {
      const dts: number[] = [];
      lockstep.register("test", (_t, dt) => dts.push(dt));
      lockstep.start();
      lockstep.tick(1 / 60 + 0.001); // slightly more than one step
      expect(dts.length).toBeGreaterThanOrEqual(1);
      expect(dts[0]).toBeCloseTo(1 / 60, 5);
    });

    it("advances simTime by fixed step per tick", () => {
      lockstep.start();
      lockstep.tick(1 / 60);
      expect(lockstep.getSimTime()).toBeCloseTo(1 / 60, 5);
    });

    it("increments tick count", () => {
      lockstep.start();
      lockstep.tick(1 / 60);
      expect(lockstep.getTickCount()).toBe(1);
    });

    it("caps at MAX_SUBSTEPS (4) even with large delta", () => {
      lockstep.start();
      const steps = lockstep.tick(10); // huge delta
      expect(steps).toBeLessThanOrEqual(4);
    });

    it("caps accumulator at 250ms to prevent spiral of death", () => {
      lockstep.start();
      lockstep.tick(100); // 100 seconds — should be capped
      expect(lockstep.getTickCount()).toBeLessThanOrEqual(4);
    });

    it("executes systems in priority order", () => {
      const order: string[] = [];
      lockstep.register("low", () => order.push("low"), 100);
      lockstep.register("high", () => order.push("high"), 1);
      lockstep.register("mid", () => order.push("mid"), 50);
      lockstep.start();
      lockstep.tick(1 / 60);
      expect(order[0]).toBe("high");
      expect(order[1]).toBe("mid");
      expect(order[2]).toBe("low");
    });

    it("skips disabled systems", () => {
      const calls: number[] = [];
      lockstep.register("disabled_sys", () => calls.push(1));
      lockstep.setEnabled("disabled_sys", false);
      lockstep.start();
      lockstep.tick(1 / 60);
      expect(calls).toHaveLength(0);
    });

    it("re-enables a disabled system", () => {
      const calls: number[] = [];
      lockstep.register("re_enable", () => calls.push(1));
      lockstep.setEnabled("re_enable", false);
      lockstep.start();
      lockstep.tick(1 / 60);
      expect(calls).toHaveLength(0);
      lockstep.setEnabled("re_enable", true);
      lockstep.tick(1 / 60);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe("getAlpha()", () => {
    it("returns a value between 0 and 1", () => {
      lockstep.start();
      lockstep.tick(1 / 120); // half a fixed step
      const alpha = lockstep.getAlpha();
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(1);
    });
  });

  describe("getPerformanceReport()", () => {
    it("returns entries for registered systems", () => {
      lockstep.register("geo2", () => {}, 10);
      lockstep.register("phys2", () => {}, 20);
      const report = lockstep.getPerformanceReport();
      const ids = report.map((r) => r.id);
      expect(ids).toContain("geo2");
      expect(ids).toContain("phys2");
    });

    it("includes enabled flag", () => {
      lockstep.register("check", () => {});
      lockstep.setEnabled("check", false);
      const report = lockstep.getPerformanceReport();
      const entry = report.find((r) => r.id === "check");
      expect(entry!.enabled).toBe(false);
    });
  });

  describe("reset()", () => {
    it("resets simTime, tickCount, accumulator, and stops engine", () => {
      lockstep.register("r", () => {});
      lockstep.start();
      lockstep.tick(0.5);
      lockstep.reset();
      expect(lockstep.getSimTime()).toBe(0);
      expect(lockstep.getTickCount()).toBe(0);
      expect(lockstep.isRunning()).toBe(false);
    });
  });
});
