/**
 * Signature verification for remote effect packages.
 *
 * Uses Web Crypto exclusively (no third-party crypto libs). Supports Ed25519
 * (preferred) and ECDSA P-256 SHA-256 as a fallback for older runtimes.
 *
 * The signed payload is the canonical JSON of the package's manifest +
 * artifact integrity descriptor, in a fixed key order. Anything outside that
 * payload (e.g. publishedAt, mirrors) is metadata and NOT covered.
 */
import type {
  ArtifactIntegrity,
  PackageSignature,
  SignatureAlgorithm,
  TrustedKey,
} from "./types";
import { RemoteMarketplaceError } from "./types";
import type { EffectPackageManifest } from "../types";

const TRUSTED_KEYS = new Map<string, TrustedKey>();

export function registerTrustedKey(key: TrustedKey): void {
  TRUSTED_KEYS.set(key.keyId, key);
}

export function unregisterTrustedKey(keyId: string): boolean {
  return TRUSTED_KEYS.delete(keyId);
}

export function listTrustedKeys(): TrustedKey[] {
  return Array.from(TRUSTED_KEYS.values());
}

export function clearTrustedKeys(): void {
  TRUSTED_KEYS.clear();
}

/** Build the deterministic byte payload that signatures cover. */
export function buildSignedPayload(
  manifest: EffectPackageManifest,
  integrity: ArtifactIntegrity,
): Uint8Array {
  const canonical = JSON.stringify({
    manifest: canonicalizeManifest(manifest),
    integrity: {
      algorithm: integrity.algorithm,
      hash: integrity.hash,
      size: integrity.size,
    },
  });
  return new TextEncoder().encode(canonical);
}

export async function verifyPackageSignature(
  manifest: EffectPackageManifest,
  integrity: ArtifactIntegrity,
  signature: PackageSignature,
): Promise<void> {
  const trusted = TRUSTED_KEYS.get(signature.keyId);
  if (!trusted) {
    throw new RemoteMarketplaceError(
      "UNTRUSTED_KEY",
      `Signature key "${signature.keyId}" is not in the trusted registry.`,
    );
  }
  if (trusted.algorithm !== signature.algorithm) {
    throw new RemoteMarketplaceError(
      "ALGORITHM_MISMATCH",
      `Trusted key "${signature.keyId}" uses ${trusted.algorithm}, signature uses ${signature.algorithm}.`,
    );
  }
  if (trusted.expiresAt && trusted.expiresAt < Date.now()) {
    throw new RemoteMarketplaceError(
      "KEY_EXPIRED",
      `Trusted key "${signature.keyId}" expired at ${new Date(trusted.expiresAt).toISOString()}.`,
    );
  }

  const subtle = getSubtle();
  const spki = base64ToBytes(trusted.publicKeySpkiBase64);
  const sig = base64ToBytes(signature.signature);
  const payload = buildSignedPayload(manifest, integrity);

  let publicKey: CryptoKey;
  let verifyParams: AlgorithmIdentifier | EcdsaParams;
  try {
    if (signature.algorithm === "Ed25519") {
      publicKey = await subtle.importKey("spki", spki as BufferSource, { name: "Ed25519" }, false, ["verify"]);
      verifyParams = { name: "Ed25519" };
    } else {
      publicKey = await subtle.importKey(
        "spki",
        spki as BufferSource,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"],
      );
      verifyParams = { name: "ECDSA", hash: "SHA-256" };
    }
  } catch (err) {
    throw new RemoteMarketplaceError("KEY_IMPORT_FAILED", "Failed to import trusted public key.", err);
  }

  let ok: boolean;
  try {
    ok = await subtle.verify(verifyParams, publicKey, sig as BufferSource, payload as BufferSource);
  } catch (err) {
    throw new RemoteMarketplaceError("VERIFY_THREW", "Signature verification threw an error.", err);
  }
  if (!ok) {
    throw new RemoteMarketplaceError(
      "INVALID_SIGNATURE",
      `Signature verification failed for package "${manifest.id}@${manifest.version}".`,
    );
  }
}

export async function verifyArtifactIntegrity(
  bytes: Uint8Array,
  integrity: ArtifactIntegrity,
): Promise<void> {
  if (bytes.byteLength !== integrity.size) {
    throw new RemoteMarketplaceError(
      "SIZE_MISMATCH",
      `Artifact size mismatch: expected ${integrity.size}, got ${bytes.byteLength}.`,
    );
  }
  const subtle = getSubtle();
  let digest: ArrayBuffer;
  try {
    digest = await subtle.digest(integrity.algorithm, bytes as BufferSource);
  } catch (err) {
    throw new RemoteMarketplaceError("DIGEST_FAILED", `Failed to compute ${integrity.algorithm} digest.`, err);
  }
  const got = bytesToBase64(new Uint8Array(digest));
  if (!constantTimeEqualB64(got, integrity.hash)) {
    throw new RemoteMarketplaceError(
      "HASH_MISMATCH",
      `Artifact ${integrity.algorithm} hash mismatch.`,
    );
  }
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.subtle) {
    throw new RemoteMarketplaceError(
      "WEBCRYPTO_UNAVAILABLE",
      "Web Crypto SubtleCrypto is not available in this runtime.",
    );
  }
  return c.subtle;
}

function canonicalizeManifest(m: EffectPackageManifest): EffectPackageManifest {
  // Stable key order via explicit reconstruction.
  return {
    id: m.id,
    name: m.name,
    version: m.version,
    author: m.author,
    description: m.description,
    tags: [...m.tags].sort(),
    type: m.type,
    entry: m.entry,
    preview: m.preview,
    engine: { minVersion: m.engine.minVersion },
  };
}

// Avoid `Buffer` (browser-first). Atob/btoa handle standard base64.
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

function constantTimeEqualB64(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type { SignatureAlgorithm };
