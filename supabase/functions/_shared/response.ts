import { corsHeaders } from "./cors.ts";

/**
 * Return a JSON success response with CORS headers.
 */
export function jsonOk<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Return a JSON error response with CORS headers.
 */
export function jsonError(message: string, status = 500, extra?: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ error: message, ...extra }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Return a binary/raw response with CORS headers.
 */
export function rawOk(body: BodyInit, contentType: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": contentType },
  });
}
