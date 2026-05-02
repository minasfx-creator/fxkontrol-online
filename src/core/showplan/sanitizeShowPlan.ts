/**
 * sanitizeShowPlan — Sprint 2 (Phase 0/1) deliverable.
 *
 * JOI orçamento 02/05/2026 calls out two ShowPlan-quality blockers
 * keeping the system in BLOCKED:
 *   1. Orphan pyro cues / orphan drone paths (referenced positions
 *      do not exist) — `int-orphan-cues` and `drone-pad-ref` issues
 *      from VerificationEngine.
 *   2. Empty/default metadata (`metadata.name` blank, `duration === 0`).
 *
 * This pure utility produces a sanitized copy + a deterministic diff
 * report. NEVER mutates the input. Callers (UI panel, JOI advisor) decide
 * whether to apply the result via `showPlanManager.load()`.
 *
 * Honesty rules:
 *   - Pure function. Zero IO, zero CommandBus/FieldBus/SafetyStateMachine.
 *   - Deterministic: identical input → identical output (no clocks, no
 *     `Math.random`).
 *   - Does NOT change pyroCues that are valid; only filters orphans.
 *   - `metadata.name` only filled when blank ("" / whitespace / "Untitled
 *     Show"). User-set names are preserved.
 *   - `metadata.duration` only re-derived when it is `0` and there is at
 *     least one timed entry.
 */

import type { ShowPlan } from './ShowPlan';

export interface ShowPlanSanitizationDiff {
  removedPyroCueIds: string[];
  removedDronePathIds: string[];
  filledName: string | null;
  filledDuration: number | null;
}

export interface ShowPlanSanitizationResult {
  changed: boolean;
  diff: ShowPlanSanitizationDiff;
  /** Sanitized deep clone. Same reference as input when `changed === false`. */
  plan: ShowPlan;
}

const BLANK_NAMES = new Set(['', 'untitled show', 'default']);

function isBlankName(name: string | undefined | null): boolean {
  if (typeof name !== 'string') return true;
  return BLANK_NAMES.has(name.trim().toLowerCase());
}

export function sanitizeShowPlan(input: ShowPlan): ShowPlanSanitizationResult {
  const posIds = new Set(input.positions.map((p) => p.id));
  const validPyro = input.pyroCues.filter((c) => posIds.has(c.positionId));
  const removedPyro = input.pyroCues
    .filter((c) => !posIds.has(c.positionId))
    .map((c) => c.id);

  const validDronePaths = input.dronePaths.filter((p) => posIds.has(p.padPositionId));
  const removedDrone = input.dronePaths
    .filter((p) => !posIds.has(p.padPositionId))
    .map((p) => p.id);

  let filledName: string | null = null;
  let filledDuration: number | null = null;
  const nextMetadata = { ...input.metadata };

  if (isBlankName(nextMetadata.name)) {
    filledName = nextMetadata.venue?.trim()
      ? `${nextMetadata.venue.trim()} — Show`
      : 'FXK Show (auto-named)';
    nextMetadata.name = filledName;
  }

  if (!nextMetadata.duration || nextMetadata.duration <= 0) {
    const allTimes: number[] = [
      ...validPyro.map((c) => c.time),
      ...input.dmxCues.map((c) => c.time + (c.duration ?? 0)),
      ...validDronePaths.flatMap((p) => p.waypoints.map((w) => w.time)),
    ];
    if (allTimes.length > 0) {
      filledDuration = Math.max(...allTimes);
      nextMetadata.duration = filledDuration;
    }
  }

  const changed =
    removedPyro.length > 0 ||
    removedDrone.length > 0 ||
    filledName !== null ||
    filledDuration !== null;

  if (!changed) {
    return {
      changed: false,
      diff: {
        removedPyroCueIds: [],
        removedDronePathIds: [],
        filledName: null,
        filledDuration: null,
      },
      plan: input,
    };
  }

  const next: ShowPlan = {
    ...input,
    metadata: nextMetadata,
    pyroCues: validPyro,
    dronePaths: validDronePaths,
  };

  return {
    changed: true,
    diff: {
      removedPyroCueIds: removedPyro,
      removedDronePathIds: removedDrone,
      filledName,
      filledDuration,
    },
    plan: next,
  };
}

/** Render a deterministic, human-readable summary of the sanitization diff. */
export function sanitizationToText(diff: ShowPlanSanitizationDiff): string {
  const L: string[] = [];
  if (diff.removedPyroCueIds.length) L.push(`Removed ${diff.removedPyroCueIds.length} orphan pyro cue(s)`);
  if (diff.removedDronePathIds.length) L.push(`Removed ${diff.removedDronePathIds.length} orphan drone path(s)`);
  if (diff.filledName) L.push(`Filled metadata.name → "${diff.filledName}"`);
  if (diff.filledDuration !== null) L.push(`Filled metadata.duration → ${diff.filledDuration.toFixed(2)}s`);
  return L.length === 0 ? 'No changes — ShowPlan already clean.' : L.join('\n');
}
