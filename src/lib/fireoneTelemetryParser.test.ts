/**
 * Pure unit tests for the telemetry parser.
 * No Vite/React/DOM dependencies.
 */
import { describe, it, expect } from 'vitest';
import { parseTelemetryLine, mergeTelemetry } from './fireoneTelemetryParser';

describe('parseTelemetryLine', () => {
  it('parses canonical STATUS BAT;RSSI', () => {
    const r = parseTelemetryLine('STATUS BAT:87;RSSI:-64');
    expect(r.batteryPercent).toBe(87);
    expect(r.rssi).toBe(-64);
  });

  it('tolerates units (%, dBm)', () => {
    const r = parseTelemetryLine('STATUS BAT:87%;RSSI:-64dBm');
    expect(r.batteryPercent).toBe(87);
    expect(r.rssi).toBe(-64);
  });

  it('tolerates extra spaces and STATUS;BAT separator', () => {
    const r = parseTelemetryLine('STATUS;BAT:87; RSSI:-64');
    expect(r.batteryPercent).toBe(87);
    expect(r.rssi).toBe(-64);
  });

  it('parses without STATUS prefix', () => {
    const r = parseTelemetryLine('BAT:87;RSSI:-64');
    expect(r.batteryPercent).toBe(87);
    expect(r.rssi).toBe(-64);
  });

  it('parses RSSI alone (BAT missing)', () => {
    const r = parseTelemetryLine('STATUS RSSI:-70');
    expect(r.rssi).toBe(-70);
    expect(r.batteryPercent).toBeUndefined();
    expect(r.batteryVoltage).toBeUndefined();
  });

  it('parses BAT alone (RSSI missing)', () => {
    const r = parseTelemetryLine('STATUS BAT:91');
    expect(r.batteryPercent).toBe(91);
    expect(r.rssi).toBeUndefined();
  });

  it('ignores invalid BAT but keeps valid RSSI', () => {
    const r = parseTelemetryLine('STATUS BAT:bad;RSSI:-64');
    expect(r.batteryPercent).toBeUndefined();
    expect(r.batteryVoltage).toBeUndefined();
    expect(r.rssi).toBe(-64);
  });

  it('treats voltage-range value as volts', () => {
    const r = parseTelemetryLine('BAT:3.7;RSSI:-50');
    expect(r.batteryVoltage).toBeCloseTo(3.7);
    expect(r.batteryPercent).toBeUndefined();
  });

  it('parses PINS mask in decimal and hex', () => {
    expect(parseTelemetryLine('PINS:255').pinsMask).toBe(255);
    expect(parseTelemetryLine('PINS:0xFF').pinsMask).toBe(255);
  });

  it('returns empty object for empty/garbage input', () => {
    expect(parseTelemetryLine('')).toEqual({});
    expect(parseTelemetryLine('   ')).toEqual({});
    expect(parseTelemetryLine('STATUS')).toEqual({});
  });

  it('does not throw on non-string input', () => {
    // @ts-expect-error testing runtime safety
    expect(parseTelemetryLine(null)).toEqual({});
    // @ts-expect-error
    expect(parseTelemetryLine(undefined)).toEqual({});
  });

  it('captures unknown tokens for diagnostics', () => {
    const r = parseTelemetryLine('STATUS BAT:87;FOO:bar;RSSI:-64');
    expect(r.batteryPercent).toBe(87);
    expect(r.rssi).toBe(-64);
    expect(r.unknown).toContain('FOO:bar');
  });

  it('parses VER token', () => {
    const r = parseTelemetryLine('VER:1.2.3');
    expect(r.firmwareVersion).toBe('1.2.3');
  });
});

describe('mergeTelemetry', () => {
  it('keeps previous valid value when next is undefined', () => {
    const prev = { batteryPercent: 90, rssi: -50 };
    const next = parseTelemetryLine('STATUS RSSI:-60'); // BAT missing
    const merged = mergeTelemetry(prev, next);
    expect(merged.batteryPercent).toBe(90); // preserved
    expect(merged.rssi).toBe(-60);          // updated
  });

  it('does not erase on invalid token', () => {
    const prev = { batteryPercent: 90, rssi: -50 };
    const next = parseTelemetryLine('STATUS BAT:bad;RSSI:-60');
    const merged = mergeTelemetry(prev, next);
    expect(merged.batteryPercent).toBe(90); // invalid BAT ignored
    expect(merged.rssi).toBe(-60);
  });
});
