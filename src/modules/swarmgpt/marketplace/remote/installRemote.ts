/**
 * End-to-end remote install pipeline.
 *
 * Order is mandatory and must not be reordered:
 *   1. Fetch package detail JSON (manifest + integrity + signature).
 *   2. Verify the signature over (manifest, integrity) BEFORE fetching the artifact.
 *      A bad signature must short-circuit before any binary is touched.
 *   3. Fetch the artifact bytes from the CDN, capped at maxArtifactBytes.
 *   4. Verify SHA-* digest against the signed integrity descriptor.
 *   5. Resolve a local entry path (blob URL by default, or caller-provided override),
 *      then hand off to the existing local installer.
 */
import { installEffectPackage } from "../install";
import { RemoteMarketplaceClient } from "./marketplaceClient";
import { fetchBytes } from "./cdnClient";
import { verifyArtifactIntegrity, verifyPackageSignature } from "./signature";
import type { RemoteInstallOptions, RemoteInstallResult } from "./types";
import { RemoteMarketplaceError } from "./types";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export async function installRemoteEffectPackage(
  client: RemoteMarketplaceClient,
  packageId: string,
  opts: RemoteInstallOptions = {},
): Promise<RemoteInstallResult> {
  const detail = await client.getPackageDetail(packageId, opts);

  // Step 2: signature verification BEFORE downloading the artifact.
  await verifyPackageSignature(detail.manifest, detail.integrity, detail.signature);

  // Step 3: fetch artifact (size-capped).
  const cap = opts.maxArtifactBytes ?? DEFAULT_MAX_BYTES;
  const bytes = await fetchBytes(detail.artifactUrl, cap, opts);

  // Step 4: verify integrity.
  await verifyArtifactIntegrity(bytes, detail.integrity);

  // Step 5: resolve a local entry path. We default to a blob URL so the
  // existing dynamic loader can `import()` it without a real filesystem.
  const entryPath = opts.entryPathOverride ?? createBlobModuleUrl(bytes);

  let installed;
  try {
    installed = await installEffectPackage(detail.manifest, entryPath);
  } catch (err) {
    // Revoke the blob URL we just created if install validation fails.
    if (!opts.entryPathOverride) safeRevokeBlobUrl(entryPath);
    throw err;
  }

  return {
    manifest: installed.manifest,
    entryPath: installed.entryPath,
    installedAt: installed.installedAt,
    bytes: opts.returnBytes ? bytes : undefined,
    verifiedKeyId: detail.signature.keyId,
    verifiedAlgorithm: detail.signature.algorithm,
  };
}

function createBlobModuleUrl(bytes: Uint8Array): string {
  const blobCtor = (globalThis as { Blob?: typeof Blob }).Blob;
  const urlCtor = (globalThis as { URL?: typeof URL }).URL;
  if (!blobCtor || !urlCtor || typeof urlCtor.createObjectURL !== "function") {
    throw new RemoteMarketplaceError(
      "BLOB_UNAVAILABLE",
      "Blob/URL.createObjectURL not available; pass entryPathOverride for non-browser runtimes.",
    );
  }
  const blob = new blobCtor([bytes as BlobPart], { type: "text/javascript" });
  return urlCtor.createObjectURL(blob);
}

function safeRevokeBlobUrl(url: string): void {
  try {
    const urlCtor = (globalThis as { URL?: typeof URL }).URL;
    if (url.startsWith("blob:") && urlCtor?.revokeObjectURL) urlCtor.revokeObjectURL(url);
  } catch {
    /* swallow */
  }
}
