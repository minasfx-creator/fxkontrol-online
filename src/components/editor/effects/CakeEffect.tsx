import { useMemo } from 'react';
import * as THREE from 'three';

const PARTICLES_PER_SHOT = 40;
const GRAVITY = -9.81;

function CakeShot({
  offset,
  color,
  progress,
  seed,
  angle,
}: {
  offset: [number, number, number];
  color: string;
  progress: number;
  seed: number;
  angle: number;
}) {
  const { velocities, lifetimes } = useMemo(() => {
    const v = new Float32Array(PARTICLES_PER_SHOT * 3);
    const l = new Float32Array(PARTICLES_PER_SHOT);
    const rng = (i: number) => Math.sin(seed * 9999 + i * 7919) * 0.5 + 0.5;
    for (let i = 0; i < PARTICLES_PER_SHOT; i++) {
      const theta = rng(i * 2) * Math.PI * 2;
      const phi = Math.acos(2 * rng(i * 2 + 1) - 1);
      const speed = 4 + rng(i * 3) * 8;
      v[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      v[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * 0.8 + 2;
      v[i * 3 + 2] = Math.cos(phi) * speed;
      l[i] = 0.5 + rng(i * 4) * 0.6;
    }
    return { velocities: v, lifetimes: l };
  }, [seed]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  if (progress <= 0 || progress > 1) return null;

  // Lift phase: shell rises before burst
  const liftTime = 0.3;
  const isLifting = progress < liftTime;
  
  if (isLifting) {
    // Rising shell
    const liftProgress = progress / liftTime;
    const shellY = liftProgress * 15;
    return (
      <group position={offset}>
        <mesh position={[Math.sin(angle) * liftProgress * 2, shellY, Math.cos(angle) * liftProgress * 0.5]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshBasicMaterial color="#FFFFCC" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Comet trail during lift */}
        {Array.from({ length: 5 }).map((_, j) => {
          const trailY = shellY * (1 - j * 0.15);
          const fade = 1 - j * 0.2;
          return (
            <mesh key={j} position={[Math.sin(angle) * liftProgress * 2 * (1 - j * 0.1), trailY, 0]}>
              <sphereGeometry args={[0.04, 4, 4]} />
              <meshBasicMaterial color={color} transparent opacity={0.3 * fade} blending={THREE.AdditiveBlending} />
            </mesh>
          );
        })}
      </group>
    );
  }

  // Burst phase
  const burstProgress = (progress - liftTime) / (1 - liftTime);
  const t = burstProgress * 2;
  const positions = new Float32Array(PARTICLES_PER_SHOT * 3);
  const colors = new Float32Array(PARTICLES_PER_SHOT * 3);

  for (let i = 0; i < PARTICLES_PER_SHOT; i++) {
    const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
    const fade = Math.max(0, 1 - burstProgress / lifetimes[i]);
    positions[i * 3] = vx * t * 0.4;
    positions[i * 3 + 1] = 15 + vy * t * 0.4 + 0.5 * GRAVITY * t * t * 0.15;
    positions[i * 3 + 2] = vz * t * 0.4;

    const sparkle = 0.7 + Math.sin(i * 13 + burstProgress * 30) * 0.3;
    colors[i * 3] = baseColor.r * fade * sparkle;
    colors[i * 3 + 1] = baseColor.g * fade * sparkle;
    colors[i * 3 + 2] = baseColor.b * fade * sparkle;
  }

  return (
    <group position={offset}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.14} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

/**
 * Cake / Battery Effect: Multi-shot device firing shells sequentially.
 * Based on Finale 3D cake behavior with lift + break for each sub-shell.
 */
export default function CakeEffect({
  position,
  color,
  progress,
  shotCount = 16,
  pattern = 'regular',
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  shotCount?: number;
  pattern?: 'regular' | 'z-pattern' | 'fan';
}) {
  const shots = useMemo(() => {
    const s: { delay: number; angle: number; seed: number; offset: [number, number, number] }[] = [];
    for (let i = 0; i < shotCount; i++) {
      let angle = 0;
      let ox = 0, oz = 0;
      if (pattern === 'z-pattern') {
        angle = ((i % 2 === 0 ? 1 : -1) * (i / shotCount)) * 0.4;
        ox = ((i % 2 === 0 ? 1 : -1)) * 0.5;
      } else if (pattern === 'fan') {
        angle = ((i / shotCount) - 0.5) * 1.2;
        ox = Math.sin(angle) * 0.3;
      }
      s.push({
        delay: (i / shotCount) * 0.9, // spread across 90% of duration
        angle,
        seed: i + 1,
        offset: [ox, 0, oz] as [number, number, number],
      });
    }
    return s;
  }, [shotCount, pattern]);

  return (
    <group position={position}>
      {shots.map((shot, i) => {
        const shotProgress = (progress - shot.delay) / (1 - shot.delay) * shotCount * 0.5;
        return (
          <CakeShot
            key={i}
            offset={shot.offset}
            color={color}
            progress={Math.max(0, Math.min(1, shotProgress))}
            seed={shot.seed}
            angle={shot.angle}
          />
        );
      })}
    </group>
  );
}
