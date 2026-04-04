import { handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return jsonError("GOOGLE_MAPS_API_KEY not configured");

  try {
    const { lat, lng, zoom = 18, size = "640x640" } = await req.json();
    if (typeof lat !== "number" || typeof lng !== "number") {
      return jsonError("lat and lng required", 400);
    }

    const url = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&maptype=satellite&key=${key}`;
    const res = await fetch(url);

    if (!res.ok) return jsonError(`Google API error: ${res.status}`, 502);

    const imageBuffer = await res.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    return jsonOk({ image: `data:image/png;base64,${base64}` });
  } catch (err) {
    return jsonError(err.message);
  }
});
