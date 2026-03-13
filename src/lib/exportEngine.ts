import { type TimelineItem, type Position, type Trajectory, type DroneFormation, EFFECT_LIBRARY } from '@/store/useProjectStore';

// ─── VVIZ Drone Export (Finale 3D Spec) ─────────────────────────────
// Generates a valid .vviz JSON file following the official Finale 3D specification:
// https://finale3d.com/documentation/vviz-file-format/
//
// Coordinate system: X (right), Y (up), Z (into screen)
// Uses delta positions (dx, dy, dz) and optional heading delta (dh).
// Supports LED Light payloads and Pyro payloads with VDL descriptions.

interface VVIZTraversalSample {
  dx: number;
  dy: number;
  dz: number;
  dh?: number;
  dt?: number;  // time delta in seconds (overrides defaultPositionRate)
}

interface VVIZColorSample {
  r: number;
  g: number;
  b: number;
  frames?: number; // time delta in units of 1/defaultColorRate
}

interface VVIZLightPayload {
  id: number;
  type: 'Light';
  payloadActions: VVIZColorSample[];
}

interface VVIZPyroPayload {
  id: number;
  type: 'Pyro';
  eventTime: number;
  vdl: string;
  partNumber: string;
  tilt?: number;
  pan?: number;
}

type VVIZPayload = VVIZLightPayload | VVIZPyroPayload;

interface VVIZPerformance {
  id: number;
  agentDescription: {
    homeX: number;
    homeY: number;
    homeZ: number;
    homeH: number;
    agentTraversal: VVIZTraversalSample[];
  };
  payloadDescription: VVIZPayload[];
}

interface VVIZFile {
  version: '1.0';
  defaultPositionRate: number;
  defaultColorRate: number;
  timeOffsetSecs: number;
  performanceName?: string;
  coordinateFrame: 'ogl';
  performances: VVIZPerformance[];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

const POSITION_RATE = 2.0;  // 2 samples/sec for position
const COLOR_RATE = 10.0;    // 10 samples/sec for LED color

/**
 * Build agentTraversal from a list of absolute keyframes.
 * Converts to delta positions (dx, dy, dz) with explicit dt for each sample.
 */
function buildTraversal(
  keyframes: { t: number; x: number; y: number; z: number; h: number }[],
): VVIZTraversalSample[] {
  if (keyframes.length === 0) return [];

  const sorted = [...keyframes].sort((a, b) => a.t - b.t);
  const samples: VVIZTraversalSample[] = [];

  // First sample: delta from home (always 0,0,0)
  samples.push({ dx: 0, dy: 0, dz: 0, dh: 0 });

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const dt = curr.t - prev.t;

    samples.push({
      dt: Math.round(dt * 1000) / 1000,
      dx: Math.round((curr.x - prev.x) * 1000) / 1000,
      dy: Math.round((curr.y - prev.y) * 1000) / 1000,
      dz: Math.round((curr.z - prev.z) * 1000) / 1000,
      dh: Math.round((curr.h - prev.h) * 1000) / 1000,
    });
  }

  return samples;
}

/**
 * Build LED Light payload from color keyframes.
 * Uses `frames` for time deltas in units of 1/defaultColorRate.
 */
function buildLightPayload(
  colorKeyframes: { t: number; r: number; g: number; b: number }[],
): VVIZLightPayload {
  const sorted = [...colorKeyframes].sort((a, b) => a.t - b.t);
  const actions: VVIZColorSample[] = [];

  if (sorted.length === 0) {
    actions.push({ r: 0, g: 0, b: 0 });
    return { id: 0, type: 'Light', payloadActions: actions };
  }

  // First sample: no frames
  actions.push({ r: sorted[0].r, g: sorted[0].g, b: sorted[0].b });

  for (let i = 1; i < sorted.length; i++) {
    const dt = sorted[i].t - sorted[i - 1].t;
    const frames = Math.round(dt * COLOR_RATE);
    actions.push({
      r: sorted[i].r,
      g: sorted[i].g,
      b: sorted[i].b,
      frames: Math.max(1, frames),
    });
  }

  return { id: 0, type: 'Light', payloadActions: actions };
}

