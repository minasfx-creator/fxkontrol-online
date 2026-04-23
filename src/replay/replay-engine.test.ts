import { describe, expect, it } from "vitest";
import { replayExecution } from "./replay-engine";
import type { ExecutionPlan, RuntimeTrace } from "./types";

function makePlan(): ExecutionPlan {
  return {
    frames: [
      {
        frameIndex: 10,
        hash: "frame-10-hash",
        riskEnvelope: { avg: 0.2, peak: 0.4, variance: 0.01, spread: 0.2 },
        events: [
          {
            frameIndex: 10,
            executionLayer: "pyro",
            sequenceId: "seq-001",
            t0: 1000,
            adapter: "pyro",
            channel: 1,
            action: "fire",
          },
          {
            frameIndex: 10,
            executionLayer: "dmx",
            sequenceId: "seq-002",
            t0: 1000,
            adapter: "dmx",
            channel: 7,
            action: "set",
          },
        ],
      },
    ],
  };
}

function makeTracePerfect(): RuntimeTrace {
  return {
    frames: [
      {
        frameIndex: 10,
        hash: "frame-10-hash",
        riskEnvelope: { avg: 0.2, peak: 0.4, variance: 0.01, spread: 0.2 },
        events: [
          {
            frameIndex: 10,
            executionLayer: "pyro",
            sequenceId: "seq-001",
            t0: 1000,
            executedAtMs: 1001,
            adapter: "pyro",
            channel: 1,
            action: "fire",
            adapterStatus: "ok",
          },
          {
            frameIndex: 10,
            executionLayer: "dmx",
            sequenceId: "seq-002",
            t0: 1000,
            executedAtMs: 1002,
            adapter: "dmx",
            channel: 7,
            action: "set",
            adapterStatus: "ok",
          },
        ],
      },
    ],
  };
}

describe("replayExecution", () => {
  it("PASS em execução perfeita", () => {
    const report = replayExecution(makePlan(), makeTracePerfect(), { maxDriftMs: 5 });
    expect(report.integrity).toBe("PASS");
    expect(report.divergences).toHaveLength(0);
    expect(report.matchedFrames).toBe(1);
  });

  it("detecta missing_frame", () => {
    const report = replayExecution(makePlan(), { frames: [] });
    expect(report.integrity).toBe("FAIL");
    expect(report.divergences.some((d) => d.type === "missing_frame")).toBe(true);
  });

  it("detecta extra_frame", () => {
    const trace = makeTracePerfect();
    trace.frames.push({ frameIndex: 99, hash: "ghost", events: [] });
    const report = replayExecution(makePlan(), trace);
    expect(report.divergences.some((d) => d.type === "extra_frame")).toBe(true);
  });

  it("detecta hash_mismatch", () => {
    const trace = makeTracePerfect();
    trace.frames[0].hash = "wrong-hash";
    const report = replayExecution(makePlan(), trace);
    expect(report.integrity).toBe("FAIL");
    expect(report.divergences.some((d) => d.type === "hash_mismatch")).toBe(true);
  });

  it("detecta order_mismatch", () => {
    const trace = makeTracePerfect();
    const a = trace.frames[0].events[0];
    trace.frames[0].events[0] = trace.frames[0].events[1];
    trace.frames[0].events[1] = a;
    const report = replayExecution(makePlan(), trace);
    expect(report.integrity).toBe("FAIL");
    expect(report.divergences.some((d) => d.type === "order_mismatch")).toBe(true);
  });

  it("detecta timing_drift", () => {
    const trace = makeTracePerfect();
    trace.frames[0].events[0].executedAtMs = 1015;
    const report = replayExecution(makePlan(), trace, { maxDriftMs: 5 });
    expect(report.divergences.some((d) => d.type === "timing_drift")).toBe(true);
  });

  it("detecta adapter_mismatch", () => {
    const trace = makeTracePerfect();
    trace.frames[0].events[0].adapterStatus = "failed";
    const report = replayExecution(makePlan(), trace);
    expect(report.integrity).toBe("FAIL");
    expect(report.divergences.some((d) => d.type === "adapter_mismatch")).toBe(true);
  });

  it("detecta risk_mismatch como warn", () => {
    const trace = makeTracePerfect();
    trace.frames[0].riskEnvelope!.peak = 0.9;
    const report = replayExecution(makePlan(), trace, { riskTolerance: 0.01 });
    expect(report.divergences.some((d) => d.type === "risk_mismatch")).toBe(true);
    expect(report.integrity).toBe("PASS");
  });

  it("falha com warn quando failOnWarnings=true", () => {
    const trace = makeTracePerfect();
    trace.frames[0].riskEnvelope!.peak = 0.9;
    const report = replayExecution(makePlan(), trace, {
      riskTolerance: 0.01,
      failOnWarnings: true,
    });
    expect(report.integrity).toBe("FAIL");
  });

  it("é determinístico", () => {
    const r1 = replayExecution(makePlan(), makeTracePerfect());
    const r2 = replayExecution(makePlan(), makeTracePerfect());
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
