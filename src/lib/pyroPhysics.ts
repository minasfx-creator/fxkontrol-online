/**
 * ─── Pyrotechnic Physics Engine ─────────────────────────────────────
 * Real-world ballistics based on Finale 3D manual.
 * Refactored: uses interpolateTable to eliminate code duplication.
 * 
 * Caliber reference (real-world):
 *   2" = 30-45m, 3" = 50-70m, 4" = 75-100m, 5" = 100-130m
 *   6" = 130-170m, 8" = 170-220m, 10" = 220-270m, 12" = 270-300m
 */

import { interpolateTable, interpolateTableRound, type LookupTable } from './interpolateTable';

// ── Constants ───────────────────────────────────────────────────────

export const GRAVITY = -9.81; // m/s²
export const AIR_DRAG = 0.03;
export const STAR_DRAG = 0.08;

// ── Lookup Tables ───────────────────────────────────────────────────

const MORTAR_VELOCITY: LookupTable = {
  2: 42, 3: 56, 4: 68, 5: 78, 6: 88, 8: 105, 10: 118, 12: 130, 16: 145,
};

const BREAK_HEIGHT: LookupTable = {
  2: 35, 3: 55, 4: 80, 5: 110, 6: 140, 8: 190, 10: 240, 12: 280, 16: 320,
};

const BREAK_SPEED: LookupTable = {
  2: 18, 3: 28, 4: 38, 5: 48, 6: 58, 8: 72, 10: 85, 12: 95, 16: 110,
};

const STAR_COUNT: LookupTable = {
  2: 80, 3: 150, 4: 250, 5: 350, 6: 500, 8: 700, 10: 900, 12: 1100,
};

// ── Caliber-Based Functions ─────────────────────────────────────────

export function getMortarVelocity(caliberInches: number): number {
  return interpolateTable(MORTAR_VELOCITY, caliberInches, 68);
}

export function getBreakHeight(caliberInches: number): number {
  return interpolateTable(BREAK_HEIGHT, caliberInches, 80);
}

export function getBreakSpeed(caliberInches: number): number {
  return interpolateTable(BREAK_SPEED, caliberInches, 38);
}

export function getStarCount(caliberInches: number): number {
  return interpolateTableRound(STAR_COUNT, caliberInches, 250);
}

export function getLiftTime(caliberInches: number): number {
  const breakH = getBreakHeight(caliberInches);
  const v0 = getMortarVelocity(caliberInches);
  const discriminant = 1 - 2 * Math.abs(GRAVITY) * breakH / (v0 * v0);
  return v0 / Math.abs(GRAVITY) * (1 - Math.sqrt(Math.max(0, discriminant)));
}

export function getStarLifetime(caliberInches: number): number {
  // Calibrated to real pyro: 3"=1.6s, 4"=2.2s, 6"=3.5s, 8"=4.5s, 10"=6s, 12"=7.5s
  if (caliberInches <= 3) return 1.6;
  if (caliberInches <= 4) return 2.2;
  if (caliberInches <= 5) return 2.8;
  if (caliberInches <= 6) return 3.5;
  if (caliberInches <= 8) return 4.5;
  if (caliberInches <= 10) return 6.0;
  return 7.5;
}

export function getStarSpread(caliberInches: number): number {
  return 8 + caliberInches * 8;
}

// Safety distance (NFPA 1123)
export function getSafetyDistance(caliberInches: number): number {
  if (caliberInches <= 3) return 70;
  if (caliberInches <= 4) return 100;
  if (caliberInches <= 5) return 140;
  if (caliberInches <= 6) return 175;
  if (caliberInches <= 8) return 210;
  if (caliberInches <= 10) return 280;
  return 300;
}

// ── Multi-Break Timings ─────────────────────────────────────────────

export interface MultiBreakTiming {
  height: number;
  delay: number;
  starCount: number;
}

export function createMultiBreakTimings(caliber: number, breakCount: number): MultiBreakTiming[] {
  const baseHeight = getBreakHeight(caliber);
  const baseStars = getStarCount(caliber);
  const timings: MultiBreakTiming[] = [];
  const heightFactors = [1.0, 0.7, 0.5, 0.35];
  const starFactors = [0.5, 0.3, 0.15, 0.05];
  
  for (let i = 0; i < Math.min(breakCount, 4); i++) {
    timings.push({
      height: baseHeight * heightFactors[i],
      delay: i * (0.3 + Math.random() * 0.2),
      starCount: Math.round(baseStars * (i === 0 ? starFactors[0] + 0.5 : starFactors[i])),
    });
  }
  return timings;
}

