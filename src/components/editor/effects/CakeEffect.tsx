import { useMemo } from 'react';
import * as THREE from 'three';
import { getBreakHeight, getMortarVelocity, GRAVITY, getStarLifetime } from '@/lib/pyroPhysics';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const PARTICLES_PER_SHOT = 55;

function CakeShot({
  offset,
  color,
  progress,
  seed,
  angle,
  caliber,
}: {
  offset: [number, number, number];
  color: string;
  progress: number;
  seed: number;
  angle: number;
  caliber: number;
}) {
  const breakH = useMemo(() => getBreakHeight(caliber), [caliber]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);
  const starLife = useMemo(() => getStarLifetime(caliber), [caliber]);

  const { velocities, lifetimes } = useMemo(() => {
    const v = new Float32Array(PARTICLES_PER_SHOT * 3);
    const l = new Float32Array(PARTICLES_PER_SHOT);
    const rng = (i: number) => Math.sin(seed * 9999 + i * 7919) * 0.5 + 0.5;
    const breakSpeed = 5 + caliber * 2.5; // larger caliber = wider burst
    for (let i = 0; i < PARTICLES_PER_SHOT; i++) {
      const theta = rng(i * 2) * Math.PI * 2;
      const phi = Math.acos(2 * rng(i * 2 + 1) - 1);
      const speed = breakSpeed * (0.6 + rng(i * 3) * 0.4);
      v[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      v[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed * 0.85 + 1.5;
      v[i * 3 + 2] = Math.cos(phi) * speed;
      l[i] = starLife * (0.6 + rng(i * 4) * 0.4);
    }
    return { velocities: v, lifetimes: l };
  }, [seed, caliber, starLife]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  if (progress <= 0 || progress > 1) return null;

  // Lift phase: shell rises with real physics
  const liftFraction = 0.25;
  const isLifting = progress < liftFraction;

  if (isLifting) {
    const liftProgress = progress / liftFraction;
    const t = liftProgress * (v0 / Math.abs(GRAVITY)); 
    const shellY = Math.min(breakH, v0 * t * 0.3 + 0.5 * GRAVITY * t * t * 0.09);
    const realY = Math.max(0, liftProgress * breakH * 0.7);
    return (
      <group position={offset}>
        {/* Rising shell */}
        <mesh position={[Math.sin(angle) * liftProgress * 1.5, realY, Math.cos(angle) * liftProgress * 0.3]}>
          <sphereGeometry args={[0.06 + caliber * 0.01, 6, 6]} />
          <meshBasicMaterial color="#FFFFCC" transparent opacity={0.9} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Comet trail during lift — longer and brighter */}
        {Array.from({ length: 8 }).map((_, j) => {
          const trailY = realY * (1 - j * 0.1);
          const fade = Math.pow(1 - j / 8, 1.8);
          return (
            <mesh key={j} position={[Math.sin(angle) * liftProgress * 1.5 * (1 - j * 0.05), trailY, 0]}>
              <sphereGeometry args={[0.03 + caliber * 0.005, 4, 4]} />
              <meshBasicMaterial color="#FFCC66" transparent opacity={0.4 * fade} blending={THREE.AdditiveBlending} />
            </mesh>
          );
        })}
        {/* Muzzle flash */}
        {progress < 0.04 && (
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.3 + caliber * 0.08, 8, 8]} />
            <meshBasicMaterial color="#FFEEAA" transparent opacity={0.5 * (1 - progress / 0.04)} blending={THREE.AdditiveBlending} />
          </mesh>
        )}
      </group>
    );
  }

  // Burst phase — realistic star spread with gravity and drag
  const burstProgress = (progress - liftFraction) / (1 - liftFraction);
  const t = burstProgress * starLife;
  const positions = new Float32Array(PARTICLES_PER_SHOT * 3);
  const colors = new Float32Array(PARTICLES_PER_SHOT * 3);
  const drag = 0.03 + caliber * 0.005;

  for (let i = 0; i < PARTICLES_PER_SHOT; i++) {
    const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
    const life = lifetimes[i];
    const age = burstProgress / life;
    const fade = Math.max(0, 1 - age);
    const dragFactor = Math.exp(-drag * t);

    positions[i * 3] = vx * t * 0.35 * dragFactor;
    positions[i * 3 + 1] = breakH * 0.7 + vy * t * 0.35 * dragFactor + 0.5 * GRAVITY * t * t * 0.12;
    positions[i * 3 + 2] = vz * t * 0.35 * dragFactor;

    // Color: white-hot flash → base color → dim ember
    const flashPhase = Math.max(0, 1 - burstProgress * 8); // quick white flash
    const sparkle = 0.75 + Math.sin(i * 13 + burstProgress * 25) * 0.25;
    colors[i * 3] = THREE.MathUtils.lerp(baseColor.r, 1.0, flashPhase) * fade * sparkle;
    colors[i * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.95, flashPhase) * fade * sparkle;
    colors[i * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.7, flashPhase) * fade * sparkle;
  }

  return (
    <group position={offset}>
      {/* Break flash */}
      {burstProgress < 0.08 && (
        <mesh position={[0, breakH * 0.7, 0]}>
          <sphereGeometry args={[0.8 + caliber * 0.3, 12, 12]} />
          <meshBasicMaterial color="#FFFFEE" transparent opacity={0.4 * (1 - burstProgress / 0.08)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.12 + caliber * 0.02} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}

/**
 * Cake / Battery Effect: Multi-shot device firing shells sequentially.
 * Realistic physics: caliber-based break height, star spread, and gravity.
 */
export default function CakeEffect({
  position,
  color,
  progress,
  shotCount = 16,
  pattern = 'regular',
  caliber = 2,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  shotCount?: number;
  pattern?: 'regular' | 'z-pattern' | 'fan';
  caliber?: number;
}) {
  const shots = useMemo(() => {
    const s: { delay: number; angle: number; seed: number; offset: [number, number, number] }[] = [];
    for (let i = 0; i < shotCount; i++) {
      let angle = 0;
      let ox = 0, oz = 0;
      if (pattern === 'z-pattern') {
        angle = ((i % 2 === 0 ? 1 : -1) * (i / shotCount)) * 0.35;
        ox = ((i % 2 === 0 ? 1 : -1)) * 0.3;
      } else if (pattern === 'fan') {
        angle = ((i / shotCount) - 0.5) * 1.0;
        ox = Math.sin(angle) * 0.2;
      }
      s.push({
        delay: (i / shotCount) * 0.85,
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
        const shotDuration = 1 / shotCount * 2.5;
        const shotProgress = (progress - shot.delay) / shotDuration;
        return (
          <CakeShot
            key={i}
            offset={shot.offset}
            color={color}
            progress={Math.max(0, Math.min(1, shotProgress))}
            seed={shot.seed}
            angle={shot.angle}
            caliber={caliber}
          />
        );
      })}
    </group>
  );
}
