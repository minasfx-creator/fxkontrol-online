/**
 * Smoke test — DMX / Pyro Fire panel
 *
 * Guards against the TDZ regression in `src/lib/bridgePhysicalControl.ts`
 * where `BridgePhysicalController` referenced `HilBridgeHarness` in a field
 * initializer before its class declaration, throwing:
 *   "ReferenceError: Cannot access 'HilBridgeHarness' before initialization"
 *
 * The test mounts the actual `PyroFireOnePanel` (the component used by the
 * Live Firing `pyro_fire` mode) and asserts:
 *   1. The module import does not throw at evaluation time (TDZ check).
 *   2. The component renders to the DOM without a runtime TypeError.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// jsdom does not implement these — stub before importing the panel.
beforeEach(() => {
  cleanup();
  if (!("ResizeObserver" in window)) {
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
  }
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

describe("PyroFireOnePanel — smoke", () => {
  it("evaluates bridgePhysicalControl without TDZ ReferenceError", async () => {
    // Importing the module is the canonical TDZ trigger: the singleton
    // `bridgePhysicalController` is constructed at module-eval time.
    await expect(import("@/lib/bridgePhysicalControl")).resolves.toBeDefined();
  });

  it("mounts the Pyro Fire panel without throwing", async () => {
    const { default: PyroFireOnePanel } = await import(
      "@/components/editor/live-firing/PyroFireOnePanel"
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      const { container } = render(
        <MemoryRouter>
          <PyroFireOnePanel
            fs={false}
            fireChannel={() => {}}
            channels={[]}
            pyroArm={false}
            dmxArm={false}
            handlePanic={() => {}}
            artNetConnected={false}
            relayConnected={false}
          />
        </MemoryRouter>,
      );
      // Sanity: something rendered.
      expect(container.firstChild).not.toBeNull();
    }).not.toThrow();

    // No React-logged TypeError / ReferenceError swallowed by error boundaries.
    const offendingCalls = errorSpy.mock.calls.filter((args) =>
      args.some(
        (a) =>
          typeof a === "string" &&
          (a.includes("TypeError") || a.includes("ReferenceError")),
      ),
    );
    expect(offendingCalls).toEqual([]);
    errorSpy.mockRestore();
  });
});
