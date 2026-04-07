import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { combustionFlicker, temporalFlicker, thermalColorRamp } from '@/lib/pyroNoise';
import { getChemistryForRendering, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';

const STARS_PER_SHOT = 24;
const TRAIL_POINTS_PER_SHOT = 16;
const SPARK_SHOWER_PER_SHOT = 8;

/**
 * Roman Candle: Fires individual stars with realistic ballistic arcs.
 * Enhanced physics:
 *  - Proper ballistic trajectory: v*t + 0.5*g*t² with quadratic drag
 *  - Tube exit flash per shot
 *  - Star ignition delay (stars brighten after exiting tube)
 *  - Spark shower from tube mouth on each firing
 *  - Ribbon-style comet trails with taper
 *  - Angle offset support for angled candles
 *  - Wind integration, combustion flicker, thermal color ramp
 */
export default function RomanCandleEffect({
  position,
  color,
  progress,
  shotCount = 8,
  caliber = 2,
  angleOffset = 0,
  formulationId,
  launchHeading = 0,
  launchPitch = 85,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  shotCount?: number;
  caliber?: number;
  angleOffset?: number;
  formulationId?: string;
  launchHeading?: number;
  launchPitch?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailLinesRef = useRef<THREE.LineSegments>(null);
  const sparkShowerRef = useRef<THREE.Points>(null);

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
  const totalShowerParticles = shotCount * SPARK_SHOWER_PER_SHOT;

  const posArr = useMemo(() => new Float32Array(totalParticles * 3), [totalParticles]);
  const colArr = useMemo(() => new Float32Array(totalParticles * 3), [totalParticles]);
  const trailPosArr = useMemo(() => new Float32Array(totalTrailSegs * 3), [totalTrailSegs]);
  const trailColArr = useMemo(() => new Float32Array(totalTrailSegs * 3), [totalTrailSegs]);
  const showerPos = useMemo(() => new Float32Array(totalShowerParticles * 3), [totalShowerParticles]);
  const showerCol = useMemo(() => new Float32Array(totalShowerParticles * 3), [totalShowerParticles]);

  // Exit velocity scales with caliber (larger candles = more propellant)
  const exitVelocity = useMemo(() => 14 + caliber * 3, [caliber]);

  const shotSeeds = useMemo(() => {
    const seeds: { vx: number; vy: number; vz: number; lt: number; seed: number; ignitionDelay: number }[][] = [];
    for (let s = 0; s < shotCount; s++) {
      const shot: { vx: number; vy: number; vz: number; lt: number; seed: number; ignitionDelay: number }[] = [];
      // Each shot has slight random tilt from tube axis
      const tiltAngle = (Math.random() - 0.5) * 0.1;
      const tiltDir = Math.random() * Math.PI * 2;
      for (let j = 0; j < STARS_PER_SHOT; j++) {
        const isMain = j === 0;
        const spread = isMain ? 0 : 0.5 + Math.random() * 0.3;
        shot.push({
          vx: Math.sin(tiltAngle) * Math.cos(tiltDir) * (isMain ? 1.2 : 0) + (Math.random() - 0.5) * spread,
          vy: exitVelocity + Math.random() * 4,
          vz: Math.sin(tiltAngle) * Math.sin(tiltDir) * (isMain ? 1.2 : 0) + (Math.random() - 0.5) * spread,
          lt: isMain ? 1.6 + Math.random() * 0.4 : 0.2 + Math.random() * 0.4,
          seed: Math.random() * 999 + s * STARS_PER_SHOT + j,
          ignitionDelay: isMain ? 0.05 + Math.random() * 0.05 : 0, // star ignites after tube exit
        });
      }
      seeds.push(shot);
    }
    return seeds;
  }, [shotCount, exitVelocity]);

  // Spark shower seeds per shot
  const showerSeeds = useMemo(() => {
    const s: { vx: number; vy: number; vz: number; lt: number }[][] = [];
    for (let shot = 0; shot < shotCount; shot++) {
      const shower: { vx: number; vy: number; vz: number; lt: number }[] = [];
      for (let j = 0; j < SPARK_SHOWER_PER_SHOT; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        shower.push({
          vx: Math.cos(angle) * speed,
          vy: 2 + Math.random() * 4,
          vz: Math.sin(angle) * speed,
          lt: 0.15 + Math.random() * 0.2,
        });
      }
      s.push(shower);
    }
    return s;
  }, [shotCount]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const GRAVITY = -9.81;
    const time = clock.getElapsedTime();

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
        const trailDelay = isMain ? 0 : j * 0.012;
        const tAdj = Math.max(0, t - trailDelay);

        // Quadratic drag: F_drag ∝ v², approximated as exponential decay
        const dragCoeff = isMain ? 0.04 : 0.08; // main star has less drag (larger mass)
        const dragH = Math.exp(-dragCoeff * tAdj);

        // Ballistic arc: x = v0*t*drag, y = v0y*t + 0.5*g*t²
        const px = seed.vx * tAdj * dragH + wX * tAdj * tAdj * 0.5;
        const py = Math.max(0, seed.vy * tAdj * dragH + 0.5 * GRAVITY * tAdj * tAdj);
        const pz = seed.vz * tAdj * dragH + wZ * tAdj * tAdj * 0.5;

        posArr[idx * 3] = px;
        posArr[idx * 3 + 1] = py;
        posArr[idx * 3 + 2] = pz;

        const age = timeSinceFire / maxVisible;

        // Ignition delay: star brightens after clearing tube
        const ignitionFactor = isMain && timeSinceFire < seed.ignitionDelay
          ? timeSinceFire / seed.ignitionDelay * 0.3
          : 1.0;

        const fade = Math.max(0, 1 - age) * ignitionFactor;

        const flicker = isMain
          ? combustionFlicker(seed.seed, time, 1.15)
          : temporalFlicker(seed.seed, time, 0.55, 0.35, 0.30);

        const brightness = isMain ? 1.0 : 0.45;
        const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, age, isMain ? 1.5 : 1.0);

        colArr[idx * 3] = thermal.r * fade * flicker * brightness;
        colArr[idx * 3 + 1] = thermal.g * fade * flicker * brightness;
        colArr[idx * 3 + 2] = thermal.b * fade * flicker * brightness;

        // ── Ribbon trail for main star ──
        if (isMain && timeSinceFire > seed.ignitionDelay && timeSinceFire < maxVisible) {
          for (let tp = 0; tp < TRAIL_POINTS_PER_SHOT && trailIdx < totalTrailSegs; tp++) {
            const tBack = Math.max(0, tAdj - tp * 0.035);
            const tBack2 = Math.max(0, tAdj - (tp + 1) * 0.035);
            const d1 = Math.exp(-dragCoeff * tBack);
            const d2 = Math.exp(-dragCoeff * tBack2);

            const segIdx = trailIdx * 3;
            trailPosArr[segIdx] = seed.vx * tBack * d1 + wX * tBack * tBack * 0.5;
            trailPosArr[segIdx + 1] = Math.max(0, seed.vy * tBack * d1 + 0.5 * GRAVITY * tBack * tBack);
            trailPosArr[segIdx + 2] = seed.vz * tBack * d1 + wZ * tBack * tBack * 0.5;

            const segIdx2 = (trailIdx + 1) * 3;
            trailPosArr[segIdx2] = seed.vx * tBack2 * d2 + wX * tBack2 * tBack2 * 0.5;
            trailPosArr[segIdx2 + 1] = Math.max(0, seed.vy * tBack2 * d2 + 0.5 * GRAVITY * tBack2 * tBack2);
            trailPosArr[segIdx2 + 2] = seed.vz * tBack2 * d2 + wZ * tBack2 * tBack2 * 0.5;

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

      // ── Spark shower at tube mouth ──
      if (sparkShowerRef.current) {
        const showerTimeSinceFire = progress - shotTime;
        for (let j = 0; j < SPARK_SHOWER_PER_SHOT; j++) {
          const sIdx = s * SPARK_SHOWER_PER_SHOT + j;
          const ss = showerSeeds[s][j];

          if (showerTimeSinceFire < 0 || showerTimeSinceFire > ss.lt * 3) {
            showerPos[sIdx * 3 + 1] = -100;
            showerCol[sIdx * 3] = 0; showerCol[sIdx * 3 + 1] = 0; showerCol[sIdx * 3 + 2] = 0;
            continue;
          }

          const st = showerTimeSinceFire * 4;
          const sDrag = Math.exp(-4 * st);
          showerPos[sIdx * 3] = ss.vx * st * sDrag;
          showerPos[sIdx * 3 + 1] = Math.max(0, ss.vy * st * sDrag - 4.9 * st * st);
          showerPos[sIdx * 3 + 2] = ss.vz * st * sDrag;

          const sFade = Math.max(0, 1 - showerTimeSinceFire / (ss.lt * 3));
          showerCol[sIdx * 3] = 1.2 * sFade;
          showerCol[sIdx * 3 + 1] = 0.9 * sFade;
          showerCol[sIdx * 3 + 2] = 0.4 * sFade;
        }
      }
    }

    // Clear unused trail segments
    for (let i = trailIdx; i < totalTrailSegs; i++) {
      trailPosArr[i * 3 + 1] = -100;
      trailColArr[i * 3] = 0; trailColArr[i * 3 + 1] = 0; trailColArr[i * 3 + 2] = 0;
    }

    (pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (pointsRef.current.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    if (trailLinesRef.current) {
      (trailLinesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (trailLinesRef.current.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    if (sparkShowerRef.current) {
      (sparkShowerRef.current.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (sparkShowerRef.current.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  const launchRotation = useMemo(() => {
    const headingRad = -(launchHeading || 0) * Math.PI / 180;
    const pitchRad = (90 - (launchPitch || 85)) * Math.PI / 180;
    return new THREE.Euler(pitchRad, headingRad, 0, 'YXZ');
  }, [launchHeading, launchPitch]);

  return (
    <group position={position} rotation={launchRotation} renderOrder={50}>
      {/* Tube exit flash */}
      {Array.from({ length: shotCount }).map((_, s) => {
        const shotTime = s / shotCount;
        const dt = progress - shotTime;
        if (dt < 0 || dt > 0.035) return null;
        const flashIntensity = 1 - dt / 0.035;
        return (
          <mesh key={s} position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.2 + dt * 6, 8, 8]} />
            <meshBasicMaterial color="#FFFFCC" transparent opacity={0.6 * flashIntensity} blending={THREE.AdditiveBlending} depthTest={false} />
          </mesh>
        );
      })}

      {/* Spark shower from tube mouth */}
      <points ref={sparkShowerRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[showerPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[showerCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.85} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Ribbon-style comet trails */}
      <lineSegments ref={trailLinesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPosArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColArr, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.7} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} />
      </lineSegments>

      {/* Star particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.18} vertexColors transparent opacity={0.95} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
