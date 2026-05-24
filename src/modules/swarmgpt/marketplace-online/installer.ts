/**
 * End-to-end installer for online effect packages.
 *
 * Pipeline:
 *   1. Resolve version (latest-compatible or exact).
 *   2. Fetch trusted signing key.
 *   3. Verify detached signature against canonical manifest+integrity.
 *   4. Pull artifact (cache-first), enforce size cap, verify SHA-256.
 *   5. Materialize as a blob: URL and register in the local effect registry.
 */
import { getSigningKey, getVersion, listVersions } from "./registryClient";
import { pickLatestCompatible, resolveExact } from "./semverResolver";
import { verifyArtifactSha256, verifyOnlineSignature } from "./signatureVerifier";
import { getCached, putCached } from "./installCache";
import type { OnlineInstallOptions, OnlineInstallResult } from "./types";
import { MarketplaceOnlineError } from "./types";
import { installEffectPackage } from "../marketplace/install";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_ENGINE = "1.0.0";

export async function installOnlinePackage(
  packageId: string,
  versionOrLatest: string | "latest",
  opts: OnlineInstallOptions = {},
): Promise<OnlineInstallResult> {
  const engine = opts.engineVersion ?? DEFAULT_ENGINE;
  const maxBytes = opts.maxArtifactBytes ?? DEFAULT_MAX_BYTES;
  const useCache = opts.useCache !== false;

  const version =
    versionOrLatest === "latest"
      ? pickLatestCompatible(await listVersions(packageId), engine)
      : await getVersion(packageId, versionOrLatest);
  if (!version) {
    throw new MarketplaceOnlineError(
      "NO_COMPATIBLE_VERSION",
      `No compatible version found for ${packageId} (engine ${engine}).`,
    );
  }
  if (version.sizeBytes > maxBytes) {
    throw new MarketplaceOnlineError(
      "ARTIFACT_TOO_LARGE",
      `Artifact ${version.sizeBytes}B exceeds cap ${maxBytes}B.`,
    );
  }

  const key = await getSigningKey(version.signatureKeyId);
  if (!key) {
    throw new MarketplaceOnlineError(
      "UNTRUSTED_KEY",
      `Signing key ${version.signatureKeyId} not found in trusted registry.`,
    );
  }
  await verifyOnlineSignature(version, key);

  let bytes: Uint8Array | null = useCache ? await getCached(version.sha256) : null;
  const fromCache = bytes !== null;
  if (!bytes) {
    const res = await fetch(version.artifactUrl, { signal: opts.signal });
    if (!res.ok) {
      throw new MarketplaceOnlineError("ARTIFACT_FETCH_FAILED", `HTTP ${res.status} fetching artifact.`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new MarketplaceOnlineError(
        "ARTIFACT_TOO_LARGE",
        `Downloaded ${buf.byteLength}B exceeds cap ${maxBytes}B.`,
      );
    }
    bytes = new Uint8Array(buf);
    await verifyArtifactSha256(bytes, version.sha256, version.sizeBytes);
    if (useCache) await putCached(version.sha256, bytes);
  } else {
    // Even cache hits are re-verified — defends against a poisoned cache.
    await verifyArtifactSha256(bytes, version.sha256, version.sizeBytes);
  }

  const blob = new Blob([bytes as BlobPart], { type: "application/javascript" });
  const entryUrl = URL.createObjectURL(blob);
  await installEffectPackage(version.manifest, entryUrl);

  return {
    manifest: version.manifest,
    entryUrl,
    installedAt: Date.now(),
    fromCache,
    verifiedKeyId: key.keyId,
  };
}
