/**
 * Shared CORS headers for all FXK Edge Functions.
 * Single source of truth — never duplicate in individual functions.
 */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-requested-with",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

/**
 * Handle CORS preflight. Call at the top of every serve handler:
 *
 *   const preflight = handleCors(req);
 *   if (preflight) return preflight;
 *
 * Returns 200 (not 204) — some browsers/proxies reject 204 on OPTIONS for
 * streamed endpoints, which was the root cause of fxk-ai-chat preflight failures.
 */
export function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  return null;
}
