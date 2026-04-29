/**
 * Paddle.js client utility — single entry point for the SDK.
 *
 * The client token is shipped to the browser via Vite's import.meta.env. The test
 * token (test_*) lives behind Lovable preview auth; the build-time token swap
 * puts the live token into the production bundle. See `paddle-security`.
 */
import { supabase } from "@/integrations/supabase/client";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

/** True when a Paddle client token is configured. Use this to gate any UI
 *  that opens checkout — calling getPaddleEnvironment() without a token
 *  now THROWS to prevent accidental "live" defaulting. */
export function isPaddleConfigured(): boolean {
  return typeof clientToken === "string" && clientToken.length > 0;
}

/**
 * Single source of truth for the active Paddle environment.
 *
 * WHY: the previous implementation defaulted to "live" when the token was
 * missing or malformed (any prefix other than "test_"). On a misconfigured
 * deploy that meant Paddle.js silently initialised in production mode,
 * which would have charged real cards in test scenarios. We now refuse to
 * guess: callers must check `isPaddleConfigured()` first, or be prepared
 * to catch.
 */
export function getPaddleEnvironment(): "sandbox" | "live" {
  if (!clientToken) {
    throw new Error(
      "[paddle] VITE_PAYMENTS_CLIENT_TOKEN is not set — refusing to default to live. Configure the token before invoking checkout.",
    );
  }
  if (clientToken.startsWith("test_")) return "sandbox";
  if (clientToken.startsWith("live_")) return "live";
  throw new Error(
    "[paddle] VITE_PAYMENTS_CLIENT_TOKEN has an unrecognised prefix — must start with 'test_' or 'live_'.",
  );
}

let paddleInitialized = false;

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");

  return new Promise<void>((resolve, reject) => {
    // Load Paddle.js if not already on the page
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]');
    const onReady = () => {
      const paddleJsEnv = getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(paddleJsEnv);
      window.Paddle.Initialize({ token: clientToken });
      paddleInitialized = true;
      resolve();
    };
    if (existing && window.Paddle) return onReady();
    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Paddle.js")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = onReady;
    script.onerror = () => reject(new Error("Failed to load Paddle.js"));
    document.head.appendChild(script);
  });
}

/** Resolves a human-readable price ID (e.g. "pro_monthly") to a Paddle internal ID. */
export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  const { data, error } = await supabase.functions.invoke("get-paddle-price", {
    body: { priceId, environment },
  });
  if (error || !data?.paddleId) {
    throw new Error(`Failed to resolve price: ${priceId} — ${error?.message ?? "unknown"}`);
  }
  return data.paddleId as string;
}
