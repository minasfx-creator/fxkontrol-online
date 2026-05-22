/**
 * ─── MAVLink Flight Plan Exporter ───────────────────────────────────
 * Converts local XYZ simulation waypoints to MAVLink-compatible
 * Lat/Lon/Alt flight plans for ArduPilot and DJI controllers.
 *
 * Output format: QGroundControl WPL 110 (.waypoints) file
 */

import { localToGeo } from './skybrushCoordinates';
import type { GeoOrigin, GeoPosition, LocalPosition } from './skybrushCoordinates';

// ── MAVLink Constants ───────────────────────────────────────────────

export const MAV_CMD = {
  NAV_WAYPOINT: 16,
  NAV_TAKEOFF: 22,
  NAV_LAND: 21,
  NAV_RETURN_TO_LAUNCH: 20,
  NAV_LOITER_TIME: 19,
  DO_SET_SPEED: 178,
} as const;

export const MAV_FRAME = {
  GLOBAL: 0,
  GLOBAL_RELATIVE_ALT: 3,
  GLOBAL_INT: 5,
  GLOBAL_RELATIVE_ALT_INT: 6,
} as const;

// ── Types ───────────────────────────────────────────────────────────

export interface MAVLinkWaypoint {
  seq: number;
  frame: number;
  command: number;
  current: number;
  autocontinue: number;
  param1: number; // hold time (seconds)
  param2: number; // acceptance radius (meters)
  param3: number; // pass through (0=stop, >0=radius)
  param4: number; // yaw angle (degrees)
  lat: number;
  lng: number;
  alt: number;    // relative altitude (meters)
}

export interface FlightPlanConfig {
  origin: GeoOrigin;
  takeoffAltitude: number;      // meters AGL (default 10)
  acceptanceRadius: number;     // meters (default 1.0)
  holdTime: number;             // seconds at each waypoint (default 0)
  maxSpeed: number;             // m/s (default 5)
  returnToLaunch: boolean;      // append RTL at end (default true)
  droneId: string;
  droneName: string;
}

export interface FlightPlan {
  droneId: string;
  droneName: string;
  waypoints: MAVLinkWaypoint[];
  homePosition: GeoPosition;
  estimatedDuration: number;    // seconds
  totalDistance: number;         // meters
  maxAltitude: number;          // meters AGL
}

// ── Default Config ──────────────────────────────────────────────────

export const DEFAULT_FLIGHT_CONFIG: FlightPlanConfig = {
  origin: {
    lat: -23.007,
    lon: -44.318,
    altMSL: 0,
    heading: 0,
    magneticDeclination: -22.5, // Angra dos Reis approximate
  },
  takeoffAltitude: 10,
  acceptanceRadius: 1.0,
  holdTime: 0,
  maxSpeed: 5,
  returnToLaunch: true,
  droneId: 'drone-1',
  droneName: 'Drone 1',
};

// ── Core Export Function ────────────────────────────────────────────

/**
 * Convert local simulation waypoints to a MAVLink flight plan.
 * Local coordinates use NEU convention (X=North, Y=East, Z=Up).
 */
