/**
 * LaserFX Engine — Professional laser show simulation.
 * Galvo scanner physics, ILDA-style patterns, volumetric beams,
 * atmospheric scattering, DMX control mapping.
 */

import * as THREE from 'three';

// ── Galvo Scanner Simulation ──────────────────────────────────
export interface GalvoConfig {
  pps: number;        // Points per second (30k, 40k, 60k)
  maxAngle: number;   // Max deflection angle in radians
  acceleration: number; // Angular acceleration (rad/s²)
  damping: number;    // Mechanical damping
}

export const GALVO_PRESETS: Record<string, GalvoConfig> = {
  'entry':   { pps: 20000, maxAngle: Math.PI * 0.4, acceleration: 800, damping: 0.92 },
  '30k':     { pps: 30000, maxAngle: Math.PI * 0.45, acceleration: 1200, damping: 0.94 },
  '40k':     { pps: 40000, maxAngle: Math.PI * 0.5, acceleration: 1800, damping: 0.95 },
  '60k_pro': { pps: 60000, maxAngle: Math.PI * 0.55, acceleration: 2400, damping: 0.96 },
  // OPT Laser real hardware galvo presets
  'OPT_20k': { pps: 20000, maxAngle: Math.PI * (80 / 360), acceleration: 1000, damping: 0.93 },
  'OPT_25k': { pps: 25000, maxAngle: Math.PI * (80 / 360), acceleration: 1200, damping: 0.94 },
  'OPT_30k': { pps: 30000, maxAngle: Math.PI * (80 / 360), acceleration: 1400, damping: 0.95 },
  'OPT_40k': { pps: 40000, maxAngle: Math.PI * (80 / 360), acceleration: 1800, damping: 0.95 },
};

export class GalvoScanner {
  angle = 0;
  velocity = 0;
  config: GalvoConfig;

  constructor(preset: string = '30k') {
    this.config = GALVO_PRESETS[preset] || GALVO_PRESETS['30k'];
  }

  update(targetAngle: number, dt: number): number {
    const diff = targetAngle - this.angle;
    this.velocity += diff * this.config.acceleration * dt;
    this.velocity *= this.config.damping;
    this.angle += this.velocity * dt;
    this.angle = THREE.MathUtils.clamp(this.angle, -this.config.maxAngle, this.config.maxAngle);
    return this.angle;
  }
}

// ── RGB Laser Color System ────────────────────────────────────
export interface LaserColorProfile {
  wavelength: number; // nm
  power: number;      // Watts
  divergence: number; // mrad
  color: THREE.Color;
}

export const LASER_WAVELENGTHS: Record<string, LaserColorProfile> = {
  'red':    { wavelength: 638, power: 3, divergence: 1.2, color: new THREE.Color('#FF0000') },
  'green':  { wavelength: 532, power: 5, divergence: 0.8, color: new THREE.Color('#00FF00') },
  'blue':   { wavelength: 450, power: 8, divergence: 1.0, color: new THREE.Color('#0044FF') },
  'cyan':   { wavelength: 488, power: 4, divergence: 0.9, color: new THREE.Color('#00FFFF') },
  'yellow': { wavelength: 577, power: 2, divergence: 1.1, color: new THREE.Color('#FFFF00') },
  'magenta':{ wavelength: 405, power: 3, divergence: 1.3, color: new THREE.Color('#FF00FF') },
  'white':  { wavelength: 0,   power: 20, divergence: 1.0, color: new THREE.Color('#FFFFFF') },
};

// ── OPT Laser Hardware Presets ────────────────────────────────────
export interface LaserHardwarePreset {
  model: string;
  totalPower: number;    // Watts
  redPower: number;
  greenPower: number;
  bluePower: number;
  divergence: number;    // mrad
  pps: number;           // ILDA @ 8°
  scanAngle: number;     // degrees
  weight: number;        // kg
  ipRating: string;
  safetyClass: string;
  galvoPreset: string;   // key into GALVO_PRESETS
}

export const LASER_HARDWARE_PRESETS: Record<string, LaserHardwarePreset> = {
  'WP35_IP65': {
    model: 'OPT Laser WP35000-RGB',
    totalPower: 35,
    redPower: 10,
    greenPower: 12,
    bluePower: 13,
    divergence: 0.9,
    pps: 30000,
    scanAngle: 60,
    weight: 24.5,
    ipRating: 'IP65',
    safetyClass: 'Class 4',
    galvoPreset: 'WP35_IP65',
  },
  'CF25_Carbon': {
    model: 'OPT Laser CF25000-RGB',
    totalPower: 25,
    redPower: 7,
    greenPower: 8,
    bluePower: 10,
    divergence: 1.0,
    pps: 40000,
    scanAngle: 60,
    weight: 12,
    ipRating: 'IP54',
    safetyClass: 'Class 4',
    galvoPreset: 'CF25_Carbon',
  },
};

// ── Beam Pattern Generators ───────────────────────────────────
export interface BeamPoint {
  x: number;
  y: number;
  z: number;
  intensity: number;
}

/** Fan pattern — parallel beams spread at angles */
export function generateFanPattern(
  count: number,
  spreadAngle: number,
  beamLength: number,
  time: number,
  sway = 0.1,
): BeamPoint[] {
  const points: BeamPoint[] = [];
  const halfSpread = spreadAngle / 2;
  const swayOffset = Math.sin(time * 0.3) * sway;

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5;
    const angle = t * spreadAngle + swayOffset;
    points.push({
      x: Math.sin(angle) * beamLength,
      y: Math.cos(angle) * beamLength,
      z: 0,
      intensity: 1 - Math.abs(t) * 0.3,
    });
  }
  return points;
}

