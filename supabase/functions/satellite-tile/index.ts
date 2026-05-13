import { handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

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
    const base64 = uint8ToBase64(new Uint8Array(imageBuffer));

    return jsonOk({ image: `data:image/png;base64,${base64}` });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : String(err));
  }
});
