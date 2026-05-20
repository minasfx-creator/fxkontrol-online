import type { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError } from "./response.ts";

/**
 * Server-side feature gate. Calls public.user_has_feature(uid, feat).
 * Returns a 402 Response if the user is missing the entitlement.
 * Returns null when access is granted.
 *
 * Use right after requireAuth():
 *
 *   const denied = await requireFeature(client, userId, "fir_export");
 *   if (denied) return denied;
 */
export async function requireFeature(
  client: ReturnType<typeof createClient>,
  userId: string,
  feature: string,
): Promise<Response | null> {
  const { data, error } = await client.rpc("user_has_feature", {
    uid: userId,
    feat: feature,
  });
  if (error) {
    return jsonError(`entitlement check failed: ${error.message}`, 500);
  }
  if (data === true) return null;

  // Best-effort telemetry (ignore failures)
  try {
    await client.from("plg_events").insert({
      user_id: userId,
      event_type: "feature.gated",
      feature,
    });
  } catch (_) { /* noop */ }

  return jsonError(
    `Feature "${feature}" requires a higher plan.`,
    402,
    { code: "PAYMENT_REQUIRED", feature, upgrade_url: "/pricing" },
  );
}
