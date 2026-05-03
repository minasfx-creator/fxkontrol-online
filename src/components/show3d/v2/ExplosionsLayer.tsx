/**
 * SkyCanvas 2.0 — ExplosionsLayer (frame-synced).
 *
 * One <OneExplosion> per BurstSpec, mounted ALL THE TIME. Each instance
 * computes its own `age = max(0, showTime - burstStart)` per frame using
 * `useShowTimeRef`, then:
 *   - particles only get written when age ∈ [0, life]
 *   - opacity → 0 outside the burst window (visually invisible)
 * This means scrub jumps to any time and the next frame snaps the burst
 * into the right physics state without any React reconciliation.
 *
 * Pause: `showTime` stops moving → age frozen → particles locked in place.
 */
import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type BurstSpec, useBurstSpecs } from './useShowSelectors';
import { useShowTimeRef, type ShowTimeRef } from './useShowTimeRef';

const PARTICLES_PER_BURST = 96;
const GRAVITY = 9.8;
const GRAVITY_SCALE = 0.12;

/** djb2 + LCG → deterministic random direction set for an id. */
function makeDirections(seed: string): Float32Array {
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
  spec: BurstSpec;
  timeRef: React.MutableRefObject<ShowTimeRef>;
}

function OneExplosion({ spec, timeRef }: OneExplosionProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const directions = useMemo(() => makeDirections(spec.id), [spec.id]);
  const positions = useMemo(
    () => new Float32Array(PARTICLES_PER_BURST * 3),
    [spec.id],
  );

  // Seed positions at origin so first frame doesn't draw at (0,0,0).
  useEffect(() => {
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      positions[i * 3 + 0] = spec.origin[0];
      positions[i * 3 + 1] = spec.origin[1];
      positions[i * 3 + 2] = spec.origin[2];
    }
    const geom = pointsRef.current?.geometry;
    if (geom) (geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }, [spec.id, spec.origin, positions]);

  useFrame(() => {
    const geom = pointsRef.current?.geometry;
    const mat = matRef.current;
    if (!geom || !mat) return;

    const showTime = timeRef.current.time;
    const t = showTime - spec.burstStart;

    // Outside the burst window → fully transparent. Cheap branch keeps the
    // points alive in the scene but invisible (no per-frame writes).
    if (t < 0 || t > spec.life) {
      if (mat.opacity !== 0) mat.opacity = 0;
      return;
    }

    const drag = Math.exp(-1.3 * t);
    const radius = spec.height * 0.18;
    const lifeRatio = Math.min(1, t / spec.life);
    const gravityDrop = 0.5 * GRAVITY * GRAVITY_SCALE * t * t;

    const [ox, oy, oz] = spec.origin;
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
        color={spec.color}
        size={2.2}
        sizeAttenuation
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export function ExplosionsLayer() {
  const specs = useBurstSpecs();
  const timeRef = useShowTimeRef();
  if (specs.length === 0) return null;
  return (
    <group>
      {specs.map((spec) => (
        <OneExplosion key={spec.id} spec={spec} timeRef={timeRef} />
      ))}
    </group>
  );
}
