/**
 * Supabase-backed registry client for the online marketplace.
 *
 * Read-only on the client (writes go through the `marketplace-publish` edge
 * function with service-role privileges). All queries are RLS-safe: the
 * `effect_packages*` tables grant `SELECT` to any authenticated user.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  OnlinePackageSummary,
  OnlinePackageVersion,
  OnlineSigningKey,
} from "./types";
import { MarketplaceOnlineError } from "./types";
import type { SignatureAlgorithm } from "../marketplace/remote/types";
import type { EffectPackageManifest } from "../marketplace/types";

function rowToSummary(row: Record<string, unknown>): OnlinePackageSummary {
  return {
    id: String(row.id),
    packageId: String(row.package_id),
    name: String(row.name),
    author: String(row.author),
    description: String(row.description ?? ""),
    category: String(row.category ?? "effect"),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    latestVersion: (row.latest_version as string | null) ?? null,
    previewUrl: (row.preview_url as string | null) ?? null,
    updatedAt: String(row.updated_at),
  };
}

function rowToVersion(row: Record<string, unknown>): OnlinePackageVersion {
  return {
    id: String(row.id),
    packageId: String(row.package_id),
    version: String(row.version),
    engineMin: String(row.engine_min),
    engineMax: (row.engine_max as string | null) ?? null,
    artifactUrl: String(row.artifact_url),
    sha256: String(row.sha256),
    sizeBytes: Number(row.size_bytes ?? 0),
    signatureKeyId: String(row.signature_key_id),
    signatureAlgorithm: row.signature_algorithm as SignatureAlgorithm,
    signatureB64: String(row.signature_b64),
    manifest: row.manifest as EffectPackageManifest,
    changelog: (row.changelog as string | null) ?? null,
    publishedAt: String(row.published_at),
  };
}

function rowToKey(row: Record<string, unknown>): OnlineSigningKey {
  return {
    keyId: String(row.key_id),
    algorithm: row.algorithm as SignatureAlgorithm,
    publisher: String(row.publisher),
    publicKeyJwk: row.public_key_jwk as JsonWebKey,
    active: Boolean(row.active),
    revokedAt: (row.revoked_at as string | null) ?? null,
  };
}

export async function listPackages(): Promise<OnlinePackageSummary[]> {
  const { data, error } = await supabase
    .from("effect_packages")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new MarketplaceOnlineError("LIST_FAILED", error.message, error);
  return (data ?? []).map(rowToSummary);
}

export async function searchPackages(query: string): Promise<OnlinePackageSummary[]> {
  const q = query.trim();
  if (!q) return listPackages();
  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const { data, error } = await supabase
    .from("effect_packages")
    .select("*")
    .or(`package_id.ilike.${pattern},name.ilike.${pattern},author.ilike.${pattern},description.ilike.${pattern}`)
    .order("updated_at", { ascending: false });
  if (error) throw new MarketplaceOnlineError("SEARCH_FAILED", error.message, error);
  return (data ?? []).map(rowToSummary);
}

export async function getPackage(packageId: string): Promise<OnlinePackageSummary | null> {
  const { data, error } = await supabase
    .from("effect_packages")
    .select("*")
    .eq("package_id", packageId)
    .maybeSingle();
  if (error) throw new MarketplaceOnlineError("GET_FAILED", error.message, error);
  return data ? rowToSummary(data) : null;
}

export async function listVersions(packageId: string): Promise<OnlinePackageVersion[]> {
  const { data, error } = await supabase
    .from("effect_package_versions")
    .select("*")
    .eq("package_id", packageId)
    .order("published_at", { ascending: false });
  if (error) throw new MarketplaceOnlineError("VERSIONS_FAILED", error.message, error);
  return (data ?? []).map(rowToVersion);
}

export async function getVersion(
  packageId: string,
  version: string,
): Promise<OnlinePackageVersion | null> {
  const { data, error } = await supabase
    .from("effect_package_versions")
    .select("*")
    .eq("package_id", packageId)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new MarketplaceOnlineError("VERSION_FAILED", error.message, error);
  return data ? rowToVersion(data) : null;
}

export async function getSigningKey(keyId: string): Promise<OnlineSigningKey | null> {
  const { data, error } = await supabase
    .from("marketplace_signing_keys")
    .select("*")
    .eq("key_id", keyId)
    .maybeSingle();
  if (error) throw new MarketplaceOnlineError("KEY_FAILED", error.message, error);
  return data ? rowToKey(data) : null;
}
