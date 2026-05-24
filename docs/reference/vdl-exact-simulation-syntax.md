# VDL — Exact Simulation Syntax

> Source: Finale 3D VDL Documentation, *“Exact simulation syntax”* (last updated 2023-09-12).

Standard cake VDL (`N Shot … Cake, K Rows, Row 1 (…), …`) represents both the
**visual appearance** and the **physical row construction** of a cake. When a
cake’s real angles/timing don’t fit the standard row firing patterns
(`STR`, `STL`, `FNT`, `Z-Shape`, etc.), Finale 3D / show-import functions fall
back to **Exact Simulation Syntax**: every shot is described individually as a
*tube description section*, with no relation to physical tube rows.

## Top-level shape

```
49 Shot 5s (a) Red Pearl + (b) Blue Pearl Cake, 1 Row (
  -30a93 / -20a / -10a / 0a / 10a / 20a / 30a /
  b      / 20b  / 10b  / 0b / -10b / -20b / -30b /
  a      / -20a / -10a / 0a / 10a / 20a / 30a /
  b      / 20b  / 10b  / 0b / -10b / -20b / -30b /
  a92    / -20a / -10a / 0a / 10a / 20a / 30a /
  b      / 20b  / 10b  / 0b / -10b / -20b / -30b1200 /
  a0     / -20b / -10a / 0b / 10a / 20b / 30a / CAK
)
```

- Always exactly **`, 1 Row (…)`** — exact mode collapses to a single virtual row.
- The body is a slash-separated list of *tube description sections*.
- The body ends with the literal designator **`/CAK`** marking the body as exact-simulation.

## Tube description section grammar

```
<angle?> <label> <delay?>
```

| Component | Example | Rule |
|-----------|---------|------|
| **Angle** (deg) | `-30`, `0`, `30` | Integer, sign optional (`+` = right). **Required on the first section.** Optional thereafter — elision means *“same as previous”*. |
| **Label** (cake ingredient) | `a`, `b` | Single letter referencing `(a)`/`(b)` ingredient labels in the cake header. **Required in every section.** |
| **Delay** (ms) | `93`, `1200`, `0` | Integer milliseconds. **Optional**; elision means *“same as previous”*. **Ignored on the last section** even if present. |

Parsed with the regex:

```
^\s*(-?\d+)?([A-Za-z])(\d+)?\s*$
```

Examples (from the spec):

| Section | Angle | Label | Delay |
|---------|-------|-------|-------|
| `-30a93` | −30° | `a` | 93 ms |
| `-20a`   | (elide) | `a` | (elide) |
| `a92`    | (elide) | `a` | 92 ms |
| `0a`     | 0°  | `a` | (elide) |
| `a0`     | (elide) | `a` | 0 ms |
| `-30b1200` | −30° | `b` | 1200 ms |

## Elision rules

- **Angle**: first section MUST specify; subsequent sections inherit the previous resolved angle when omitted.
- **Delay**: any omission inherits the previous resolved delay. The very first omitted run defaults to `0` if no prior value exists.
- **Last section’s delay is ignored** (no shot after it to delay against).
- **All-delays-omitted convention**: if no section in the body specifies a delay, treat all inter-shot delays as equal, summing to the declared cake duration (from header `Ns` term). For shells, account for the lift time of the last shot so the **last break** lands at the declared cake end — for non-bursting items (comets, mines), the sum equals the declared duration directly.

## Units sanity check

The spec mixes notation: `1.2s` in the header description, `1200` ms inside a section. Both refer to the same value. Tube-section delays are **always integer milliseconds** — no decimal seconds inside the parentheses.

## When it appears

- Show import (FWX, .FIN, etc.) — automatic fallback when angles/timing can’t fit standard patterns.
- *Effects → Create cake by combining selected effects…* in Finale 3D — falls back too.
- Manual authoring with non-standard fans, deliberate stagger overrides, or asymmetric chase patterns.

## Parser surface (this repo)

`src/lib/vdlExactSimulationSyntax.ts`

```ts
type ExactTube = {
  angleDeg: number;   // resolved (elision applied)
  label: string;      // single lowercase letter
  delayMs: number;    // resolved (elision applied; 0 on last by convention)
  raw: string;        // original section text
};

type ExactCakeBody = {
  tubes: ExactTube[];
  closed: boolean;    // /CAK designator present
  warnings: string[]; // first-section missing angle, unknown chars, etc.
};

function parseExactCakeBody(body: string): ExactCakeBody;
function isExactSimulationCake(raw: string): boolean;
function extractExactCakeBody(raw: string): string | null;
```

`vdlParser` exposes the parsed result on `VDLResult.exactTubes: ExactTube[]` (empty array when the cake uses standard syntax).

## Renderer wiring

Out of scope for this round. Future:
- Use `exactTubes[i].angleDeg` to override each shot’s pan angle directly instead of running `computeRowFiring(pattern,…)`.
- Use cumulative `delayMs` prefix-sum to compute per-shot start times within the cake cue.
- Continue resolving `label → ingredient VDL` via `cakeSegments` from the cake header.
