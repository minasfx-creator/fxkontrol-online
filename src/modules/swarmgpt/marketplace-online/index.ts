/**
 * Marketplace Online — public barrel.
 *
 * Supabase-backed catalog of signed effect packages. Read paths use the
 * authenticated client; writes (publish) go through the
 * `marketplace-publish` edge function. Verified artifacts are cached in
 * IndexedDB and exposed to the local effect runtime via blob: URLs.
 */
export * from "./types";
export {
  listPackages,
  searchPackages,
  getPackage,
  listVersions,
  getVersion,
  getSigningKey,
} from "./registryClient";
export { pickLatestCompatible, resolveExact } from "./semverResolver";
export { verifyOnlineSignature, verifyArtifactSha256 } from "./signatureVerifier";
export { getCached, putCached, clearCache } from "./installCache";
export { installOnlinePackage } from "./installer";
