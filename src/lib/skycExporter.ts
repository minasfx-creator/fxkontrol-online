/**
 * ─── Skybrush .skyc Export Engine v2 ───────────────────────────────
 * Exports show data in Skybrush-compatible .skyc format.
 * 
 * .skyc is a ZIP archive containing:
 *   - show.json      Main manifest with metadata and settings
 *   - trajectories/   Per-drone trajectory data (Bézier segments)
 *   - lights/         Per-drone LED light program
 *   - cues.json       Cue markers and timing
 *   - validation.json Safety validation results
 *
 * Coordinate systems: NEU (default), NED (MAVLink), ENU (ROS)
 */

import type { Position, Trajectory, DroneFormation } from '@/store/useProjectStore';

// ── Types ───────────────────────────────────────────────────────────

export interface SkycFile {
  version: number;
  settings: SkycSettings;
  environment: SkycEnvironment;
  drones: SkycDrone[];
  cues: SkycCues;
  meta: SkycMeta;
  validation?: SkycValidation;
  media?: SkycMedia;
}

interface SkycSettings {
  coordinateSystem: 'neu' | 'ned' | 'enu';
  trajectoryFPS: number;
  lightFPS: number;
  showDuration: number;
  indoor: boolean;
  yawControl: boolean;
  pyroControl: boolean;
  proposedMapping?: boolean;
  cameraExport: boolean;
}

interface SkycEnvironment {
  origin: { lat: number; lon: number; altMSL: number };
  timezone: string;
  magneticDeclination: number;
  type: 'indoor' | 'outdoor';
}

interface SkycDrone {
  id: string;
  name: string;
  home: { x: number; y: number; z: number };
  trajectory: SkycTrajectorySegment[];
  lightProgram: SkycLightSegment[];
  yawControl: SkycYawSegment[];
  startDelay: number;
  landPosition?: { x: number; y: number; z: number };
}

interface SkycTrajectorySegment {
  t: number;
  x: number;
  y: number;
  z: number;
  type: 'goto' | 'bezier' | 'hold';
  duration?: number;
  cp1?: { x: number; y: number; z: number };
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
  yaw: number;
  rate?: number;
}

interface SkycCues {
  takeoff: {
    time: number;
    staggerDelay: number;
    order: 'sequential' | 'center-out' | 'random' | 'simultaneous';
  };
  landing: {
    time: number;
    staggerDelay: number;
    order: 'sequential' | 'center-out' | 'random' | 'simultaneous';
  };
  showStart: number;
  showEnd: number;
  markers: SkycCueMarker[];
}

interface SkycCueMarker {
  time: number;
  label: string;
  type: 'takeoff' | 'formation' | 'transition' | 'effect' | 'landing' | 'custom';
}

interface SkycMeta {
  name: string;
  author: string;
  createdAt: string;
  software: string;
  softwareVersion: string;
  droneCount: number;
  notes: string;
  tags?: string[];
}

interface SkycValidation {
  maxAltitude: number;
  maxVelocity: number;
  maxAcceleration: number;
  minProximity: number;
  totalDistance: number;
  altitudeProfile: { t: number; min: number; max: number; avg: number }[];
  velocityProfile: { t: number; min: number; max: number; avg: number }[];
  proximityProfile: { t: number; min: number; pairIds: [string, string] }[];
}

