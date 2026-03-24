/**
 * FX KONTROL · Niagara Force Modules
 * UE5.7-style physics modules: attractors, vortex, orbit, wind, kill zones, collision.
 */

import * as THREE from 'three';

// ── Base Force Module ───────────────────────────────────────────────

export type ForceModuleType = 'point-attractor' | 'vortex' | 'orbit' | 'wind' | 'kill-zone' | 'collision';

export interface ForceModule {
  type: ForceModuleType;
  id: string;
  enabled: boolean;
}

export interface ForceResult {
  velocityDelta: THREE.Vector3;
  kill?: boolean;
  /** For collision: new position after bounce */
  newPosition?: THREE.Vector3;
}

// ── Point Attractor ─────────────────────────────────────────────────

export interface PointAttractorModule extends ForceModule {
  type: 'point-attractor';
  position: THREE.Vector3;
  strength: number;
  /** Falloff: 0 = constant, 1 = linear, 2 = quadratic */
  falloffExponent: number;
  /** Max radius of influence; 0 = infinite */
  radius: number;
  /** Negative strength = repel */
}

export function createPointAttractor(id: string, config?: Partial<Omit<PointAttractorModule, 'type' | 'id'>>): PointAttractorModule {
  return {
    type: 'point-attractor', id, enabled: true,
    position: new THREE.Vector3(),
    strength: 50,
    falloffExponent: 1,
    radius: 0,
    ...config,
  };
}

export function applyPointAttractor(
  mod: PointAttractorModule, particlePos: THREE.Vector3, dt: number
): ForceResult {
  const dir = new THREE.Vector3().subVectors(mod.position, particlePos);
  const dist = dir.length();
  if (dist < 0.001) return { velocityDelta: new THREE.Vector3() };
  if (mod.radius > 0 && dist > mod.radius) return { velocityDelta: new THREE.Vector3() };

  dir.normalize();
  let forceMag = mod.strength;
  if (mod.falloffExponent > 0) {
    forceMag /= Math.pow(Math.max(dist, 0.1), mod.falloffExponent);
  }
  return { velocityDelta: dir.multiplyScalar(forceMag * dt) };
}

// ── Vortex ──────────────────────────────────────────────────────────

export interface VortexModule extends ForceModule {
  type: 'vortex';
  axis: THREE.Vector3;
  center: THREE.Vector3;
  strength: number;
  /** Inward pull strength (0 = pure rotation) */
  pullStrength: number;
  radius: number;
}

export function createVortex(id: string, config?: Partial<Omit<VortexModule, 'type' | 'id'>>): VortexModule {
  return {
    type: 'vortex', id, enabled: true,
    axis: new THREE.Vector3(0, 1, 0),
    center: new THREE.Vector3(),
    strength: 10,
    pullStrength: 0,
    radius: 50,
    ...config,
  };
}

export function applyVortex(
  mod: VortexModule, particlePos: THREE.Vector3, dt: number
): ForceResult {
  const toParticle = new THREE.Vector3().subVectors(particlePos, mod.center);
  // Project onto plane perpendicular to axis
  const axisN = mod.axis.clone().normalize();
  const alongAxis = axisN.clone().multiplyScalar(toParticle.dot(axisN));
  const radial = toParticle.clone().sub(alongAxis);
  const dist = radial.length();

  if (dist < 0.001 || (mod.radius > 0 && dist > mod.radius)) {
    return { velocityDelta: new THREE.Vector3() };
  }

  // Tangential force (cross product of axis and radial direction)
  const tangent = new THREE.Vector3().crossVectors(axisN, radial).normalize();
  const vel = tangent.multiplyScalar(mod.strength * dt);

  // Optional inward pull
  if (mod.pullStrength !== 0) {
    const inward = radial.clone().normalize().multiplyScalar(-mod.pullStrength * dt);
    vel.add(inward);
  }

  return { velocityDelta: vel };
}

// ── Orbit ───────────────────────────────────────────────────────────

