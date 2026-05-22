/**
 * Remote marketplace types.
 *
 * The remote service is intentionally minimal and CDN-friendly: a JSON index
 * at `${baseUrl}/index.json`, per-package detail at `${baseUrl}/p/{id}.json`,
 * and immutable artifact URLs (typically pointing at a CDN). All signed
 * payloads are verified against a project-controlled trusted-key registry
 * before anything is installed.
 */
import type { EffectPackageManifest } from "../types";

export type SignatureAlgorithm = "Ed25519" | "ECDSA-P256-SHA256";

/** Detached signature attached to a package detail document. */
export type PackageSignature = {
  algorithm: SignatureAlgorithm;
  /** Public key id (matches a key in TrustedKeyRegistry). */
  keyId: string;
  /** base64 (standard, not URL-safe) detached signature over the canonical manifest+integrity payload. */
  signature: string;
};

/** SubResource-style integrity for the artifact bytes. */
export type ArtifactIntegrity = {
  algorithm: "SHA-256" | "SHA-384" | "SHA-512";
  /** base64-encoded digest. */
  hash: string;
  /** Expected size in bytes. Hard-cap enforced before hashing. */
  size: number;
};

/** Lightweight entry returned by the remote index. */
export type RemotePackageEntry = {
  id: string;
  name: string;
  version: string;
  author: string;
  type: EffectPackageManifest["type"];
  tags: string[];
  description: string;
  preview?: string;
  /** Relative or absolute URL to the per-package detail document. */
  detailUrl: string;
  updatedAt: number;
};

export type RemotePackageDetail = {
  manifest: EffectPackageManifest;
  /** Absolute URL of the entry artifact (typically CDN). */
  artifactUrl: string;
  integrity: ArtifactIntegrity;
  signature: PackageSignature;
  publishedAt: number;
};

export type RemoteFetchOptions = {
  /** Per-request timeout in ms. Default 15s. */
  timeoutMs?: number;
  /** Retries on network/5xx failure. Default 2. */
  retries?: number;
  /** AbortSignal forwarded to fetch. */
  signal?: AbortSignal;
};

export type RemoteInstallOptions = RemoteFetchOptions & {
  /** Override the resolved entry path written to the registry. */
  entryPathOverride?: string;
  /** If true, return the artifact bytes alongside the install record. */
  returnBytes?: boolean;
  /** Hard cap on artifact size (defensive against integrity mismatch). Default 5 MiB. */
  maxArtifactBytes?: number;
};

export type RemoteInstallResult = {
  manifest: EffectPackageManifest;
  entryPath: string;
  installedAt: number;
  bytes?: Uint8Array;
  /** Raw signature info that was verified. Useful for audit logs. */
  verifiedKeyId: string;
  verifiedAlgorithm: SignatureAlgorithm;
};

export type TrustedKey = {
  keyId: string;
  algorithm: SignatureAlgorithm;
  /** Raw SPKI bytes (DER), base64-encoded. */
  publicKeySpkiBase64: string;
  label?: string;
  expiresAt?: number;
};

export class RemoteMarketplaceError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "RemoteMarketplaceError";
    this.code = code;
    this.cause = cause;
  }
}
