/**
 * Effect package installer.
 *
 * Validates the manifest, then registers the package. Does NOT execute the
 * entry module — loading is deferred until `loadEffectFromPackage`.
 */
import { registerPackage, unregisterPackage } from "./registry";
import { validateManifest } from "./security";
import type { EffectPackageManifest, InstalledEffectPackage } from "./types";

export async function installEffectPackage(
  manifest: EffectPackageManifest,
  entryPath: string,
): Promise<InstalledEffectPackage> {
  validateManifest(manifest);

  const pkg: InstalledEffectPackage = {
    manifest,
    entryPath,
    installedAt: Date.now(),
  };
  registerPackage(pkg);
  return pkg;
}

export function uninstallEffectPackage(id: string): boolean {
  return unregisterPackage(id);
}
