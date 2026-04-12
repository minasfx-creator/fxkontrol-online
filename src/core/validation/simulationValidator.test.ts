import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock blackbox so the validator can run without a recording session
vi.mock("@/core/reliability/blackBoxRecorder", () => ({
  blackbox: { record: vi.fn() },
}));

import { simulationValidator, ValidationCue } from "./simulationValidator";

const DEFAULT_SHOW_DURATION = 60;

function makeCue(partial: Partial<ValidationCue> & { id: string }): ValidationCue {
  return {
    type: "drone",
    time: 0,
    x: 0,
    y: 0,
    z: 50,
    ...partial,
  };
}

describe("SimulationValidator", () => {
  beforeEach(() => {
    simulationValidator.setConfig({
      minCueSpacing: 0.1,
      collisionRadius: 10,
      geofenceRadius: 500,
      maxAltitude: 300,
    });
  });

  describe("validate() — clean show", () => {
    it("passes an empty cue list", () => {
      const report = simulationValidator.validate([], DEFAULT_SHOW_DURATION);
      expect(report.passed).toBe(true);
      expect(report.totalCues).toBe(0);
      expect(report.issues).toHaveLength(0);
    });

    it("passes a well-spaced, in-bounds show", () => {
      const cues: ValidationCue[] = [
        makeCue({ id: "c1", time: 0, x: 0, y: 0, z: 50 }),
        makeCue({ id: "c2", time: 1, x: 100, y: 0, z: 50 }),
        makeCue({ id: "c3", time: 2, x: 200, y: 0, z: 50 }),
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      expect(report.passed).toBe(true);
      expect(report.criticals).toBe(0);
    });

    it("returns correct totalCues count", () => {
      const cues = [
        makeCue({ id: "a" }),
        makeCue({ id: "b", time: 5 }),
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      expect(report.totalCues).toBe(2);
    });

    it("includes simulatedDuration in report", () => {
      const report = simulationValidator.validate([], 180);
      expect(report.simulatedDuration).toBe(180);
    });
  });

  describe("validate() — geofence", () => {
    it("flags critical when cue is outside geofenceRadius", () => {
      const cues = [makeCue({ id: "far", x: 600, y: 0, z: 50 })];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      expect(report.passed).toBe(false);
      expect(report.criticals).toBe(1);
      expect(report.issues[0].message).toMatch(/Geofence breach/);
    });

    it("does not flag cue exactly at geofenceRadius boundary", () => {
      const cues = [makeCue({ id: "edge", x: 499, y: 0, z: 50 })];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const geofenceIssues = report.issues.filter((i) => i.message.includes("Geofence"));
      expect(geofenceIssues).toHaveLength(0);
    });
  });

  describe("validate() — altitude", () => {
    it("flags critical when cue exceeds maxAltitude", () => {
      const cues = [makeCue({ id: "high", z: 400 })];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      expect(report.passed).toBe(false);
      const altIssue = report.issues.find((i) => i.message.includes("Altitude"));
      expect(altIssue).toBeDefined();
      expect(altIssue!.severity).toBe("critical");
    });

    it("does not flag cue at or below maxAltitude", () => {
      const cues = [makeCue({ id: "ok_alt", z: 299 })];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const altIssues = report.issues.filter((i) => i.message.includes("Altitude"));
      expect(altIssues).toHaveLength(0);
    });
  });

  describe("validate() — collision / proximity", () => {
    it("flags warning when two cues are too close within 2s window", () => {
      const cues = [
        makeCue({ id: "p1", time: 0, x: 0, y: 0, z: 50 }),
        makeCue({ id: "p2", time: 0.5, x: 5, y: 0, z: 50 }), // within 10m collision radius
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const proxIssue = report.issues.find((i) => i.message.includes("Proximity"));
      expect(proxIssue).toBeDefined();
      expect(proxIssue!.severity).toBe("warning");
    });

    it("does not flag cues beyond 2s temporal window", () => {
      const cues = [
        makeCue({ id: "q1", time: 0, x: 0, y: 0, z: 50 }),
        makeCue({ id: "q2", time: 5, x: 5, y: 0, z: 50 }), // 5s apart → outside window
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const proxIssues = report.issues.filter((i) => i.message.includes("Proximity"));
      expect(proxIssues).toHaveLength(0);
    });

    it("does not flag cues that are far apart", () => {
      const cues = [
        makeCue({ id: "r1", time: 0, x: 0, y: 0, z: 50 }),
        makeCue({ id: "r2", time: 0.1, x: 50, y: 0, z: 50 }), // 50m apart > 20m min
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const proxIssues = report.issues.filter((i) => i.message.includes("Proximity"));
      expect(proxIssues).toHaveLength(0);
    });

    it("uses per-cue safetyRadius when provided", () => {
      const cues = [
        makeCue({ id: "s1", time: 0, x: 0, y: 0, z: 50, safetyRadius: 30 }),
        makeCue({ id: "s2", time: 0, x: 50, y: 0, z: 50, safetyRadius: 30 }), // 50m apart but 60m required
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const proxIssues = report.issues.filter((i) => i.message.includes("Proximity"));
      expect(proxIssues).toHaveLength(1);
    });
  });

  describe("validate() — timing spacing", () => {
    it("flags warning when same-type cues are too close together", () => {
      const cues = [
        makeCue({ id: "t1", type: "pyro", time: 0 }),
        makeCue({ id: "t2", type: "pyro", time: 0.05 }), // 50ms < 100ms min
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const spacingIssue = report.issues.find((i) => i.message.includes("Cue spacing"));
      expect(spacingIssue).toBeDefined();
      expect(spacingIssue!.severity).toBe("warning");
    });

    it("does not flag different-type cues for timing", () => {
      const cues = [
        makeCue({ id: "u1", type: "pyro", time: 0 }),
        makeCue({ id: "u2", type: "drone", time: 0.05 }), // different type
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const spacingIssues = report.issues.filter((i) => i.message.includes("Cue spacing"));
      expect(spacingIssues).toHaveLength(0);
    });
  });

  describe("validate() — multiple issues", () => {
    it("can have both warnings and criticals", () => {
      const cues = [
        makeCue({ id: "m1", time: 0, x: 600, y: 0, z: 50 }), // geofence breach (critical)
        makeCue({ id: "m2", time: 0, x: 601, y: 0, z: 55 }), // geofence + proximity (warning)
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      expect(report.criticals).toBeGreaterThan(0);
      // passed is false when there are criticals
      expect(report.passed).toBe(false);
    });

    it("issues have cueId set", () => {
      const cues = [makeCue({ id: "x1", z: 500 })];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      expect(report.issues[0].cueId).toBe("x1");
    });
  });

  describe("validate() — passed flag", () => {
    it("passes when there are only warnings (no criticals)", () => {
      const cues = [
        makeCue({ id: "w1", type: "pyro", time: 0 }),
        makeCue({ id: "w2", type: "pyro", time: 0.05 }), // warning only
      ];
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      expect(report.warnings).toBeGreaterThan(0);
      expect(report.criticals).toBe(0);
      expect(report.passed).toBe(true);
    });
  });

  describe("setConfig()", () => {
    it("updates configuration for next validation", () => {
      simulationValidator.setConfig({ maxAltitude: 100 });
      const cues = [makeCue({ id: "v1", z: 150 })]; // 150m > 100m new limit
      const report = simulationValidator.validate(cues, DEFAULT_SHOW_DURATION);
      const altIssue = report.issues.find((i) => i.message.includes("Altitude"));
      expect(altIssue).toBeDefined();
    });
  });

  describe("getConfig()", () => {
    it("returns current config", () => {
      const cfg = simulationValidator.getConfig();
      expect(cfg).toHaveProperty("minCueSpacing");
      expect(cfg).toHaveProperty("collisionRadius");
      expect(cfg).toHaveProperty("geofenceRadius");
      expect(cfg).toHaveProperty("maxAltitude");
    });

    it("reflects updated config", () => {
      simulationValidator.setConfig({ collisionRadius: 5 });
      expect(simulationValidator.getConfig().collisionRadius).toBe(5);
    });
  });

  describe("performance", () => {
    it("includes duration_ms in report", () => {
      const report = simulationValidator.validate([], DEFAULT_SHOW_DURATION);
      expect(typeof report.duration_ms).toBe("number");
      expect(report.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });
});
