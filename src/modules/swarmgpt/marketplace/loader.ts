/**
 * Dynamic effect loader.
 *
 * Imports the entry module of an installed package and returns its default
 * export, which must be a callable `EffectFunction`. Errors are normalized so
 * the caller always sees a clear message.
 */
import { getPackage } from "./registry";
import type { EffectFunction } from "./types";

export async function loadEffectFromPackage(packageId: string): Promise<EffectFunction> {
  const pkg = getPackage(packageId);
  if (!pkg) {
    throw new Error(`Package not found: ${packageId}`);
  }

  let mod: { default?: unknown };
  try {
    mod = await import(/* @vite-ignore */ pkg.entryPath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load effect entry "${pkg.entryPath}": ${reason}`);
  }

  if (!mod || typeof mod.default !== "function") {
    throw new Error(`Invalid effect module in package: ${packageId} (missing default export function)`);
  }
  return mod.default as EffectFunction;
}