export interface OrbitModule extends ForceModule {
  type: 'orbit';
  center: THREE.Vector3;
  axis: THREE.Vector3;
  orbitSpeed: number;
  /** Radius offset added per second (spiral in/out) */
  radialDrift: number;
}

export function createOrbit(id: string, config?: Partial<Omit<OrbitModule, 'type' | 'id'>>): OrbitModule {
  return {
    type: 'orbit', id, enabled: true,
    center: new THREE.Vector3(),
    axis: new THREE.Vector3(0, 1, 0),
    orbitSpeed: 3,
    radialDrift: 0,
    ...config,
  };
}

export function applyOrbit(
  mod: OrbitModule, particlePos: THREE.Vector3, dt: number
): ForceResult {
  const toParticle = new THREE.Vector3().subVectors(particlePos, mod.center);
  const axisN = mod.axis.clone().normalize();
  const alongAxis = axisN.clone().multiplyScalar(toParticle.dot(axisN));
  const radial = toParticle.clone().sub(alongAxis);
  const dist = radial.length();

  if (dist < 0.001) return { velocityDelta: new THREE.Vector3() };

  // Tangential velocity for orbit
  const tangent = new THREE.Vector3().crossVectors(axisN, radial).normalize();
  const vel = tangent.multiplyScalar(mod.orbitSpeed * dist);

  // Radial drift
  if (mod.radialDrift !== 0) {
    vel.add(radial.clone().normalize().multiplyScalar(mod.radialDrift));
  }

  // Convert desired velocity to delta (replace current radial velocity)
  return { velocityDelta: vel.multiplyScalar(dt) };
}

// ── Wind ────────────────────────────────────────────────────────────

export interface WindModule extends ForceModule {
  type: 'wind';
  direction: THREE.Vector3;
  strength: number;
  /** Turbulence intensity (0 = laminar, 1 = chaotic) */
  turbulence: number;
  turbulenceScale: number;
  /** Internal time accumulator */
  _time?: number;
}

export function createWind(id: string, config?: Partial<Omit<WindModule, 'type' | 'id'>>): WindModule {
  return {
    type: 'wind', id, enabled: true,
    direction: new THREE.Vector3(1, 0, 0),
    strength: 5,
    turbulence: 0.3,
    turbulenceScale: 0.1,
    _time: 0,
    ...config,
  };
}

export function applyWind(
  mod: WindModule, particlePos: THREE.Vector3, dt: number, systemTime: number
): ForceResult {
  const baseForce = mod.direction.clone().normalize().multiplyScalar(mod.strength * dt);

  if (mod.turbulence > 0) {
    const s = mod.turbulenceScale;
    const t = systemTime;
    // Pseudo-turbulence via sin combinations
    const tx = Math.sin(particlePos.x * s + t * 1.7) * Math.cos(particlePos.z * s * 0.8 + t * 2.3);
    const ty = Math.sin(particlePos.y * s * 1.2 + t * 1.1) * Math.cos(particlePos.x * s + t * 0.9);
    const tz = Math.cos(particlePos.z * s + t * 2.1) * Math.sin(particlePos.y * s * 0.7 + t * 1.5);
    baseForce.add(new THREE.Vector3(tx, ty, tz).multiplyScalar(mod.turbulence * mod.strength * dt));
  }

  return { velocityDelta: baseForce };
}

// ── Kill Zone ───────────────────────────────────────────────────────

export type KillZoneShape = 'box' | 'sphere';
export type KillZoneMode = 'kill-inside' | 'kill-outside';

export interface KillZoneModule extends ForceModule {
  type: 'kill-zone';
  shape: KillZoneShape;
  center: THREE.Vector3;
  /** Radius for sphere, or half-extents for box */
  size: THREE.Vector3;
  mode: KillZoneMode;
}