// ── Glitter Trail Particle ──────────────────────────────────────────

export function createGlitterTrailParticle(parent: ParticleState): ParticleState {
  return {
    x: parent.x + (Math.random() - 0.5) * 0.1,
    y: parent.y + (Math.random() - 0.5) * 0.1,
    z: parent.z + (Math.random() - 0.5) * 0.1,
    vx: parent.vx * 0.1 + (Math.random() - 0.5) * 0.5,
    vy: parent.vy * 0.1 - 0.5,
    vz: parent.vz * 0.1 + (Math.random() - 0.5) * 0.5,
    life: 0,
    maxLife: 0.2 + Math.random() * 0.15,
    brightness: 0.6 + Math.random() * 0.4,
  };
}

// ── Particle Physics ────────────────────────────────────────────────

export interface ParticleState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  brightness: number;
  seed?: number; // for falling leaves oscillation
}

export interface StepModifiers {
  fallingLeaves?: boolean;
  reducedGravity?: number; // 0-1 factor
}

export function stepParticle(
  p: ParticleState,
  dt: number,
  wind: [number, number, number],
  drag: number = AIR_DRAG,
  modifiers?: StepModifiers,
): void {
  const gravityFactor = modifiers?.reducedGravity ?? 1;
  // Apply gravity (reduced for falling leaves)
  p.vy += GRAVITY * gravityFactor * dt;
  
  // Apply wind forces
  p.vx += wind[0] * dt * 0.5;
  p.vy += wind[1] * dt * 0.5;
  p.vz += wind[2] * dt * 0.5;

  // Falling leaves: sinusoidal lateral oscillation
  if (modifiers?.fallingLeaves && p.seed !== undefined) {
    const osc = Math.sin(p.life * 2 + p.seed * 6.28) * 0.5;
    p.vx += osc * dt;
    p.vz += Math.cos(p.life * 1.5 + p.seed * 3.14) * 0.3 * dt;
  }
  
  // Apply aerodynamic drag
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
  if (speed > 0.01) {
    const dragForce = drag * speed;
    const invSpeed = 1 / speed;
    p.vx -= p.vx * invSpeed * dragForce * dt;
    p.vy -= p.vy * invSpeed * dragForce * dt;
    p.vz -= p.vz * invSpeed * dragForce * dt;
  }
  
  // Integrate position
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  
  // Ground collision
  if (p.y < 0) {
    p.y = 0;
    p.vy = 0;
    p.vx *= 0.5;
    p.vz *= 0.5;
  }
  
  // Update lifecycle
  p.life += dt;
  p.brightness = Math.max(0, 1 - p.life / p.maxLife);
}

// ── Shell Burst Patterns ────────────────────────────────────────────

export type BurstPattern = 
  | 'sphere' | 'ring' | 'willow' | 'palm' | 'peony' 
  | 'chrysanthemum' | 'kamuro' | 'crossette' | 'dahlia' | 'brocade';

/** Generate spherical direction vector */
function randomSphericalDir(): { sx: number; sy: number; sz: number; theta: number } {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  return {
    sx: Math.sin(phi) * Math.cos(theta),
    sy: Math.cos(phi),          // Y = UP
    sz: Math.sin(phi) * Math.sin(theta),
    theta,
  };
}

