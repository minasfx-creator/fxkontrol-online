import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STARS_PER_SHOT = 20;

/**
 * Roman Candle: Fires individual stars at regular intervals from a tube.
 * Realistic: each star is a single bright ball with a short comet trail,
 * launches nearly vertical with slight random wobble, arcs under gravity,
 * height ~15-25m for typical roman candles, individual star colors.
 */
export default function RomanCandleEffect({
  position,
  color,
  progress,
  shotCount = 8,
  caliber = 2,
  angleOffset = 0,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  shotCount?: number;
  caliber?: number;
  angleOffset?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const totalParticles = shotCount * STARS_PER_SHOT;

  const shotSeeds = useMemo(() => {
    const seeds: { vx: number; vy: number; vz: number; lt: number }[][] = [];
    for (let s = 0; s < shotCount; s++) {
      const shot: { vx: number; vy: number; vz: number; lt: number }[] = [];
      const tiltAngle = (Math.random() - 0.5) * 0.12; // near-vertical
      const tiltDir = Math.random() * Math.PI * 2;
      for (let j = 0; j < STARS_PER_SHOT; j++) {
        const isMain = j === 0; // first particle is the star, rest are trail
        const spread = isMain ? 0 : 0.6;
        shot.push({
          vx: Math.sin(tiltAngle) * Math.cos(tiltDir) * (isMain ? 1.5 : 0) + (Math.random() - 0.5) * spread,
          vy: 16 + Math.random() * 6, // 16-22 m/s — realistic for roman candle
          vz: Math.sin(tiltAngle) * Math.sin(tiltDir) * (isMain ? 1.5 : 0) + (Math.random() - 0.5) * spread,
          lt: isMain ? 1.4 : 0.3 + Math.random() * 0.5, // main star lasts longer
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
      const shotTime = s / shotCount;
      const timeSinceFire = progress - shotTime;

      for (let j = 0; j < STARS_PER_SHOT; j++) {
        const idx = s * STARS_PER_SHOT + j;
        const seed = shotSeeds[s][j];
        const maxVisible = seed.lt * (1 / shotCount) * 2.5;

        if (timeSinceFire < 0 || timeSinceFire > maxVisible) {
          posArr[idx * 3] = 0; posArr[idx * 3 + 1] = -100; posArr[idx * 3 + 2] = 0;
          colArr[idx * 3] = 0; colArr[idx * 3 + 1] = 0; colArr[idx * 3 + 2] = 0;
          continue;
        }

        const t = timeSinceFire * 3.5;
        const isMain = j === 0;
        const trailDelay = isMain ? 0 : j * 0.015;
        const tAdj = Math.max(0, t - trailDelay);

        const dragH = Math.exp(-0.05 * tAdj);
        posArr[idx * 3] = seed.vx * tAdj * dragH;
        posArr[idx * 3 + 1] = Math.max(0, seed.vy * tAdj + 0.5 * GRAVITY * tAdj * tAdj);
        posArr[idx * 3 + 2] = seed.vz * tAdj * dragH;

        const age = timeSinceFire / maxVisible;
        const fade = Math.max(0, 1 - age);
        const sparkle = isMain
          ? 0.85 + Math.sin(idx * 7 + progress * 30) * 0.15
          : 0.5 + Math.sin(idx * 19 + progress * 60) * 0.5;

        // Main star is brighter, trail particles are dimmer
        const brightness = isMain ? 1.0 : 0.5;
        const flashPhase = Math.max(0, 1 - timeSinceFire * 15);
        colArr[idx * 3] = THREE.MathUtils.lerp(baseColor.r, 1.0, flashPhase) * fade * sparkle * brightness;
        colArr[idx * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.9, flashPhase) * fade * sparkle * brightness;
        colArr[idx * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.6, flashPhase) * fade * sparkle * brightness;
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
        if (dt < 0 || dt > 0.04) return null;
        return (
          <mesh key={s} position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.25 + dt * 8, 8, 8]} />
            <meshBasicMaterial color="#FFFFCC" transparent opacity={0.5 * (1 - dt / 0.04)} blending={THREE.AdditiveBlending} />
          </mesh>
        );
      })}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(totalParticles * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(totalParticles * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.16} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
