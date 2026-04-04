import { handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return jsonError("GOOGLE_MAPS_API_KEY not configured");

  return jsonOk({ key });
});
