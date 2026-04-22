import { describe, it, expect, beforeEach } from "vitest";
import { emergency } from "./emergencySystem";

describe("EmergencySystem", () => {
  beforeEach(() => {
    emergency.reset();
  });

  describe("initial state", () => {
    it("is not active on creation", () => {
      expect(emergency.isActive()).toBe(false);
      expect(emergency.getLevel()).toBe(0);
    });

    it("has empty history", () => {
      expect(emergency.getHistory()).toHaveLength(0);
    });
  });

  describe("softStop() — Level 1", () => {
    it("sets level to 1", () => {
      emergency.softStop("test pause");
      expect(emergency.getLevel()).toBe(1);
    });

    it("marks emergency as active", () => {
      emergency.softStop("pause");
      expect(emergency.isActive()).toBe(true);
    });

    it("stores reason", () => {
      emergency.softStop("wind gust");
      expect(emergency.getState().reason).toBe("wind gust");
    });

    it("records in history", () => {
      emergency.softStop("pause");
      expect(emergency.getHistory()).toHaveLength(1);
    });
  });

  describe("hardStop() — Level 2", () => {
    it("sets level to 2", () => {
      emergency.hardStop("lost link");
      expect(emergency.getLevel()).toBe(2);
    });

    it("escalates from level 1", () => {
      emergency.softStop("first");
      emergency.hardStop("worse");
      expect(emergency.getLevel()).toBe(2);
    });
  });

  describe("killSwitch() — Level 3", () => {
    it("sets level to 3", () => {
      emergency.killSwitch("all lost");
      expect(emergency.getLevel()).toBe(3);
    });

    it("escalates from level 2", () => {
      emergency.hardStop("hard");
      emergency.killSwitch("kill");
      expect(emergency.getLevel()).toBe(3);
    });
  });

  describe("clear()", () => {
    it("clears level 1 without acknowledgment", () => {
      emergency.softStop("pause");
      const result = emergency.clear();
      expect(result).toBe(true);
      expect(emergency.isActive()).toBe(false);
    });

    it("fails to clear level 2 without acknowledgment", () => {
      emergency.hardStop("link lost");
      const result = emergency.clear();
      expect(result).toBe(false);
      expect(emergency.getLevel()).toBe(2);
    });

    it("clears level 2 after acknowledgment", () => {
      emergency.hardStop("link lost");
      emergency.acknowledge();
      const result = emergency.clear();
      expect(result).toBe(true);
      expect(emergency.isActive()).toBe(false);
    });

    it("clears level 3 after acknowledgment", () => {
      emergency.killSwitch("all fail");
      emergency.acknowledge();
      const result = emergency.clear();
      expect(result).toBe(true);
      expect(emergency.isActive()).toBe(false);
    });

    it("notifies handlers with level 0 on clear", () => {
      const levels: number[] = [];
      emergency.onEmergency((level) => levels.push(level));
      emergency.softStop("test");
      emergency.clear();
      expect(levels).toContain(0);
    });
  });

  describe("acknowledge()", () => {
    it("sets acknowledged flag", () => {
      emergency.hardStop("err");
      emergency.acknowledge();
      expect(emergency.getState().acknowledged).toBe(true);
    });
  });

  describe("checkHealth()", () => {
    it("does not trigger when metrics are nominal", () => {
      emergency.checkHealth({
        latencyMs: 10,
        fps: 60,
        positionErrorM: 1,
        lostDrones: 0,
        linkAlive: true,
        linkDownMs: 0,
      });
      expect(emergency.isActive()).toBe(false);
    });

    it("triggers Level 1 on low FPS", () => {
      emergency.checkHealth({
        latencyMs: 10,
        fps: 5,
        positionErrorM: 0,
        lostDrones: 0,
        linkAlive: true,
        linkDownMs: 0,
      });
      expect(emergency.getLevel()).toBe(1);
      expect(emergency.getState().autoTriggered).toBe(true);
    });

    it("triggers Level 1 on high position error", () => {
      emergency.checkHealth({
        latencyMs: 10,
        fps: 60,
        positionErrorM: 100,
        lostDrones: 0,
        linkAlive: true,
        linkDownMs: 0,
      });
      expect(emergency.getLevel()).toBe(1);
    });

    it("triggers Level 2 when enough drones are lost", () => {
      emergency.checkHealth({
        latencyMs: 10,
        fps: 60,
        positionErrorM: 0,
        lostDrones: 5,
        linkAlive: true,
        linkDownMs: 0,
      });
      expect(emergency.getLevel()).toBe(2);
    });

    it("triggers Level 2 on link timeout", () => {
      emergency.checkHealth({
        latencyMs: 10,
        fps: 60,
        positionErrorM: 0,
        lostDrones: 0,
        linkAlive: false,
        linkDownMs: 6000,
      });
      expect(emergency.getLevel()).toBe(2);
    });

    it("does not de-escalate once at Level 3", () => {
      emergency.killSwitch("kill");
      emergency.checkHealth({
        latencyMs: 10,
        fps: 5,
        positionErrorM: 100,
        lostDrones: 10,
        linkAlive: false,
        linkDownMs: 10000,
      });
      expect(emergency.getLevel()).toBe(3);
    });
  });

  describe("onEmergency()", () => {
    it("calls handler when emergency is triggered", () => {
      const calls: [number, string][] = [];
      emergency.onEmergency((level, reason) => calls.push([level, reason]));
      emergency.softStop("test");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([1, "test"]);
    });

    it("returns unsubscribe function", () => {
      let callCount = 0;
      const unsub = emergency.onEmergency(() => callCount++);
      emergency.softStop("first");
      unsub();
      emergency.reset();
      emergency.softStop("second");
      expect(callCount).toBe(1);
    });

    it("does not crash if handler throws", () => {
      emergency.onEmergency(() => { throw new Error("handler error"); });
      expect(() => emergency.softStop("test")).not.toThrow();
    });
  });

  describe("setThresholds()", () => {
    it("updates thresholds", () => {
      // Lower lost drones threshold to 1
      emergency.setThresholds({ maxLostDrones: 1 });
      emergency.checkHealth({
        latencyMs: 10,
        fps: 60,
        positionErrorM: 0,
        lostDrones: 1,
        linkAlive: true,
        linkDownMs: 0,
      });
      expect(emergency.getLevel()).toBe(2);
    });
  });

  describe("history", () => {
    it("accumulates events", () => {
      emergency.softStop("reason1");
      emergency.reset();
      emergency.hardStop("reason2");
      expect(emergency.getHistory()).toHaveLength(1);
    });
  });
});
