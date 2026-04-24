/**
 * Remote marketplace barrel.
 *
 * Public surface for fetching, verifying, and installing CDN-hosted effect
 * packages. Trusted keys must be registered via `registerTrustedKey` before
 * any install will succeed.
 */
export * from "./types";
export {
  registerTrustedKey,
  unregisterTrustedKey,
  listTrustedKeys,
  clearTrustedKeys,
  verifyPackageSignature,
  verifyArtifactIntegrity,
  buildSignedPayload,
} from "./signature";
export { fetchBytes, fetchJson } from "./cdnClient";
export { RemoteMarketplaceClient } from "./marketplaceClient";
export type { RemoteMarketplaceClientOptions } from "./marketplaceClient";
export { installRemoteEffectPackage } from "./installRemote";
