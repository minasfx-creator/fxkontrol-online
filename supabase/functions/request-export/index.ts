// deno-lint-ignore-file no-explicit-any
import { corsHeaders } from "../_shared/cors.ts";
import { jsonError, jsonOk } from "../_shared/response.ts";
import { requireAuth } from "../_shared/auth.ts";
import { requireFeature } from "../_shared/requireFeature.ts";

type ExportKind = "fir" | "mavlink" | "skyc" | "vviz" | "csv" | "blackbox";
const VALID: ReadonlySet<ExportKind> = new Set([
  "fir", "mavlink", "skyc", "vviz", "csv", "blackbox",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  const { client, userId } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const kind = String(body?.kind ?? "").toLowerCase() as ExportKind;
  if (!VALID.has(kind)) {
    return jsonError(`Invalid export kind. Allowed: ${[...VALID].join(", ")}`, 400);
  }

  // Server-side entitlement check (defense in depth — RLS also enforces)
  const denied = await requireFeature(client, userId, `${kind}_export`);
  if (denied) return denied;

  // Insert the job. RLS will reject if entitlement was lost between check and insert.
  const { data: job, error } = await client
    .from("export_jobs")
    .insert({ user_id: userId, kind, status: "ready", bytes: body?.bytes ?? null })
    .select()
    .single();

  if (error) {
    return jsonError(`Could not create export job: ${error.message}`, 403);
  }

  // Audit (best-effort)
  try {
    await client.from("plg_events").insert({
      user_id: userId,
      event_type: "export.requested",
      feature: `${kind}_export`,
    });
  } catch (_) { /* noop */ }

  return jsonOk({ ok: true, job });
});