export function createShellBurst(
  count: number,
  breakSpeed: number,
  pattern: BurstPattern = 'peony',
  starLifetime: number = 2
): ParticleState[] {
  const particles: ParticleState[] = [];

  for (let i = 0; i < count; i++) {
    const { sx, sy, sz, theta } = randomSphericalDir();
    let vx: number, vy: number, vz: number;
    let life = starLifetime * (0.7 + Math.random() * 0.3);

    switch (pattern) {
      case 'ring':
        vx = Math.cos(theta) * breakSpeed;
        vy = (Math.random() - 0.5) * breakSpeed * 0.1;
        vz = Math.sin(theta) * breakSpeed;
        break;
      case 'willow':
        vx = sx * breakSpeed * 0.5;
        vy = sy * breakSpeed * 0.5;
        vz = sz * breakSpeed * 0.5;
        life = starLifetime * (1.8 + Math.random() * 1.2);
        break;
      case 'palm':
        vx = sx * breakSpeed * 0.6;
        vy = Math.abs(sy) * breakSpeed + breakSpeed * 0.4;
        vz = sz * breakSpeed * 0.6;
        life = starLifetime * (1.5 + Math.random() * 0.5);
        break;
      case 'chrysanthemum':
        vx = sx * breakSpeed;
        vy = sy * breakSpeed * 0.9;
        vz = sz * breakSpeed;
        life = starLifetime * (1.1 + Math.random() * 0.3);
        break;
      case 'kamuro':
        vx = sx * breakSpeed * 0.45;
        vy = sy * breakSpeed * 0.45 + 2;
        vz = sz * breakSpeed * 0.45;
        life = starLifetime * (2.5 + Math.random() * 1.5);
        break;
      case 'dahlia':
        vx = sx * breakSpeed * 1.2;
        vy = sy * breakSpeed * 1.1;
        vz = sz * breakSpeed * 1.2;
        life = starLifetime * (0.6 + Math.random() * 0.3);
        break;
      case 'brocade':
        vx = sx * breakSpeed * 0.7;
        vy = sy * breakSpeed * 0.7;
        vz = sz * breakSpeed * 0.7;
        life = starLifetime * (1.6 + Math.random() * 0.8);
        break;
      case 'crossette':
        vx = sx * breakSpeed * 0.8;
        vy = sy * breakSpeed * 0.8;
        vz = sz * breakSpeed * 0.8;
        break;
      case 'peony':
      default: {
        const speedVariation = 0.7 + Math.random() * 0.3;
        vx = sx * breakSpeed * speedVariation;
        vy = sy * breakSpeed * speedVariation * 0.85 + 1;
        vz = sz * breakSpeed * speedVariation;
        break;
      }
    }

    particles.push({ x: 0, y: 0, z: 0, vx, vy, vz, life: 0, maxLife: life, brightness: 1 });
  }

  return particles;
}

// ── Mine Burst ──────────────────────────────────────────────────────

export function createMineBurst(count: number, speed: number, lifetime: number): ParticleState[] {
  const particles: ParticleState[] = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const upAngle = Math.random() * Math.PI * 0.4;
    const s = speed * (0.5 + Math.random() * 0.5);
    particles.push({
      x: 0, y: 0.1, z: 0,
      vx: Math.cos(theta) * Math.sin(upAngle) * s,
      vy: Math.cos(upAngle) * s + speed * 0.3,
      vz: Math.sin(theta) * Math.sin(upAngle) * s,
      life: 0, maxLife: lifetime * (0.6 + Math.random() * 0.4), brightness: 1,
    });
  }
  return particles;
}

// ── Gerb / Fountain ─────────────────────────────────────────────────

export function createGerbStream(height: number): ParticleState {
  const spread = 0.15;
  return {
    x: 0, y: 0, z: 0,
    vx: (Math.random() - 0.5) * spread * height,
    vy: height * (0.8 + Math.random() * 0.4),
    vz: (Math.random() - 0.5) * spread * height,
    life: 0, maxLife: 0.8 + Math.random() * 0.5, brightness: 1,
  };
}

// ── Waterfall ───────────────────────────────────────────────────────

export function createWaterfallParticle(width: number, dropHeight: number): ParticleState {
  return {
    x: (Math.random() - 0.5) * width,
    y: 0, z: (Math.random() - 0.5) * 0.3,
    vx: (Math.random() - 0.5) * 0.5,
    vy: -0.5 - Math.random() * 1.5,
    vz: (Math.random() - 0.5) * 0.3,
    life: 0, maxLife: dropHeight / 2 + Math.random(), brightness: 1,
  };
}

// ── Cake Timing ─────────────────────────────────────────────────────

export function getCakeShotTimes(
  totalDuration: number,
  shotCount: number,
  pattern: 'regular' | 'accelerating' | 'z-pattern' | 'fan' = 'regular'
): number[] {
  const times: number[] = [];
  for (let i = 0; i < shotCount; i++) {
    switch (pattern) {
      case 'accelerating':
        times.push(totalDuration * Math.pow(i / shotCount, 1.5));
        break;
      case 'fan':
        times.push(i * 0.08);
        break;
      case 'z-pattern':
      default:
        times.push((i / shotCount) * totalDuration);
    }
  }
  return times;
}

// ── Roman Candle Shot Angles ────────────────────────────────────────

export function getRomanCandleShotAngle(_shotIndex: number, _totalShots: number): number {
  return (Math.random() - 0.5) * 0.1;
}

// ── FFIC Real Product Data (Laudo-Calibrated) ───────────────────────

