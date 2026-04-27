/**
 * Field-level export validation guarantees. Locks coordinate formatting,
 * MAVLink plan rules and firing-input checks so a regression cannot
 * produce a CSV/JSON/VVIZ payload with NaN or out-of-range coords.
 */
import { describe, it, expect } from 'vitest';
import {
  validateFiringExportInputs,
  validateMAVLinkPlan,
  validateGeoOrigin,
  validateVvizCues,
  formatVvizCoordinate,
  tryFormatVvizCoordinate,
  ExportValidationError,
  assertValid,
  VAL,
} from '../exportValidation';
import type { FlightPlan } from '@/lib/mavlinkFlightPlanExporter';

describe('formatVvizCoordinate', () => {
  it('formats lat/lon to 8 decimals', () => {
    expect(formatVvizCoordinate(-23.001234567, 'lat')).toBe('-23.00123457');
    expect(formatVvizCoordinate(-44.318, 'lon')).toBe('-44.31800000');
  });
  it('formats alt to 6 decimals, local to 3', () => {
    expect(formatVvizCoordinate(12.5, 'alt')).toBe('12.500000');
    expect(formatVvizCoordinate(12.5, 'local')).toBe('12.500');
  });
  it('throws on NaN/Infinity', () => {
    expect(() => formatVvizCoordinate(NaN, 'lat')).toThrow(ExportValidationError);
    expect(() => formatVvizCoordinate(Infinity, 'alt')).toThrow(ExportValidationError);
  });
  it('throws on out-of-range', () => {
    expect(() => formatVvizCoordinate(91, 'lat')).toThrow(ExportValidationError);
    expect(() => formatVvizCoordinate(-181, 'lon')).toThrow(ExportValidationError);
  });
  it('tryFormat returns null on bad input', () => {
    expect(tryFormatVvizCoordinate(NaN, 'lat')).toBeNull();
    expect(tryFormatVvizCoordinate(0, 'lat')).toBe('0.00000000');
  });
});

describe('validateFiringExportInputs', () => {
  const pos = { id: 'p1', name: 'A1', x: 0, y: 0, z: 0, type: 'pyro', heading: 0, pitch: 90 } as any;
  const okItem = { id: 'i1', effectId: 'shell-01', startTime: 1, position: { x: 0, y: 0, z: 0 } } as any;

  it('reports empty payload', () => {
    const r = validateFiringExportInputs([], []);
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe(VAL.EMPTY_PAYLOAD);
  });
  it('flags NaN coords with row+field', () => {
    const r = validateFiringExportInputs([{ ...okItem, position: { x: NaN, y: 0, z: 0 } }], [pos]);
    expect(r.ok).toBe(false);
    const f = r.errors.find((e) => e.code === VAL.COORD_NAN);
    expect(f?.row).toBe(0);
    expect(f?.field).toBe('position.x');
  });
  it('flags negative time', () => {
    const r = validateFiringExportInputs([{ ...okItem, startTime: -1 }], [pos]);
    expect(r.errors.some((e) => e.code === VAL.TIME_NEGATIVE)).toBe(true);
  });
  it('flags missing positionId reference', () => {
    const r = validateFiringExportInputs([{ ...okItem, positionId: 'ghost' }], [pos]);
    expect(r.errors.some((e) => e.code === VAL.POSITION_MISSING)).toBe(true);
  });
  it('warns on duplicate cue but does not fail', () => {
    const r = validateFiringExportInputs([okItem, { ...okItem, id: 'i2' }], [pos]);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === VAL.DUPLICATE_CUE)).toBe(true);
  });
});

function buildPlan(overrides?: Partial<FlightPlan>): FlightPlan {
  return {
    droneId: 'd1', droneName: 'Drone 1',
    homePosition: { lat: -23, lon: -44, alt: 0 },
    estimatedDuration: 10, totalDistance: 50, maxAltitude: 30,
    waypoints: [
      { seq: 0, frame: 0, command: 16, current: 1, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0, lat: -23, lng: -44, alt: 0 },
      { seq: 1, frame: 3, command: 22, current: 0, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0, lat: -23, lng: -44, alt: 10 },
    ],
    ...overrides,
  };
}

describe('validateMAVLinkPlan', () => {
  it('passes a valid plan', () => {
    expect(validateMAVLinkPlan(buildPlan()).ok).toBe(true);
  });
  it('catches lat out of range', () => {
    const p = buildPlan();
    p.waypoints[1].lat = 200;
    const r = validateMAVLinkPlan(p);
    expect(r.ok).toBe(false);
    expect(r.errors[0].code).toBe(VAL.COORD_OUT_OF_RANGE);
    expect(r.errors[0].field).toBe('lat');
  });
  it('catches non-sequential seq', () => {
    const p = buildPlan();
    p.waypoints[1].seq = 5;
    const r = validateMAVLinkPlan(p);
    expect(r.errors.some((e) => e.code === VAL.SEQ_NOT_SEQUENTIAL)).toBe(true);
  });
  it('warns on excessive altitude but stays valid', () => {
    const p = buildPlan();
    p.waypoints[1].alt = 800;
    const r = validateMAVLinkPlan(p);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === VAL.ALT_EXCESSIVE)).toBe(true);
  });
  it('rejects empty plan', () => {
    expect(validateMAVLinkPlan(buildPlan({ waypoints: [] })).ok).toBe(false);
  });
});

describe('validateGeoOrigin', () => {
  it('accepts a sane origin', () => {
    expect(validateGeoOrigin({ lat: -23, lon: -44, altMSL: 0, heading: 0 } as any).ok).toBe(true);
  });
  it('rejects out-of-range lat', () => {
    expect(validateGeoOrigin({ lat: 100, lon: 0, altMSL: 0, heading: 0 } as any).ok).toBe(false);
  });
});

describe('validateVvizCues', () => {
  it('passes clean cues', () => {
    expect(validateVvizCues([{ time: 0, x: 1, y: 2, z: 3 }]).ok).toBe(true);
  });
  it('flags bad lat per row with path', () => {
    const r = validateVvizCues([{ time: 0, lat: 200 }]);
    expect(r.errors[0].path).toEqual(['cues', 0, 'lat']);
  });
});

describe('assertValid', () => {
  it('throws ExportValidationError carrying the report', () => {
    const r = validateFiringExportInputs([], []);
    try { assertValid(r); throw new Error('did not throw'); }
    catch (e) {
      expect(e).toBeInstanceOf(ExportValidationError);
      expect((e as ExportValidationError).report.ok).toBe(false);
    }
  });
});
