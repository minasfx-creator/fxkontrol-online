/**
 * ─── Pyrotechnic Physics Engine ─────────────────────────────────────
 * Real-world ballistics based on Finale 3D manual:
 * - Shell lift time = f(caliber) with realistic mortar velocity
 * - Break height = f(caliber, charge)  
 * - Star spread = f(caliber, star count, duration)
 * - Gravity, drag, wind drift on every particle
 * - Prefire delay (fuse + lift)
 * - VDL-aware simulation parameters
 */

export const GRAVITY = -9.81; // m/s²
export const AIR_DRAG = 0.03; // drag coefficient for particles
export const STAR_DRAG = 0.08; // heavier drag for stars falling

// ── Lift physics (from Finale manual: liftTimePerInch) ──────────────
// Real mortar velocities by caliber (m/s)
const MORTAR_VELOCITY: Record<number, number> = {
  2: 40, 3: 55, 4: 65, 5: 75, 6: 85, 8: 100, 10: 115, 12: 125, 16: 140,
};

export function getMortarVelocity(caliberInches: number): number {
  const keys = Object.keys(MORTAR_VELOCITY).map(Number).sort((a, b) => a - b);
  if (caliberInches <= keys[0]) return MORTAR_VELOCITY[keys[0]];
  if (caliberInches >= keys[keys.length - 1]) return MORTAR_VELOCITY[keys[keys.length - 1]];
  for (let i = 0; i < keys.length - 1; i++) {
    if (caliberInches >= keys[i] && caliberInches <= keys[i + 1]) {
      const t = (caliberInches - keys[i]) / (keys[i + 1] - keys[i]);
      return MORTAR_VELOCITY[keys[i]] * (1 - t) + MORTAR_VELOCITY[keys[i + 1]] * t;
    }
  }
  return 65;
}

// Lift time = height / velocity (simplified, real formula includes drag)
export function getLiftTime(caliberInches: number): number {
  const breakH = getBreakHeight(caliberInches);
  const v0 = getMortarVelocity(caliberInches);
  // t = (v0 - sqrt(v0² + 2g*h)) / g — solving for time to reach breakH
  // Simplified: t ≈ v0/|g| - sqrt(v0²/g² - 2h/|g|) — but easier:
  return v0 / Math.abs(GRAVITY) * (1 - Math.sqrt(Math.max(0, 1 - 2 * Math.abs(GRAVITY) * breakH / (v0 * v0))));
}

// Break height by caliber (meters) — from Finale manual defaults
export function getBreakHeight(caliberInches: number): number {
  // Approximate: 3" = 60m, 4" = 80m, 5" = 100m, 6" = 120m, 8" = 160m
  return 15 + caliberInches * 18;
}

// Star lifetime by caliber
export function getStarLifetime(caliberInches: number): number {
  return 1.0 + caliberInches * 0.5;
}

// Star spread radius at peak (meters)
export function getStarSpread(caliberInches: number): number {
  return 5 + caliberInches * 6;
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

// ── Particle physics ────────────────────────────────────────────────

export interface ParticleState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  brightness: number;
}

export function stepParticle(
  p: ParticleState, 
  dt: number, 
  wind: [number, number, number], 
  drag: number = AIR_DRAG
): void {
  // Apply gravity
  p.vy += GRAVITY * dt;
  
  // Apply wind force
  p.vx += wind[0] * dt * 0.5;
  p.vy += wind[1] * dt * 0.5;
  p.vz += wind[2] * dt * 0.5;
  
  // Apply drag: F_drag = -drag * v²
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
  if (speed > 0.01) {
    const dragForce = drag * speed;
    p.vx -= (p.vx / speed) * dragForce * dt;
    p.vy -= (p.vy / speed) * dragForce * dt;
    p.vz -= (p.vz / speed) * dragForce * dt;
  }
  
  // Integrate position
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.z += p.vz * dt;
  
  // Clamp to ground
  if (p.y < 0) { p.y = 0; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
  
  // Age
  p.life += dt;
  p.brightness = Math.max(0, 1 - p.life / p.maxLife);
}

// ── Shell burst star distribution ───────────────────────────────────

export function createShellBurst(
  count: number, 
  breakSpeed: number, 
  pattern: 'sphere' | 'ring' | 'willow' | 'palm' | 'peony' | 'chrysanthemum' | 'kamuro' | 'crossette' = 'sphere',
  starLifetime: number = 2
): ParticleState[] {
  const particles: ParticleState[] = [];
  
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    let vx: number, vy: number, vz: number;
    let life = starLifetime * (0.7 + Math.random() * 0.3);
    
    switch (pattern) {
      case 'ring':
        // Flat ring distribution
        vx = Math.cos(theta) * breakSpeed;
        vy = (Math.random() - 0.5) * breakSpeed * 0.1;
        vz = Math.sin(theta) * breakSpeed;
        break;
      case 'willow':
        // Long-burning stars with less initial velocity
        vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.6;
        vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.6;
        vz = Math.cos(phi) * breakSpeed * 0.6;
        life = starLifetime * (1.2 + Math.random() * 0.8);
        break;
      case 'palm':
        // Upward bias with heavy falloff
        vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.7;
        vy = Math.abs(Math.sin(phi) * Math.sin(theta)) * breakSpeed + breakSpeed * 0.3;
        vz = Math.cos(phi) * breakSpeed * 0.7;
        life = starLifetime * (1.5 + Math.random() * 0.5);
        break;
      case 'chrysanthemum':
        // Dense, uniform sphere with long trails
        vx = Math.sin(phi) * Math.cos(theta) * breakSpeed;
        vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.9;
        vz = Math.cos(phi) * breakSpeed;
        life = starLifetime * (1.0 + Math.random() * 0.2);
        break;
      case 'kamuro':
        // Very long-burning golden stars that fall slowly
        vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.5;
        vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.5 + 2;
        vz = Math.cos(phi) * breakSpeed * 0.5;
        life = starLifetime * (2.0 + Math.random() * 1.0);
        break;
      case 'crossette':
        // Stars that split into 4 directions
        vx = Math.sin(phi) * Math.cos(theta) * breakSpeed * 0.8;
        vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.8;
        vz = Math.cos(phi) * breakSpeed * 0.8;
        break;
      case 'peony':
      default:
        // Classic spherical distribution
        vx = Math.sin(phi) * Math.cos(theta) * breakSpeed;
        vy = Math.sin(phi) * Math.sin(theta) * breakSpeed * 0.85 + 0.5;
        vz = Math.cos(phi) * breakSpeed;
        break;
    }
    
    particles.push({ x: 0, y: 0, z: 0, vx, vy, vz, life: 0, maxLife: life, brightness: 1 });
  }
  
  return particles;
}

