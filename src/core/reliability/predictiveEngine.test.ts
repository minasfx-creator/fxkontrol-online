import { describe, it, expect, beforeEach } from "vitest";
import { predictive } from "./predictiveEngine";

describe("PredictiveEngine", () => {
  beforeEach(() => {
    predictive.reset();
  });

  describe("recordLatency()", () => {
    it("updates average latency from RTT samples", () => {
      // Flood with many 100ms RTT samples to dominate the moving average
      for (let i = 0; i < 50; i++) predictive.recordLatency(100);
      const stats = predictive.getStats();
      // avg should converge to ~50ms (one-way from 100ms RTT)
      expect(stats.avgLatencyMs).toBeCloseTo(50, 0);
    });

    it("computes moving average over multiple samples", () => {
      // Fill with 50ms one-way samples then add 100ms one-way samples
      for (let i = 0; i < 50; i++) predictive.recordLatency(100); // 50ms one-way
      for (let i = 0; i < 50; i++) predictive.recordLatency(200); // 100ms one-way
      const stats = predictive.getStats();
      // After replacing all 50 samples with 100ms, avg ≈ 100ms
      expect(stats.avgLatencyMs).toBeCloseTo(100, 0);
    });
  });

  describe("getCompensationMs()", () => {
    it("equals avgLatency + jitter + safetyMargin", () => {
      // Flood with identical samples so jitter ≈ 0
      for (let i = 0; i < 50; i++) predictive.recordLatency(100); // 50ms one-way, 0 jitter
      predictive.setSafetyMargin(20);
      const stats = predictive.getStats();
      // compensation = 50 (avg) + ~0 (jitter) + 20 (safety) ≈ 70
      expect(stats.compensationMs).toBeGreaterThan(60);
      expect(stats.compensationMs).toBeLessThan(80);
    });
  });

  describe("schedule() + tick()", () => {
    it("sends event when sim time reaches sendTime", () => {
      // Default compensation: 50ms avg + 0 jitter + 20 = 70ms = 0.07s
      // So sendTime = targetTime - 0.07
      predictive.recordLatency(100); // 50ms one-way, 0 jitter
      // Set safety margin to 0 for simpler math
      predictive.setSafetyMargin(0);

      const targetTime = 1.0;
      predictive.schedule({
        id: "e1",
        type: "fire",
        targetTime,
        payload: { cue: 1 },
      });

      // tick before sendTime — nothing sent
      const before = predictive.tick(0.0);
      expect(before).toHaveLength(0);

      // tick at or after sendTime
      const sent = predictive.tick(1.0);
      expect(sent.some((e) => e.id === "e1")).toBe(true);
    });

    it("marks sent events as sent", () => {
      predictive.setSafetyMargin(0);
      predictive.schedule({
        id: "e2",
        type: "drone_cmd",
        targetTime: 0.5,
        payload: null,
      });
      predictive.tick(0.5);
      // Second tick should not re-send
      const second = predictive.tick(0.5);
      expect(second.some((e) => e.id === "e2")).toBe(false);
    });

    it("returns no events when none are scheduled", () => {
      expect(predictive.tick(100)).toHaveLength(0);
    });
  });

  describe("confirm()", () => {
    it("marks event as confirmed", () => {
      predictive.setSafetyMargin(0);
      predictive.schedule({
        id: "e3",
        type: "fire",
        targetTime: 0.1,
        payload: null,
      });
      predictive.tick(0.5);
      predictive.confirm("e3");
      const stats = predictive.getStats();
      expect(stats.confirmed).toBeGreaterThanOrEqual(1);
    });

    it("silently ignores confirm for unknown event", () => {
      expect(() => predictive.confirm("nonexistent")).not.toThrow();
    });
  });

  describe("precomputeWindow()", () => {
    it("schedules events within the lookahead window", () => {
      const timeline = [
        { id: "t1", time: 0.1, type: "fire" as const, payload: null },
        { id: "t2", time: 0.15, type: "drone_cmd" as const, payload: null },
        { id: "t3", time: 5.0, type: "effect" as const, payload: null }, // outside window
      ];

      const count = predictive.precomputeWindow(0, timeline);
      expect(count).toBe(2);
      const stats = predictive.getStats();
      expect(stats.pending + stats.sent + stats.confirmed).toBeGreaterThanOrEqual(2);
    });

    it("does not duplicate already-scheduled events", () => {
      const timeline = [
        { id: "dup1", time: 0.1, type: "fire" as const, payload: null },
      ];
      predictive.precomputeWindow(0, timeline);
      predictive.precomputeWindow(0, timeline);
      const stats = predictive.getStats();
      // Only 1 event despite calling twice
      expect(stats.pending).toBe(1);
    });

    it("skips events at or before currentTime", () => {
      const timeline = [
        { id: "past", time: 0, type: "fire" as const, payload: null },
      ];
      const count = predictive.precomputeWindow(0.5, timeline);
      expect(count).toBe(0);
    });
  });

  describe("setLookahead()", () => {
    it("clamps lookahead between 50 and 500 ms", () => {
      predictive.setLookahead(10); // below min
      // schedule event at 0.06s (within 50ms lookahead from 0)
      const timeline = [{ id: "x", time: 0.04, type: "fire" as const, payload: null }];
      const count = predictive.precomputeWindow(0, timeline);
      // After clamping to 50ms, event at 40ms should be in window
      expect(count).toBe(1);
    });
  });

  describe("getStats()", () => {
    it("returns correct initial stats", () => {
      const stats = predictive.getStats();
      expect(stats.pending).toBe(0);
      expect(stats.sent).toBe(0);
      expect(stats.confirmed).toBe(0);
    });
  });
});
