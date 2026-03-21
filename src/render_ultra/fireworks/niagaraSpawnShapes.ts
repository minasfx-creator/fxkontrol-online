/**
 * FX KONTROL · Niagara Spawn Shapes
 * UE5.7-style spawn shape sampling for particle initialization.
 * Supports 9 shape types with uniform volume/surface distribution.
 */

import * as THREE from 'three';

// ── Shape Types ─────────────────────────────────────────────────────

export type SpawnShapeType =
  | 'point'
  | 'sphere'
  | 'hemisphere'
  | 'cone'
  | 'box'
  | 'torus'
  | 'ring'
  | 'cylinder'
  | 'mesh-surface';

export interface SpawnShapeConfig {
  type: SpawnShapeType;
  /** Radius for sphere/hemisphere/torus/ring/cylinder/cone */
  radius?: number;
  /** Inner radius for torus/ring */
  innerRadius?: number;
  /** Half-extents for box (x,y,z) */
  extents?: THREE.Vector3;
  /** Half-angle in radians for cone */
  coneAngle?: number;
  /** Height for cylinder/cone */
  height?: number;
  /** Whether to sample surface only (vs volume) */
  surfaceOnly?: boolean;
  /** Mesh geometry for mesh-surface sampling */
  meshGeometry?: THREE.BufferGeometry;
}

export interface SpawnSample {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

// ── Helpers ─────────────────────────────────────────────────────────

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Uniform random point inside a unit sphere (cube-root distribution) */
function randomInUnitSphere(): THREE.Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random());
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
    r * Math.cos(phi)
  );
}

/** Uniform random point on unit sphere surface */
function randomOnUnitSphere(): THREE.Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new THREE.Vector3(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi)
  );
}

// ── Shape Samplers ──────────────────────────────────────────────────

function samplePoint(): SpawnSample {
  return { position: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0) };
}

function sampleSphere(radius: number, surfaceOnly: boolean): SpawnSample {
  if (surfaceOnly) {
    const dir = randomOnUnitSphere();
    return { position: dir.multiplyScalar(radius), normal: dir.clone().normalize() };
  }
  const p = randomInUnitSphere().multiplyScalar(radius);
  return { position: p, normal: p.clone().normalize() };
}

function sampleHemisphere(radius: number, surfaceOnly: boolean): SpawnSample {
  const sample = sampleSphere(radius, surfaceOnly);
  sample.position.y = Math.abs(sample.position.y);
  sample.normal.y = Math.abs(sample.normal.y);
  return sample;
}

function sampleCone(radius: number, height: number, coneAngle: number, surfaceOnly: boolean): SpawnSample {
  const t = surfaceOnly ? 1 : Math.cbrt(Math.random());
  const h = t * height;
  const maxR = (h / height) * Math.tan(coneAngle) * radius;
  const angle = Math.random() * Math.PI * 2;
  const r = surfaceOnly ? maxR : maxR * Math.sqrt(Math.random());
  const pos = new THREE.Vector3(Math.cos(angle) * r, h, Math.sin(angle) * r);
  const normal = new THREE.Vector3(Math.cos(angle), Math.tan(coneAngle), Math.sin(angle)).normalize();
  return { position: pos, normal };
}

function sampleBox(extents: THREE.Vector3, surfaceOnly: boolean): SpawnSample {
  if (surfaceOnly) {
    // Pick a random face, then random point on that face
    const face = Math.floor(Math.random() * 6);
    const u = randRange(-1, 1);
    const v = randRange(-1, 1);
    let pos: THREE.Vector3;
    let normal: THREE.Vector3;
    switch (face) {
      case 0: pos = new THREE.Vector3(extents.x, u * extents.y, v * extents.z); normal = new THREE.Vector3(1, 0, 0); break;
      case 1: pos = new THREE.Vector3(-extents.x, u * extents.y, v * extents.z); normal = new THREE.Vector3(-1, 0, 0); break;
      case 2: pos = new THREE.Vector3(u * extents.x, extents.y, v * extents.z); normal = new THREE.Vector3(0, 1, 0); break;
      case 3: pos = new THREE.Vector3(u * extents.x, -extents.y, v * extents.z); normal = new THREE.Vector3(0, -1, 0); break;
      case 4: pos = new THREE.Vector3(u * extents.x, v * extents.y, extents.z); normal = new THREE.Vector3(0, 0, 1); break;
      default: pos = new THREE.Vector3(u * extents.x, v * extents.y, -extents.z); normal = new THREE.Vector3(0, 0, -1); break;
    }
    return { position: pos, normal };
  }
  return {
    position: new THREE.Vector3(
      randRange(-extents.x, extents.x),
      randRange(-extents.y, extents.y),
      randRange(-extents.z, extents.z)
    ),
    normal: new THREE.Vector3(0, 1, 0),
  };
}

