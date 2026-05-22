/**
 * VDL — Exact Simulation Syntax parser.
 *
 * Spec: see docs/reference/vdl-exact-simulation-syntax.md
 *
 * Exact syntax describes every shot individually inside the cake body
 * `… Cake, 1 Row ( <section>/<section>/…/CAK )`. Each tube section follows
 *
 *     <angle?><label><delay?>
 *
 * with elision rules: angle and delay carry over from the previous section
 * when omitted; the very last section's delay is meaningless and ignored.
 */

export interface ExactTube {
  /** Resolved angle in degrees (positive = right). */
  angleDeg: number;
  /** Single lowercase letter referencing a cake ingredient label. */
  label: string;
  /** Resolved inter-shot delay in milliseconds. The last tube's delay is 0. */
  delayMs: number;
  /** Original section text as it appeared in the VDL string. */
  raw: string;
}

export interface ExactCakeBody {
  tubes: ExactTube[];
  /** True if the body ends with the `/CAK` designator. */
  closed: boolean;
  warnings: string[];
}

const SECTION_RE = /^\s*(-?\d+)?([A-Za-z])(\d+)?\s*$/;

/**
 * Returns true when `raw` looks like an Exact Simulation cake — i.e. has
 * `Cake, 1 Row (…)` and ends with `/CAK)`.
 */
export function isExactSimulationCake(raw: string): boolean {
  if (!raw) return false;
  return /\bCake\s*,\s*1\s*Row\s*\(/i.test(raw) && /\/\s*CAK\s*\)/i.test(raw);
}

/**
 * Pull the body between `Cake, 1 Row (` and `)` if it is an exact-simulation
 * cake. Returns `null` otherwise.
 */
export function extractExactCakeBody(raw: string): string | null {
  if (!isExactSimulationCake(raw)) return null;
  const m = raw.match(/\bCake\s*,\s*1\s*Row\s*\(([^)]*)\)/i);
  return m ? m[1].trim() : null;
}

/**
 * Parse the body of an exact-simulation cake (the contents between the
 * parentheses, with or without the trailing `/CAK`). Applies angle/delay
 * elision rules. Pass the body alone, not the full VDL string — use
 * `extractExactCakeBody()` first when you only have the full VDL.
 */
export function parseExactCakeBody(body: string): ExactCakeBody {
  const out: ExactCakeBody = { tubes: [], closed: false, warnings: [] };
  if (!body) return out;

  const parts = body
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Trailing /CAK designator
  if (parts.length > 0 && parts[parts.length - 1].toUpperCase() === 'CAK') {
    out.closed = true;
    parts.pop();
  }

  let lastAngle: number | null = null;
  let lastDelay = 0;
  let hadAnyExplicitDelay = false;

  for (let i = 0; i < parts.length; i++) {
    const section = parts[i];
    const m = section.match(SECTION_RE);
    if (!m) {
      out.warnings.push(`Unparseable section "${section}" at index ${i}`);
      continue;
    }
    const [, angStr, label, delStr] = m;

    let angleDeg: number;
    if (angStr !== undefined) {
      angleDeg = parseInt(angStr, 10);
      lastAngle = angleDeg;
    } else if (lastAngle !== null) {
      angleDeg = lastAngle;
    } else {
      // First section is required to specify an angle. Fall back to 0 and warn.
      out.warnings.push(`First tube section "${section}" is missing required angle (defaulting to 0)`);
      angleDeg = 0;
      lastAngle = 0;
    }

    let delayMs: number;
    if (delStr !== undefined) {
      delayMs = parseInt(delStr, 10);
      lastDelay = delayMs;
      hadAnyExplicitDelay = true;
    } else {
      delayMs = lastDelay;
    }

    out.tubes.push({
      angleDeg,
      label: label.toLowerCase(),
      delayMs,
      raw: section,
    });
  }

  // Last section's delay is meaningless (no shot follows). Zero it out.
  if (out.tubes.length > 0) {
    out.tubes[out.tubes.length - 1].delayMs = 0;
  }

  // Convention: if no delay was ever specified, leave delays at 0 and let the
  // caller fill them from the declared cake duration (renderer concern).
  if (!hadAnyExplicitDelay) {
    out.warnings.push('No explicit delays — distribute cake duration across shots (renderer task)');
  }

  return out;
}