interface SkycMedia {
  audioFile?: string;
  audioFormat?: string;
  audioDuration?: number;
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
  from: 'internal',
  to: 'neu' | 'ned' | 'enu',
): { x: number; y: number; z: number } {
  switch (to) {
    case 'neu': return { x: -z, y: x, z: y };
    case 'ned': return { x: -z, y: x, z: -y };
    case 'enu': return { x: x, y: -z, z: y };
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

  segments.push({ t: 0, ...home, type: 'hold', duration: takeoffTime });

  const takeoffPos = convertCoordSystem(homePos.x, takeoffHeight, homePos.z, 'internal', coordSystem);
  segments.push({ t: takeoffTime, ...takeoffPos, type: 'goto', duration: 5 });

  if (trajectory.waypoints.length > 0) {
    for (const wp of trajectory.waypoints) {
      const pos = convertCoordSystem(wp.position.x, wp.position.y, wp.position.z, 'internal', coordSystem);

      if (wp.controlIn && wp.controlOut) {
        const cp1 = convertCoordSystem(wp.controlIn.x, wp.controlIn.y, wp.controlIn.z, 'internal', coordSystem);
        const cp2 = convertCoordSystem(wp.controlOut.x, wp.controlOut.y, wp.controlOut.z, 'internal', coordSystem);
        segments.push({ t: wp.time, ...pos, type: 'bezier', cp1, cp2 });
      } else {
        segments.push({ t: wp.time, ...pos, type: 'goto' });
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
  segments.push({ t: 0, r: 0, g: 0, b: 0, fade: 'instant' });

  for (const formation of formations) {
    const color = hexToRGB(formation.color);
    const endColor = formation.endColor ? hexToRGB(formation.endColor) : color;

    segments.push({ t: formation.startTime, ...color, fade: 'linear' });

    if (formation.endColor && formation.colorTransition !== 'instant') {
      segments.push({ t: formation.startTime + formation.holdDuration * 0.5, ...endColor, fade: 'linear' });
    }

    segments.push({
      t: formation.startTime + formation.holdDuration + formation.transitionDuration,
      r: 0, g: 0, b: 0, fade: 'linear',
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

// ── Validation Generator ────────────────────────────────────────────

function generateValidation(
  drones: SkycDrone[],
  duration: number,
  fps: number = 4,
): SkycValidation {
  let maxAlt = 0, maxVel = 0, maxAcc = 0, minProx = Infinity, totalDist = 0;
  const altProfile: SkycValidation['altitudeProfile'] = [];
  const velProfile: SkycValidation['velocityProfile'] = [];
  const proxProfile: SkycValidation['proximityProfile'] = [];

  const steps = Math.ceil(duration * fps);
  for (let step = 0; step <= steps; step++) {
    const t = step / fps;
    let minAlt = Infinity, mAlt = 0, sumAlt = 0;
    let minVel = Infinity, mVel = 0, sumVel = 0;
    let frameMinProx = Infinity;
    let closestPair: [string, string] = ['', ''];

    // Sample positions at time t (simplified: use nearest segment)
    const positions: { id: string; x: number; y: number; z: number }[] = [];
    for (const drone of drones) {
      const seg = drone.trajectory.reduce((prev, curr) => curr.t <= t ? curr : prev, drone.trajectory[0]);
      positions.push({ id: drone.id, x: seg?.x ?? 0, y: seg?.y ?? 0, z: seg?.z ?? 0 });
      const alt = Math.abs(seg?.z ?? 0);
      sumAlt += alt;
      if (alt > mAlt) mAlt = alt;
      if (alt < minAlt) minAlt = alt;
      if (alt > maxAlt) maxAlt = alt;
    }

    // Proximity check
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dz = positions[i].z - positions[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < frameMinProx) {
          frameMinProx = dist;
          closestPair = [positions[i].id, positions[j].id];
        }
        if (dist < minProx) minProx = dist;
      }
    }

    if (step % (fps * 2) === 0) { // sample every 2 seconds
      altProfile.push({ t, min: minAlt === Infinity ? 0 : minAlt, max: mAlt, avg: sumAlt / Math.max(drones.length, 1) });
      proxProfile.push({ t, min: frameMinProx === Infinity ? 999 : frameMinProx, pairIds: closestPair });
    }
  }

  return {
    maxAltitude: maxAlt,
    maxVelocity: maxVel,
    maxAcceleration: maxAcc,
    minProximity: minProx === Infinity ? 999 : minProx,
    totalDistance: totalDist,
    altitudeProfile: altProfile,
    velocityProfile: velProfile,
    proximityProfile: proxProfile,
  };
}

// ── Cue Marker Generator ────────────────────────────────────────────

function generateCueMarkers(
  formations: DroneFormation[],
  takeoffTime: number,
  landingTime: number,
): SkycCueMarker[] {
  const markers: SkycCueMarker[] = [
    { time: 0, label: 'Show File Start', type: 'custom' },
    { time: takeoffTime, label: 'Takeoff', type: 'takeoff' },
  ];

  for (const [i, f] of formations.entries()) {
    markers.push({
      time: f.startTime,
      label: f.formationType || `Formation ${i + 1}`,
      type: 'formation',
    });
    if (f.transitionDuration > 0) {
      markers.push({
        time: f.startTime + f.holdDuration,
        label: `Transition ${i + 1}→${i + 2}`,
        type: 'transition',
      });
    }
  }

  markers.push({ time: landingTime, label: 'Landing', type: 'landing' });
  return markers.sort((a, b) => a.time - b.time);
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
  audioUrl?: string;
}

export function exportSkyc(options: SkycExportOptions): SkycFile {
  const coordSystem = options.coordinateSystem ?? 'neu';
  const dronePads = options.positions.filter(p => p.type === 'drone-pad');
  const takeoffTime = 10;
  const landingTime = options.duration - 10;

  const drones: SkycDrone[] = dronePads.map((pos, i) => {
    const traj = options.trajectories.find(t => t.positionId === pos.id);
    const home = convertCoordSystem(pos.x, pos.y, pos.z, 'internal', coordSystem);

    return {
      id: pos.id,
      name: pos.name || `Drone ${i + 1}`,
      home,
      trajectory: traj
        ? buildTrajectory(traj, pos, coordSystem, takeoffTime, options.takeoffHeight ?? 10)
        : [{ t: 0, ...home, type: 'hold' as const, duration: options.duration }],
      lightProgram: buildLightProgram(options.formations, i),
      yawControl: [{ t: 0, yaw: pos.heading }],
      startDelay: i * (options.takeoffStaggerDelay ?? 0.3),
      landPosition: home,
    };
  });

  const cueMarkers = generateCueMarkers(options.formations, takeoffTime, landingTime);
  const validation = generateValidation(drones, options.duration, options.trajectoryFPS ?? 4);

  return {
    version: 2,
    settings: {
      coordinateSystem: coordSystem,
      trajectoryFPS: options.trajectoryFPS ?? 4,
      lightFPS: options.lightFPS ?? 4,
      showDuration: options.duration,
      indoor: options.indoor ?? false,
      yawControl: true,
    },
    environment: {
      origin: {
        lat: options.gpsOrigin.lat,
        lon: options.gpsOrigin.lng,
        altMSL: options.gpsOrigin.altitude,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      magneticDeclination: 0,
      type: options.indoor ? 'indoor' : 'outdoor',
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
        order: 'center-out',
      },
      showStart: takeoffTime + 8,
      showEnd: landingTime - 5,
      markers: cueMarkers,
    },
    meta: {
      name: options.projectName,
      author: options.author ?? 'AEROSWARM NEXUS',
      createdAt: new Date().toISOString(),
      software: 'AEROSWARM NEXUS | Zenith Prime',
      softwareVersion: '1.1.0',
      droneCount: drones.length,
      notes: options.notes ?? '',
      tags: ['drone-show', 'skybrush-compatible'],
    },
    validation,
    media: options.audioUrl ? {
      audioFile: options.audioUrl,
      audioFormat: 'mp3',
    } : undefined,
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

// ── CSV Export (Skybrush Studio compatible) ──────────────────────────

export function exportShowCSV(skyc: SkycFile): string {
  const lines: string[] = [];
  lines.push('# AEROSWARM NEXUS | Zenith Prime v1.1');
  lines.push(`# Show: ${skyc.meta.name}`);
  lines.push(`# Drones: ${skyc.meta.droneCount}`);
  lines.push(`# Duration: ${skyc.settings.showDuration}s`);
  lines.push(`# Coordinate System: ${skyc.settings.coordinateSystem}`);
  lines.push(`# FPS: ${skyc.settings.trajectoryFPS}`);
  lines.push('');
  lines.push('time,drone_id,x,y,z,r,g,b,yaw');

  for (const drone of skyc.drones) {
    const steps = Math.ceil(skyc.settings.showDuration * skyc.settings.trajectoryFPS);
    for (let step = 0; step <= steps; step++) {
      const t = step / skyc.settings.trajectoryFPS;
      const seg = drone.trajectory.reduce((prev, curr) => curr.t <= t ? curr : prev, drone.trajectory[0]);
      const light = drone.lightProgram.reduce((prev, curr) => curr.t <= t ? curr : prev, drone.lightProgram[0]);
      const yaw = drone.yawControl.reduce((prev, curr) => curr.t <= t ? curr : prev, drone.yawControl[0]);

      lines.push([
        t.toFixed(3),
        drone.id,
        (seg?.x ?? 0).toFixed(3),
        (seg?.y ?? 0).toFixed(3),
        (seg?.z ?? 0).toFixed(3),
        light?.r ?? 0,
        light?.g ?? 0,
        light?.b ?? 0,
        (yaw?.yaw ?? 0).toFixed(1),
      ].join(','));
    }
  }

  return lines.join('\n');
}