export function exportVVIZ(
  projectName: string,
  duration: number,
  timelineItems: TimelineItem[],
  positions: Position[],
  trajectories: Trajectory[] = [],
  droneFormations: DroneFormation[] = [],
): string {
  let performanceId = 0;
  const performances: VVIZPerformance[] = [];

  // ── Build performances from timeline drone items ──
  const droneItems = timelineItems.filter((item) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
    return effect?.type === 'drone';
  });

  for (const item of droneItems) {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId)!;
    const rgb = hexToRgb(effect.color);

    // Home position: on the ground at the item's XZ
    const homeX = item.position.x;
    const homeY = 0;
    const homeZ = item.position.z;
    const homeH = 0;

    // Keyframes: launch → hold → descend
    const keyframes = [
      { t: 0, x: homeX, y: homeY, z: homeZ, h: 0 },
      { t: Math.max(0, item.startTime - 1), x: homeX, y: homeY, z: homeZ, h: 0 },
      { t: item.startTime, x: item.position.x, y: item.position.y, z: item.position.z, h: 0 },
      { t: item.startTime + effect.duration, x: item.position.x, y: item.position.y, z: item.position.z, h: 0 },
      { t: item.startTime + effect.duration + 1, x: homeX, y: homeY, z: homeZ, h: 0 },
    ];

    // Color keyframes: off → on → off
    const colorKeyframes = [
      { t: 0, r: 0, g: 0, b: 0 },
      { t: Math.max(0, item.startTime - 0.5), r: 0, g: 0, b: 0 },
      { t: item.startTime, ...rgb },
      { t: item.startTime + effect.duration, ...rgb },
      { t: item.startTime + effect.duration + 0.5, r: 0, g: 0, b: 0 },
    ];

    performances.push({
      id: performanceId++,
      agentDescription: {
        homeX,
        homeY,
        homeZ,
        homeH,
        agentTraversal: buildTraversal(keyframes),
      },
      payloadDescription: [buildLightPayload(colorKeyframes)],
    });
  }

  // ── Build performances from trajectories ──
  for (const traj of trajectories) {
    const pad = positions.find((p) => p.id === traj.positionId);
    if (!pad) continue;

    const rgb = hexToRgb(pad.color || '#00B4D8');
    const sortedWps = [...traj.waypoints].sort((a, b) => a.time - b.time);

    const homeX = pad.x;
    const homeY = pad.y || 0;
    const homeZ = pad.z;
    const homeH = pad.heading || 0;

    // Build absolute keyframes from trajectory waypoints
    const keyframes: { t: number; x: number; y: number; z: number; h: number }[] = [
      { t: 0, x: homeX, y: homeY, z: homeZ, h: homeH },
    ];

    for (const wp of sortedWps) {
      keyframes.push({
        t: wp.time,
        x: wp.position.x,
        y: wp.position.y,
        z: wp.position.z,
        h: 0,
      });
    }

    // Return to pad
    const lastTime = sortedWps.length > 0 ? sortedWps[sortedWps.length - 1].time + 2 : 5;
    keyframes.push({ t: lastTime, x: homeX, y: homeY, z: homeZ, h: 0 });

    // Color: on for entire trajectory, off at end
    const colorKeyframes = [
      { t: 0, ...rgb },
      { t: lastTime - 0.5, ...rgb },
      { t: lastTime, r: 0, g: 0, b: 0 },
    ];

    performances.push({
      id: performanceId++,
      agentDescription: {
        homeX,
        homeY,
        homeZ,
        homeH,
        agentTraversal: buildTraversal(keyframes),
      },
      payloadDescription: [buildLightPayload(colorKeyframes)],
    });
  }

  // ── Build performances from drone formations (choreography) ──
  if (droneFormations.length > 0) {
    const droneCount = droneFormations[0].droneCount;
    const landingDuration = 10;
    const lastFormation = droneFormations[droneFormations.length - 1];
    const lastEnd = lastFormation.startTime + lastFormation.transitionDuration + lastFormation.holdDuration;

    for (let d = 0; d < droneCount; d++) {
      const homeX = droneFormations[0].points[d]?.x ?? 0;
      const homeZ = droneFormations[0].points[d]?.z ?? 0;

      // Build keyframes through all formations
      const keyframes: { t: number; x: number; y: number; z: number; h: number }[] = [
        { t: 0, x: homeX, y: 0, z: homeZ, h: 0 },
      ];

      for (const f of droneFormations) {
        const pt = f.points[d] || { x: 0, z: 0 };
        const transEnd = f.startTime + f.transitionDuration;
        const holdEnd = transEnd + f.holdDuration;

        // Start of transition (current position handled by previous keyframe)
        keyframes.push({ t: f.startTime, x: keyframes[keyframes.length - 1].x, y: keyframes[keyframes.length - 1].y, z: keyframes[keyframes.length - 1].z, h: 0 });
        // Formed
        keyframes.push({ t: transEnd, x: pt.x, y: f.height, z: pt.z, h: 0 });
        // Hold end
        keyframes.push({ t: holdEnd, x: pt.x, y: f.height, z: pt.z, h: 0 });
      }

      // Landing
      keyframes.push({ t: lastEnd + landingDuration, x: homeX, y: 0, z: homeZ, h: 0 });

      // Color keyframes: match formation colors
      const colorKeyframes: { t: number; r: number; g: number; b: number }[] = [
        { t: 0, r: 0, g: 0, b: 0 },
      ];
      for (const f of droneFormations) {
        const rgb = hexToRgb(f.color);
        colorKeyframes.push({ t: f.startTime, r: 0, g: 0, b: 0 });
        colorKeyframes.push({ t: f.startTime + 1, ...rgb });
        colorKeyframes.push({ t: f.startTime + f.transitionDuration + f.holdDuration - 0.5, ...rgb });
        colorKeyframes.push({ t: f.startTime + f.transitionDuration + f.holdDuration, r: 0, g: 0, b: 0 });
      }

      performances.push({
        id: performanceId++,
        agentDescription: {
          homeX,
          homeY: 0,
          homeZ,
          homeH: 0,
          agentTraversal: buildTraversal(keyframes),
        },
        payloadDescription: [buildLightPayload(colorKeyframes)],
      });
    }
  }

  const vviz: VVIZFile = {
    version: '1.0',
    performanceName: projectName,
    coordinateFrame: 'ogl',
    defaultPositionRate: POSITION_RATE,
    defaultColorRate: COLOR_RATE,
    timeOffsetSecs: 0,
    performances,
  };

  return JSON.stringify(vviz, null, 2);
}

