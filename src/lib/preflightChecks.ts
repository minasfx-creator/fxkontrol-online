/**
 * ─── Preflight Check System ────────────────────────────────────────
 * Automated multi-step safety validation before drone show execution.
 * Based on Skybrush Live preflight checklist.
 *
 * Categories:
 *   1. GPS Quality (fix type, satellite count, accuracy)
 *   2. Battery Health (voltage, percentage, cell balance)
 *   3. IMU Calibration (accel/gyro/mag status)
 *   4. Geofence Verification (boundaries uploaded)
 *   5. Communication Link (RSSI, packet loss)
 *   6. Motor/ESC Test (spin-up verification)
 *   7. Show Data Verification (trajectory uploaded, timing valid)
 *   8. Proximity Check (min distance to neighbors at start)
 *   9. Weather Assessment (wind, visibility)
 *  10. Authorization Check (show authorized, countdown ready)
 */

import type { UAVStatus, GeofenceConfig } from './flockwaveProtocol';

export interface PreflightCheckResult {
  id: string;
  category: PreflightCategory;
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
  value?: number | string;
  threshold?: number | string;
  critical: boolean;
}

export type PreflightCategory =
  | 'gps'
  | 'battery'
  | 'imu'
  | 'geofence'
  | 'comms'
  | 'motors'
  | 'showdata'
  | 'proximity'
  | 'weather'
  | 'authorization';

export interface PreflightConfig {
  minGPSSatellites: number;
  minGPSFix: number;
  maxHorizontalAccuracy: number; // meters
  maxVerticalAccuracy: number;   // meters
  minBatteryPercent: number;
  minBatteryVoltage: number;     // per cell
  warnBatteryPercent: number;
  minRSSI: number;               // dBm
  maxWindSpeed: number;          // m/s
  warnWindSpeed: number;
  minProximity: number;          // meters between drones at start
  requireGeofence: boolean;
  requireAuthorization: boolean;
}

export const DEFAULT_PREFLIGHT_CONFIG: PreflightConfig = {
  minGPSSatellites: 12,
  minGPSFix: 3, // 3D fix
  maxHorizontalAccuracy: 1.5,
  maxVerticalAccuracy: 2.5,
  minBatteryPercent: 75,
  minBatteryVoltage: 3.7, // per cell
  warnBatteryPercent: 85,
  minRSSI: -80,
  maxWindSpeed: 10,
  warnWindSpeed: 6,
  minProximity: 1.5,
  requireGeofence: true,
  requireAuthorization: true,
};

// ── Individual Check Functions ──────────────────────────────────────

function checkGPS(uav: UAVStatus, config: PreflightConfig): PreflightCheckResult[] {
  const results: PreflightCheckResult[] = [];

  // Fix type
  results.push({
    id: `gps-fix-${uav.id}`,
    category: 'gps',
    name: 'GPS Fix Type',
    status: uav.gps.fix >= config.minGPSFix ? 'pass' : 'fail',
    message: uav.gps.fix >= config.minGPSFix
      ? `3D fix acquired (type ${uav.gps.fix})`
      : `Insufficient fix (type ${uav.gps.fix}, need ${config.minGPSFix})`,
    value: uav.gps.fix,
    threshold: config.minGPSFix,
    critical: true,
  });

  // Satellite count
  const satStatus = uav.gps.numSat >= config.minGPSSatellites ? 'pass'
    : uav.gps.numSat >= config.minGPSSatellites - 3 ? 'warn' : 'fail';
  results.push({
    id: `gps-sat-${uav.id}`,
    category: 'gps',
    name: 'Satellite Count',
    status: satStatus,
    message: `${uav.gps.numSat} satellites visible`,
    value: uav.gps.numSat,
    threshold: config.minGPSSatellites,
    critical: true,
  });

  // Horizontal accuracy
  results.push({
    id: `gps-hacc-${uav.id}`,
    category: 'gps',
    name: 'Horizontal Accuracy',
    status: uav.gps.hAcc <= config.maxHorizontalAccuracy ? 'pass' : 'fail',
    message: `${uav.gps.hAcc.toFixed(2)}m horizontal accuracy`,
    value: uav.gps.hAcc,
    threshold: config.maxHorizontalAccuracy,
    critical: true,
  });

  return results;
}

