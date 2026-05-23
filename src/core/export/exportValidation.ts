/**
 * ─── Export Validation — Field-Level Errors for JSON/CSV/VVIZ ────────
 *
 * Single source of truth for validating outbound firing data before it
 * leaves the simulator. Every validator returns a structured
 * `ValidationReport` so callers (UI panels, CLI exporters, tests) can
 * surface the offending row + field name to the operator instead of a
 * generic "Export failed".
 *
 * Why this exists:
 *   - A malformed lat/lon in a MAVLink plan can crash an autopilot or
 *     send a drone to the wrong field (life-safety risk).
 *   - A NaN time / missing position in a CSV silently drops cues on the
 *     firing system console — operators only discover it during arming.
 *   - VVIZ ingestion downstream chokes on inconsistent decimal precision
 *     in coordinates; we normalise during export.
 *
 * Design rules:
 *   - Errors are blocking. Warnings are advisory and surface to the UI
 *     but do not abort the export.
 *   - Each finding includes a JSON-pointer-like `path` plus the row
 *     index when it originated from an array, so panels can scroll the
 *     operator straight to the bad cue.
 *   - Coordinate formatters are axis-aware. WGS84 lat/lon → 8 decimals,
 *     altitude → 6 decimals, local XYZ → 3 decimals (mm precision).
 */

import { z } from 'zod';
import type { TimelineItem, Position } from '@/types/projectTypes';
import type { MAVLinkWaypoint, FlightPlan } from '@/lib/mavlinkFlightPlanExporter';
import type { GeoOrigin } from '@/lib/skybrushCoordinates';

// ── Types ───────────────────────────────────────────────────────────

export type Severity = 'error' | 'warning';

export interface ValidationFinding {
  path: ReadonlyArray<string | number>;
  code: string;
  message: string;
  severity: Severity;
  row?: number;
  field?: string;
}

export interface ValidationReport {
  ok: boolean;
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  summary: string;
}

// Sentinel codes — keep stable; UI panels match on these to localise.
export const VAL = {
  COORD_NAN: 'COORD_NAN',
  COORD_OUT_OF_RANGE: 'COORD_OUT_OF_RANGE',
  TIME_NEGATIVE: 'TIME_NEGATIVE',
  TIME_NOT_FINITE: 'TIME_NOT_FINITE',
  EFFECT_MISSING: 'EFFECT_MISSING',
  POSITION_MISSING: 'POSITION_MISSING',
  DUPLICATE_CUE: 'DUPLICATE_CUE',
  ALT_BELOW_GROUND: 'ALT_BELOW_GROUND',
  ALT_EXCESSIVE: 'ALT_EXCESSIVE',
  SEQ_NOT_SEQUENTIAL: 'SEQ_NOT_SEQUENTIAL',
  COMMAND_UNKNOWN: 'COMMAND_UNKNOWN',
  FRAME_UNKNOWN: 'FRAME_UNKNOWN',
  PRECISION_LOSS: 'PRECISION_LOSS',
  EMPTY_PAYLOAD: 'EMPTY_PAYLOAD',
} as const;

// ── Helpers ─────────────────────────────────────────────────────────

function err(
  path: (string | number)[],
  code: string,
  message: string,
  extras: { row?: number; field?: string } = {},
): ValidationFinding {
  return { path, code, message, severity: 'error', ...extras };
}
function warn(
  path: (string | number)[],
  code: string,
  message: string,
  extras: { row?: number; field?: string } = {},
): ValidationFinding {
  return { path, code, message, severity: 'warning', ...extras };
}

function buildReport(findings: ValidationFinding[], context: string): ValidationReport {
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const ok = errors.length === 0;
  const summary = ok
    ? `${context}: OK (${warnings.length} warning${warnings.length === 1 ? '' : 's'})`
    : `${context}: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`;
  return { ok, errors, warnings, summary };
}

/** Throw a single, message-rich Error built from a failed report. Caller
 * gets a concise top-line plus the first 5 errors enumerated. */
