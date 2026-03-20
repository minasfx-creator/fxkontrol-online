import { useMemo } from 'react';
import * as THREE from 'three';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

// Reuse the FireworkBurst from SkyCanvas but with staggered timing
// Import it as a lazy inline to avoid circular deps - we'll define a mini burst here

const PARTICLE_COUNT = 60;
const GRAVITY = -4;

function particlePos(vx: number, vy: number, vz: number, t: number): [number, number, number] {
  return [vx * t * 0.5, vy * t * 0.5 + 0.5 * GRAVITY * t * t * 0.25, vz * t * 0.5];
}

function MiniBurst({
  offset,
  color,
  progress,
  seed,
}: {
  offset: [number, number, number];
  color: string;
  progress: number;
  seed: number;
}) {
  const { velocities, lifetimes } = useMemo(() => {
    const v = new Float32Array(PARTICLE_COUNT * 3);
    const l = new Float32Array(PARTICLE_COUNT);
    const rng = (i: number) => Math.sin(seed * 9999 + i * 7919) * 0.5 + 0.5;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = rng(i * 2) * Math.PI * 2;
      const phi = Math.acos(2 * rng(i * 2 + 1) - 1);
      const speed = 1.5 + rng(i * 3) * 4;
      v[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      v[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * 0.8 + 0.5;
      v[i * 3 + 2] = Math.cos(phi) * speed;
      l[i] = 0.4 + rng(i * 4) * 0.5;
    }
    return { velocities: v, lifetimes: l };
  }, [seed]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  if (progress <= 0 || progress > 1) return null;

  const t = progress * 2.5;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const vx = velocities[i * 3];
    const vy = velocities[i * 3 + 1];
    const vz = velocities[i * 3 + 2];
    const fade = Math.max(0, 1 - progress / lifetimes[i]);

    const [hx, hy, hz] = particlePos(vx, vy, vz, t);
    positions[i * 3] = hx;
    positions[i * 3 + 1] = hy;
    positions[i * 3 + 2] = hz;

    colors[i * 3] = baseColor.r * fade;
    colors[i * 3 + 1] = baseColor.g * fade;
    colors[i * 3 + 2] = baseColor.b * fade;
  }

  return (
    <group position={offset}>
      {/* Glow handled by bloom — no pointLight to avoid uniform overflow */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

/**
 * MultiBurst: Multiple sequential explosions at staggered times and offset positions.
 */
export default function MultiBurstEffect({
  position,
  color,
  progress,
  burstCount = 3,
  caliber = 3,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  burstCount?: number;
  caliber?: number;
}) {
  // Scale burst spread based on caliber
  const burstScale = 0.7 + caliber * 0.12;
  const bursts = useMemo(() => {
    const b: { offset: [number, number, number]; delay: number; seed: number }[] = [];
    for (let i = 0; i < burstCount; i++) {
      const angle = (i / burstCount) * Math.PI * 2;
      const r = (1.5 + i * 0.8) * burstScale;
      b.push({
        offset: [
          Math.cos(angle) * r,
          (i - burstCount / 2) * 1.2 * burstScale,
          Math.sin(angle) * r,
        ] as [number, number, number],
        delay: i * 0.18,
        seed: i + 1,
      });
    }
    return b;
  }, [burstCount]);

  return (
    <group position={position}>
      {bursts.map((burst, i) => {
        const burstProgress = (progress - burst.delay) / (1 - burst.delay);
        return (
          <MiniBurst
            key={i}
            offset={burst.offset}
            color={color}
            progress={Math.max(0, Math.min(1, burstProgress))}
            seed={burst.seed}
          />
        );
      })}
    </group>
  );
}
