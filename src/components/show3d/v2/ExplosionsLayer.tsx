/**
 * SkyCanvas 2.0 — ExplosionsLayer (pooled, single draw call).
 *
 * Replaces the per-burst <points> approach with ONE merged Points system
 * sized for POOL_SIZE simultaneous bursts. Each frame we:
 *   1. Walk the burst specs and assign each currently-active spec to a pool
 *      slot (LRU eviction if we run out — oldest finishing first).
 *   2. Write per-particle position/size for active slots only; inactive
 *      slots get aSize=0 so the GPU draws nothing for them.
 *
 * Result: O(1) <points>/material/geometry regardless of cue count, zero
 * per-frame allocations, deterministic physics preserved (each burst still
 * derives state purely from `showTime - burstStart`).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useBurstSpecs } from './useShowSelectors';
import { useShowTimeRef } from './useShowTimeRef';
import { setPerfBursts } from './PerfHUD';

const PARTICLES_PER_BURST = 96;
const POOL_SIZE = 256; // up to 256 simultaneous bursts on screen
const TOTAL_PARTICLES = PARTICLES_PER_BURST * POOL_SIZE;
const GRAVITY = 9.8;
const GRAVITY_SCALE = 0.12;

/** Deterministic per-id direction set, cached across frames. */
const DIR_CACHE = new Map<string, Float32Array>();
function getDirections(seed: string): Float32Array {
  const cached = DIR_CACHE.get(seed);
  if (cached) return cached;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  let state = h >>> 0;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  const arr = new Float32Array(PARTICLES_PER_BURST * 3);
  for (let i = 0; i < PARTICLES_PER_BURST; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    const speed = 0.7 + rand() * 0.6;
    arr[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
    arr[i * 3 + 1] = Math.cos(phi) * speed;
    arr[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
  }
  // Cap cache to avoid unbounded growth.
  if (DIR_CACHE.size > 1024) DIR_CACHE.clear();
  DIR_CACHE.set(seed, arr);
  return arr;
}

const VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * (300.0 / -mv.z);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    if (vAlpha <= 0.0) discard;
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = dot(c, c);
    if (d > 0.25) discard;
    float falloff = smoothstep(0.25, 0.0, d);
    gl_FragColor = vec4(vColor * falloff, vAlpha * falloff);
  }
`;

export function ExplosionsLayer() {
  const specs = useBurstSpecs();
  const timeRef = useShowTimeRef();
  const pointsRef = useRef<THREE.Points>(null);

  // Persistent typed arrays + slot bookkeeping. Allocated once.
  const buffers = useMemo(() => {
    const positions = new Float32Array(TOTAL_PARTICLES * 3);
    const colors = new Float32Array(TOTAL_PARTICLES * 3);
    const sizes = new Float32Array(TOTAL_PARTICLES);
    const alphas = new Float32Array(TOTAL_PARTICLES);
    // slot → spec.id (or null when free). LRU via ascending index on assign.
    const slotOwner: (string | null)[] = new Array(POOL_SIZE).fill(null);
    const idToSlot = new Map<string, number>();
    const tmpColor = new THREE.Color();
    return { positions, colors, sizes, alphas, slotOwner, idToSlot, tmpColor };
  }, []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(buffers.sizes, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(buffers.alphas, 1));
    g.setDrawRange(0, TOTAL_PARTICLES);
    return g;
  }, [buffers]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
      }),
    [],
  );

  // Dispose deterministically on unmount (M5 disposal).
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);


  useFrame(() => {
    const showTime = timeRef.current.time;
    const { positions, colors, sizes, alphas, slotOwner, idToSlot, tmpColor } = buffers;

    // 1. Build active list and free slots whose owners are no longer active.
    //    We mutate idToSlot in place to avoid alloc.
    const activeIds = new Set<string>();
    for (const spec of specs) {
      const t = showTime - spec.burstStart;
      if (t >= 0 && t <= spec.life) activeIds.add(spec.id);
    }
    for (const [id, slot] of idToSlot) {
      if (!activeIds.has(id)) {
        idToSlot.delete(id);
        slotOwner[slot] = null;
        // Zero out sizes for that slot so GPU draws nothing.
        const base = slot * PARTICLES_PER_BURST;
        for (let i = 0; i < PARTICLES_PER_BURST; i++) {
          sizes[base + i] = 0;
          alphas[base + i] = 0;
        }
      }
    }

    // 2. Assign slots to active specs that don't have one yet.
    let cursor = 0;
    for (const spec of specs) {
      if (!activeIds.has(spec.id)) continue;
      if (idToSlot.has(spec.id)) continue;
      // Find next free slot from cursor; if exhausted, evict slot 0 (oldest).
      let slot = -1;
      while (cursor < POOL_SIZE) {
        if (slotOwner[cursor] === null) {
          slot = cursor;
          break;
        }
        cursor++;
      }
      if (slot === -1) {
        // Pool full → evict oldest (first non-null).
        for (let i = 0; i < POOL_SIZE; i++) {
          if (slotOwner[i] !== null) {
            const evictedId = slotOwner[i]!;
            idToSlot.delete(evictedId);
            slot = i;
            break;
          }
        }
        if (slot === -1) continue;
      }
      slotOwner[slot] = spec.id;
      idToSlot.set(spec.id, slot);
    }

    // 3. Write per-particle state for each active spec.
    for (const spec of specs) {
      const slot = idToSlot.get(spec.id);
      if (slot === undefined) continue;
      const t = showTime - spec.burstStart;
      const drag = Math.exp(-1.3 * t);
      const radius = spec.height * 0.18;
      const lifeRatio = Math.min(1, t / spec.life);
      const gravityDrop = 0.5 * GRAVITY * GRAVITY_SCALE * t * t;
      const expand = radius * (1 - drag);
      const alpha = Math.max(0, 1 - lifeRatio) * 0.95;
      const size = 1.4 + 1.6 * (1 - lifeRatio);

      tmpColor.set(spec.color);
      const cr = tmpColor.r;
      const cg = tmpColor.g;
      const cb = tmpColor.b;

      const dirs = getDirections(spec.id);
      const [ox, oy, oz] = spec.origin;
      const base = slot * PARTICLES_PER_BURST;
      for (let i = 0; i < PARTICLES_PER_BURST; i++) {
        const p3 = (base + i) * 3;
        positions[p3 + 0] = ox + dirs[i * 3 + 0] * expand;
        positions[p3 + 1] = oy + dirs[i * 3 + 1] * expand - gravityDrop;
        positions[p3 + 2] = oz + dirs[i * 3 + 2] * expand;
        colors[p3 + 0] = cr;
        colors[p3 + 1] = cg;
        colors[p3 + 2] = cb;
        sizes[base + i] = size;
        alphas[base + i] = alpha;
      }
    }

    // 4. Mark dirty (single flag per attribute per frame).
    const geom = pointsRef.current?.geometry;
    if (geom) {
      (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geom.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
  );
}