export class ExportValidationError extends Error {
  readonly report: ValidationReport;
  constructor(report: ValidationReport) {
    const head = report.errors.slice(0, 5)
      .map((e, i) => `  ${i + 1}. [${e.code}] ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    const more = report.errors.length > 5 ? `\n  …and ${report.errors.length - 5} more` : '';
    super(`${report.summary}\n${head}${more}`);
    this.name = 'ExportValidationError';
    this.report = report;
  }
}

/** Throw if the report has any errors. */
export function assertValid(report: ValidationReport): void {
  if (!report.ok) throw new ExportValidationError(report);
}

// ── Coordinate formatting (axis-aware) ──────────────────────────────

export type CoordAxis = 'lat' | 'lon' | 'alt' | 'local';

const PRECISION: Record<CoordAxis, number> = {
  lat: 8,    // ~1.1 mm at equator
  lon: 8,
  alt: 6,    // sub-mm
  local: 3,  // mm precision in metres
};

const COORD_RANGE: Record<CoordAxis, { min: number; max: number }> = {
  lat: { min: -90, max: 90 },
  lon: { min: -180, max: 180 },
  alt: { min: -500, max: 100_000 }, // -500m (Dead Sea-ish) → low Earth orbit guard
  local: { min: -1_000_000, max: 1_000_000 }, // 1000 km local sim cap
};

/**
 * Format a coordinate for VVIZ / firing-system output. Throws on NaN /
 * out-of-range so a corrupted upstream value never reaches a CSV row.
 */
export function formatVvizCoordinate(value: number, axis: CoordAxis): string {
  if (!Number.isFinite(value)) {
    throw new ExportValidationError(
      buildReport(
        [err([axis], VAL.COORD_NAN, `Coordinate "${axis}" is not finite (got ${String(value)})`)],
        `format ${axis}`,
      ),
    );
  }
  const { min, max } = COORD_RANGE[axis];
  if (value < min || value > max) {
    throw new ExportValidationError(
      buildReport(
        [err([axis], VAL.COORD_OUT_OF_RANGE, `Coordinate "${axis}" out of range [${min}, ${max}]: ${value}`)],
        `format ${axis}`,
      ),
    );
  }
  return value.toFixed(PRECISION[axis]);
}

/** Non-throwing variant — returns null on invalid input. */
export function tryFormatVvizCoordinate(value: number, axis: CoordAxis): string | null {
  try {
    return formatVvizCoordinate(value, axis);
  } catch {
    return null;
  }
}

// ── Zod schemas (re-exported for callers that want raw schema access) ──

export const geoOriginSchema = z.object({
  lat: z.number().finite().gte(-90).lte(90),
  lon: z.number().finite().gte(-180).lte(180),
  altMSL: z.number().finite(),
  heading: z.number().finite().gte(-360).lte(360),
  magneticDeclination: z.number().finite().optional(),
});

export const mavlinkWaypointSchema = z.object({
  seq: z.number().int().nonnegative(),
  frame: z.number().int().min(0).max(21),
  command: z.number().int().nonnegative(),
  current: z.number().int().min(0).max(1),
  autocontinue: z.number().int().min(0).max(1),
  param1: z.number().finite(),
  param2: z.number().finite(),
  param3: z.number().finite(),
  param4: z.number().finite(),
  lat: z.number().finite(),
  lng: z.number().finite(),
  alt: z.number().finite(),
});

// ── Validators ──────────────────────────────────────────────────────

/**
 * Validate the inputs to *every* firing-system exporter. Same set of
 * rules regardless of vendor — the per-vendor formatting layer should
 * never have to re-check semantic correctness.
 */
export function validateFiringExportInputs(
  items: ReadonlyArray<TimelineItem>,
  positions: ReadonlyArray<Position>,
): ValidationReport {
  const findings: ValidationFinding[] = [];

  if (items.length === 0) {
    findings.push(err(['items'], VAL.EMPTY_PAYLOAD, 'No timeline items to export.'));
  }

  const positionIds = new Set(positions.map((p) => p.id));
  const seenCueKeys = new Set<string>();

  items.forEach((item, idx) => {
    const path: (string | number)[] = ['items', idx];

    // Effect ID present
    if (!item.effectId || typeof item.effectId !== 'string') {
      findings.push(err([...path, 'effectId'], VAL.EFFECT_MISSING,
        `Cue ${idx} has no effectId.`, { row: idx, field: 'effectId' }));
    }

    // Time finite & non-negative
    if (!Number.isFinite(item.startTime)) {
      findings.push(err([...path, 'startTime'], VAL.TIME_NOT_FINITE,
        `Cue ${idx} startTime is not finite.`, { row: idx, field: 'startTime' }));
    } else if (item.startTime < 0) {
      findings.push(err([...path, 'startTime'], VAL.TIME_NEGATIVE,
        `Cue ${idx} startTime is negative (${item.startTime}).`, { row: idx, field: 'startTime' }));
    }

    // Local coords finite & in range
    const pos = item.position;
    if (!pos) {
      findings.push(err([...path, 'position'], VAL.COORD_NAN,
        `Cue ${idx} has no position.`, { row: idx, field: 'position' }));
    } else {
      (['x', 'y', 'z'] as const).forEach((axis) => {
        const v = pos[axis];
        if (!Number.isFinite(v)) {
          findings.push(err([...path, 'position', axis], VAL.COORD_NAN,
            `Cue ${idx} position.${axis} is not finite.`, { row: idx, field: `position.${axis}` }));
        } else if (Math.abs(v) > COORD_RANGE.local.max) {
          findings.push(err([...path, 'position', axis], VAL.COORD_OUT_OF_RANGE,
            `Cue ${idx} position.${axis}=${v} exceeds ±${COORD_RANGE.local.max}m local sim bound.`,
            { row: idx, field: `position.${axis}` }));
        }
      });
    }

    // Linked positionId must exist if provided
    if (item.positionId && !positionIds.has(item.positionId)) {
      findings.push(err([...path, 'positionId'], VAL.POSITION_MISSING,
        `Cue ${idx} references missing position "${item.positionId}".`,
        { row: idx, field: 'positionId' }));
    }

    // Duplicate cue detection (same effect + time + positionId)
    const key = `${item.effectId}|${item.startTime}|${item.positionId ?? '_'}`;
    if (seenCueKeys.has(key)) {
      findings.push(warn([...path], VAL.DUPLICATE_CUE,
        `Cue ${idx} duplicates an earlier cue at ${item.startTime}s.`,
        { row: idx }));
    } else {
      seenCueKeys.add(key);
    }
  });

  return buildReport(findings, `Firing export · ${items.length} cues`);
}

/**
 * Validate a MAVLink flight plan before download. Catches autopilot-
 * fatal mistakes: NaN coords, sequence gaps, unknown frame/command.
 */
export function validateMAVLinkPlan(plan: FlightPlan): ValidationReport {
  const findings: ValidationFinding[] = [];

  if (!plan || !Array.isArray(plan.waypoints) || plan.waypoints.length === 0) {
    findings.push(err(['waypoints'], VAL.EMPTY_PAYLOAD, 'Flight plan has no waypoints.'));
    return buildReport(findings, 'MAVLink plan');
  }

  const knownFrames = new Set([0, 3, 5, 6]);
  const knownCommands = new Set([16, 19, 20, 21, 22, 178]);

  let prevSeq = -1;
  plan.waypoints.forEach((wp, i) => {
    const path: (string | number)[] = ['waypoints', i];
    const parsed = mavlinkWaypointSchema.safeParse(wp);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        findings.push(err(
          [...path, ...issue.path.map(String)],
          VAL.COORD_NAN,
          `Waypoint ${i} ${issue.path.join('.')}: ${issue.message}`,
          { row: i, field: issue.path.join('.') },
        ));
      }
      return;
    }

    // Lat/Lon range — RTL waypoints carry zeros legitimately, allow them.
    const isRtl = wp.command === 20; // NAV_RETURN_TO_LAUNCH
    if (!isRtl) {
      if (wp.lat < -90 || wp.lat > 90) {
        findings.push(err([...path, 'lat'], VAL.COORD_OUT_OF_RANGE,
          `Waypoint ${i} lat=${wp.lat} out of [-90, 90].`, { row: i, field: 'lat' }));
      }
      if (wp.lng < -180 || wp.lng > 180) {
        findings.push(err([...path, 'lng'], VAL.COORD_OUT_OF_RANGE,
          `Waypoint ${i} lng=${wp.lng} out of [-180, 180].`, { row: i, field: 'lng' }));
      }
    }

    // Altitude
    if (wp.alt < -500) {
      findings.push(err([...path, 'alt'], VAL.ALT_BELOW_GROUND,
        `Waypoint ${i} alt=${wp.alt}m below sea-level guard (-500m).`, { row: i, field: 'alt' }));
    }
    if (wp.alt > 500) {
      findings.push(warn([...path, 'alt'], VAL.ALT_EXCESSIVE,
        `Waypoint ${i} alt=${wp.alt}m exceeds 500m AGL — confirm regulatory ceiling.`,
        { row: i, field: 'alt' }));
    }

    // Frame/command sanity
    if (!knownFrames.has(wp.frame)) {
      findings.push(warn([...path, 'frame'], VAL.FRAME_UNKNOWN,
        `Waypoint ${i} frame=${wp.frame} is not a recognised MAV_FRAME.`,
        { row: i, field: 'frame' }));
    }
    if (!knownCommands.has(wp.command)) {
      findings.push(warn([...path, 'command'], VAL.COMMAND_UNKNOWN,
        `Waypoint ${i} command=${wp.command} is not a recognised MAV_CMD.`,
        { row: i, field: 'command' }));
    }

    // Sequential seq numbers
    if (wp.seq !== prevSeq + 1) {
      findings.push(err([...path, 'seq'], VAL.SEQ_NOT_SEQUENTIAL,
        `Waypoint ${i} seq=${wp.seq} expected ${prevSeq + 1}.`,
        { row: i, field: 'seq' }));
    }
    prevSeq = wp.seq;
  });

  return buildReport(findings, `MAVLink plan · ${plan.waypoints.length} waypoints`);
}

/** Validate a GeoOrigin used for any local↔geo conversion. */
export function validateGeoOrigin(origin: GeoOrigin): ValidationReport {
  const parsed = geoOriginSchema.safeParse(origin);
  if (parsed.success) return buildReport([], 'GeoOrigin');
  const findings: ValidationFinding[] = parsed.error.issues.map((issue) =>
    err(['origin', ...issue.path.map(String)], VAL.COORD_OUT_OF_RANGE,
      `origin.${issue.path.join('.')}: ${issue.message}`,
      { field: issue.path.join('.') }),
  );
  return buildReport(findings, 'GeoOrigin');
}

/**
 * Validate a single VVIZ-bound cue (or waypoint). Used by the JSON/CSV
 * writer right before serialisation — the `path` carries the row index
 * so a panel can highlight the bad row.
 */
export interface VvizCueLike {
  time?: number;
  x?: number;
  y?: number;
  z?: number;
  lat?: number;
  lon?: number;
  alt?: number;
}
export function validateVvizCue(cue: VvizCueLike, row: number): ValidationFinding[] {
  const findings: ValidationFinding[] = [];
  if (cue.time !== undefined) {
    if (!Number.isFinite(cue.time)) {
      findings.push(err(['cues', row, 'time'], VAL.TIME_NOT_FINITE,
        `Cue ${row} time is not finite.`, { row, field: 'time' }));
    } else if (cue.time < 0) {
      findings.push(err(['cues', row, 'time'], VAL.TIME_NEGATIVE,
        `Cue ${row} time is negative.`, { row, field: 'time' }));
    }
  }
  (['x', 'y', 'z'] as const).forEach((axis) => {
    const v = cue[axis];
    if (v === undefined) return;
    if (!Number.isFinite(v)) {
      findings.push(err(['cues', row, axis], VAL.COORD_NAN,
        `Cue ${row} ${axis} is not finite.`, { row, field: axis }));
    } else if (Math.abs(v) > COORD_RANGE.local.max) {
      findings.push(err(['cues', row, axis], VAL.COORD_OUT_OF_RANGE,
        `Cue ${row} ${axis}=${v} exceeds local sim bound.`, { row, field: axis }));
    }
  });
  if (cue.lat !== undefined) {
    if (!Number.isFinite(cue.lat) || cue.lat < -90 || cue.lat > 90) {
      findings.push(err(['cues', row, 'lat'], VAL.COORD_OUT_OF_RANGE,
        `Cue ${row} lat invalid.`, { row, field: 'lat' }));
    }
  }
  if (cue.lon !== undefined) {
    if (!Number.isFinite(cue.lon) || cue.lon < -180 || cue.lon > 180) {
      findings.push(err(['cues', row, 'lon'], VAL.COORD_OUT_OF_RANGE,
        `Cue ${row} lon invalid.`, { row, field: 'lon' }));
    }
  }
  if (cue.alt !== undefined) {
    if (!Number.isFinite(cue.alt) || cue.alt < -500) {
      findings.push(err(['cues', row, 'alt'], VAL.ALT_BELOW_GROUND,
        `Cue ${row} alt invalid.`, { row, field: 'alt' }));
    }
  }
  return findings;
}

/** Convenience: validate a whole VVIZ-style array of cues. */
export function validateVvizCues(cues: ReadonlyArray<VvizCueLike>): ValidationReport {
  const findings: ValidationFinding[] = [];
  if (cues.length === 0) {
    findings.push(err(['cues'], VAL.EMPTY_PAYLOAD, 'No cues to export.'));
  }
  cues.forEach((c, i) => findings.push(...validateVvizCue(c, i)));
  return buildReport(findings, `VVIZ cues · ${cues.length}`);
}

/** Format a finding for compact toast/log usage. */
export function formatFinding(f: ValidationFinding): string {
  const where = f.row !== undefined ? ` (row ${f.row}${f.field ? `, ${f.field}` : ''})` : '';
  return `[${f.code}] ${f.message}${where}`;
}
