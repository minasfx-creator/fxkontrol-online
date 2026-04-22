import { describe, it, expect, beforeEach } from "vitest";
import { StateBuffer } from "./stateBuffer";

interface TestState extends Record<string, unknown> {
  frame: number;
  score: number;
  active: boolean;
}

const initialState: TestState = { frame: 0, score: 0, active: false };

describe("StateBuffer", () => {
  let buf: StateBuffer<TestState>;

  beforeEach(() => {
    buf = new StateBuffer<TestState>(initialState);
  });

  describe("construction", () => {
    it("initializes front and back with the same values", () => {
      expect(buf.front.frame).toBe(0);
      expect(buf.back.frame).toBe(0);
    });

    it("front and back are independent copies", () => {
      buf.back.frame = 42;
      expect(buf.front.frame).toBe(0);
    });

    it("starts with 0 swap count", () => {
      expect(buf.getSwapCount()).toBe(0);
    });
  });

  describe("front (read-only render buffer)", () => {
    it("reflects last swapped back state", () => {
      buf.back.frame = 5;
      buf.back.score = 100;
      buf.swap();
      expect(buf.front.frame).toBe(5);
      expect(buf.front.score).toBe(100);
    });
  });

  describe("back (writable simulation buffer)", () => {
    it("can be mutated freely", () => {
      buf.back.frame = 99;
      buf.back.active = true;
      expect(buf.back.frame).toBe(99);
      expect(buf.back.active).toBe(true);
    });
  });

  describe("swap()", () => {
    it("swaps front and back", () => {
      buf.back.frame = 7;
      buf.swap();
      expect(buf.front.frame).toBe(7);
    });

    it("old front becomes new back", () => {
      const originalFrontFrame = buf.front.frame; // 0
      buf.back.frame = 99;
      buf.swap();
      // The new back is the old front (frame = 0)
      expect(buf.back.frame).toBe(originalFrontFrame);
    });

    it("increments swap count each call", () => {
      buf.swap();
      buf.swap();
      buf.swap();
      expect(buf.getSwapCount()).toBe(3);
    });

    it("double swap restores state sequence", () => {
      buf.back.frame = 1;
      buf.swap(); // front=1, back=0
      buf.back.frame = 2;
      buf.swap(); // front=2, back=1
      expect(buf.front.frame).toBe(2);
      expect(buf.back.frame).toBe(1);
    });
  });

  describe("copyFrontToBack()", () => {
    it("copies current front values into back", () => {
      buf.back.frame = 10;
      buf.swap(); // front=10, back=0
      buf.copyFrontToBack(); // back=10
      expect(buf.back.frame).toBe(10);
    });

    it("allows continuing simulation from front state", () => {
      buf.back.frame = 5;
      buf.back.score = 50;
      buf.swap(); // front={5,50}
      buf.copyFrontToBack(); // back={5,50}
      buf.back.frame = 6;
      buf.swap(); // front={6,50}
      expect(buf.front.frame).toBe(6);
      expect(buf.front.score).toBe(50);
    });
  });

  describe("getSwapCount()", () => {
    it("returns 0 initially", () => {
      expect(buf.getSwapCount()).toBe(0);
    });

    it("tracks each swap", () => {
      for (let i = 1; i <= 10; i++) {
        buf.swap();
        expect(buf.getSwapCount()).toBe(i);
      }
    });
  });

  describe("isolation between front and back", () => {
    it("writes to back do not affect front before swap", () => {
      buf.back.frame = 100;
      buf.back.score = 999;
      expect(buf.front.frame).toBe(0);
      expect(buf.front.score).toBe(0);
    });

    it("writes to back after swap do not affect front", () => {
      buf.swap();
      buf.back.frame = 77;
      expect(buf.front.frame).toBe(0);
    });
  });
});