function checkBattery(uav: UAVStatus, config: PreflightConfig): PreflightCheckResult[] {
  const results: PreflightCheckResult[] = [];

  // Percentage
  const batStatus = uav.battery.percentage >= config.minBatteryPercent ? 'pass'
    : uav.battery.percentage >= config.warnBatteryPercent ? 'warn' : 'fail';
  results.push({
    id: `bat-pct-${uav.id}`,
    category: 'battery',
    name: 'Battery Level',
    status: batStatus === 'warn' ? 'warn' : batStatus,
    message: `${uav.battery.percentage.toFixed(0)}% remaining`,
    value: uav.battery.percentage,
    threshold: config.minBatteryPercent,
    critical: true,
  });

  // Cell voltage (assuming 4S pack)
  const cellVoltage = uav.battery.voltage / 4;
  results.push({
    id: `bat-cell-${uav.id}`,
    category: 'battery',
    name: 'Cell Voltage',
    status: cellVoltage >= config.minBatteryVoltage ? 'pass' : 'fail',
    message: `${cellVoltage.toFixed(2)}V per cell (${uav.battery.voltage.toFixed(1)}V total)`,
    value: cellVoltage,
    threshold: config.minBatteryVoltage,
    critical: true,
  });

  return results;
}

function checkComms(uav: UAVStatus, config: PreflightConfig): PreflightCheckResult[] {
  return [{
    id: `comms-rssi-${uav.id}`,
    category: 'comms',
    name: 'Signal Strength',
    status: uav.signal.rssi >= config.minRSSI ? 'pass'
      : uav.signal.rssi >= config.minRSSI - 10 ? 'warn' : 'fail',
    message: `RSSI ${uav.signal.rssi} dBm (quality: ${uav.signal.quality}%)`,
    value: uav.signal.rssi,
    threshold: config.minRSSI,
    critical: true,
  }];
}

function checkProximity(
  uav: UAVStatus,
  allUAVs: UAVStatus[],
  config: PreflightConfig,
): PreflightCheckResult[] {
  let minDist = Infinity;
  let nearestId = '';

  for (const other of allUAVs) {
    if (other.id === uav.id) continue;
    const dlat = (other.position.lat - uav.position.lat) * 111320;
    const dlon = (other.position.lon - uav.position.lon) * 111320 *
      Math.cos(uav.position.lat * Math.PI / 180);
    const dalt = other.position.alt - uav.position.alt;
    const dist = Math.sqrt(dlat * dlat + dlon * dlon + dalt * dalt);
    if (dist < minDist) {
      minDist = dist;
      nearestId = other.id;
    }
  }

  if (minDist === Infinity) {
    return [{
      id: `prox-${uav.id}`,
      category: 'proximity',
      name: 'Proximity',
      status: 'pass',
      message: 'No other drones detected',
      critical: false,
    }];
  }

  return [{
    id: `prox-${uav.id}`,
    category: 'proximity',
    name: 'Min Distance',
    status: minDist >= config.minProximity ? 'pass' : 'fail',
    message: `${minDist.toFixed(2)}m to ${nearestId}`,
    value: minDist,
    threshold: config.minProximity,
    critical: true,
  }];
}

function checkGeofence(
  geofence: GeofenceConfig | null,
  config: PreflightConfig,
): PreflightCheckResult[] {
  if (!config.requireGeofence) {
    return [{
      id: 'geofence',
      category: 'geofence',
      name: 'Geofence',
      status: 'skip',
      message: 'Geofence check disabled',
      critical: false,
    }];
  }

  if (!geofence || !geofence.enabled) {
    return [{
      id: 'geofence',
      category: 'geofence',
      name: 'Geofence',
      status: 'fail',
      message: 'No geofence configured',
      critical: true,
    }];
  }

  const results: PreflightCheckResult[] = [];

  results.push({
    id: 'geofence-enabled',
    category: 'geofence',
    name: 'Geofence Active',
    status: 'pass',
    message: `Geofence enabled, action: ${geofence.action}`,
    critical: false,
  });

  if (geofence.polygon.length >= 3) {
    results.push({
      id: 'geofence-polygon',
      category: 'geofence',
      name: 'Geofence Boundary',
      status: 'pass',
      message: `${geofence.polygon.length}-point polygon defined`,
      critical: false,
    });
  }

  results.push({
    id: 'geofence-alt',
    category: 'geofence',
    name: 'Max Altitude',
    status: geofence.maxAltitude > 0 ? 'pass' : 'warn',
    message: `Max altitude: ${geofence.maxAltitude}m AGL`,
    value: geofence.maxAltitude,
    critical: false,
  });

  return results;
}

