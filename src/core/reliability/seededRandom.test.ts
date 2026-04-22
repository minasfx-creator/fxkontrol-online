import { describe, it, expect, beforeEach } from "vitest";
import { SeededRandom, simRNG } from "./seededRandom";

describe("SeededRandom", () => {
  describe("determinism", () => {
    it("produces the same sequence for the same seed", () => {
      const a = new SeededRandom(42);
      const b = new SeededRandom(42);
      for (let i = 0; i < 20; i++) {
        expect(a.next()).toBe(b.next());
      }
    });

    it("produces different sequences for different seeds", () => {
      const a = new SeededRandom(1);
      const b = new SeededRandom(2);
      const aVals = Array.from({ length: 10 }, () => a.next());
      const bVals = Array.from({ length: 10 }, () => b.next());
      expect(aVals).not.toEqual(bVals);
    });
  });

  describe("next()", () => {
    it("returns values in [0, 1)", () => {
      const rng = new SeededRandom(99);
      for (let i = 0; i < 1000; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe("range()", () => {
    it("returns values within [min, max)", () => {
      const rng = new SeededRandom(7);
      for (let i = 0; i < 500; i++) {
        const v = rng.range(5, 10);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThan(10);
      }
    });

    it("handles negative ranges", () => {
      const rng = new SeededRandom(13);
      for (let i = 0; i < 100; i++) {
        const v = rng.range(-10, -5);
        expect(v).toBeGreaterThanOrEqual(-10);
        expect(v).toBeLessThan(-5);
      }
    });
  });

  describe("int()", () => {
    it("returns integers in [min, max] inclusive", () => {
      const rng = new SeededRandom(3);
      const results = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const v = rng.int(1, 6);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
        results.add(v);
      }
      // All values 1-6 should appear
      for (let i = 1; i <= 6; i++) {
        expect(results.has(i)).toBe(true);
      }
    });
  });

  describe("pick()", () => {
    it("always returns an element from the array", () => {
      const rng = new SeededRandom(55);
      const arr = ["a", "b", "c", "d"] as const;
      for (let i = 0; i < 100; i++) {
        expect(arr).toContain(rng.pick(arr));
      }
    });

    it("is deterministic", () => {
      const arr = [10, 20, 30, 40] as const;
      const a = new SeededRandom(100);
      const b = new SeededRandom(100);
      for (let i = 0; i < 20; i++) {
        expect(a.pick(arr)).toBe(b.pick(arr));
      }
    });
  });

  describe("fork()", () => {
    it("returns a new SeededRandom instance", () => {
      const rng = new SeededRandom(42);
      const child = rng.fork();
      expect(child).toBeInstanceOf(SeededRandom);
    });

    it("child diverges from parent", () => {
      const rng = new SeededRandom(42);
      const child = rng.fork();
      // Advance both several times — they should diverge
      const parentVals = Array.from({ length: 5 }, () => rng.next());
      const childVals = Array.from({ length: 5 }, () => child.next());
      expect(parentVals).not.toEqual(childVals);
    });

    it("forked child is deterministic given same parent seed", () => {
      const a = new SeededRandom(77);
      const b = new SeededRandom(77);
      const childA = a.fork();
      const childB = b.fork();
      for (let i = 0; i < 10; i++) {
        expect(childA.next()).toBe(childB.next());
      }
    });
  });

  describe("reset()", () => {
    it("resets state to given seed, reproducing same sequence", () => {
      const rng = new SeededRandom(5);
      const first = Array.from({ length: 5 }, () => rng.next());
      rng.reset(5);
      const second = Array.from({ length: 5 }, () => rng.next());
      expect(first).toEqual(second);
    });

    it("produces a different sequence after reset to different seed", () => {
      const rng = new SeededRandom(5);
      const first = Array.from({ length: 5 }, () => rng.next());
      rng.reset(999);
      const second = Array.from({ length: 5 }, () => rng.next());
      expect(first).not.toEqual(second);
    });
  });

  describe("simRNG (global instance)", () => {
    it("is an instance of SeededRandom", () => {
      expect(simRNG).toBeInstanceOf(SeededRandom);
    });

    it("produces values in [0, 1)", () => {
      const v = simRNG.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });
  });
});