export function createKillZone(id: string, config?: Partial<Omit<KillZoneModule, 'type' | 'id'>>): KillZoneModule {
  return {
    type: 'kill-zone', id, enabled: true,
    shape: 'box',
    center: new THREE.Vector3(),
    size: new THREE.Vector3(100, 100, 100),
    mode: 'kill-outside',
    ...config,
  };
}

export function applyKillZone(mod: KillZoneModule, particlePos: THREE.Vector3): ForceResult {
  let inside = false;
  const rel = new THREE.Vector3().subVectors(particlePos, mod.center);

  if (mod.shape === 'sphere') {
    inside = rel.length() <= mod.size.x;
  } else {
    inside = Math.abs(rel.x) <= mod.size.x &&
             Math.abs(rel.y) <= mod.size.y &&
             Math.abs(rel.z) <= mod.size.z;
  }

  const shouldKill = (mod.mode === 'kill-inside' && inside) || (mod.mode === 'kill-outside' && !inside);
  return { velocityDelta: new THREE.Vector3(), kill: shouldKill };
}

// ── Collision (Ground Plane) ────────────────────────────────────────

export interface CollisionModule extends ForceModule {
  type: 'collision';
  /** Ground plane Y position */
  planeY: number;
  /** Bounce coefficient (0 = no bounce, 1 = perfect elastic) */
  restitution: number;
  /** Friction applied on ground contact (0-1) */
  friction: number;
  /** Kill particle after N bounces (0 = never kill) */
  maxBounces: number;
}

export function createCollision(id: string, config?: Partial<Omit<CollisionModule, 'type' | 'id'>>): CollisionModule {
  return {
    type: 'collision', id, enabled: true,
    planeY: 0,
    restitution: 0.4,
    friction: 0.3,
    maxBounces: 0,
    ...config,
  };
}

export function applyCollision(
  mod: CollisionModule,
  particlePos: THREE.Vector3,
  particleVel: THREE.Vector3,
  bounceCount: number,
  dt: number
): ForceResult & { bounced: boolean; newBounceCount: number } {
  if (particlePos.y > mod.planeY) {
    return { velocityDelta: new THREE.Vector3(), bounced: false, newBounceCount: bounceCount };
  }

  // Kill if max bounces exceeded
  if (mod.maxBounces > 0 && bounceCount >= mod.maxBounces) {
    return { velocityDelta: new THREE.Vector3(), kill: true, bounced: false, newBounceCount: bounceCount };
  }

  // Reflect velocity
  const newVelY = -particleVel.y * mod.restitution;
  const frictionScale = 1 - mod.friction;
  const velDelta = new THREE.Vector3(
    particleVel.x * (frictionScale - 1),
    newVelY - particleVel.y,
    particleVel.z * (frictionScale - 1)
  );

  return {
    velocityDelta: velDelta,
    newPosition: new THREE.Vector3(particlePos.x, mod.planeY + 0.01, particlePos.z),
    bounced: true,
    newBounceCount: bounceCount + 1,
  };
}

// ── Universal Apply ─────────────────────────────────────────────────

export function applyForceModule(
  mod: ForceModule,
  particlePos: THREE.Vector3,
  particleVel: THREE.Vector3,
  dt: number,
  systemTime: number,
  bounceCount?: number
): ForceResult & { bounced?: boolean; newBounceCount?: number } {
  if (!mod.enabled) return { velocityDelta: new THREE.Vector3() };

  switch (mod.type) {
    case 'point-attractor': return applyPointAttractor(mod as PointAttractorModule, particlePos, dt);
    case 'vortex': return applyVortex(mod as VortexModule, particlePos, dt);
    case 'orbit': return applyOrbit(mod as OrbitModule, particlePos, dt);
    case 'wind': return applyWind(mod as WindModule, particlePos, dt, systemTime);
    case 'kill-zone': return applyKillZone(mod as KillZoneModule, particlePos);
    case 'collision': return applyCollision(mod as CollisionModule, particlePos, particleVel, bounceCount ?? 0, dt);
    default: return { velocityDelta: new THREE.Vector3() };
  }
}
