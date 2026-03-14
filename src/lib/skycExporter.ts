/**
 * ─── Skybrush .skyc Export Engine ───────────────────────────────────
 * Exports show data in Skybrush-compatible .skyc JSON format.
 * 
 * .skyc format is a JSON file containing:
 *   - version: Format version
 *   - settings: Show parameters (coordinate system, FPS)
 *   - environment: GPS origin, timezone
 *   - drones: Array of drone configs with trajectories and light programs
 *   - cues: Takeoff/landing/show cue timings
 *
 * Coordinate system: NEU (North-East-Up) by default,
 *   convertible to NED for MAVLink compatibility.
 */

import type { Position, Trajectory, DroneFormation } from '@/store/useProjectStore';

export interface SkycFile {
  version: number;
  settings: SkycSettings;
  environment: SkycEnvironment;
  drones: SkycDrone[];
  cues: SkycCues;
  meta: SkycMeta;
}

interface SkycSettings {
  coordinateSystem: 'neu' | 'ned' | 'enu';
  trajectoryFPS: number;
  lightFPS: number;
  showDuration: number; // seconds
  indoor: boolean;
}

interface SkycEnvironment {
  origin: { lat: number; lon: number; altMSL: number };
  timezone: string;
  magneticDeclination: number;
}

interface SkycDrone {
  id: string;
  name: string;
  home: { x: number; y: number; z: number };
  trajectory: SkycTrajectorySegment[];
  lightProgram: SkycLightSegment[];
  yawControl: SkycYawSegment[];
}

interface SkycTrajectorySegment {
  t: number; // time in seconds
  x: number;
  y: number;
  z: number;
  type: 'goto' | 'bezier' | 'hold';
  duration?: number;
  cp1?: { x: number; y: number; z: number }; // bezier control points
  cp2?: { x: number; y: number; z: number };
}

interface SkycLightSegment {
  t: number;
  r: number;
  g: number;
  b: number;
  w?: number;
  fade: 'instant' | 'linear' | 'ease';
}

interface SkycYawSegment {
  t: number;
  yaw: number; // degrees
  rate?: number; // deg/sec
}

interface SkycCues {
  takeoff: { time: number; staggerDelay: number; order: 'sequential' | 'center-out' | 'random' };
  landing: { time: number; staggerDelay: number };
  showStart: number;
  showEnd: number;
}

interface SkycMeta {
  name: string;
  author: string;
  createdAt: string;
  software: string;
  softwareVersion: string;
  droneCount: number;
  notes: string;
}

// ── Coordinate Conversion ───────────────────────────────────────────

function localToGPS(
  x: number, y: number, z: number,
  origin: { lat: number; lon: number },
  heading: number = 0,
): { lat: number; lon: number; alt: number } {
  const headingRad = heading * Math.PI / 180;
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);

  // Rotate to account for heading
  const north = x * cosH - z * sinH;
  const east = x * sinH + z * cosH;

  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(origin.lat * Math.PI / 180);

  return {
    lat: origin.lat + north / metersPerDegreeLat,
    lon: origin.lon + east / metersPerDegreeLon,
    alt: y,
  };
}

function convertCoordSystem(
  x: number, y: number, z: number,
  from: 'internal', // internal = X-right, Y-up, Z-into
  to: 'neu' | 'ned' | 'enu',
): { x: number; y: number; z: number } {
  switch (to) {
    case 'neu': return { x: -z, y: x, z: y }; // North=-Z, East=X, Up=Y
    case 'ned': return { x: -z, y: x, z: -y }; // North=-Z, East=X, Down=-Y
    case 'enu': return { x: x, y: -z, z: y }; // East=X, North=-Z, Up=Y
    default: return { x, y, z };
  }
}

// ── Trajectory Builder ──────────────────────────────────────────────

function buildTrajectory(
  trajectory: Trajectory,
  homePos: Position,
  coordSystem: 'neu' | 'ned' | 'enu',
  takeoffTime: number,
  takeoffHeight: number = 10,
): SkycTrajectorySegment[] {
  const segments: SkycTrajectorySegment[] = [];
  const home = convertCoordSystem(homePos.x, homePos.y, homePos.z, 'internal', coordSystem);

  // Start at home (ground)
  segments.push({
    t: 0,
    ...home,
    type: 'hold',
    duration: takeoffTime,
  });

  // Takeoff: climb to takeoff height
  const takeoffPos = convertCoordSystem(homePos.x, takeoffHeight, homePos.z, 'internal', coordSystem);
  segments.push({
    t: takeoffTime,
    ...takeoffPos,
    type: 'goto',
    duration: 5,
  });

  // Trajectory waypoints
  if (trajectory.waypoints.length > 0) {
    for (const wp of trajectory.waypoints) {
      const pos = convertCoordSystem(wp.position.x, wp.position.y, wp.position.z, 'internal', coordSystem);
      
      if (wp.controlIn && wp.controlOut) {
        const cp1 = convertCoordSystem(wp.controlIn.x, wp.controlIn.y, wp.controlIn.z, 'internal', coordSystem);
        const cp2 = convertCoordSystem(wp.controlOut.x, wp.controlOut.y, wp.controlOut.z, 'internal', coordSystem);
        segments.push({
          t: wp.time,
          ...pos,
          type: 'bezier',
          cp1,
          cp2,
        });
      } else {
        segments.push({
          t: wp.time,
          ...pos,
          type: 'goto',
        });
      }
    }
  }

  return segments;
}

