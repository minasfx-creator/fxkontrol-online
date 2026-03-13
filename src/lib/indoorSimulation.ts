/**
 * ─── Indoor Simulation Engine ───────────────────────────────────────
 * GPS-denied indoor simulation for micro-drones.
 * Based on research: "vision-based SLAM and optical flow systems"
 * Simulates:
 * - UWB (Ultra-Wideband) positioning
 * - Optical flow velocity estimation
 * - SLAM landmark tracking
 * - Indoor geofencing with wall collision
 */

export interface IndoorVenue {
  id: string;
  name: string;
  width: number;    // meters
  height: number;   // meters (ceiling)
  depth: number;    // meters
  wallMaterial: 'concrete' | 'glass' | 'fabric' | 'open';
  uwbAnchors: UWBAnchor[];
  obstacles: IndoorObstacle[];
  lightingZones: LightingZone[];
}

export interface UWBAnchor {
  id: string;
  position: [number, number, number];
  range: number; // max range in meters
  frequency: number; // Hz update rate
}

export interface IndoorObstacle {
  id: string;
  type: 'pillar' | 'beam' | 'fixture' | 'cable' | 'custom';
  position: [number, number, number];
  size: [number, number, number]; // bounding box
  label: string;
}

export interface LightingZone {
  id: string;
  name: string;
  center: [number, number, number];
  radius: number;
  luminance: number; // lux
  color: string;
}

export interface PositioningMode {
  type: 'uwb' | 'optical-flow' | 'slam' | 'hybrid';
  accuracy: number;     // meters (std dev)
  updateRate: number;   // Hz
  latency: number;      // milliseconds
}

export const POSITIONING_MODES: PositioningMode[] = [
  { type: 'uwb', accuracy: 0.1, updateRate: 50, latency: 10 },
  { type: 'optical-flow', accuracy: 0.3, updateRate: 30, latency: 33 },
  { type: 'slam', accuracy: 0.15, updateRate: 20, latency: 50 },
  { type: 'hybrid', accuracy: 0.05, updateRate: 100, latency: 8 },
];

export interface IndoorDroneSpec {
  name: string;
  weight: number;        // grams
  diameter: number;       // cm
  maxSpeed: number;       // m/s
  maxAltitude: number;    // meters
  batteryLife: number;    // minutes
  ledCount: number;
  propGuard: boolean;
  noiseLevel: number;     // dB at 1m
}

export const MICRO_DRONE_PRESETS: IndoorDroneSpec[] = [
  { name: 'Crazyflie 2.1', weight: 27, diameter: 9.2, maxSpeed: 1.5, maxAltitude: 3, batteryLife: 7, ledCount: 1, propGuard: true, noiseLevel: 45 },
  { name: 'Bitcraze Bolt', weight: 29, diameter: 9.2, maxSpeed: 2, maxAltitude: 4, batteryLife: 8, ledCount: 4, propGuard: true, noiseLevel: 48 },
  { name: 'Indoor Show 50', weight: 50, diameter: 12, maxSpeed: 2.5, maxAltitude: 8, batteryLife: 12, ledCount: 9, propGuard: true, noiseLevel: 52 },
  { name: 'Verity Lucie', weight: 35, diameter: 10, maxSpeed: 3, maxAltitude: 6, batteryLife: 10, ledCount: 4, propGuard: true, noiseLevel: 50 },
];

