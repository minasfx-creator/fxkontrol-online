/**
 * SkyCanvas 2.0 — ExplosionsLayer.
 *
 * Cada explosão = 96 partículas (Points) com física simples:
 *   pos = origin + dir * radius * (1 - exp(-1.3*t))
 *   y  -= 0.5 * g * t^2  (g=9.8, escala 0.12 para previs cinematográfico)
 *   opacity = (1 - t/life) * 0.95
 *   size    = 1.4 + 1.6 * (1 - t/life)
 *
 * Direções são memoizadas por id da cue (estáveis ao longo do burst).
 */
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ActiveExplosion, Vec3 } from './types';
import { useActiveExplosions } from './useShowSelectors';

const PARTICLES_PER_BURST = 96;
const GRAVITY = 9.8;
const GRAVITY_SCALE = 0.12; // visual scale; pyro previs, not physics-accurate

/** Stable random sphere directions for a given seed. */
function makeDirections(seed: string): Float32Array {
  // simple djb2 hash → deterministic seed
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
  return arr;
}

interface OneExplosionProps {
  data: ActiveExplosion;
}

function OneExplosion({ data }: OneExplosionProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const directions = useMemo(() => makeDirections(data.id), [data.id]);
  const positions = useMemo(
    () => new Float32Array(PARTICLES_PER_BURST * 3),
    [data.id],
  );

  // Seed initial positions at origin so first frame renders without jitter.
  useEffect(() => {
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      positions[i * 3 + 0] = data.origin[0];
      positions[i * 3 + 1] = data.origin[1];
      positions[i * 3 + 2] = data.origin[2];
    }
    const geom = pointsRef.current?.geometry;
    if (geom) (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }, [data.id, data.origin, positions]);

  useFrame(() => {
    const geom = pointsRef.current?.geometry;
    const mat = matRef.current;
    if (!geom || !mat) return;

    const t = Math.max(0, data.age);
    const drag = Math.exp(-1.3 * t);
    const radius = data.height * 0.18;
    const lifeRatio = Math.min(1, t / data.life);
    const gravityDrop = 0.5 * GRAVITY * GRAVITY_SCALE * t * t;

    const [ox, oy, oz] = data.origin;
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const dx = directions[i * 3 + 0];
      const dy = directions[i * 3 + 1];
      const dz = directions[i * 3 + 2];
      const expand = radius * (1 - drag);
      positions[i * 3 + 0] = ox + dx * expand;
      positions[i * 3 + 1] = oy + dy * expand - gravityDrop;
      positions[i * 3 + 2] = oz + dz * expand;
    }
    (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    mat.opacity = Math.max(0, 1 - lifeRatio) * 0.95;
    mat.size = 1.4 + 1.6 * (1 - lifeRatio);
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLES_PER_BURST}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        color={data.color}
        size={2.2}
        sizeAttenuation
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function ExplosionsLayer() {
  const explosions = useActiveExplosions();
  if (explosions.length === 0) return null;
  return (
    <group>
      {explosions.map((e) => (
        <OneExplosion key={e.id} data={e} />
      ))}
    </group>
  );
}

// Re-export the Vec3 type so consumers of the layer don't need to import from types.
export type { Vec3 };
