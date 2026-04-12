import { describe, it, expect, beforeEach } from "vitest";
import { autoHeal } from "./autoHealEngine";

describe("AutoHealEngine", () => {
  beforeEach(() => {
    autoHeal.reset();
  });

  describe("register()", () => {
    it("registers a subsystem as healthy", () => {
      autoHeal.register("camera", () => true);
      const health = autoHeal.getHealth("camera");
      expect(health).toBeDefined();
      expect(health!.status).toBe("healthy");
      expect(health!.disabled).toBe(false);
    });

    it("warns and ignores duplicate registration", () => {
      autoHeal.register("tiles", () => true);
      autoHeal.register("tiles", () => true); // duplicate
      const report = autoHeal.getHealthReport();
      expect(report.filter((h) => h.id === "tiles")).toHaveLength(1);
    });
  });

  describe("reportFailure()", () => {
    it("auto-registers unknown subsystem and heals successfully", () => {
      const status = autoHeal.reportFailure("physics", "boom");
      // Auto-registered with no-op heal (returns true)
      expect(["healthy", "degraded"]).toContain(status);
    });

    it("returns healthy after successful heal", () => {
      autoHeal.register("audio", () => true);
      const status = autoHeal.reportFailure("audio", "buffer underrun");
      expect(status).toBe("healthy");
    });

    it("returns degraded after failed heal", () => {
      autoHeal.register("postfx", () => false);
      const status = autoHeal.reportFailure("postfx", "shader crash");
      expect(status).toBe("degraded");
    });

    it("disables subsystem after MAX_RETRIES failures (cooldown bypassed via time travel)", () => {
      // We cannot easily control Date.now, so we call reportFailure many
      // times while bypassing cooldown by resetting lastHealAttempt.
      autoHeal.register("lighting", () => false);

      // Force 4 failures: each call increments failureCount but cooldown
      // prevents consecutive calls. We manipulate the internal state via
      // force cycling through unique errors on freshly created instances.
      // Instead, we rely on the fact that 3 retries + 1 triggers disable.
      for (let i = 0; i < 4; i++) {
        const h = autoHeal.getHealth("lighting");
        if (h) h.lastHealAttempt = 0; // bypass cooldown
        autoHeal.reportFailure("lighting", `error ${i}`);
      }

      const health = autoHeal.getHealth("lighting");
      expect(health!.status).toBe("disabled");
      expect(health!.disabled).toBe(true);
    });

    it("returns disabled immediately if subsystem is already disabled", () => {
      autoHeal.register("fireworks", () => false);
      for (let i = 0; i < 5; i++) {
        const h = autoHeal.getHealth("fireworks");
        if (h) h.lastHealAttempt = 0;
        autoHeal.reportFailure("fireworks", `err ${i}`);
      }
      // Now it's disabled — further reports return 'disabled'
      const status = autoHeal.reportFailure("fireworks", "another error");
      expect(status).toBe("disabled");
    });

    it("respects heal cooldown", () => {
      autoHeal.register("drones", () => false);
      autoHeal.reportFailure("drones", "first");
      // Second call should be within cooldown and return current status without healing
      const health = autoHeal.getHealth("drones");
      const countBefore = health!.failureCount;
      autoHeal.reportFailure("drones", "second");
      expect(autoHeal.getHealth("drones")!.failureCount).toBe(countBefore);
    });

    it("handles heal function that throws", () => {
      autoHeal.register("environment", () => { throw new Error("heal exploded"); });
      const status = autoHeal.reportFailure("environment", "crash");
      expect(status).toBe("degraded");
    });
  });

  describe("isOperational()", () => {
    it("returns true for a healthy registered subsystem", () => {
      autoHeal.register("timeline", () => true);
      expect(autoHeal.isOperational("timeline")).toBe(true);
    });

    it("returns true for an unregistered subsystem (unknown is assumed operational)", () => {
      expect(autoHeal.isOperational("unknown_system" as never)).toBe(true);
    });

    it("returns false for a disabled subsystem", () => {
      autoHeal.register("unreal", () => false);
      for (let i = 0; i < 5; i++) {
        const h = autoHeal.getHealth("unreal");
        if (h) h.lastHealAttempt = 0;
        autoHeal.reportFailure("unreal", `err ${i}`);
      }
      expect(autoHeal.isOperational("unreal")).toBe(false);
    });
  });

  describe("forceEnable()", () => {
    it("re-enables a disabled subsystem", () => {
      autoHeal.register("cluster", () => false);
      for (let i = 0; i < 5; i++) {
        const h = autoHeal.getHealth("cluster");
        if (h) h.lastHealAttempt = 0;
        autoHeal.reportFailure("cluster", `err ${i}`);
      }
      expect(autoHeal.getHealth("cluster")!.disabled).toBe(true);
      autoHeal.forceEnable("cluster");
      const health = autoHeal.getHealth("cluster");
      expect(health!.disabled).toBe(false);
      expect(health!.status).toBe("healthy");
      expect(health!.failureCount).toBe(0);
    });

    it("does nothing for an unregistered subsystem", () => {
      // Should not throw
      expect(() => autoHeal.forceEnable("nonexistent" as never)).not.toThrow();
    });
  });

  describe("onHeal()", () => {
    it("calls listener on heal events", () => {
      const events: unknown[] = [];
      autoHeal.onHeal((e) => events.push(e));
      autoHeal.register("network" as never, () => true);
      autoHeal.reportFailure("network" as never, "net down");
      expect(events.length).toBeGreaterThan(0);
    });

    it("returns unsubscribe function", () => {
      let called = 0;
      const unsub = autoHeal.onHeal(() => called++);
      autoHeal.register("audio2" as never, () => true);
      autoHeal.reportFailure("audio2" as never, "err");
      const countBefore = called;
      unsub();
      const h = autoHeal.getHealth("audio2" as never);
      if (h) h.lastHealAttempt = 0;
      autoHeal.reportFailure("audio2" as never, "err2");
      expect(called).toBe(countBefore); // no new calls after unsub
    });
  });

  describe("getHealLog()", () => {
    it("returns an empty log initially", () => {
      expect(autoHeal.getHealLog()).toHaveLength(0);
    });

    it("appends heal events to log", () => {
      autoHeal.register("cam2" as never, () => true);
      autoHeal.reportFailure("cam2" as never, "focus lost");
      expect(autoHeal.getHealLog().length).toBeGreaterThan(0);
    });
  });

  describe("getHealthReport()", () => {
    it("returns health for all registered subsystems", () => {
      autoHeal.register("tiles", () => true);
      autoHeal.register("camera", () => true);
      const report = autoHeal.getHealthReport();
      const ids = report.map((h) => h.id);
      expect(ids).toContain("tiles");
      expect(ids).toContain("camera");
    });
  });

  describe("reset()", () => {
    it("clears heal log and resets all subsystem states", () => {
      autoHeal.register("physics", () => false);
      const h = autoHeal.getHealth("physics");
      if (h) h.lastHealAttempt = 0;
      autoHeal.reportFailure("physics", "crashed");
      autoHeal.reset();
      expect(autoHeal.getHealLog()).toHaveLength(0);
      const after = autoHeal.getHealth("physics");
      if (after) {
        expect(after.failureCount).toBe(0);
        expect(after.status).toBe("healthy");
      }
    });
  });
});