// ── Mine burst ──────────────────────────────────────────────────────

export function createMineBurst(count: number, speed: number, lifetime: number): ParticleState[] {
  const particles: ParticleState[] = [];
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const upAngle = Math.random() * Math.PI * 0.4; // mostly upward
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

// ── Cake timing ─────────────────────────────────────────────────────

export function getCakeShotTimes(
  totalDuration: number, 
  shotCount: number, 
  pattern: 'regular' | 'accelerating' | 'z-pattern' | 'fan' = 'regular'
): number[] {
  const times: number[] = [];
  for (let i = 0; i < shotCount; i++) {
    switch (pattern) {
      case 'accelerating':
        // Shots get faster towards the end
        times.push(totalDuration * Math.pow(i / shotCount, 1.5));
        break;
      case 'z-pattern':
        // Alternating left-right with regular timing
        times.push((i / shotCount) * totalDuration);
        break;
      case 'fan':
        // All shots nearly simultaneous in a spread
        times.push(i * 0.08);
        break;
      default:
        times.push((i / shotCount) * totalDuration);
    }
  }
  return times;
}

// ── Roman Candle shot angles ────────────────────────────────────────

export function getRomanCandleShotAngle(shotIndex: number, totalShots: number): number {
  // Slight random variation around vertical
  return (Math.random() - 0.5) * 0.1; // radians from vertical
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

// ── Flame projector ─────────────────────────────────────────────────

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

// ── Laser beam calculation ──────────────────────────────────────────

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
        beams.push({
          origin: [0, 0, 0],
          direction: [Math.sin(angle), Math.cos(angle) * 0.3 + 0.7, 0],
          color, width: 0.02, length: 100,
        });
      }
      break;
    case 'harp':
      for (let i = 0; i < beamCount; i++) {
        const x = ((i / beamCount) - 0.5) * 4;
        beams.push({
          origin: [x, 0, 0],
          direction: [0, 1, 0],
          color, width: 0.015, length: 80,
        });
      }
      break;
    case 'tunnel':
      for (let i = 0; i < beamCount; i++) {
        const angle = (i / beamCount) * Math.PI * 2 + time;
        beams.push({
          origin: [0, 0, 0],
          direction: [Math.cos(angle) * 0.3, 0.3, Math.sin(angle) * 0.3 + 0.7],
          color, width: 0.02, length: 60,
        });
      }
      break;
    case 'cone':
      for (let i = 0; i < beamCount; i++) {
        const angle = (i / beamCount) * Math.PI * 2 + time * 0.5;
        const tilt = 0.3 + Math.sin(time * 2 + i) * 0.1;
        beams.push({
          origin: [0, 0, 0],
          direction: [Math.cos(angle) * tilt, 1 - tilt, Math.sin(angle) * tilt],
          color, width: 0.02, length: 100,
        });
      }
      break;
    default:
      beams.push({
        origin: [0, 0, 0],
        direction: [Math.sin(time * 0.5) * 0.2, 0.9, Math.cos(time * 0.3) * 0.2],
        color, width: 0.03, length: 100,
      });
  }
  
  return beams;
}