/** Tunnel pattern — rotating ring of beams */
export function generateTunnelPattern(
  count: number,
  radius: number,
  beamLength: number,
  time: number,
  rotationSpeed = 1.5,
): BeamPoint[] {
  const points: BeamPoint[] = [];
  const baseAngle = time * rotationSpeed;

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (i / count) * Math.PI * 2;
    const tiltAngle = 0.25;
    points.push({
      x: Math.cos(angle) * tiltAngle * beamLength,
      y: beamLength,
      z: Math.sin(angle) * tiltAngle * beamLength,
      intensity: 0.8 + Math.sin(angle * 3 + time) * 0.2,
    });
  }
  return points;
}

/** Wave pattern — sinusoidal oscillation */
export function generateWavePattern(
  count: number,
  amplitude: number,
  frequency: number,
  beamLength: number,
  time: number,
): BeamPoint[] {
  const points: BeamPoint[] = [];
  for (let i = 0; i < count; i++) {
    const phase = (i / count) * Math.PI * 2;
    const waveAngle = Math.sin(time * frequency + phase) * amplitude;
    points.push({
      x: Math.sin(waveAngle) * beamLength,
      y: Math.cos(waveAngle) * beamLength,
      z: ((i / count) - 0.5) * 6,
      intensity: 0.7 + Math.sin(phase + time * 2) * 0.3,
    });
  }
  return points;
}

/** Grid/matrix pattern */
export function generateGridPattern(
  cols: number,
  rows: number,
  spacing: number,
  beamLength: number,
  time: number,
): BeamPoint[] {
  const points: BeamPoint[] = [];
  const halfW = (cols - 1) * spacing / 2;
  const halfH = (rows - 1) * spacing / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = c * spacing - halfW;
      const oz = r * spacing - halfH;
      const pulse = Math.sin(time * 3 + c * 0.5 + r * 0.7) * 0.5 + 0.5;
      points.push({
        x: ox,
        y: beamLength,
        z: oz,
        intensity: pulse,
      });
    }
  }
  return points;
}

/** Cone pattern — rotating cone of beams */
export function generateConePattern(
  count: number,
  coneAngle: number,
  beamLength: number,
  time: number,
  rotationSpeed = 0.5,
): BeamPoint[] {
  const points: BeamPoint[] = [];
  const baseAngle = time * rotationSpeed;

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (i / count) * Math.PI * 2;
    const tilt = coneAngle + Math.sin(time * 2 + i) * 0.1;
    points.push({
      x: Math.cos(angle) * tilt * beamLength,
      y: beamLength,
      z: Math.sin(angle) * tilt * beamLength,
      intensity: 0.85,
    });
  }
  return points;
}

// ── Volumetric Beam Scattering ────────────────────────────────
export interface AtmosphereConfig {
  hazeLevel: number;    // 0-1 (0=clear, 1=heavy haze)
  fogDensity: number;   // particles per m³
  temperature: number;  // K (affects scattering color)
}

/** Calculate beam visibility based on atmosphere */
export function beamVisibility(
  distance: number,
  atmosphere: AtmosphereConfig,
): number {
  const extinction = atmosphere.hazeLevel * 0.3 + atmosphere.fogDensity * 0.001;
  return Math.exp(-extinction * distance);
}

/** Volumetric scattering intensity along beam path */
export function scatteringIntensity(
  viewAngle: number, // angle between view direction and beam
  atmosphere: AtmosphereConfig,
): number {
  // Mie scattering approximation — forward scattering dominant
  const g = 0.75; // asymmetry parameter for haze
  const cosTheta = Math.cos(viewAngle);
  const mie = (1 - g * g) / Math.pow(1 + g * g - 2 * g * cosTheta, 1.5);
  return mie * atmosphere.hazeLevel * 0.5;
}

// ── DMX Laser Channel Mapping ─────────────────────────────────
export interface LaserDMXProfile {
  startChannel: number;
  channels: {
    mode: number;       // ch1: operating mode
    pan: number;        // ch2: pan position
    tilt: number;       // ch3: tilt position
    red: number;        // ch4: red intensity
    green: number;      // ch5: green intensity
    blue: number;       // ch6: blue intensity
    pattern: number;    // ch7: pattern selection
    patternSpeed: number; // ch8: pattern rotation speed
    zoom: number;       // ch9: beam divergence
    dimmer: number;     // ch10: master dimmer
  };
}

export function createLaserDMXProfile(startChannel: number): LaserDMXProfile {
  return {
    startChannel,
    channels: {
      mode: startChannel,
      pan: startChannel + 1,
      tilt: startChannel + 2,
      red: startChannel + 3,
      green: startChannel + 4,
      blue: startChannel + 5,
      pattern: startChannel + 6,
      patternSpeed: startChannel + 7,
      zoom: startChannel + 8,
      dimmer: startChannel + 9,
    },
  };
}

// ── Laser Safety Zones ────────────────────────────────────────
export interface SafetyZone {
  minHeight: number;   // meters above audience
  maxPower: number;    // mW/cm² (MPE limit)
  scanSpeed: number;   // minimum scan speed for audience scanning
}

export const LASER_SAFETY: Record<string, SafetyZone> = {
  'class3b': { minHeight: 3.0, maxPower: 0.5, scanSpeed: 5000 },
  'class4':  { minHeight: 5.0, maxPower: 0.0, scanSpeed: 0 }, // no audience scanning
  'outdoor': { minHeight: 0.0, maxPower: 2.5, scanSpeed: 15000 },
};

export function isBeamSafe(
  beamHeight: number,
  power: number,
  scanSpeed: number,
  zone: SafetyZone,
): boolean {
  if (beamHeight < zone.minHeight) return false;
  if (power > zone.maxPower && scanSpeed < zone.scanSpeed) return false;
  return true;
}