export interface RealProductSpec {
  name: string;
  caliber: string;
  caliberInches: number;
  tubeDimensions: { heightMM: number; outerDiaMM: number; innerDiaMM: number };
  effectChargeG: number;
  liftChargeG: number;
  burstChargeG: number;
  totalWeightG: number;
  fuseDelayMin: number;  // seconds
  fuseDelayMax: number;
  fuseDelayNominal: number;
  unNumber: string;
  classCode: string;
  productType: 'shell' | 'cake' | 'single_shot';
}

export const REAL_PRODUCT_DATA: Record<string, RealProductSpec> = {
  'shell_2.5_color_peony': {
    name: 'Bomba Aérea 2.5" Color Peony',
    caliber: '2.5"',
    caliberInches: 2.5,
    tubeDimensions: { heightMM: 85, outerDiaMM: 58, innerDiaMM: 50 },
    effectChargeG: 51.8,
    liftChargeG: 25.4,
    burstChargeG: 21.1,
    totalWeightG: 98.3,
    fuseDelayMin: 4.1,
    fuseDelayMax: 4.9,
    fuseDelayNominal: 4.5,
    unNumber: 'UN0335',
    classCode: '1.3G',
    productType: 'shell',
  },
  'single_shot_30mm_crackling': {
    name: 'Single Shot 30mm Ti Crackling Willow + Red Mine',
    caliber: '30mm',
    caliberInches: 1.18,
    tubeDimensions: { heightMM: 230, outerDiaMM: 38, innerDiaMM: 30 },
    effectChargeG: 28.4,
    liftChargeG: 6.92,
    burstChargeG: 0,
    totalWeightG: 35.32,
    fuseDelayMin: 5.0,
    fuseDelayMax: 6.9,
    fuseDelayNominal: 5.95,
    unNumber: 'UN0335',
    classCode: '1.3G',
    productType: 'single_shot',
  },
  'cake_20mm_300shot': {
    name: 'Cake 20mm 300-Shot',
    caliber: '20mm',
    caliberInches: 0.79,
    tubeDimensions: { heightMM: 180, outerDiaMM: 25, innerDiaMM: 20 },
    effectChargeG: 15.2,
    liftChargeG: 3.5,
    burstChargeG: 0,
    totalWeightG: 18.7,
    fuseDelayMin: 6.2,
    fuseDelayMax: 7.3,
    fuseDelayNominal: 6.75,
    unNumber: 'UN0335',
    classCode: '1.4G',
    productType: 'cake',
  },
};

// ── Gaussian Fuse Delay Jitter ──────────────────────────────────────

/** Box-Muller transform for Gaussian random */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Returns a fuse delay with realistic Gaussian jitter within measured range.
 * In a real show with 100 shells, no two explode at exactly the same time.
 */
export function fuseDelayWithJitter(
  nominalDelay: number,
  minDelay: number,
  maxDelay: number,
): number {
  const sigma = (maxDelay - minDelay) / 4; // 95% within range
  const jittered = nominalDelay + gaussianRandom() * sigma;
  return Math.max(minDelay, Math.min(maxDelay, jittered));
}

/**
 * Get calibrated fuse delay for a real product spec.
 */
export function getProductFuseDelay(productId: string): number {
  const spec = REAL_PRODUCT_DATA[productId];
  if (!spec) return 4.0; // generic fallback
  return fuseDelayWithJitter(spec.fuseDelayNominal, spec.fuseDelayMin, spec.fuseDelayMax);
}

/**
 * Get lift time calibrated with real charge weight data.
 * Uses lift charge mass to adjust velocity instead of purely ballistic formula.
 */
export function getCalibratedLiftTime(productId: string): number {
  const spec = REAL_PRODUCT_DATA[productId];
  if (!spec) return getLiftTime(2.5);
  
  // Real lift velocity estimated from charge weight: v0 ≈ k * sqrt(liftCharge / totalWeight) * base
  const chargeRatio = spec.liftChargeG / spec.totalWeightG;
  const baseVelocity = getMortarVelocity(spec.caliberInches);
  const adjustedV0 = baseVelocity * (0.7 + chargeRatio * 2.5); // calibrated scaling
  const breakH = getBreakHeight(spec.caliberInches);
  const discriminant = 1 - 2 * Math.abs(GRAVITY) * breakH / (adjustedV0 * adjustedV0);
  return adjustedV0 / Math.abs(GRAVITY) * (1 - Math.sqrt(Math.max(0, discriminant)));
}