// ─── Pyro Firing System CSV Export ───────────────────────────────────
// Compatible with Cobra and FireTEK firing systems.
// Columns: Cue, Module, Slat, Pin, EventTime, PreFireTime, EffectName,
//          Caliber, Duration, PosName, X, Y, Z, Heading, Pitch, Angle

interface FiringCue {
  cue: number;
  module: number;
  slat: number;
  pin: number;
  eventTime: number;
  preFireTime: number;
  effectName: string;
  caliber: string;
  duration: number;
  posName: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  angle: number;
}

/** Extract caliber from effect name (e.g., 'Chrysanthemum 3"' → '3"') */
function extractCaliber(name: string): string {
  const match = name.match(/(\d+)"/);
  return match ? `${match[1]}"` : 'N/A';
}

/** Calculate pre-fire time based on caliber (lift time in seconds) */
function calculatePFT(caliber: string): number {
  const size = parseInt(caliber);
  if (isNaN(size)) return 0;
  const liftTimes: Record<number, number> = {
    2: 1.2, 3: 1.8, 4: 2.3, 5: 2.8, 6: 3.2, 8: 3.8, 10: 4.2, 12: 4.8,
  };
  return liftTimes[size] ?? 2.0;
}

export function exportFiringCSV(
  timelineItems: TimelineItem[],
  positions: Position[],
): string {
  const pyroItems = timelineItems.filter((item) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
    return effect?.type === 'firework';
  });

  const sorted = [...pyroItems].sort((a, b) => a.startTime - b.startTime);

  const PINS_PER_SLAT = 20;
  const SLATS_PER_MODULE = 5;

  const cues: FiringCue[] = sorted.map((item, index) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId)!;
    const caliber = extractCaliber(effect.name);
    const pft = calculatePFT(caliber);

    const globalPin = index;
    const pin = (globalPin % PINS_PER_SLAT) + 1;
    const slat = Math.floor((globalPin / PINS_PER_SLAT) % SLATS_PER_MODULE) + 1;
    const module = Math.floor(globalPin / (PINS_PER_SLAT * SLATS_PER_MODULE)) + 1;

    const pyroPositions = positions.filter((p) => p.type === 'pyro');
    let posName = 'UNASSIGNED';
    let heading = 0;
    let pitch = 90;
    if (pyroPositions.length > 0) {
      let minDist = Infinity;
      for (const pos of pyroPositions) {
        const dist = Math.sqrt(
          (pos.x - item.position.x) ** 2 +
          (pos.z - item.position.z) ** 2
        );
        if (dist < minDist) {
          minDist = dist;
          posName = pos.name;
          heading = pos.heading;
          pitch = pos.pitch || 90;
        }
      }
    }

    return {
      cue: index + 1,
      module,
      slat,
      pin,
      eventTime: Math.round(item.startTime * 1000) / 1000,
      preFireTime: pft,
      effectName: effect.name,
      caliber,
      duration: effect.duration,
      posName,
      x: Math.round(item.position.x * 1000) / 1000,
      y: Math.round(item.position.y * 1000) / 1000,
      z: Math.round(item.position.z * 1000) / 1000,
      heading,
      pitch,
      angle: 0,
    };
  });

  const header = 'Cue,Module,Slat,Pin,EventTime(s),PreFireTime(s),EffectName,Caliber,Duration(s),Position,X,Y,Z,Heading,Pitch,Angle';
  const rows = cues.map((c) =>
    `${c.cue},${c.module},${c.slat},${c.pin},${c.eventTime},${c.preFireTime},${c.effectName},${c.caliber},${c.duration},${c.posName},${c.x},${c.y},${c.z},${c.heading},${c.pitch},${c.angle}`
  );

  return header + '\n' + rows.join('\n');
}

