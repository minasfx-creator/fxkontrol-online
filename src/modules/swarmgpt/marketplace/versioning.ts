/**
 * Semver-aware version comparison utilities.
 * Supports MAJOR.MINOR.PATCH plus an optional pre-release/build suffix that
 * is ignored during ordering (matching npm's "loose" comparison semantics).
 */

export type SemverParts = { major: number; minor: number; patch: number };

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(?:[-+][0-9A-Za-z.-]+)?$/;

export function parseSemver(v: string): SemverParts | null {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b. Throws on invalid input. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    throw new Error(`Invalid semver: "${pa ? b : a}"`);
  }
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return 0;
}

/** True if `current` satisfies `current >= minVersion`. */
export function isCompatible(minVersion: string, current: string): boolean {
  return compareSemver(current, minVersion) >= 0;
}
