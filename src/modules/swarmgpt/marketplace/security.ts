/**
 * Manifest validation — first-line defense before a package enters the registry.
 *
 * This is intentionally strict on entry paths: remote URLs, protocol-relative
 * paths, and `..` traversal are all rejected. Real isolation still requires
 * a Worker/iframe (see sandbox.ts).
 */
import type { EffectPackageManifest } from "./types";

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;

export class ManifestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

export function validateManifest(manifest: unknown): asserts manifest is EffectPackageManifest {
  if (!manifest || typeof manifest !== "object") {
    throw new ManifestValidationError("Manifest must be an object.");
  }
  const m = manifest as Record<string, unknown>;

  requireString(m, "id");
  if (!ID_RE.test(m.id as string)) {
    throw new ManifestValidationError(`Invalid manifest.id: "${m.id}"`);
  }
  requireString(m, "name");
  requireString(m, "version");
  if (!SEMVER_RE.test(m.version as string)) {
    throw new ManifestValidationError(`Invalid semver in manifest.version: "${m.version}"`);
  }
  requireString(m, "author");
  requireString(m, "description");
  requireString(m, "entry");

  // Reject obvious remote-execution attempts.
  const entry = m.entry as string;
  if (/^[a-z]+:\/\//i.test(entry) || entry.startsWith("//")) {
    throw new ManifestValidationError("Remote execution not allowed (entry must be a local module path).");
  }
  if (entry.includes("..")) {
    throw new ManifestValidationError("Path traversal not allowed in manifest.entry.");
  }

  if (!Array.isArray(m.tags)) {
    throw new ManifestValidationError("manifest.tags must be an array.");
  }
  const validTypes: ReadonlyArray<string> = ["field", "formation", "composite"];
  if (typeof m.type !== "string" || !validTypes.includes(m.type)) {
    throw new ManifestValidationError(`Invalid manifest.type: "${String(m.type)}"`);
  }

  const eng = m.engine as Record<string, unknown> | undefined;
  if (!eng || typeof eng.minVersion !== "string" || !SEMVER_RE.test(eng.minVersion)) {
    throw new ManifestValidationError("manifest.engine.minVersion must be a valid semver string.");
  }
}

function requireString(m: Record<string, unknown>, key: string): void {
  if (typeof m[key] !== "string" || (m[key] as string).length === 0) {
    throw new ManifestValidationError(`manifest.${key} must be a non-empty string.`);
  }
}
