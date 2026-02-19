import { type TimelineItem, type Position, type Trajectory, EFFECT_LIBRARY } from '@/store/useProjectStore';

// ─── VVIZ Drone Export ───────────────────────────────────────────────
// Generates a .vviz JSON file following the VVIZ specification:
// Coordinate system: X (right), Y (up), Z (into screen)
// Each drone has keyframes with absolute positions and heading.

interface VVIZKeyframe {
  t: number;     // time in seconds
  x: number;
  y: number;
  z: number;
  h: number;     // heading in degrees
  r: number;     // red 0-255
  g: number;     // green 0-255
  b: number;     // blue 0-255
}

interface VVIZDrone {
  id: string;
  name: string;
  launchPad: string | null;
  keyframes: VVIZKeyframe[];
}

interface VVIZFile {
  version: '1.0';
  format: 'vviz';
  project: string;
  exportedAt: string;
  coordinateSystem: 'VVIZ';
  axes: { x: 'right'; y: 'up'; z: 'into-screen' };
  duration: number;
  drones: VVIZDrone[];
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

export function exportVVIZ(
  projectName: string,
  duration: number,
  timelineItems: TimelineItem[],
  positions: Position[],
  trajectories: Trajectory[] = [],
): string {
  const droneItems = timelineItems.filter((item) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);
    return effect?.type === 'drone';
  });

  // Build drones from timeline items
  const timelineDrones: VVIZDrone[] = droneItems.map((item, index) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId)!;
    const rgb = hexToRgb(effect.color);

    const dronePads = positions.filter((p) => p.type === 'drone-pad');
    let launchPad: string | null = null;
    if (dronePads.length > 0) {
      let minDist = Infinity;
      for (const pad of dronePads) {
        const dist = Math.sqrt(
          (pad.x - item.position.x) ** 2 +
          (pad.z - item.position.z) ** 2
        );
        if (dist < minDist) {
          minDist = dist;
          launchPad = pad.name;
        }
      }
    }

    const keyframes: VVIZKeyframe[] = [
      { t: Math.max(0, item.startTime - 1), x: item.position.x, y: 0, z: item.position.z, h: 0, ...rgb },
      { t: item.startTime, x: item.position.x, y: item.position.y, z: item.position.z, h: 0, ...rgb },
      { t: item.startTime + effect.duration, x: item.position.x, y: item.position.y, z: item.position.z, h: 0, ...rgb },
      { t: item.startTime + effect.duration + 1, x: item.position.x, y: 0, z: item.position.z, h: 0, r: 0, g: 0, b: 0 },
    ];

    return {
      id: `drone-${String(index + 1).padStart(3, '0')}`,
      name: effect.name,
      launchPad,
      keyframes,
    };
  });

  // Build drones from trajectories
  const trajectoryDrones: VVIZDrone[] = trajectories.map((traj, index) => {
    const pad = positions.find((p) => p.id === traj.positionId);
    if (!pad) return null;

    const sortedWps = [...traj.waypoints].sort((a, b) => a.time - b.time);
    const rgb = hexToRgb(pad?.color || '#00B4D8');

    const keyframes: VVIZKeyframe[] = [
      // Start at pad
      { t: 0, x: pad.x, y: pad.y || 0, z: pad.z, h: pad.heading || 0, ...rgb },
    ];

    // Add waypoints
    for (const wp of sortedWps) {
      keyframes.push({
        t: wp.time,
        x: wp.position.x,
        y: wp.position.y,
        z: wp.position.z,
        h: 0,
        ...rgb,
      });
    }

    // Return to pad at end
    const lastTime = sortedWps.length > 0 ? sortedWps[sortedWps.length - 1].time + 2 : 5;
    keyframes.push({
      t: lastTime,
      x: pad.x,
      y: pad.y || 0,
      z: pad.z,
      h: 0,
      r: 0, g: 0, b: 0,
    });

    return {
      id: `traj-drone-${String(index + 1).padStart(3, '0')}`,
      name: traj.name,
      launchPad: pad.name,
      keyframes,
    };
  }).filter(Boolean) as VVIZDrone[];

  const drones = [...timelineDrones, ...trajectoryDrones];

  const vviz: VVIZFile = {
    version: '1.0',
    format: 'vviz',
    project: projectName,
    exportedAt: new Date().toISOString(),
    coordinateSystem: 'VVIZ',
    axes: { x: 'right', y: 'up', z: 'into-screen' },
    duration,
    drones,
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
  // Approximate lift times by shell diameter (inches)
  const liftTimes: Record<number, number> = {
    2: 1.2,
    3: 1.8,
    4: 2.3,
    5: 2.8,
    6: 3.2,
    8: 3.8,
    10: 4.2,
    12: 4.8,
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

  // Sort by start time
  const sorted = [...pyroItems].sort((a, b) => a.startTime - b.startTime);

  const PINS_PER_SLAT = 20;
  const SLATS_PER_MODULE = 5;

  const cues: FiringCue[] = sorted.map((item, index) => {
    const effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId)!;
    const caliber = extractCaliber(effect.name);
    const pft = calculatePFT(caliber);

    // Module/Slat/Pin addressing
    const globalPin = index;
    const pin = (globalPin % PINS_PER_SLAT) + 1;
    const slat = Math.floor((globalPin / PINS_PER_SLAT) % SLATS_PER_MODULE) + 1;
    const module = Math.floor(globalPin / (PINS_PER_SLAT * SLATS_PER_MODULE)) + 1;

    // Find nearest pyro position
    const pyroPositions = positions.filter((p) => p.type === 'pyro');
    let posName = 'UNASSIGNED';
    let heading = 0;
    let pitch = 90; // straight up by default
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
