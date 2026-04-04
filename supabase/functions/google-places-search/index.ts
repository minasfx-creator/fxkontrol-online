import { handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return jsonError("GOOGLE_MAPS_API_KEY not configured");

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return jsonOk({ results: [] });
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: query.trim(),
        maxResultCount: 5,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Google Places API error:", res.status, errText);
      return jsonOk({ results: [], error: `Google API: ${res.status}` });
    }

    const data = await res.json();
    const results = (data.places || []).map((p: any) => ({
      name: p.displayName?.text || "Unknown",
      lat: p.location?.latitude || 0,
      lng: p.location?.longitude || 0,
      formattedAddress: p.formattedAddress || "",
    }));

    return jsonOk({ results });
  } catch (err) {
    console.error("google-places-search error:", err);
    return jsonError(err.message);
  }
});
