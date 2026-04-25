/**
 * BUG-06 guardian — get-maps-key MUST refuse anonymous callers. The Google
 * Maps key cannot leak via a misconfigured verify_jwt or a missing Bearer
 * check.
 *
 * Run: deno test --allow-net --allow-env supabase/functions/get-maps-key/auth_test.ts
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "https://kyywqpyhsgdthcqqohyv.supabase.co";
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? "";
const FN_URL = `${SUPABASE_URL}/functions/v1/get-maps-key`;

Deno.test("BUG-06 · GET without Authorization is rejected (401)", async () => {
  const res = await fetch(FN_URL, {
    method: "GET",
    headers: ANON_KEY ? { "apikey": ANON_KEY } : {},
  });
  const body = await res.text();
  assertEquals(res.status, 401, `expected 401, got ${res.status}: ${body}`);
  assert(!body.includes("AIza"), "Google Maps key MUST NOT appear in unauth response");
});

Deno.test("BUG-06 · GET with bogus Bearer token is rejected", async () => {
  const res = await fetch(FN_URL, {
    method: "GET",
    headers: {
      "Authorization": "Bearer not-a-real-jwt",
      ...(ANON_KEY ? { "apikey": ANON_KEY } : {}),
    },
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(!body.includes("AIza"), "key leak on bogus token");
});

Deno.test("BUG-06 · OPTIONS preflight succeeds (CORS not regressed)", async () => {
  const res = await fetch(FN_URL, {
    method: "OPTIONS",
    headers: { "Origin": "https://fxkontrol.online" },
  });
  await res.text();
  assertEquals(res.status, 200);
});