// ── Light Program Builder ───────────────────────────────────────────

function buildLightProgram(
  formations: DroneFormation[],
  droneIndex: number,
): SkycLightSegment[] {
  const segments: SkycLightSegment[] = [];

  // Default: off at start
  segments.push({ t: 0, r: 0, g: 0, b: 0, fade: 'instant' });

  for (const formation of formations) {
    const color = hexToRGB(formation.color);
    const endColor = formation.endColor ? hexToRGB(formation.endColor) : color;

    // Light on at formation start
    segments.push({
      t: formation.startTime,
      ...color,
      fade: 'linear',
    });

    // Color transition if specified
    if (formation.endColor && formation.colorTransition !== 'instant') {
      segments.push({
        t: formation.startTime + formation.holdDuration * 0.5,
        ...endColor,
        fade: 'linear',
      });
    }

    // Light off between formations
    segments.push({
      t: formation.startTime + formation.holdDuration + formation.transitionDuration,
      r: 0, g: 0, b: 0,
      fade: 'linear',
    });
  }

  return segments;
}

function hexToRGB(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

// ── Main Export Function ────────────────────────────────────────────

export interface SkycExportOptions {
  projectName: string;
  positions: Position[];
  trajectories: Trajectory[];
  formations: DroneFormation[];
  duration: number;
  gpsOrigin: { lat: number; lng: number; heading: number; altitude: number };
  coordinateSystem?: 'neu' | 'ned' | 'enu';
  trajectoryFPS?: number;
  lightFPS?: number;
  indoor?: boolean;
  takeoffStaggerDelay?: number;
  takeoffHeight?: number;
  author?: string;
  notes?: string;
}

export function exportSkyc(options: SkycExportOptions): SkycFile {
  const coordSystem = options.coordinateSystem ?? 'neu';
  const dronePads = options.positions.filter(p => p.type === 'drone-pad');

  const drones: SkycDrone[] = dronePads.map((pos, i) => {
    const traj = options.trajectories.find(t => t.positionId === pos.id);
    const home = convertCoordSystem(pos.x, pos.y, pos.z, 'internal', coordSystem);

    return {
      id: pos.id,
      name: pos.name || `Drone ${i + 1}`,
      home,
      trajectory: traj
        ? buildTrajectory(traj, pos, coordSystem, 10, options.takeoffHeight ?? 10)
        : [{ t: 0, ...home, type: 'hold' as const, duration: options.duration }],
      lightProgram: buildLightProgram(options.formations, i),
      yawControl: [{ t: 0, yaw: pos.heading }],
    };
  });

  const takeoffTime = 10;
  const landingTime = options.duration - 10;

  return {
    version: 2,
    settings: {
      coordinateSystem: coordSystem,
      trajectoryFPS: options.trajectoryFPS ?? 4,
      lightFPS: options.lightFPS ?? 4,
      showDuration: options.duration,
      indoor: options.indoor ?? false,
    },
    environment: {
      origin: {
        lat: options.gpsOrigin.lat,
        lon: options.gpsOrigin.lng,
        altMSL: options.gpsOrigin.altitude,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      magneticDeclination: 0,
    },
    drones,
    cues: {
      takeoff: {
        time: takeoffTime,
        staggerDelay: options.takeoffStaggerDelay ?? 0.3,
        order: 'center-out',
      },
      landing: {
        time: landingTime,
        staggerDelay: 0.2,
      },
      showStart: takeoffTime + 8,
      showEnd: landingTime - 5,
    },
    meta: {
      name: options.projectName,
      author: options.author ?? 'AEROSWARM NEXUS',
      createdAt: new Date().toISOString(),
      software: 'AEROSWARM NEXUS | Zenith Prime',
      softwareVersion: '1.1.0',
      droneCount: drones.length,
      notes: options.notes ?? '',
    },
  };
}

// ── Download Helper ─────────────────────────────────────────────────

export function downloadSkycFile(skyc: SkycFile, filename?: string) {
  const json = JSON.stringify(skyc, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${skyc.meta.name.replace(/\s+/g, '_')}.skyc`;
  a.click();
  URL.revokeObjectURL(url);
}