// ─── Boids Simulation → VVIZ Export ──────────────────────────────────

export interface BoidsRecordingFrame {
  time: number;
  positions: { x: number; y: number; z: number }[];
}

/**
 * Export a recorded Boids simulation as a VVIZ file.
 * Each agent becomes a performance with traversal samples from recorded frames.
 */
export function exportBoidsVVIZ(
  projectName: string,
  frames: BoidsRecordingFrame[],
  color: string = '#00FFAA',
): string {
  if (frames.length === 0) return '{}';

  const agentCount = frames[0].positions.length;
  const rgb = hexToRgb(color);
  const performances: VVIZPerformance[] = [];

  for (let a = 0; a < agentCount; a++) {
    const homeX = frames[0].positions[a]?.x ?? 0;
    const homeY = frames[0].positions[a]?.y ?? 0;
    const homeZ = frames[0].positions[a]?.z ?? 0;

    const keyframes = frames.map(f => ({
      t: f.time,
      x: f.positions[a]?.x ?? homeX,
      y: f.positions[a]?.y ?? homeY,
      z: f.positions[a]?.z ?? homeZ,
      h: 0,
    }));

    const lastT = keyframes[keyframes.length - 1]?.t ?? 0;
    const colorKeyframes = [
      { t: 0, ...rgb },
      { t: lastT, ...rgb },
    ];

    performances.push({
      id: a,
      agentDescription: {
        homeX, homeY, homeZ, homeH: 0,
        agentTraversal: buildTraversal(keyframes),
      },
      payloadDescription: [buildLightPayload(colorKeyframes)],
    });
  }

  const vviz: VVIZFile = {
    version: '1.0',
    performanceName: `${projectName}_boids`,
    coordinateFrame: 'ogl',
    defaultPositionRate: POSITION_RATE,
    defaultColorRate: COLOR_RATE,
    timeOffsetSecs: 0,
    performances,
  };

  return JSON.stringify(vviz, null, 2);
}

