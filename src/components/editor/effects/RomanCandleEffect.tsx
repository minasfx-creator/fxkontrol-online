import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { combustionFlicker, temporalFlicker, thermalColorRamp } from '@/lib/pyroNoise';
import { getChemistryForRendering, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';

const STARS_PER_SHOT = 20;
const TRAIL_POINTS_PER_SHOT = 12;

/**
 * Roman Candle: Fires individual stars with ribbon-style comet trails.
 * Integrated with wind, combustion flicker (main star), temporal flicker
 * (sparks), and thermal color ramp.
 */
export default function RomanCandleEffect({
  position,
  color,
  progress,
  shotCount = 8,
  caliber = 2,
  angleOffset = 0,
  formulationId,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  shotCount?: number;
  caliber?: number;
  angleOffset?: number;
  formulationId?: string;
}) {
  const chemistry = useMemo(() => {
    const fId = formulationId || autoMatchFormulation(color, 'candle', caliber);
    return fId ? getChemistryForRendering(fId) : null;
  }, [formulationId, color, caliber]);

  const baseColor = useMemo(() => {
    if (chemistry?.resultColor) return chemistry.resultColor.clone();
    return new THREE.Color(color);
  }, [color, chemistry]);
  const totalParticles = shotCount * STARS_PER_SHOT;
  const totalTrailSegs = shotCount * TRAIL_POINTS_PER_SHOT * 2;

  const posArr = useMemo(() => new Float32Array(totalParticles * 3), [totalParticles]);
  const colArr = useMemo(() => new Float32Array(totalParticles * 3), [totalParticles]);
  const trailPosArr = useMemo(() => new Float32Array(totalTrailSegs * 3), [totalTrailSegs]);
  const trailColArr = useMemo(() => new Float32Array(totalTrailSegs * 3), [totalTrailSegs]);

  const shotSeeds = useMemo(() => {
    const seeds: { vx: number; vy: number; vz: number; lt: number; seed: number }[][] = [];
    for (let s = 0; s < shotCount; s++) {
      const shot: { vx: number; vy: number; vz: number; lt: number; seed: number }[] = [];
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
          seed: Math.random() * 999 + s * STARS_PER_SHOT + j,
        });
      }
      seeds.push(shot);
    }
    return seeds;
  }, [shotCount]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const GRAVITY = -9.81;
    const time = clock.getElapsedTime();

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
        
        // Main star: combustion flicker; sparks: temporal flicker
        const flicker = isMain
          ? combustionFlicker(seed.seed, time, 1.1)
          : temporalFlicker(seed.seed, time, 0.55, 0.35, 0.30);

        const brightness = isMain ? 1.0 : 0.5;
        
        // Thermal color ramp for natural cooling
        const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, age, isMain ? 1.5 : 1.0);
        
        colArr[idx * 3] = thermal.r * fade * flicker * brightness;
        colArr[idx * 3 + 1] = thermal.g * fade * flicker * brightness;
        colArr[idx * 3 + 2] = thermal.b * fade * flicker * brightness;

        // Ribbon trail for main star
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

            // Trail uses thermal ramp too — brighter for main star trail segments
            const trailAge = tp / TRAIL_POINTS_PER_SHOT;
            const trailThermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, trailAge * 0.6 + age * 0.4, 1.2);
            const trailFade = Math.max(0, 1 - tp / TRAIL_POINTS_PER_SHOT) * fade * 0.7;
            
            trailColArr[segIdx] = trailThermal.r * trailFade;
            trailColArr[segIdx + 1] = trailThermal.g * trailFade * 0.7;
            trailColArr[segIdx + 2] = trailThermal.b * trailFade * 0.4;
            trailColArr[segIdx2] = trailThermal.r * trailFade * 0.5;
            trailColArr[segIdx2 + 1] = trailThermal.g * trailFade * 0.3;
            trailColArr[segIdx2 + 2] = trailThermal.b * trailFade * 0.2;

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
