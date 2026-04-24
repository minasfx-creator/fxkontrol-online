/**
 * In-memory registry of installed effect packages.
 *
 * Keyed by manifest.id. The registry is intentionally process-local; persistence
 * (IndexedDB, Supabase) lives in a separate adapter so this module stays pure.
 */
import type { InstalledEffectPackage } from "./types";

const INSTALLED = new Map<string, InstalledEffectPackage>();

export function registerPackage(pkg: InstalledEffectPackage): void {
  INSTALLED.set(pkg.manifest.id, pkg);
}

export function unregisterPackage(id: string): boolean {
  return INSTALLED.delete(id);
}

export function getPackage(id: string): InstalledEffectPackage | undefined {
  return INSTALLED.get(id);
}

export function listPackages(): InstalledEffectPackage[] {
  return Array.from(INSTALLED.values());
}

export function clearRegistry(): void {
  INSTALLED.clear();
}