export function exportFlightPlan(
  localWaypoints: LocalPosition[],
  config: Partial<FlightPlanConfig> = {},
): FlightPlan {
  const cfg = { ...DEFAULT_FLIGHT_CONFIG, ...config };
  const waypoints: MAVLinkWaypoint[] = [];

  // Home position (seq 0)
  const homeGeo = localToGeo({ x: 0, y: 0, z: 0 }, cfg.origin);
  waypoints.push({
    seq: 0,
    frame: MAV_FRAME.GLOBAL,
    command: MAV_CMD.NAV_WAYPOINT,
    current: 1,
    autocontinue: 1,
    param1: 0, param2: 0, param3: 0, param4: 0,
    lat: homeGeo.lat,
    lng: homeGeo.lon,
    alt: homeGeo.alt,
  });

  // Takeoff (seq 1)
  waypoints.push({
    seq: 1,
    frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
    command: MAV_CMD.NAV_TAKEOFF,
    current: 0,
    autocontinue: 1,
    param1: 0, param2: 0, param3: 0, param4: 0,
    lat: homeGeo.lat,
    lng: homeGeo.lon,
    alt: cfg.takeoffAltitude,
  });

  // Navigation waypoints
  let totalDistance = 0;
  let maxAlt = cfg.takeoffAltitude;
  let prevGeo = homeGeo;

  for (let i = 0; i < localWaypoints.length; i++) {
    const local = localWaypoints[i];
    const geo = localToGeo(local, cfg.origin);
    const altRel = local.z; // Z is Up in NEU

    // Distance calculation
    const dLat = (geo.lat - prevGeo.lat) * 111320;
    const dLon = (geo.lon - prevGeo.lon) * 111320 * Math.cos(geo.lat * Math.PI / 180);
    const dAlt = altRel - (prevGeo.alt - cfg.origin.altMSL);
    totalDistance += Math.sqrt(dLat * dLat + dLon * dLon + dAlt * dAlt);

    if (altRel > maxAlt) maxAlt = altRel;

    waypoints.push({
      seq: i + 2,
      frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
      command: MAV_CMD.NAV_WAYPOINT,
      current: 0,
      autocontinue: 1,
      param1: cfg.holdTime,
      param2: cfg.acceptanceRadius,
      param3: 0,
      param4: 0,
      lat: geo.lat,
      lng: geo.lon,
      alt: altRel,
    });

    prevGeo = geo;
  }

  // Return to launch
  if (cfg.returnToLaunch) {
    waypoints.push({
      seq: waypoints.length,
      frame: MAV_FRAME.GLOBAL_RELATIVE_ALT,
      command: MAV_CMD.NAV_RETURN_TO_LAUNCH,
      current: 0,
      autocontinue: 0,
      param1: 0, param2: 0, param3: 0, param4: 0,
      lat: 0, lng: 0, alt: 0,
    });
  }

  const estimatedDuration = cfg.maxSpeed > 0
    ? totalDistance / cfg.maxSpeed
    : totalDistance / 5;

  return {
    droneId: cfg.droneId,
    droneName: cfg.droneName,
    waypoints,
    homePosition: homeGeo,
    estimatedDuration,
    totalDistance,
    maxAltitude: maxAlt,
  };
}

// ── File Formatters ─────────────────────────────────────────────────

/**
 * Format flight plan as QGroundControl WPL 110 text.
 * Compatible with ArduPilot Mission Planner and QGC.
 */
export function toWaypointFileFormat(plan: FlightPlan): string {
  const lines = ['QGC WPL 110'];

  for (const wp of plan.waypoints) {
    lines.push([
      wp.seq,
      wp.current,
      wp.frame,
      wp.command,
      wp.param1.toFixed(6),
      wp.param2.toFixed(6),
      wp.param3.toFixed(6),
      wp.param4.toFixed(6),
      wp.lat.toFixed(8),
      wp.lng.toFixed(8),
      wp.alt.toFixed(6),
      wp.autocontinue,
    ].join('\t'));
  }

  return lines.join('\n');
}

/**
 * Format flight plan as JSON (DJI-compatible structure).
 */
export function toJSONFormat(plan: FlightPlan): string {
  return JSON.stringify({
    version: '1.0',
    generator: 'FX Kontrol Mission Planner',
    droneId: plan.droneId,
    droneName: plan.droneName,
    home: {
      lat: plan.homePosition.lat,
      lon: plan.homePosition.lon,
      alt: plan.homePosition.alt,
    },
    stats: {
      totalDistance: Math.round(plan.totalDistance),
      estimatedDuration: Math.round(plan.estimatedDuration),
      maxAltitude: Math.round(plan.maxAltitude),
      waypointCount: plan.waypoints.length,
    },
    waypoints: plan.waypoints.map(wp => ({
      seq: wp.seq,
      command: wp.command,
      frame: wp.frame,
      lat: wp.lat,
      lng: wp.lng,
      alt: wp.alt,
      holdTime: wp.param1,
      acceptanceRadius: wp.param2,
    })),
  }, null, 2);
}

/**
 * Trigger browser download of flight plan file.
 */
export function downloadFlightPlan(
  plan: FlightPlan,
  format: 'waypoints' | 'json' = 'waypoints',
): void {
  const content = format === 'waypoints'
    ? toWaypointFileFormat(plan)
    : toJSONFormat(plan);

  const ext = format === 'waypoints' ? 'waypoints' : 'json';
  const mime = format === 'waypoints' ? 'text/plain' : 'application/json';
  const filename = `${plan.droneName.replace(/\s+/g, '_')}_mission.${ext}`;

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