// ─── SkyCreator .skyc Export ─────────────────────────────────────────
// Generates a .skyc JSON file compatible with SkyCreator/Verge Aero format.
// Contains drone positions, waypoints, LED colors, and show metadata.

interface SkycDrone {
  id: number;
  homePosition: { x: number; y: number; z: number };
  waypoints: { time: number; x: number; y: number; z: number; yaw: number }[];
  ledTimeline: { time: number; r: number; g: number; b: number; w: number }[];
}

interface SkycFile {
  version: string;
  showName: string;
  droneCount: number;
  duration: number;
  fps: number;
  safetyDistance: number;
  gpsOrigin: { latitude: number; longitude: number; altitude: number; heading: number };
  drones: SkycDrone[];
  metadata: {
    generator: string;
    created: string;
    formations: string[];
  };
}

export function exportSkyc(
  projectName: string,
  duration: number,
  timelineItems: TimelineItem[],
  positions: Position[],
  trajectories: Trajectory[] = [],
  droneFormations: DroneFormation[] = [],
  gpsOrigin: { lat: number; lng: number; heading: number; altitude: number } = { lat: -23.5505, lng: -46.6333, heading: 0, altitude: 0 },
): string {
  const drones: SkycDrone[] = [];
  let droneId = 0;

  // Build from drone formations (choreography)
  if (droneFormations.length > 0) {
    const droneCount = droneFormations[0].droneCount;
    const lastFormation = droneFormations[droneFormations.length - 1];
    const showEnd = lastFormation.startTime + lastFormation.transitionDuration + lastFormation.holdDuration;

    for (let d = 0; d < droneCount; d++) {
      const homeX = droneFormations[0].points[d]?.x ?? (d % 20) * 2.5 - 25;
      const homeZ = droneFormations[0].points[d]?.z ?? Math.floor(d / 20) * 2.5 - 25;

      const waypoints: SkycDrone['waypoints'] = [
        { time: 0, x: homeX, y: 0, z: homeZ, yaw: 0 },
      ];
      const ledTimeline: SkycDrone['ledTimeline'] = [
        { time: 0, r: 0, g: 0, b: 0, w: 0 },
      ];

      for (const f of droneFormations) {
        const pt = f.points[d] || { x: 0, z: 0 };
        const transEnd = f.startTime + f.transitionDuration;
        const holdEnd = transEnd + f.holdDuration;

        waypoints.push({ time: f.startTime, x: waypoints[waypoints.length - 1].x, y: waypoints[waypoints.length - 1].y, z: waypoints[waypoints.length - 1].z, yaw: 0 });
        waypoints.push({ time: transEnd, x: pt.x, y: f.height, z: pt.z, yaw: f.rotation || 0 });
        waypoints.push({ time: holdEnd, x: pt.x, y: f.height, z: pt.z, yaw: f.rotation || 0 });

        const rgb = hexToRgb(f.color);
        ledTimeline.push({ time: f.startTime, r: 0, g: 0, b: 0, w: 0 });
        ledTimeline.push({ time: f.startTime + 1, r: rgb.r, g: rgb.g, b: rgb.b, w: 0 });
        
        if (f.endColor) {
          const endRgb = hexToRgb(f.endColor);
          ledTimeline.push({ time: holdEnd - 1, r: endRgb.r, g: endRgb.g, b: endRgb.b, w: 0 });
        } else {
          ledTimeline.push({ time: holdEnd - 0.5, r: rgb.r, g: rgb.g, b: rgb.b, w: 0 });
        }
        ledTimeline.push({ time: holdEnd, r: 0, g: 0, b: 0, w: 0 });
      }

      // Landing
      waypoints.push({ time: showEnd + 10, x: homeX, y: 0, z: homeZ, yaw: 0 });

      drones.push({
        id: droneId++,
        homePosition: { x: homeX, y: 0, z: homeZ },
        waypoints,
        ledTimeline,
      });
    }
  }

  // Build from trajectories
  for (const traj of trajectories) {
    const pad = positions.find((p) => p.id === traj.positionId);
    if (!pad) continue;
    const rgb = hexToRgb(pad.color || '#00B4D8');
    const sorted = [...traj.waypoints].sort((a, b) => a.time - b.time);

    const waypoints: SkycDrone['waypoints'] = [
      { time: 0, x: pad.x, y: pad.y || 0, z: pad.z, yaw: pad.heading || 0 },
    ];
    for (const wp of sorted) {
      waypoints.push({ time: wp.time, x: wp.position.x, y: wp.position.y, z: wp.position.z, yaw: 0 });
    }
    const lastT = sorted.length > 0 ? sorted[sorted.length - 1].time + 5 : 10;
    waypoints.push({ time: lastT, x: pad.x, y: pad.y || 0, z: pad.z, yaw: 0 });

    drones.push({
      id: droneId++,
      homePosition: { x: pad.x, y: pad.y || 0, z: pad.z },
      waypoints,
      ledTimeline: [
        { time: 0, r: rgb.r, g: rgb.g, b: rgb.b, w: 0 },
        { time: lastT - 1, r: rgb.r, g: rgb.g, b: rgb.b, w: 0 },
        { time: lastT, r: 0, g: 0, b: 0, w: 0 },
      ],
    });
  }

  const skyc: SkycFile = {
    version: '2.0',
    showName: projectName,
    droneCount: drones.length,
    duration: Math.ceil(duration),
    fps: 30,
    safetyDistance: 2.0,
    gpsOrigin: {
      latitude: gpsOrigin.lat,
      longitude: gpsOrigin.lng,
      altitude: gpsOrigin.altitude,
      heading: gpsOrigin.heading,
    },
    drones,
    metadata: {
      generator: 'AEROSWARM NEXUS v2.0',
      created: new Date().toISOString(),
      formations: droneFormations.map((f) => f.formationType),
    },
  };

  return JSON.stringify(skyc, null, 2);
}

