/**
 * Shared CORS headers for all FXK Edge Functions.
 * Single source of truth — never duplicate in individual functions.
 */
/**
 * Runtime-aware CORS helpers for Edge functions.
 *
 * Configure allowed origins using the SUPABASE_ALLOWED_ORIGINS environment
 * variable (comma-separated list). When present, only matching Origins will
 * be accepted and returned in `Access-Control-Allow-Origin`. When absent,
 * behaviour falls back to permissive '*' for backward compatibility.
 */

function parseAllowedOrigins(): string[] {
  const raw = (typeof Deno !== 'undefined' && Deno?.env?.get('SUPABASE_ALLOWED_ORIGINS')) || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function buildCorsHeaders(req?: Request): Record<string, string> {
  const allowed = parseAllowedOrigins();
  const origin = req?.headers.get('origin') ?? '';

  let allowOrigin = '*';
  if (allowed.length > 0) {
    if (origin && allowed.includes(origin)) {
      allowOrigin = origin;
    } else {
      // No allowed origin matched — return a conservative null value so
      // browsers will block the request. The caller may choose to return
      // a 403 for preflight requests when appropriate.
      allowOrigin = 'null';
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight. Returns a Response when the request is OPTIONS and
 * allowed, or a 403 Response when the Origin is not permitted. Returns null
 * when processing should continue.
 */
export function handleCors(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null;
  const headers = buildCorsHeaders(req);
  if (headers['Access-Control-Allow-Origin'] === 'null') {
    return new Response('Forbidden', { status: 403, headers: { 'Content-Type': 'text/plain' } });
  }
  return new Response('ok', { status: 200, headers });
}
