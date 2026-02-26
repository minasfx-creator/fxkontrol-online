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
