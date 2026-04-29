/**
 * xai-key-health — lightweight pre-flight probe for the configured XAI_API_KEY.
 *
 * Why a separate function:
 *   The choreography call costs tokens, takes ~30 s, and returns a 12 MB
 *   body. Operators need a way to ask "is my key valid?" without burning
 *   that round-trip every time they suspect a mis-paste or rotation issue.
 *
 *   This endpoint is GET-only, performs a single zero-token request to
 *   xAI's `/v1/models` (cheapest authenticated endpoint), and returns a
 *   sanitized verdict the UI can show in a toast or the diagnostics panel.
 *
 * Response contract:
 *   { ok: true,  status: 200, valid: true,  masked: "xai-…abcd", reason: null }
 *   { ok: true,  status: 200, valid: false, masked: "cu-…wxyz", reason: "key_format_invalid", hint: "…" }
 *   { ok: true,  status: 200, valid: false, masked: "xai-…abcd", reason: "auth", upstreamStatus: 401, hint: "…" }
 *   { ok: false, status: 500, error: "XAI_API_KEY is not configured" }
 *
 * The function NEVER echoes the key in plaintext — only the prefix and last
 * four chars, joined by `…`, suitable to display in an admin toast.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const XAI_MODELS_URL = "https://api.x.ai/v1/models";

function maskKey(raw: string): string {
  const k = raw.trim();
  if (k.length === 0) return "(empty)";
  if (k.length <= 8) return `${k.slice(0, 2)}…`;
  // Keep prefix up to first dash + 1 char so vendor (xai-, sk-, cu-) is visible.
  const dash = k.indexOf("-");
  const prefixLen = dash >= 0 ? Math.min(dash + 2, 6) : 4;
  return `${k.slice(0, prefixLen)}…${k.slice(-4)}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return json({ ok: false, error: "Method not allowed. Use GET." }, 405);
  }

  const raw = Deno.env.get("XAI_API_KEY");
  if (!raw) {
    return json({ ok: false, error: "XAI_API_KEY is not configured" }, 500);
  }

  const masked = maskKey(raw);
  const trimmed = raw.trim();

  // 1. Cheap format check. xAI keys begin with `xai-` followed by an opaque
  //    base64-ish string; everything else (Cursor `cu-`, OpenAI `sk-`, blank
  //    line, accidental quotes) is rejected before the network call.
  const looksLikeXai = /^xai-[A-Za-z0-9_-]{20,}$/.test(trimmed);
  if (!looksLikeXai) {
    return json({
      ok: true,
      valid: false,
      masked,
      reason: "key_format_invalid",
      hint:
        'xAI keys start with "xai-". Copy a fresh key from ' +
        "https://console.x.ai/team/default/api-keys and update the secret " +
        "in Lovable Cloud → Backend → Secrets.",
    });
  }

  // 2. Live probe against xAI. 5 s timeout so a stalled upstream can't wedge
  //    the diagnostics UI.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(XAI_MODELS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${trimmed}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (resp.ok) {
      // Drain body so Deno doesn't leak the connection.
      await resp.text();
      return json({
        ok: true,
        valid: true,
        masked,
        upstreamStatus: resp.status,
        reason: null,
      });
    }

    const bodyText = await resp.text();
    const isAuth =
      resp.status === 401 ||
      resp.status === 403 ||
      /incorrect api key|invalid api key|api key.*invalid|unauthorized|authentication/i.test(bodyText);

    return json({
      ok: true,
      valid: false,
      masked,
      upstreamStatus: resp.status,
      reason: isAuth ? "auth" :
        resp.status === 429 ? "rate_limit" :
        resp.status === 402 ? "credits" : "upstream_error",
      hint: isAuth
        ? "xAI rejected the key. Verify it's active at https://console.x.ai/team/default/api-keys and that the workspace has credits."
        : resp.status === 429
        ? "Rate limited by xAI. Wait a moment and try again."
        : resp.status === 402
        ? "xAI workspace is out of credits. Top up at https://console.x.ai/."
        : `Upstream returned ${resp.status}. Body: ${bodyText.slice(0, 200)}`,
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    const aborted = err instanceof Error && err.name === "AbortError";
    return json({
      ok: true,
      valid: false,
      masked,
      reason: aborted ? "timeout" : "network_error",
      hint: aborted
        ? "xAI did not respond within 5s. Check status.x.ai for incidents."
        : `Network error reaching xAI: ${msg}`,
    });
  }
});