// ─── KML Export for Google Earth ──────────────────────────────────────
// Converts formations and trajectories to KML with GPS coordinates.
// Uses VVIZ coordinate system: X (right), Y (up), Z (into screen)
// Mapping to GPS: X → lng offset, Y → altitude, Z → lat offset (negative = north)

const METERS_TO_LAT = 1 / 111320; // 1 degree lat ≈ 111.32 km
function metersToLng(lat: number) {
  return 1 / (111320 * Math.cos((lat * Math.PI) / 180));
}

function localToGps(
  x: number, y: number, z: number,
  origin: { lat: number; lng: number; heading: number; altitude: number },
): { lat: number; lng: number; alt: number } {
  // Rotate by heading (degrees from north, clockwise)
  const rad = (-origin.heading * Math.PI) / 180;
  const rx = x * Math.cos(rad) - z * Math.sin(rad);
  const rz = x * Math.sin(rad) + z * Math.cos(rad);

  return {
    lng: origin.lng + rx * metersToLng(origin.lat),
    lat: origin.lat - rz * METERS_TO_LAT, // Z positive = into screen = south
    alt: origin.altitude + y,
  };
}

export function exportFormationsToKML(
  formations: DroneFormation[],
  trajectories: Trajectory[],
  positions: Position[],
  gpsOrigin: { lat: number; lng: number; heading: number; altitude: number },
  projectName: string,
): string {
  const placemarks: string[] = [];

  // --- Formation placemarks ---
  formations.forEach((f, fIdx) => {
    const coords = f.points.slice(0, f.droneCount).map((p) => {
      const gps = localToGps(p.x, f.height, p.z, gpsOrigin);
      return `${gps.lng},${gps.lat},${gps.alt}`;
    });

    // Individual drone points
    placemarks.push(`
    <Folder>
      <name>Formation ${fIdx + 1}: ${f.formationType || 'Unnamed'}</name>
      <description>Drones: ${f.droneCount} | Height: ${f.height}m | Color: ${f.color}</description>
      <Style>
        <IconStyle>
          <color>ff${f.color.slice(5, 7)}${f.color.slice(3, 5)}${f.color.slice(1, 3)}</color>
          <scale>0.5</scale>
          <Icon><href>http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon>
        </IconStyle>
      </Style>
      ${coords.map((c, i) => `
      <Placemark>
        <name>Drone ${i + 1}</name>
        <Point><altitudeMode>relativeToGround</altitudeMode><coordinates>${c}</coordinates></Point>
      </Placemark>`).join('')}
    </Folder>`);
  });

  // --- Trajectory paths ---
  trajectories.forEach((traj) => {
    const pos = positions.find((p) => p.id === traj.positionId);
    if (!pos || traj.waypoints.length < 2) return;

    const sorted = [...traj.waypoints].sort((a, b) => a.time - b.time);
    const coordStr = [
      localToGps(pos.x, pos.y, pos.z, gpsOrigin),
      ...sorted.map((wp) => localToGps(wp.position.x, wp.position.y, wp.position.z, gpsOrigin)),
    ]
      .map((g) => `${g.lng},${g.lat},${g.alt}`)
      .join(' ');

    placemarks.push(`
    <Placemark>
      <name>Trajectory: ${traj.name}</name>
      <Style>
        <LineStyle><color>ff00ffff</color><width>2</width></LineStyle>
      </Style>
      <LineString>
        <altitudeMode>relativeToGround</altitudeMode>
        <tessellate>1</tessellate>
        <coordinates>${coordStr}</coordinates>
      </LineString>
    </Placemark>`);
  });

  // --- Position markers ---
  positions.forEach((pos) => {
    const gps = localToGps(pos.x, pos.y, pos.z, gpsOrigin);
    placemarks.push(`
    <Placemark>
      <name>${pos.name}</name>
      <description>Type: ${pos.type} | Color: ${pos.color}</description>
      <Style>
        <IconStyle>
          <color>ff${pos.color.slice(5, 7)}${pos.color.slice(3, 5)}${pos.color.slice(1, 3)}</color>
          <scale>0.8</scale>
          <Icon><href>http://maps.google.com/mapfiles/kml/paddle/${pos.type === 'pyro' ? 'red' : 'blu'}-circle.png</href></Icon>
        </IconStyle>
      </Style>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${gps.lng},${gps.lat},${gps.alt}</coordinates>
      </Point>
    </Placemark>`);
  });

  // --- Geofence circle (approximation as polygon) ---
  const fenceCoords: string[] = [];
  for (let i = 0; i <= 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const gps = localToGps(Math.cos(angle) * 80, 0, Math.sin(angle) * 80, gpsOrigin);
    fenceCoords.push(`${gps.lng},${gps.lat},0`);
  }
  placemarks.push(`
  <Placemark>
    <name>Geofence (80m)</name>
    <Style>
      <LineStyle><color>660000ff</color><width>2</width></LineStyle>
      <PolyStyle><color>220000ff</color></PolyStyle>
    </Style>
    <Polygon>
      <altitudeMode>clampToGround</altitudeMode>
      <outerBoundaryIs><LinearRing><coordinates>${fenceCoords.join(' ')}</coordinates></LinearRing></outerBoundaryIs>
    </Polygon>
  </Placemark>`);

  // --- Origin marker ---
  placemarks.push(`
  <Placemark>
    <name>Launch Origin</name>
    <description>GPS: ${gpsOrigin.lat.toFixed(6)}, ${gpsOrigin.lng.toFixed(6)} | Heading: ${gpsOrigin.heading}°</description>
    <Style>
      <IconStyle>
        <color>ff00ff00</color>
        <scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-stars.png</href></Icon>
      </IconStyle>
    </Style>
    <Point><coordinates>${gpsOrigin.lng},${gpsOrigin.lat},0</coordinates></Point>
  </Placemark>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${projectName} — Drone Show</name>
  <description>Exported from AEROSWARM NEXUS</description>
  <open>1</open>
  ${placemarks.join('\n')}
</Document>
</kml>`;
}

// ─── Download Helper ─────────────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
