import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { jsonOk, jsonError } from "../_shared/response.ts";

serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  const key = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!key) return jsonError("GOOGLE_MAPS_API_KEY not configured");

  try {
    const { action, lat, lng, timestamp } = await req.json();

    if (!action || lat == null || lng == null) {
      return jsonError("Missing required fields: action, lat, lng", 400);
    }

    const results: Record<string, unknown> = {};

    // Reverse Geocoding
    if (action === "all" || action === "geocode") {
      try {
        const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=pt-BR`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        if (geoData.status === "OK" && geoData.results?.length > 0) {
          results.locationName = geoData.results[0].formatted_address;
          const short = geoData.results.find((r: any) =>
            r.types?.some((t: string) => ["sublocality", "locality", "neighborhood", "point_of_interest"].includes(t))
          );
          if (short) results.locationShortName = short.formatted_address;
        } else {
          results.locationName = null;
          results.geocodeError = geoData.status;
        }
      } catch (e) {
        results.locationName = null;
        results.geocodeError = String(e);
      }
    }

    // Time Zone
    if (action === "all" || action === "timezone") {
      try {
        const ts = timestamp || Math.floor(Date.now() / 1000);
        const tzUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${ts}&key=${key}`;
        const tzRes = await fetch(tzUrl);
        const tzData = await tzRes.json();
        if (tzData.status === "OK") {
          results.timeZoneId = tzData.timeZoneId;
          results.timeZoneName = tzData.timeZoneName;
          results.rawOffset = tzData.rawOffset;
          results.dstOffset = tzData.dstOffset;
          results.totalOffset = tzData.rawOffset + tzData.dstOffset;
        } else {
          results.timeZoneError = tzData.status;
        }
      } catch (e) {
        results.timeZoneError = String(e);
      }
    }

    // Elevation
    if (action === "all" || action === "elevation") {
      try {
        const elUrl = `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${key}`;
        const elRes = await fetch(elUrl);
        const elData = await elRes.json();
        if (elData.status === "OK" && elData.results?.length > 0) {
          results.elevation = elData.results[0].elevation;
          results.resolution = elData.results[0].resolution;
        } else {
          results.elevationError = elData.status;
        }
      } catch (e) {
        results.elevationError = String(e);
      }
    }

    // Static Map URL
    if (action === "all" || action === "staticmap") {
      const zoom = 15;
      results.staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=640x400&maptype=satellite&markers=color:red|${lat},${lng}&key=${key}`;
    }

    return jsonOk(results);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : String(e));
  }
});
