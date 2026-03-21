import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';

const STARS_PER_SHOT = 20;
const TRAIL_POINTS_PER_SHOT = 12;

/**
 * Roman Candle: Fires individual stars with ribbon-style comet trails.
 * Integrated with wind force and ribbon trail rendering.
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
  const trailLinesRef = useRef<THREE.LineSegments>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const totalParticles = shotCount * STARS_PER_SHOT;
  const totalTrailSegs = shotCount * TRAIL_POINTS_PER_SHOT * 2;

  const posArr = useMemo(() => new Float32Array(totalParticles * 3), [totalParticles]);
  const colArr = useMemo(() => new Float32Array(totalParticles * 3), [totalParticles]);
  const trailPosArr = useMemo(() => new Float32Array(totalTrailSegs * 3), [totalTrailSegs]);
  const trailColArr = useMemo(() => new Float32Array(totalTrailSegs * 3), [totalTrailSegs]);

  const shotSeeds = useMemo(() => {
    const seeds: { vx: number; vy: number; vz: number; lt: number }[][] = [];
    for (let s = 0; s < shotCount; s++) {
      const shot: { vx: number; vy: number; vz: number; lt: number }[] = [];
      const tiltAngle = (Math.random() - 0.5) * 0.12;
      const tiltDir = Math.random() * Math.PI * 2;
      for (let j = 0; j < STARS_PER_SHOT; j++) {
        const isMain = j === 0;
        const spread = isMain ? 0 : 0.6;
        shot.push({
          vx: Math.sin(tiltAngle) * Math.cos(tiltDir) * (isMain ? 1.5 : 0) + (Math.random() - 0.5) * spread,
          vy: 16 + Math.random() * 6,
          vz: Math.sin(tiltAngle) * Math.sin(tiltDir) * (isMain ? 1.5 : 0) + (Math.random() - 0.5) * spread,
          lt: isMain ? 1.4 : 0.3 + Math.random() * 0.5,
        });
      }
      seeds.push(shot);
    }
    return seeds;
  }, [shotCount]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const GRAVITY = -9.81;

    // Wind
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const wX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.03 : 0;
    const wZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.03 : 0;

    let trailIdx = 0;

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
        const px = seed.vx * tAdj * dragH + wX * tAdj * tAdj * 0.5;
        const py = Math.max(0, seed.vy * tAdj + 0.5 * GRAVITY * tAdj * tAdj);
        const pz = seed.vz * tAdj * dragH + wZ * tAdj * tAdj * 0.5;

        posArr[idx * 3] = px;
        posArr[idx * 3 + 1] = py;
        posArr[idx * 3 + 2] = pz;

        const age = timeSinceFire / maxVisible;
        const fade = Math.max(0, 1 - age);
        const sparkle = isMain
          ? 0.85 + Math.sin(idx * 7 + progress * 30) * 0.15
          : 0.5 + Math.sin(idx * 19 + progress * 60) * 0.5;

        const brightness = isMain ? 1.0 : 0.5;
        const flashPhase = Math.max(0, 1 - timeSinceFire * 15);
        colArr[idx * 3] = THREE.MathUtils.lerp(baseColor.r, 1.0, flashPhase) * fade * sparkle * brightness;
        colArr[idx * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.9, flashPhase) * fade * sparkle * brightness;
        colArr[idx * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.6, flashPhase) * fade * sparkle * brightness;

        // Ribbon trail for main star — generate line segments along past trajectory
        if (isMain && timeSinceFire > 0 && timeSinceFire < maxVisible) {
          for (let tp = 0; tp < TRAIL_POINTS_PER_SHOT && trailIdx < totalTrailSegs; tp++) {
            const tBack = Math.max(0, tAdj - tp * 0.04);
            const tBack2 = Math.max(0, tAdj - (tp + 1) * 0.04);
            const d1 = Math.exp(-0.05 * tBack);
            const d2 = Math.exp(-0.05 * tBack2);

            const segIdx = trailIdx * 3;
            trailPosArr[segIdx] = seed.vx * tBack * d1 + wX * tBack * tBack * 0.5;
            trailPosArr[segIdx + 1] = Math.max(0, seed.vy * tBack + 0.5 * GRAVITY * tBack * tBack);
            trailPosArr[segIdx + 2] = seed.vz * tBack * d1 + wZ * tBack * tBack * 0.5;

            const segIdx2 = (trailIdx + 1) * 3;
            trailPosArr[segIdx2] = seed.vx * tBack2 * d2 + wX * tBack2 * tBack2 * 0.5;
            trailPosArr[segIdx2 + 1] = Math.max(0, seed.vy * tBack2 + 0.5 * GRAVITY * tBack2 * tBack2);
            trailPosArr[segIdx2 + 2] = seed.vz * tBack2 * d2 + wZ * tBack2 * tBack2 * 0.5;

            const trailFade = Math.max(0, 1 - tp / TRAIL_POINTS_PER_SHOT) * fade * 0.6;
            trailColArr[segIdx] = baseColor.r * trailFade;
            trailColArr[segIdx + 1] = baseColor.g * trailFade * 0.7;
            trailColArr[segIdx + 2] = baseColor.b * trailFade * 0.4;
            trailColArr[segIdx2] = baseColor.r * trailFade * 0.5;
            trailColArr[segIdx2 + 1] = baseColor.g * trailFade * 0.3;
            trailColArr[segIdx2 + 2] = baseColor.b * trailFade * 0.2;

            trailIdx += 2;
          }
        }
      }
    }

    // Clear unused trail segments
    for (let i = trailIdx; i < totalTrailSegs; i++) {
      trailPosArr[i * 3 + 1] = -100;
      trailColArr[i * 3] = 0;
      trailColArr[i * 3 + 1] = 0;
      trailColArr[i * 3 + 2] = 0;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;

    if (trailLinesRef.current) {
      const tGeo = trailLinesRef.current.geometry;
      const tPos = tGeo.getAttribute('position') as THREE.BufferAttribute;
      const tCol = tGeo.getAttribute('color') as THREE.BufferAttribute;
      if (tPos) tPos.needsUpdate = true;
      if (tCol) tCol.needsUpdate = true;
    }
  });

  const angleOffsetRad = (angleOffset * Math.PI) / 180;

  return (
    <group position={position} rotation={[0, 0, angleOffsetRad]}>
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
      {/* Ribbon-style comet trails */}
      <lineSegments ref={trailLinesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPosArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColArr, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.16} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
