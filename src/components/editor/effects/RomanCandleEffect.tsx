import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STARS_PER_SHOT = 15;

/**
 * Roman Candle: Fires individual stars at regular intervals from a tube.
 * Realistic physics: each star launches with lift velocity, arcs under gravity.
 */
export default function RomanCandleEffect({
  position,
  color,
  progress,
  shotCount = 8,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  shotCount?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const totalParticles = shotCount * STARS_PER_SHOT;

  const shotSeeds = useMemo(() => {
    const seeds: { vx: number; vy: number; vz: number; lt: number }[][] = [];
    for (let s = 0; s < shotCount; s++) {
      const shot: { vx: number; vy: number; vz: number; lt: number }[] = [];
      const baseAngle = (Math.random() - 0.5) * 0.15;
      for (let j = 0; j < STARS_PER_SHOT; j++) {
        const spread = 0.3;
        shot.push({
          vx: Math.sin(baseAngle) * 2 + (Math.random() - 0.5) * spread,
          vy: 18 + Math.random() * 8,
          vz: (Math.random() - 0.5) * spread,
          lt: 1.0 + Math.random() * 0.8,
        });
      }
      seeds.push(shot);
    }
    return seeds;
  }, [shotCount]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const posArr = new Float32Array(totalParticles * 3);
    const colArr = new Float32Array(totalParticles * 3);
    const GRAVITY = -9.81;

    for (let s = 0; s < shotCount; s++) {
      const shotTime = s / shotCount; // normalized fire time
      const timeSinceFire = progress - shotTime;
      
      for (let j = 0; j < STARS_PER_SHOT; j++) {
        const idx = s * STARS_PER_SHOT + j;
        const seed = shotSeeds[s][j];

        if (timeSinceFire < 0 || timeSinceFire > seed.lt * (1 / shotCount) * 2) {
          posArr[idx * 3] = 0; posArr[idx * 3 + 1] = -100; posArr[idx * 3 + 2] = 0;
          colArr[idx * 3] = 0; colArr[idx * 3 + 1] = 0; colArr[idx * 3 + 2] = 0;
          continue;
        }

        const t = timeSinceFire * 3;
        const drag = 0.88;
        posArr[idx * 3] = seed.vx * t * drag;
        posArr[idx * 3 + 1] = Math.max(0, seed.vy * t + 0.5 * GRAVITY * t * t);
        posArr[idx * 3 + 2] = seed.vz * t * drag;

        const age = timeSinceFire / (seed.lt * (1 / shotCount) * 2);
        const fade = Math.max(0, 1 - age);
        const sparkle = 0.7 + Math.sin(idx * 13 + progress * 50) * 0.3;
        
        // Color shifts: white-hot → base color → dim
        colArr[idx * 3] = THREE.MathUtils.lerp(1, baseColor.r, age * 0.7) * fade * sparkle;
        colArr[idx * 3 + 1] = THREE.MathUtils.lerp(0.9, baseColor.g, age * 0.8) * fade * sparkle;
        colArr[idx * 3 + 2] = THREE.MathUtils.lerp(0.7, baseColor.b, age * 0.9) * fade * sparkle;
      }
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Muzzle flash per shot */}
      {Array.from({ length: shotCount }).map((_, s) => {
        const shotTime = s / shotCount;
        const dt = progress - shotTime;
        if (dt < 0 || dt > 0.05) return null;
        return (
          <mesh key={s} position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.3 + dt * 10, 8, 8]} />
            <meshBasicMaterial color="#FFFFCC" transparent opacity={0.5 * (1 - dt / 0.05)} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(totalParticles * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(totalParticles * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.18} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
