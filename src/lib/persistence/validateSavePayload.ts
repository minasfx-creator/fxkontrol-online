/**
 * Pre-save validation for project persistence.
 *
 * Runs entirely client-side BEFORE any Supabase round-trip. The goal is to
 * fail fast with a clear, user-actionable message — so we never enqueue an
 * obviously-broken transaction (waypoints out of order, NaN coordinates,
 * empty project name) and never trigger the toast "transação revertida"
 * for a problem the user can fix locally.
 *
 * Returns either { ok: true } or { ok: false, message } — pure data, no
 * side effects (no toasts, no logs). Caller decides how to surface it.
 */
import type {
  PositionSavePayload,
  TimelineItemSavePayload,
  TrajectorySavePayload,
} from './savePayloadTypes';

export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export function validateProjectName(name: unknown): ValidationResult {
  if (typeof name !== 'string' || name.trim().length === 0) {
    return { ok: false, message: 'Nome do projeto é obrigatório.' };
  }
  if (name.length > 200) {
    return { ok: false, message: 'Nome do projeto excede 200 caracteres.' };
  }
  return { ok: true };
}

export function validateDuration(duration: unknown): ValidationResult {
  if (!isFiniteNumber(duration) || duration <= 0) {
    return { ok: false, message: 'Duração do show deve ser maior que zero.' };
  }
  return { ok: true };
}

export function validatePositions(positions: PositionSavePayload[]): ValidationResult {
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y) || !isFiniteNumber(p.z)) {
      return {
        ok: false,
        message: `Posição "${p.name || `#${i + 1}`}" tem coordenadas inválidas (NaN ou Infinity).`,
      };
    }
    if (!isFiniteNumber(p.heading) || !isFiniteNumber(p.pitch) || !isFiniteNumber(p.roll)) {
      return {
        ok: false,
        message: `Posição "${p.name || `#${i + 1}`}" tem rotação inválida (heading/pitch/roll).`,
      };
    }
  }
  return { ok: true };
}

export function validateTimelineItems(items: TimelineItemSavePayload[]): ValidationResult {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!isFiniteNumber(it.start_time) || it.start_time < 0) {
      return {
        ok: false,
        message: `Cue #${i + 1} (${it.effect_id || '?'}) tem startTime inválido (deve ser >= 0).`,
      };
    }
    if (!it.effect_id) {
      return { ok: false, message: `Cue #${i + 1} sem effect_id.` };
    }
  }
  return { ok: true };
}

export function validateTrajectories(trajectories: TrajectorySavePayload[]): ValidationResult {
  for (let i = 0; i < trajectories.length; i++) {
    const t = trajectories[i];
    if (!t.waypoints || t.waypoints.length === 0) continue; // empty trajectory is allowed
    let lastTime = -Infinity;
    for (let w = 0; w < t.waypoints.length; w++) {
      const wp = t.waypoints[w];
      if (!isFiniteNumber(wp.x) || !isFiniteNumber(wp.y) || !isFiniteNumber(wp.z)) {
        return {
          ok: false,
          message: `Trajetória "${t.name}" tem waypoint #${w + 1} com coordenadas inválidas.`,
        };
      }
      if (!isFiniteNumber(wp.time_seconds) || wp.time_seconds < 0) {
        return {
          ok: false,
          message: `Trajetória "${t.name}" tem waypoint #${w + 1} com tempo inválido.`,
        };
      }
      if (wp.time_seconds < lastTime) {
        return {
          ok: false,
          message: `Trajetória "${t.name}" tem waypoints fora de ordem (waypoint #${w + 1} ocorre antes do anterior).`,
        };
      }
      lastTime = wp.time_seconds;
    }
  }
  return { ok: true };
}

export interface SaveValidationInput {
  projectName: unknown;
  duration: unknown;
  positions: PositionSavePayload[];
  timelineItems: TimelineItemSavePayload[];
  trajectories: TrajectorySavePayload[];
}

/** Runs all checks in order; returns the first failure, or ok. */
export function validateSavePayload(input: SaveValidationInput): ValidationResult {
  const checks: ValidationResult[] = [
    validateProjectName(input.projectName),
    validateDuration(input.duration),
    validatePositions(input.positions),
    validateTimelineItems(input.timelineItems),
    validateTrajectories(input.trajectories),
  ];
  for (const r of checks) if (!r.ok) return r;
  return { ok: true };
}
