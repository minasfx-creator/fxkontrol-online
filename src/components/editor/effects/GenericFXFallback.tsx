/**
 * GenericFXFallback — last-resort visual for any timeline effect whose
 * partType / id does not match a dedicated renderer.
 *
 * Goal: "todos da livraria renderizem no viewport, sem exceção". Instead of
 * silently rendering an off-screen drone marker, we classify by partType /
 * id-prefix heuristics and emit a small but visible representation:
 *
 *   - light / lighting / lightBeam → vertical additive cone (color of effect)
 *   - lancework / ground line       → low ground spark rake
 *   - flame / Showven flame (SHV3*) → orange flame plume
 *   - drone / formation             → small cyan pulse marker
 *   - default                       → soft sparkle puff (peony-ish)
 *
 * Pure presentation. No safety/store interaction. Auto-fades with progress.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position: [number, number, number];
  color?: string;
  progress: number;
  /** Lower-cased classification hint: partType OR derived bucket. */
  kind?: string;
  /** Optional id for finer heuristics (e.g. 'SHV3xxx'). */
  id?: string;
  /** Optional size scale */
  scale?: number;
}

function classify(kind?: string, id?: string):
  | 'light' | 'lancework' | 'flame' | 'drone' | 'sparkle' {
  const k = (kind || '').toLowerCase();
  const i = (id || '').toLowerCase();
  if (k === 'light' || k === 'lighting' || k === 'lightbeam' || k.includes('beam')) return 'light';
  if (k === 'lancework' || k === 'ground' || i.includes('lance')) return 'lancework';
  if (k === 'flame' || i.startsWith('shv3') || i.includes('flame') || i.includes('sparkular')) return 'flame';
  if (k === 'drone' || k === 'formation' || k === 'swarm' || i.startsWith('drone-') || i.startsWith('form-')) return 'drone';
  return 'sparkle';
}

export default function GenericFXFallback({
  position, color = '#FFE0A0', progress, kind, id, scale = 1,
}: Props) {
  const variant = useMemo(() => classify(kind, id), [kind, id]);
  const c = useMemo(() => new THREE.Color(color), [color]);
  const beamRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  // Sparkle particles (small puff, 64 points)
  const PARTICLE_COUNT = 64;
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const colors = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const velocities = useMemo(() => {
    const v = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(2 * Math.random() - 1);
      const r = 2 + Math.random() * 3;
      v[i * 3] = Math.sin(b) * Math.cos(a) * r;
      v[i * 3 + 1] = Math.cos(b) * r + 1;
      v[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    }
    return v;
  }, []);
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_s, dt) => {
    const fade = Math.max(0, 1 - progress);
    if (matRef.current) matRef.current.opacity = fade * 0.6;
    if (pulseRef.current) {
      const s = 1 + Math.sin(progress * Math.PI * 4) * 0.2;
      pulseRef.current.scale.setScalar(s);
    }

    // Sparkle update
    if (pointsRef.current && (variant === 'sparkle' || variant === 'lancework' || variant === 'flame')) {
      const geo = pointsRef.current.geometry;
      const pa = geo.getAttribute('position') as THREE.BufferAttribute;
      const ca = geo.getAttribute('color') as THREE.BufferAttribute;
      const t = progress * 1.6;
      const drag = Math.exp(-0.8 * t);
      const GRAV = variant === 'lancework' ? -0.4 : -3.0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const vx = velocities[ix], vy = velocities[ix + 1], vz = velocities[ix + 2];
        pa.array[ix] = vx * t * drag;
        pa.array[ix + 1] = Math.max(0, vy * t * drag + 0.5 * GRAV * t * t);
        pa.array[ix + 2] = vz * t * drag;
        const k = fade * (0.5 + 0.5 * Math.exp(-2 * progress));
        ca.array[ix] = c.r * k;
        ca.array[ix + 1] = c.g * k;
        ca.array[ix + 2] = c.b * k;
      }
      pa.needsUpdate = true;
      ca.needsUpdate = true;
    }
    void dt;
  });

  if (variant === 'light') {
    // Vertical additive cone — visible from far, scales with progress (pulse)
    const h = 18 * scale;
    return (
      <group position={position} renderOrder={45}>
        <mesh ref={beamRef} position={[0, h / 2, 0]}>
          <coneGeometry args={[2.5 * scale, h, 16, 1, true]} />
          <meshBasicMaterial
            ref={matRef}
            color={c}
            transparent
            opacity={0.4}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh ref={pulseRef} position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.8 * scale, 16, 16]} />
          <meshBasicMaterial color={c} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    );
  }

  if (variant === 'drone') {
    return (
      <group position={position}>
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.35 * scale, 12, 12]} />
          <meshBasicMaterial color="#7DD3FC" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    );
  }

  // sparkle / lancework / flame — additive points puff
  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} count={PARTICLE_COUNT} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} count={PARTICLE_COUNT} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          size={variant === 'flame' ? 0.5 : 0.3}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