export function getRealProduct(id: string): RealProductSpec | undefined {
  return REAL_PRODUCT_DATA[id];
}

export function getAllRealProducts(): Record<string, RealProductSpec> {
  return { ...REAL_PRODUCT_DATA };
}

// ── Formulation-Based Physics Modifiers ─────────────────────────────

export interface FormulationModifiers extends StepModifiers {
  dragOverride: number;
  velocityScale: number;
  sparkSizeScale: number;
  crackleEnabled: boolean;
  burnRateScale: number;
}

/**
 * Returns physics modifiers derived from chemical composition.
 * Ti = low drag/high velocity (hot metallic sparks fly fast).
 * Fe/C = high drag/long duration (charcoal streamers linger).
 * Bi = medium, with crackle micro-bursts.
 */
export function getFormulationModifiers(formulationId: string): FormulationModifiers | null {
  // Lazy import to avoid circular dependency
  let formulation: any;
  try {
    // We access formulation data via a simple lookup
    const formulationData: Record<string, { compounds: { element: string; percentage: number }[]; crackle: boolean; sparkSize: number; burnRate: number; trailDecay: number }> = {
      'purple_peony_2.5': { compounds: [{ element: 'CuO', percentage: 22 }, { element: 'KClO4', percentage: 16 }, { element: 'Sr(NO3)2', percentage: 12 }, { element: 'Al', percentage: 8 }], crackle: false, sparkSize: 1.0, burnRate: 2.4, trailDecay: 0.91 },
      'blue_peony_2.5': { compounds: [{ element: 'LAC', percentage: 50 }, { element: 'PVC', percentage: 8 }, { element: 'CuO', percentage: 15 }], crackle: false, sparkSize: 0.9, burnRate: 2.3, trailDecay: 0.89 },
      'crackling_willow_30mm': { compounds: [{ element: 'Ti', percentage: 10 }, { element: 'Al/Mg', percentage: 5 }, { element: 'Bi2O3', percentage: 18 }], crackle: true, sparkSize: 1.8, burnRate: 1.5, trailDecay: 0.95 },
      'red_mine_30mm': { compounds: [{ element: 'SrCO3', percentage: 25 }, { element: 'KClO4', percentage: 18 }, { element: 'Mg/Al', percentage: 6 }], crackle: false, sparkSize: 1.3, burnRate: 2.6, trailDecay: 0.92 },
      'gold_willow_2.5': { compounds: [{ element: 'Fe', percentage: 15 }, { element: 'C', percentage: 12 }, { element: 'KNO3', percentage: 20 }], crackle: false, sparkSize: 1.6, burnRate: 3.8, trailDecay: 0.82 },
      'brocade_crown_2.5': { compounds: [{ element: 'Bi', percentage: 20 }, { element: 'KClO4', percentage: 15 }, { element: 'Sb2S3', percentage: 10 }], crackle: true, sparkSize: 1.3, burnRate: 3.2, trailDecay: 0.84 },
      'cake_300_20mm': { compounds: [{ element: 'Mixed', percentage: 100 }], crackle: false, sparkSize: 0.8, burnRate: 2.0, trailDecay: 0.88 },
    };
    formulation = formulationData[formulationId];
  } catch { return null; }

  if (!formulation) return null;

  // Analyze dominant elements
  const tiPct = formulation.compounds.reduce((s: number, c: any) => c.element === 'Ti' ? s + c.percentage : s, 0);
  const fePct = formulation.compounds.reduce((s: number, c: any) => (c.element === 'Fe' || c.element === 'C') ? s + c.percentage : s, 0);
  const mgPct = formulation.compounds.reduce((s: number, c: any) => (c.element === 'Mg/Al' || c.element === 'Al/Mg' || c.element === 'Al') ? s + c.percentage : s, 0);

  // Ti = fast sparks, low drag
  // Fe/C = slow streamers, high drag
  // Mg/Al = medium, bright
  let dragOverride = STAR_DRAG;
  let velocityScale = 1.0;

  if (tiPct > 5) {
    dragOverride = STAR_DRAG * 0.6; // Ti sparks fly faster
    velocityScale = 1.3;
  } else if (fePct > 10) {
    dragOverride = STAR_DRAG * 1.4; // charcoal/iron lingers
    velocityScale = 0.75;
  } else if (mgPct > 5) {
    dragOverride = STAR_DRAG * 0.85;
    velocityScale = 1.1;
  }

  return {
    dragOverride,
    velocityScale,
    sparkSizeScale: formulation.sparkSize / 1.0,
    crackleEnabled: formulation.crackle,
    burnRateScale: 2.0 / formulation.burnRate, // normalize to baseline 2.0s
  };
}

