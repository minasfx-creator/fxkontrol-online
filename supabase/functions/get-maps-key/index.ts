import { handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  // Defense-in-depth: even though `verify_jwt = true` is set in
  // supabase/config.toml, validate the user explicitly so a misconfig
  // never leaks the Google Maps key to anonymous callers.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError("Unauthorized", 401);
  }
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      return jsonError("Unauthorized", 401);
    }
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return jsonError("GOOGLE_MAPS_API_KEY not configured");

  return jsonOk({ key });
});
