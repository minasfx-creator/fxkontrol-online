/**
 * SemVer resolver for the online marketplace.
 *
 * Picks the highest published version that satisfies an `engineMin <= engine
 * <= engineMax` window. Re-uses the strict comparator from
 * `../marketplace/versioning.ts` so behaviour matches the local registry.
 */
import { compareSemver, isCompatible } from "../marketplace/versioning";
import type { OnlinePackageVersion } from "./types";

export function pickLatestCompatible(
  versions: OnlinePackageVersion[],
  engineVersion: string,
): OnlinePackageVersion | null {
  const compatible = versions.filter((v) => {
    if (!isCompatible(v.engineMin, engineVersion)) return false;
    if (v.engineMax && compareSemver(engineVersion, v.engineMax) > 0) return false;
    return true;
  });
  if (!compatible.length) return null;
  compatible.sort((a, b) => compareSemver(b.version, a.version));
  return compatible[0];
}

export function resolveExact(
  versions: OnlinePackageVersion[],
  version: string,
): OnlinePackageVersion | null {
  return versions.find((v) => v.version === version) ?? null;
}