// ── CO2 Jet ─────────────────────────────────────────────────────────

export function createCO2Particle(jetHeight: number, isHorizontal: boolean): ParticleState {
  const spread = 0.4;
  if (isHorizontal) {
    return {
      x: 0, y: (Math.random() - 0.5) * 0.5, z: 0,
      vx: jetHeight * (0.8 + Math.random() * 0.4),
      vy: (Math.random() - 0.5) * spread * 2,
      vz: (Math.random() - 0.5) * spread,
      life: 0, maxLife: 0.5 + Math.random() * 0.5, brightness: 1,
    };
  }
  return {
    x: (Math.random() - 0.5) * spread, y: 0, z: (Math.random() - 0.5) * spread,
    vx: (Math.random() - 0.5) * spread * 2,
    vy: jetHeight * (0.7 + Math.random() * 0.6),
    vz: (Math.random() - 0.5) * spread * 2,
    life: 0, maxLife: 0.4 + Math.random() * 0.6, brightness: 1,
  };
}

// ── Flame Projector ─────────────────────────────────────────────────

export function createFlameParticle(height: number): ParticleState {
  const spread = 0.3;
  return {
    x: (Math.random() - 0.5) * spread, y: 0, z: (Math.random() - 0.5) * spread,
    vx: (Math.random() - 0.5) * 2,
    vy: height * (0.5 + Math.random() * 0.5) + 3,
    vz: (Math.random() - 0.5) * 2,
    life: 0, maxLife: 0.3 + Math.random() * 0.4, brightness: 1,
  };
}

// ── Cold Spark / Sparkle Pot ────────────────────────────────────────

export function createColdSparkParticle(height: number): ParticleState {
  const angle = Math.random() * Math.PI * 2;
  const spread = 0.2;
  return {
    x: 0, y: 0, z: 0,
    vx: Math.cos(angle) * spread * height,
    vy: height * (0.6 + Math.random() * 0.8),
    vz: Math.sin(angle) * spread * height,
    life: 0, maxLife: 1.0 + Math.random() * 1.5, brightness: 1,
  };
}

// ── Laser Beam Calculation ──────────────────────────────────────────

export interface LaserBeam {
  origin: [number, number, number];
  direction: [number, number, number];
  color: string;
  width: number;
  length: number;
}

export function createLaserPattern(
  pattern: 'fan' | 'harp' | 'tunnel' | 'cone' | 'single',
  beamCount: number,
  color: string,
  time: number
): LaserBeam[] {
  const beams: LaserBeam[] = [];

  switch (pattern) {
    case 'fan':
      for (let i = 0; i < beamCount; i++) {
        const angle = ((i / beamCount) - 0.5) * Math.PI * 0.8;
        beams.push({ origin: [0, 0, 0], direction: [Math.sin(angle), Math.cos(angle) * 0.3 + 0.7, 0], color, width: 0.02, length: 100 });
      }
      break;
    case 'harp':
      for (let i = 0; i < beamCount; i++) {
        const x = ((i / beamCount) - 0.5) * 4;
        beams.push({ origin: [x, 0, 0], direction: [0, 1, 0], color, width: 0.015, length: 80 });
      }
      break;
    case 'tunnel':
      for (let i = 0; i < beamCount; i++) {
        const angle = (i / beamCount) * Math.PI * 2 + time;
        beams.push({ origin: [0, 0, 0], direction: [Math.cos(angle) * 0.3, 0.3, Math.sin(angle) * 0.3 + 0.7], color, width: 0.02, length: 60 });
      }
      break;
    case 'cone':
      for (let i = 0; i < beamCount; i++) {
        const angle = (i / beamCount) * Math.PI * 2 + time * 0.5;
        const tilt = 0.3 + Math.sin(time * 2 + i) * 0.1;
        beams.push({ origin: [0, 0, 0], direction: [Math.cos(angle) * tilt, 1 - tilt, Math.sin(angle) * tilt], color, width: 0.02, length: 100 });
      }
      break;
    default:
      beams.push({ origin: [0, 0, 0], direction: [Math.sin(time * 0.5) * 0.2, 0.9, Math.cos(time * 0.3) * 0.2], color, width: 0.03, length: 100 });
  }

  return beams;
}
