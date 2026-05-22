/**
 * BUG-03 guardian — fxk-ai-chat OPTIONS preflight MUST return 200 with all
 * headers the browser sends. Regression here = JOI silently dies in browser.
 *
 * Run: deno test --allow-net --allow-env supabase/functions/fxk-ai-chat/cors_test.ts
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "https://kyywqpyhsgdthcqqohyv.supabase.co";
const FN_URL = `${SUPABASE_URL}/functions/v1/fxk-ai-chat`;

const REQUIRED_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "x-client-info",
  "x-supabase-client-platform",
  "x-supabase-client-platform-version",
  "x-supabase-client-runtime",
  "x-supabase-client-runtime-version",
];

Deno.test("BUG-03 · OPTIONS preflight returns 200 (not 204)", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://fxkontrol.online",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": REQUIRED_HEADERS.join(", "),
    },
  });
  await res.text();
  assertEquals(res.status, 200, "OPTIONS must be 200 — 204 breaks streaming on some proxies");
});

Deno.test("BUG-03 · Allow-Headers includes every header the supabase-js client sends", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: { "Origin": "https://fxkontrol.online" },
  });
  await res.text();
  const allow = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
  for (const h of REQUIRED_HEADERS) {
    assert(allow.includes(h), `Missing required header in Allow-Headers: ${h}`);
  }
});

Deno.test("BUG-03 · Allow-Origin and Allow-Methods are present", async () => {
  const res = await fetch(FN_URL, { method: "OPTIONS" });
  await res.text();
  assert(res.headers.get("access-control-allow-origin"), "missing allow-origin");
  const methods = (res.headers.get("access-control-allow-methods") ?? "").toUpperCase();
  assert(methods.includes("POST") && methods.includes("OPTIONS"), "POST/OPTIONS required");
});
