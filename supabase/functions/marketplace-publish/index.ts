/**
 * marketplace-publish
 *
 * Authenticated publishers POST a signed effect package; this function:
 *   1. Validates the manifest + signature payload.
 *   2. Verifies the detached signature against a trusted signing key
 *      (`public.marketplace_signing_keys`).
 *   3. Uploads the artifact to the `marketplace-packages` bucket using the
 *      service role (publisher does NOT need direct storage access).
 *   4. Inserts the version row; the `bump_effect_package_latest` trigger
 *      promotes `latest_version` if appropriate.
 *
 * Auth: requires a valid Supabase JWT. Authorization: only users that own a
 * row in `marketplace_signing_keys` matching `signature.keyId` may publish
 * with that key (publisher == auth.uid()::text OR explicit allowlist).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

type SignatureAlgorithm = "Ed25519" | "ECDSA-P256";

type PublishRequest = {
  manifest: {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    tags: string[];
    type: "field" | "formation" | "composite";
    entry: string;
    preview?: string;
    engine: { minVersion: string; maxVersion?: string };
  };
  artifactBase64: string; // raw module bytes, base64
  signature: {
    keyId: string;
    algorithm: SignatureAlgorithm;
    signatureB64: string;
  };
  changelog?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "marketplace-packages";
const MAX_BYTES = 5 * 1024 * 1024;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function buildSignedPayload(
  manifest: PublishRequest["manifest"],
  integrity: { algorithm: "SHA-256"; hash: string; size: number },
): Uint8Array {
  const canonical = JSON.stringify({
    manifest: {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      author: manifest.author,
      description: manifest.description,
      tags: [...manifest.tags].sort(),
      type: manifest.type,
      entry: manifest.entry,
      preview: manifest.preview,
      engine: { minVersion: manifest.engine.minVersion },
    },
    integrity,
  });
  return new TextEncoder().encode(canonical);
}

function validate(req: PublishRequest): string | null {
  if (!req?.manifest || !req.artifactBase64 || !req.signature) return "Missing required fields.";
  const m = req.manifest;
  if (!/^[a-z][a-z0-9.-]{2,63}$/.test(m.id)) return "Invalid manifest.id.";
  if (!SEMVER_RE.test(m.version)) return "Invalid manifest.version.";
  if (!SEMVER_RE.test(m.engine?.minVersion ?? "")) return "Invalid engine.minVersion.";
  if (!["field", "formation", "composite"].includes(m.type)) return "Invalid manifest.type.";
  if (!Array.isArray(m.tags)) return "manifest.tags must be array.";
  if (!req.signature.keyId || !req.signature.signatureB64) return "Invalid signature payload.";
  if (!["Ed25519", "ECDSA-P256"].includes(req.signature.algorithm)) return "Unsupported algorithm.";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  // --- Auth: verify JWT manually (this function deploys with verify_jwt = false) ---
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "Invalid token" }, 401);
  }
  const userId = userData.user.id;

  let body: PublishRequest;
  try {
    body = (await req.json()) as PublishRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }
  const invalid = validate(body);
  if (invalid) return jsonResponse({ error: invalid }, 400);

  const artifact = base64ToBytes(body.artifactBase64);
  if (artifact.byteLength === 0 || artifact.byteLength > MAX_BYTES) {
    return jsonResponse({ error: `Artifact size out of range (1..${MAX_BYTES} bytes).` }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // --- Authorization: signing key must exist, be active, and belong to the caller ---
  const { data: keyRow, error: keyErr } = await admin
    .from("marketplace_signing_keys")
    .select("*")
    .eq("key_id", body.signature.keyId)
    .maybeSingle();
  if (keyErr) return jsonResponse({ error: `Key lookup failed: ${keyErr.message}` }, 500);
  if (!keyRow || !keyRow.active || keyRow.revoked_at) {
    return jsonResponse({ error: "Signing key not found or inactive." }, 403);
  }
  if (keyRow.publisher !== userId) {
    return jsonResponse({ error: "Signing key not owned by this user." }, 403);
  }
  if (keyRow.algorithm !== body.signature.algorithm) {
    return jsonResponse({ error: "Algorithm mismatch with registered key." }, 400);
  }

  // --- Verify signature ---
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", artifact));
  const sha256B64 = bytesToBase64(digest);
  const integrity = { algorithm: "SHA-256" as const, hash: sha256B64, size: artifact.byteLength };
  const payload = buildSignedPayload(body.manifest, integrity);
  const sigBytes = base64ToBytes(body.signature.signatureB64);

  let publicKey: CryptoKey;
  let verifyParams: AlgorithmIdentifier | EcdsaParams;
  try {
    if (body.signature.algorithm === "Ed25519") {
      publicKey = await crypto.subtle.importKey("jwk", keyRow.public_key_jwk, { name: "Ed25519" }, false, ["verify"]);
      verifyParams = { name: "Ed25519" };
    } else {
      publicKey = await crypto.subtle.importKey(
        "jwk",
        keyRow.public_key_jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );
      verifyParams = { name: "ECDSA", hash: "SHA-256" };
    }
  } catch (err) {
    return jsonResponse({ error: `Key import failed: ${(err as Error).message}` }, 400);
  }
  const ok = await crypto.subtle.verify(verifyParams, publicKey, sigBytes, payload);
  if (!ok) return jsonResponse({ error: "Signature verification failed." }, 400);

  // --- Upsert package row (idempotent by package_id) ---
  const m = body.manifest;
  const { error: pkgErr } = await admin.from("effect_packages").upsert(
    {
      package_id: m.id,
      name: m.name,
      author: m.author,
      description: m.description,
      category: m.type,
      tags: m.tags,
    },
    { onConflict: "package_id" },
  );
  if (pkgErr) return jsonResponse({ error: `Package upsert failed: ${pkgErr.message}` }, 500);

  // --- Reject duplicate version ---
  const { data: existing } = await admin
    .from("effect_package_versions")
    .select("id")
    .eq("package_id", m.id)
    .eq("version", m.version)
    .maybeSingle();
  if (existing) return jsonResponse({ error: "Version already published." }, 409);

  // --- Upload artifact to storage ---
  const objectPath = `${m.id}/${m.version}/${m.id}-${m.version}.js`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(objectPath, artifact, {
    contentType: "application/javascript",
    upsert: false,
  });
  if (upErr) return jsonResponse({ error: `Upload failed: ${upErr.message}` }, 500);
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  const artifactUrl = pub.publicUrl;

  // --- Insert version row (trigger bumps latest_version) ---
  const { data: versionRow, error: verErr } = await admin
    .from("effect_package_versions")
    .insert({
      package_id: m.id,
      version: m.version,
      engine_min: m.engine.minVersion,
      engine_max: m.engine.maxVersion ?? null,
      artifact_url: artifactUrl,
      sha256: sha256B64,
      size_bytes: artifact.byteLength,
      signature_key_id: body.signature.keyId,
      signature_algorithm: body.signature.algorithm,
      signature_b64: body.signature.signatureB64,
      manifest: m,
      changelog: body.changelog ?? null,
    })
    .select()
    .single();
  if (verErr) {
    // Best-effort cleanup of orphaned object.
    await admin.storage.from(BUCKET).remove([objectPath]);
    return jsonResponse({ error: `Version insert failed: ${verErr.message}` }, 500);
  }

  return jsonResponse(
    {
      ok: true,
      packageId: m.id,
      version: m.version,
      artifactUrl,
      sha256: sha256B64,
      sizeBytes: artifact.byteLength,
      versionId: versionRow.id,
    },
    201,
  );
});
