import { describe, it, expect, beforeEach } from "vitest";
import { BlackBoxRecorder } from "./blackBoxRecorder";

// Create a fresh instance per test suite to avoid shared state
function makeRecorder() {
  // BlackBoxRecorder is only exported as a singleton (`blackbox`), so we
  // reach the class through its module structure. Since the source exports
  // the class implicitly via the singleton, we test the singleton API by
  // importing it and working with a fresh one each test via reset().
  const { blackbox } = require("./blackBoxRecorder");
  return blackbox as InstanceType<typeof import("./blackBoxRecorder").BlackBoxRecorder>;
}

import { blackbox } from "./blackBoxRecorder";

describe("BlackBoxRecorder", () => {
  beforeEach(() => {
    blackbox.reset();
  });

  describe("initial state", () => {
    it("is not recording after construction/reset", () => {
      expect(blackbox.isRecording()).toBe(false);
    });

    it("has zero entries after reset", () => {
      expect(blackbox.getEntryCount()).toBe(0);
    });
  });

  describe("start / stop", () => {
    it("starts recording", () => {
      blackbox.start();
      expect(blackbox.isRecording()).toBe(true);
    });

    it("records a 'recording started' entry on start", () => {
      blackbox.start();
      const entries = blackbox.export();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].msg).toBe("BlackBox recording started");
    });

    it("stops recording", () => {
      blackbox.start();
      blackbox.stop();
      expect(blackbox.isRecording()).toBe(false);
    });

    it("records a 'recording stopped' entry on stop", () => {
      blackbox.start();
      blackbox.stop();
      const entries = blackbox.export();
      expect(entries.some((e) => e.msg === "BlackBox recording stopped")).toBe(true);
    });
  });

  describe("record()", () => {
    it("silently ignores entries when not recording", () => {
      blackbox.record("cmd", "test message");
      expect(blackbox.getEntryCount()).toBe(0);
    });

    it("records an entry when recording", () => {
      blackbox.start();
      blackbox.record("cmd", "fire cue 1", { cueId: "c1" });
      const entries = blackbox.export();
      const cmd = entries.find((e) => e.msg === "fire cue 1");
      expect(cmd).toBeDefined();
      expect(cmd!.cat).toBe("cmd");
      expect(cmd!.data).toEqual({ cueId: "c1" });
    });

    it("increments entry count", () => {
      blackbox.start();
      const initial = blackbox.getEntryCount();
      blackbox.record("err", "error 1");
      blackbox.record("err", "error 2");
      expect(blackbox.getEntryCount()).toBe(initial + 2);
    });

    it("records all category types", () => {
      blackbox.start();
      const cats = ["cmd", "err", "state", "fire", "drone", "net", "emergency"] as const;
      for (const cat of cats) {
        blackbox.record(cat, `test ${cat}`);
      }
      const entries = blackbox.export();
      for (const cat of cats) {
        expect(entries.some((e) => e.cat === cat)).toBe(true);
      }
    });

    it("records entries with non-negative timestamps", () => {
      blackbox.start();
      blackbox.record("state", "check time");
      const entries = blackbox.export();
      for (const e of entries) {
        expect(e.t).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("export()", () => {
    it("returns empty array when no entries", () => {
      expect(blackbox.export()).toEqual([]);
    });

    it("returns entries in chronological order", () => {
      blackbox.start();
      blackbox.record("cmd", "first");
      blackbox.record("cmd", "second");
      blackbox.record("cmd", "third");
      const entries = blackbox.export();
      const msgs = entries.map((e) => e.msg);
      const firstIdx = msgs.indexOf("first");
      const secondIdx = msgs.indexOf("second");
      const thirdIdx = msgs.indexOf("third");
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it("returns copies (not references to internal entries)", () => {
      blackbox.start();
      blackbox.record("state", "original", { key: "value" });
      const entries = blackbox.export();
      const entry = entries.find((e) => e.msg === "original")!;
      entry.msg = "mutated";
      // Re-export should still have original
      const entries2 = blackbox.export();
      expect(entries2.find((e) => e.msg === "original")).toBeDefined();
    });
  });

  describe("exportBlob()", () => {
    it("returns a Blob of type application/json", () => {
      blackbox.start();
      blackbox.record("state", "blob test");
      const blob = blackbox.exportBlob();
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/json");
    });
  });

  describe("reset()", () => {
    it("clears all entries", () => {
      blackbox.start();
      blackbox.record("cmd", "test");
      blackbox.reset();
      expect(blackbox.getEntryCount()).toBe(0);
    });

    it("stops recording", () => {
      blackbox.start();
      blackbox.reset();
      expect(blackbox.isRecording()).toBe(false);
    });
  });
});
