/**
 * FX KONTROL · Ground Decal System
 * UE5.7-inspired projected decals for firework scorch marks,
 * light splashes, and environmental detail stamps.
 */

import * as THREE from 'three';

export type DecalType = 'scorch' | 'light-splash' | 'water-ring' | 'debris';

export interface DecalInstance {
  id: string;
  type: DecalType;
  position: THREE.Vector3;
  radius: number;
  rotation: number;        // radians
  color: THREE.Color;
  opacity: number;
  age: number;             // seconds since creation
  maxAge: number;          // seconds before full fade
  fadeInDuration: number;
}

const DECAL_VERTEX = `
  varying vec2 vUv;
  varying float vDist;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDist = length(wp.xz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SCORCH_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uAge;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0;

    // Circular falloff with noisy edges
    float n = noise(vUv * 8.0 + uAge * 0.1);
    float edge = 1.0 - smoothstep(0.5, 0.9 + n * 0.2, dist);

    // Inner core (darker burn)
    float core = 1.0 - smoothstep(0.0, 0.3, dist);
    vec3 color = mix(uColor, uColor * 0.3, core);

    // Radial cracks pattern
    float angle = atan(centered.y, centered.x);
    float cracks = abs(sin(angle * 5.0 + n * 6.28));
    cracks = smoothstep(0.7, 0.9, cracks) * (1.0 - dist) * 0.3;

    float alpha = edge * uOpacity * (1.0 + cracks);
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(color, alpha);
  }
`;

const LIGHT_SPLASH_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uAge;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0;

    // Soft radial glow
    float glow = exp(-dist * dist * 3.0);
    float alpha = glow * uOpacity;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(uColor * (1.0 + glow * 0.5), alpha);
  }
`;

// ─── Decal pool ───

const MAX_DECALS = 32;
const _pool: DecalInstance[] = [];
const _meshPool: THREE.Mesh[] = [];
let _group: THREE.Group | null = null;

function createDecalMesh(type: DecalType): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const fragment = type === 'scorch' ? SCORCH_FRAGMENT : LIGHT_SPLASH_FRAGMENT;
  const blending = type === 'light-splash' ? THREE.AdditiveBlending : THREE.NormalBlending;

  const material = new THREE.ShaderMaterial({
    vertexShader: DECAL_VERTEX,
    fragmentShader: fragment,
    uniforms: {
      uColor: { value: new THREE.Color(0.05, 0.03, 0.02) },
      uOpacity: { value: 1 },
      uAge: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02; // just above ground
  mesh.visible = false;

  return mesh;
}

/**
 * Initialize the decal system. Call once, returns the group to add to scene.
 */
export function createDecalSystem(): THREE.Group {
  _group = new THREE.Group();
  _group.name = 'DecalSystem';

  // Pre-allocate mesh pool
  for (let i = 0; i < MAX_DECALS; i++) {
    const mesh = createDecalMesh('scorch');
    _meshPool.push(mesh);
    _group.add(mesh);
  }

  return _group;
}

/**
 * Spawn a scorch mark decal at position.
 */
export function spawnScorchMark(
  position: THREE.Vector3,
  radius: number,
  color?: THREE.Color,
  maxAge = 30,
): DecalInstance | null {
  return spawnDecal('scorch', position, radius, color || new THREE.Color(0.04, 0.02, 0.01), maxAge);
}

/**
 * Spawn a light splash (ground glow from explosion).
 */
export function spawnLightSplash(
  position: THREE.Vector3,
  radius: number,
  color: THREE.Color,
  maxAge = 3,
): DecalInstance | null {
  return spawnDecal('light-splash', position, radius, color, maxAge, 0.1);
}

function spawnDecal(
  type: DecalType,
  position: THREE.Vector3,
  radius: number,
  color: THREE.Color,
  maxAge: number,
  fadeInDuration = 0.5,
): DecalInstance | null {
  // Evict oldest if at capacity
  if (_pool.length >= MAX_DECALS) {
    _pool.shift();
  }

  const decal: DecalInstance = {
    id: `decal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    position: position.clone(),
    radius,
    rotation: Math.random() * Math.PI * 2,
    color: color.clone(),
    opacity: 0,
    age: 0,
    maxAge,
    fadeInDuration,
  };

  _pool.push(decal);
  return decal;
}

/**
 * Update all decals. Call each frame.
 */
export function updateDecals(dt: number) {
  // Hide all meshes first
  for (const m of _meshPool) m.visible = false;

  // Remove expired
  for (let i = _pool.length - 1; i >= 0; i--) {
    _pool[i].age += dt;
    if (_pool[i].age > _pool[i].maxAge) {
      _pool.splice(i, 1);
    }
  }

  // Assign to mesh pool
  for (let i = 0; i < Math.min(_pool.length, _meshPool.length); i++) {
    const decal = _pool[i];
    const mesh = _meshPool[i];

    // Fade in/out
    const fadeIn = Math.min(decal.age / decal.fadeInDuration, 1);
    const fadeOut = 1 - Math.max(0, (decal.age - decal.maxAge * 0.7) / (decal.maxAge * 0.3));
    decal.opacity = fadeIn * Math.max(0, fadeOut);

    mesh.visible = decal.opacity > 0.01;
    mesh.position.set(decal.position.x, 0.02, decal.position.z);
    mesh.scale.set(decal.radius * 2, decal.radius * 2, 1);
    mesh.rotation.z = decal.rotation;

    const mat = mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uColor.value.copy(decal.color);
    mat.uniforms.uOpacity.value = decal.opacity;
    mat.uniforms.uAge.value = decal.age;

    // Update blend mode based on type
    mat.blending = decal.type === 'light-splash' ? THREE.AdditiveBlending : THREE.NormalBlending;
  }
}

/**
 * Clear all decals.
 */
export function clearDecals() {
  _pool.length = 0;
  for (const m of _meshPool) m.visible = false;
}

/**
 * Get active decal count.
 */
export function getActiveDecalCount(): number {
  return _pool.length;
}
