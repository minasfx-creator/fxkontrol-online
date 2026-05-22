/**
 * Web Crypto signature verifier for online packages.
 *
 * Uses JWK-imported public keys (Ed25519 or ECDSA P-256) registered in
 * `public.marketplace_signing_keys`. The signed payload is the canonical
 * JSON of `{ manifest, integrity }` — same shape used by the local
 * `../marketplace/remote/signature.ts` so signing tooling stays unified.
 */
import type { OnlinePackageVersion, OnlineSigningKey } from "./types";
import { MarketplaceOnlineError } from "./types";
import type { ArtifactIntegrity } from "../marketplace/remote/types";
import { buildSignedPayload } from "../marketplace/remote/signature";

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new MarketplaceOnlineError("WEBCRYPTO_UNAVAILABLE", "Web Crypto unavailable.");
  }
  return c.subtle;
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

export async function verifyOnlineSignature(
  version: OnlinePackageVersion,
  key: OnlineSigningKey,
): Promise<void> {
  if (!key.active || key.revokedAt) {
    throw new MarketplaceOnlineError("KEY_INACTIVE", `Signing key "${key.keyId}" is inactive.`);
  }
  if (key.algorithm !== version.signatureAlgorithm) {
    throw new MarketplaceOnlineError(
      "ALGORITHM_MISMATCH",
      `Key algorithm ${key.algorithm} does not match signature ${version.signatureAlgorithm}.`,
    );
  }

  const subtle = getSubtle();
  const integrity: ArtifactIntegrity = {
    algorithm: "SHA-256",
    hash: version.sha256,
    size: version.sizeBytes,
  };
  const payload = buildSignedPayload(version.manifest, integrity);
  const sig = base64ToBytes(version.signatureB64);

  let publicKey: CryptoKey;
  let verifyParams: AlgorithmIdentifier | EcdsaParams;
  try {
    if (key.algorithm === "Ed25519") {
      publicKey = await subtle.importKey("jwk", key.publicKeyJwk, { name: "Ed25519" }, false, ["verify"]);
      verifyParams = { name: "Ed25519" };
    } else {
      publicKey = await subtle.importKey(
        "jwk",
        key.publicKeyJwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );
      verifyParams = { name: "ECDSA", hash: "SHA-256" };
    }
  } catch (err) {
    throw new MarketplaceOnlineError("KEY_IMPORT_FAILED", "Failed to import signing key.", err);
  }

  let ok: boolean;
  try {
    ok = await subtle.verify(verifyParams, publicKey, sig as BufferSource, payload as BufferSource);
  } catch (err) {
    throw new MarketplaceOnlineError("VERIFY_THREW", "Verification threw.", err);
  }
  if (!ok) {
    throw new MarketplaceOnlineError(
      "INVALID_SIGNATURE",
      `Signature failed for ${version.packageId}@${version.version}.`,
    );
  }
}

export async function verifyArtifactSha256(
  bytes: Uint8Array,
  expectedB64: string,
  expectedSize: number,
): Promise<void> {
  if (bytes.byteLength !== expectedSize) {
    throw new MarketplaceOnlineError(
      "SIZE_MISMATCH",
      `Artifact size ${bytes.byteLength} != expected ${expectedSize}.`,
    );
  }
  const subtle = getSubtle();
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes as BufferSource));
  const got = bytesToBase64(digest);
  if (got !== expectedB64) {
    throw new MarketplaceOnlineError("HASH_MISMATCH", "Artifact SHA-256 mismatch.");
  }
}