function sampleTorus(radius: number, innerRadius: number): SpawnSample {
  const tubeR = innerRadius || radius * 0.25;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 2;
  const x = (radius + tubeR * Math.cos(phi)) * Math.cos(theta);
  const y = tubeR * Math.sin(phi);
  const z = (radius + tubeR * Math.cos(phi)) * Math.sin(theta);
  const centerOnRing = new THREE.Vector3(radius * Math.cos(theta), 0, radius * Math.sin(theta));
  const pos = new THREE.Vector3(x, y, z);
  const normal = pos.clone().sub(centerOnRing).normalize();
  return { position: pos, normal };
}

function sampleRing(radius: number, innerRadius: number): SpawnSample {
  const angle = Math.random() * Math.PI * 2;
  const minR = innerRadius || radius * 0.9;
  const r = randRange(minR, radius);
  return {
    position: new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
    normal: new THREE.Vector3(0, 1, 0),
  };
}

function sampleCylinder(radius: number, height: number, surfaceOnly: boolean): SpawnSample {
  const angle = Math.random() * Math.PI * 2;
  const h = randRange(-height * 0.5, height * 0.5);
  const r = surfaceOnly ? radius : radius * Math.sqrt(Math.random());
  const pos = new THREE.Vector3(Math.cos(angle) * r, h, Math.sin(angle) * r);
  const normal = surfaceOnly
    ? new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle))
    : new THREE.Vector3(0, 1, 0);
  return { position: pos, normal };
}

function sampleMeshSurface(geometry: THREE.BufferGeometry): SpawnSample {
  const posAttr = geometry.getAttribute('position');
  const normalAttr = geometry.getAttribute('normal');
  const index = geometry.index;

  if (!posAttr) return samplePoint();

  if (index && index.count >= 3) {
    // Pick random triangle
    const triIdx = Math.floor(Math.random() * (index.count / 3)) * 3;
    const i0 = index.getX(triIdx);
    const i1 = index.getX(triIdx + 1);
    const i2 = index.getX(triIdx + 2);

    const v0 = new THREE.Vector3().fromBufferAttribute(posAttr, i0);
    const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1);
    const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2);

    // Barycentric coordinates
    let u = Math.random();
    let v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;

    const pos = v0.multiplyScalar(w).add(v1.multiplyScalar(u)).add(v2.multiplyScalar(v));

    let normal = new THREE.Vector3(0, 1, 0);
    if (normalAttr) {
      const n0 = new THREE.Vector3().fromBufferAttribute(normalAttr, i0);
      const n1 = new THREE.Vector3().fromBufferAttribute(normalAttr, i1);
      const n2 = new THREE.Vector3().fromBufferAttribute(normalAttr, i2);
      normal = n0.multiplyScalar(w).add(n1.multiplyScalar(u)).add(n2.multiplyScalar(v)).normalize();
    }
    return { position: pos, normal };
  }

  // Fallback: random vertex
  const idx = Math.floor(Math.random() * posAttr.count);
  const pos = new THREE.Vector3().fromBufferAttribute(posAttr, idx);
  const normal = normalAttr
    ? new THREE.Vector3().fromBufferAttribute(normalAttr, idx).normalize()
    : new THREE.Vector3(0, 1, 0);
  return { position: pos, normal };
}

// ── Public API ──────────────────────────────────────────────────────

export function sampleSpawnShape(config: SpawnShapeConfig): SpawnSample {
  const r = config.radius ?? 10;
  const h = config.height ?? 20;
  const surface = config.surfaceOnly ?? false;

  switch (config.type) {
    case 'point': return samplePoint();
    case 'sphere': return sampleSphere(r, surface);
    case 'hemisphere': return sampleHemisphere(r, surface);
    case 'cone': return sampleCone(r, h, config.coneAngle ?? Math.PI / 6, surface);
    case 'box': return sampleBox(config.extents ?? new THREE.Vector3(10, 10, 10), surface);
    case 'torus': return sampleTorus(r, config.innerRadius ?? r * 0.25);
    case 'ring': return sampleRing(r, config.innerRadius ?? r * 0.9);
    case 'cylinder': return sampleCylinder(r, h, surface);
    case 'mesh-surface':
      return config.meshGeometry ? sampleMeshSurface(config.meshGeometry) : samplePoint();
    default: return samplePoint();
  }
}

/** Create a default spawn shape config */
export function defaultSpawnShapeConfig(type: SpawnShapeType = 'point', overrides?: Partial<SpawnShapeConfig>): SpawnShapeConfig {
  return { type, radius: 10, height: 20, surfaceOnly: false, ...overrides };
}
