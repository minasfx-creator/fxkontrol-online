/**
 * Local search across the installed package registry.
 * Matches against name, description, tags, and id.
 */
import { listPackages } from "./registry";
import type { InstalledEffectPackage, EffectPackageType } from "./types";

export type SearchOptions = {
  type?: EffectPackageType;
  /** Restrict to packages whose tags include all of these. */
  requiredTags?: string[];
};

export function searchEffects(
  query: string,
  options: SearchOptions = {},
): InstalledEffectPackage[] {
  const q = query.trim().toLowerCase();
  return listPackages().filter((pkg) => {
    if (options.type && pkg.manifest.type !== options.type) return false;
    if (options.requiredTags && options.requiredTags.length > 0) {
      const have = new Set(pkg.manifest.tags.map((t) => t.toLowerCase()));
      for (const t of options.requiredTags) {
        if (!have.has(t.toLowerCase())) return false;
      }
    }
    if (!q) return true;
    return (
      pkg.manifest.id.toLowerCase().includes(q) ||
      pkg.manifest.name.toLowerCase().includes(q) ||
      pkg.manifest.description.toLowerCase().includes(q) ||
      pkg.manifest.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}
