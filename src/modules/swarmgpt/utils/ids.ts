/**
 * SwarmGPT 2.0 — Lightweight ID generator (collision-resistant for module scope).
 */
export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
