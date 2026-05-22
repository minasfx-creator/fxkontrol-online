import { handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";
import { requireAuth } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return jsonError("GOOGLE_MAPS_API_KEY not configured");

  return jsonOk({ key });
});