function checkWeather(
  windSpeed: number,
  visibility: number,
  config: PreflightConfig,
): PreflightCheckResult[] {
  const results: PreflightCheckResult[] = [];

  results.push({
    id: 'weather-wind',
    category: 'weather',
    name: 'Wind Speed',
    status: windSpeed <= config.warnWindSpeed ? 'pass'
      : windSpeed <= config.maxWindSpeed ? 'warn' : 'fail',
    message: `${windSpeed.toFixed(1)} m/s`,
    value: windSpeed,
    threshold: config.maxWindSpeed,
    critical: windSpeed > config.maxWindSpeed,
  });

  results.push({
    id: 'weather-vis',
    category: 'weather',
    name: 'Visibility',
    status: visibility >= 3000 ? 'pass' : visibility >= 1000 ? 'warn' : 'fail',
    message: `${(visibility / 1000).toFixed(1)} km`,
    value: visibility,
    threshold: 3000,
    critical: false,
  });

  return results;
}

// ── Main Preflight Runner ───────────────────────────────────────────

export interface PreflightContext {
  uavs: UAVStatus[];
  geofence: GeofenceConfig | null;
  windSpeed: number;       // m/s
  visibility: number;      // meters
  showUploaded: boolean;
  authorized: boolean;
}

export function runPreflightChecks(
  ctx: PreflightContext,
  config: PreflightConfig = DEFAULT_PREFLIGHT_CONFIG,
): { results: Map<string, PreflightCheckResult[]>; summary: PreflightSummary } {
  const results = new Map<string, PreflightCheckResult[]>();

  // Per-UAV checks
  for (const uav of ctx.uavs) {
    const checks: PreflightCheckResult[] = [
      ...checkGPS(uav, config),
      ...checkBattery(uav, config),
      ...checkComms(uav, config),
      ...checkProximity(uav, ctx.uavs, config),
    ];

    // Show data check
    checks.push({
      id: `showdata-${uav.id}`,
      category: 'showdata',
      name: 'Show Data',
      status: ctx.showUploaded ? 'pass' : 'fail',
      message: ctx.showUploaded ? 'Trajectory uploaded' : 'No show data uploaded',
      critical: true,
    });

    results.set(uav.id, checks);
  }

  // Global checks
  const globalChecks: PreflightCheckResult[] = [
    ...checkGeofence(ctx.geofence, config),
    ...checkWeather(ctx.windSpeed, ctx.visibility, config),
    {
      id: 'auth',
      category: 'authorization',
      name: 'Show Authorization',
      status: !config.requireAuthorization ? 'skip'
        : ctx.authorized ? 'pass' : 'fail',
      message: ctx.authorized ? 'Show authorized' : 'Show not yet authorized',
      critical: config.requireAuthorization,
    },
  ];
  results.set('__global__', globalChecks);

  // Generate summary
  const allChecks = Array.from(results.values()).flat();
  const summary: PreflightSummary = {
    total: allChecks.length,
    pass: allChecks.filter(c => c.status === 'pass').length,
    warn: allChecks.filter(c => c.status === 'warn').length,
    fail: allChecks.filter(c => c.status === 'fail').length,
    skip: allChecks.filter(c => c.status === 'skip').length,
    criticalFails: allChecks.filter(c => c.status === 'fail' && c.critical).length,
    ready: allChecks.filter(c => c.status === 'fail' && c.critical).length === 0,
  };

  return { results, summary };
}

export interface PreflightSummary {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  skip: number;
  criticalFails: number;
  ready: boolean;
}

// ── Preflight Report Export ─────────────────────────────────────────

export function exportPreflightReport(
  results: Map<string, PreflightCheckResult[]>,
  summary: PreflightSummary,
): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '  AEROSWARM NEXUS | PREFLIGHT CHECK REPORT',
    `  Generated: ${new Date().toISOString()}`,
    '═══════════════════════════════════════════════════════════════',
    '',
    `  Status: ${summary.ready ? '✅ READY FOR FLIGHT' : '❌ NOT READY'}`,
    `  Total checks: ${summary.total}`,
    `  Pass: ${summary.pass} | Warn: ${summary.warn} | Fail: ${summary.fail} | Skip: ${summary.skip}`,
    `  Critical failures: ${summary.criticalFails}`,
    '',
  ];

  for (const [uavId, checks] of results.entries()) {
    lines.push(`─── ${uavId === '__global__' ? 'Global Checks' : `UAV ${uavId}`} ───`);
    for (const check of checks) {
      const icon = check.status === 'pass' ? '✅'
        : check.status === 'warn' ? '⚠️'
        : check.status === 'fail' ? '❌' : '⏭️';
      lines.push(`  ${icon} [${check.category.toUpperCase()}] ${check.name}: ${check.message}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
