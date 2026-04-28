/**
 * useTelemetryData — Shared telemetry data layer
 * 
 * Single source of truth for operational telemetry consumed by both:
 * - TelemetryBar (compact viewport strip)
 * - TelemetryDashboard (expanded drone fleet panel)
 * 
 * Provides location, altitude, FPS, and tile data at 4Hz without
 * causing re-render storms (module-level singleton pattern).
 */
import { useState, useEffect } from 'react';

export interface TelemetryData {
  fps: number;
  lat: number;
  lng: number;
  altMSL: number;
  locationName: string;
  tilesLoaded: number;
  drawCalls: number;
  triangles: number;
}

const DEFAULT_TELEMETRY: TelemetryData = {
  fps: 60,
  lat: -23.007,
  lng: -44.318,
  altMSL: 0,
  locationName: '',
  tilesLoaded: 0,
  drawCalls: 0,
  triangles: 0,
};

// Module-level singleton — written from render loop, read by React at 4Hz
const _telemetry: TelemetryData = { ...DEFAULT_TELEMETRY };

/** Called externally (from R3F render loop or scene manager) to push data */
export function updateTelemetry(data: Partial<TelemetryData>) {
  Object.assign(_telemetry, data);
}

/** Returns current telemetry snapshot (non-reactive, for imperative use) */
export function getTelemetrySnapshot(): Readonly<TelemetryData> {
  return _telemetry;
}

/**
 * React hook — returns live TelemetryData updated at ~4Hz.
 * Lightweight: only setInterval, no RAF (telemetry is written externally).
 */
export function useTelemetryData(pollMs = 250): TelemetryData {
  const [snapshot, setSnapshot] = useState<TelemetryData>(() => ({ ..._telemetry }));

  useEffect(() => {
    const id = setInterval(() => {
      setSnapshot({ ..._telemetry });
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  return snapshot;
}
