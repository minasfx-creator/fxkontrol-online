/**
 * Marketplace Online — Domain types.
 *
 * Bridges the Supabase-backed catalog (`effect_packages`,
 * `effect_package_versions`, `marketplace_signing_keys`) with the in-app
 * effect package runtime defined in `../marketplace/types.ts`.
 *
 * All artifacts referenced here live in the public storage bucket
 * `marketplace-packages` and MUST be addressed by full path (the bucket's
 * RLS now forbids LIST, only direct READ by name).
 */
import type { EffectPackageManifest } from "../marketplace/types";
import type { SignatureAlgorithm } from "../marketplace/remote/types";

/** Row shape from `public.effect_packages`. */
export type OnlinePackageSummary = {
  id: string;
  packageId: string;
  name: string;
  author: string;
  description: string;
  category: string;
  tags: string[];
  latestVersion: string | null;
  previewUrl: string | null;
  updatedAt: string;
};

/** Row shape from `public.effect_package_versions`. */
export type OnlinePackageVersion = {
  id: string;
  packageId: string;
  version: string;
  engineMin: string;
  engineMax: string | null;
  artifactUrl: string;
  sha256: string;
  sizeBytes: number;
  signatureKeyId: string;
  signatureAlgorithm: SignatureAlgorithm;
  signatureB64: string;
  manifest: EffectPackageManifest;
  changelog: string | null;
  publishedAt: string;
};

/** Trusted signing key fetched from `public.marketplace_signing_keys`. */
export type OnlineSigningKey = {
  keyId: string;
  algorithm: SignatureAlgorithm;
  publisher: string;
  publicKeyJwk: JsonWebKey;
  active: boolean;
  revokedAt: string | null;
};

export type OnlineInstallOptions = {
  /** Override engine version when checking compatibility. */
  engineVersion?: string;
  /** Hard cap on artifact size; default 5 MiB. */
  maxArtifactBytes?: number;
  /** Reuse cached blob when sha256 matches; default true. */
  useCache?: boolean;
  signal?: AbortSignal;
};

export type OnlineInstallResult = {
  manifest: EffectPackageManifest;
  entryUrl: string;
  installedAt: number;
  fromCache: boolean;
  verifiedKeyId: string;
};

export class MarketplaceOnlineError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "MarketplaceOnlineError";
    this.code = code;
    this.cause = cause;
  }
}