export const VENUE_PRESETS: IndoorVenue[] = [
  {
    id: 'theater',
    name: 'Teatro (200 lugares)',
    width: 20, height: 12, depth: 30,
    wallMaterial: 'fabric',
    uwbAnchors: [
      { id: 'uwb-1', position: [0, 10, 0], range: 25, frequency: 50 },
      { id: 'uwb-2', position: [20, 10, 0], range: 25, frequency: 50 },
      { id: 'uwb-3', position: [0, 10, 30], range: 25, frequency: 50 },
      { id: 'uwb-4', position: [20, 10, 30], range: 25, frequency: 50 },
    ],
    obstacles: [],
    lightingZones: [
      { id: 'lz-1', name: 'Palco', center: [10, 6, 5], radius: 8, luminance: 500, color: '#ffffff' },
    ],
  },
  {
    id: 'arena',
    name: 'Arena Indoor (5000 lugares)',
    width: 60, height: 20, depth: 80,
    wallMaterial: 'concrete',
    uwbAnchors: [
      { id: 'uwb-1', position: [0, 18, 0], range: 50, frequency: 100 },
      { id: 'uwb-2', position: [60, 18, 0], range: 50, frequency: 100 },
      { id: 'uwb-3', position: [0, 18, 80], range: 50, frequency: 100 },
      { id: 'uwb-4', position: [60, 18, 80], range: 50, frequency: 100 },
      { id: 'uwb-5', position: [30, 18, 40], range: 50, frequency: 100 },
    ],
    obstacles: [
      { id: 'obs-1', type: 'beam', position: [15, 15, 20], size: [0.5, 0.5, 10], label: 'Viga A' },
      { id: 'obs-2', type: 'beam', position: [45, 15, 20], size: [0.5, 0.5, 10], label: 'Viga B' },
    ],
    lightingZones: [
      { id: 'lz-1', name: 'Centro', center: [30, 10, 40], radius: 20, luminance: 800, color: '#ffffff' },
    ],
  },
  {
    id: 'museum',
    name: 'Museu / Galeria',
    width: 30, height: 8, depth: 40,
    wallMaterial: 'glass',
    uwbAnchors: [
      { id: 'uwb-1', position: [0, 7, 0], range: 30, frequency: 50 },
      { id: 'uwb-2', position: [30, 7, 0], range: 30, frequency: 50 },
      { id: 'uwb-3', position: [0, 7, 40], range: 30, frequency: 50 },
      { id: 'uwb-4', position: [30, 7, 40], range: 30, frequency: 50 },
    ],
    obstacles: [
      { id: 'obs-1', type: 'pillar', position: [10, 4, 13], size: [0.6, 8, 0.6], label: 'Pilar 1' },
      { id: 'obs-2', type: 'pillar', position: [20, 4, 13], size: [0.6, 8, 0.6], label: 'Pilar 2' },
      { id: 'obs-3', type: 'pillar', position: [10, 4, 27], size: [0.6, 8, 0.6], label: 'Pilar 3' },
      { id: 'obs-4', type: 'pillar', position: [20, 4, 27], size: [0.6, 8, 0.6], label: 'Pilar 4' },
    ],
    lightingZones: [],
  },
];

/** Simulate UWB trilateration position estimate */
export function simulateUWBPosition(
  truePosition: [number, number, number],
  anchors: UWBAnchor[],
  noiseStdDev: number = 0.1,
): { position: [number, number, number]; hdop: number; anchorsUsed: number } {
  let anchorsUsed = 0;
  let estX = 0, estY = 0, estZ = 0;
  let totalWeight = 0;
  
  for (const anchor of anchors) {
    const dx = truePosition[0] - anchor.position[0];
    const dy = truePosition[1] - anchor.position[1];
    const dz = truePosition[2] - anchor.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    if (dist <= anchor.range) {
      anchorsUsed++;
      const noisyDist = dist + (Math.random() * 2 - 1) * noiseStdDev;
      const weight = 1 / Math.max(0.1, noisyDist);
      
      // Weighted average toward anchor
      estX += anchor.position[0] * weight;
      estY += anchor.position[1] * weight;
      estZ += anchor.position[2] * weight;
      totalWeight += weight;
    }
  }
  
  if (totalWeight > 0 && anchorsUsed >= 3) {
    estX /= totalWeight;
    estY /= totalWeight;
    estZ /= totalWeight;
    
    // Blend with true position + noise
    const noise = () => (Math.random() * 2 - 1) * noiseStdDev;
    return {
      position: [
        truePosition[0] + noise(),
        truePosition[1] + noise(),
        truePosition[2] + noise(),
      ],
      hdop: anchorsUsed >= 4 ? 0.8 : anchorsUsed >= 3 ? 1.5 : 3.0,
      anchorsUsed,
    };
  }
  
  return {
    position: [...truePosition] as [number, number, number],
    hdop: 99,
    anchorsUsed,
  };
}

/** Check indoor collision with venue walls and obstacles */
export function checkIndoorCollision(
  position: [number, number, number],
  venue: IndoorVenue,
  droneRadius: number = 0.1,
): { collision: boolean; nearest: string; distance: number } {
  let minDist = Infinity;
  let nearest = 'none';
  
  // Check walls
  const wallDistances = [
    { name: 'Parede Esquerda', dist: position[0] - droneRadius },
    { name: 'Parede Direita', dist: venue.width - position[0] - droneRadius },
    { name: 'Chão', dist: position[1] - droneRadius },
    { name: 'Teto', dist: venue.height - position[1] - droneRadius },
    { name: 'Parede Frente', dist: position[2] - droneRadius },
    { name: 'Parede Fundo', dist: venue.depth - position[2] - droneRadius },
  ];
  
  for (const wd of wallDistances) {
    if (wd.dist < minDist) {
      minDist = wd.dist;
      nearest = wd.name;
    }
  }
  
  // Check obstacles
  for (const obs of venue.obstacles) {
    const dx = Math.max(0, Math.abs(position[0] - obs.position[0]) - obs.size[0] / 2);
    const dy = Math.max(0, Math.abs(position[1] - obs.position[1]) - obs.size[1] / 2);
    const dz = Math.max(0, Math.abs(position[2] - obs.position[2]) - obs.size[2] / 2);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) - droneRadius;
    
    if (dist < minDist) {
      minDist = dist;
      nearest = obs.label;
    }
  }
  
  return { collision: minDist <= 0, nearest, distance: minDist };
}
