import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getRocketApogee, getRocketMotorBurnTime, getStarCount, getBreakSpeed, getStarLifetime, GRAVITY } from '@/lib/pyroPhysics';

const EXHAUST_COUNT = 200;
const BURST_COUNT = 120;

/**
 * RocketEffect — Self-propelled aerial device (cohete) from Manual de Pirotecnia.
 * Motor exhaust trail, stick stabilizer visible during ascent, apogee burst.
 */
export default function RocketEffect({
  position,
  color,
  progress,
  caliber = 3,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
}) {
  const exhaustRef = useRef<THREE.Points>(null);
  const burstRef = useRef<THREE.Points>(null);
  const apogee = useMemo(() => getRocketApogee(caliber), [caliber]);
  const motorBurn = useMemo(() => getRocketMotorBurnTime(caliber), [caliber]);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // Motor phase = 0..0.4, coast = 0.4..0.55, burst = 0.55..1.0
  const motorEnd = 0.4;
  const burstStart = 0.55;

  const exhaustPos = useMemo(() => new Float32Array(EXHAUST_COUNT * 3), []);
  const exhaustCol = useMemo(() => new Float32Array(EXHAUST_COUNT * 3), []);
  const burstPos = useMemo(() => new Float32Array(BURST_COUNT * 3), []);
  const burstCol = useMemo(() => new Float32Array(BURST_COUNT * 3), []);

  const exhaustSeeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number }[] = [];
    for (let i = 0; i < EXHAUST_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: 3 + Math.random() * 8,
        spread: 0.1 + Math.random() * 0.25,
        lt: 0.15 + Math.random() * 0.35,
      });
    }
    return s;
  }, []);

  const burstSeeds = useMemo(() => {
    const s: { vx: number; vy: number; vz: number; lt: number }[] = [];
    const breakSpeed = getBreakSpeed(caliber) * 0.8;
    for (let i = 0; i < BURST_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const sp = breakSpeed * (0.5 + Math.random() * 0.5);
      s.push({
        vx: Math.sin(phi) * Math.cos(theta) * sp,
        vy: Math.cos(phi) * sp * 0.85,
        vz: Math.sin(phi) * Math.sin(theta) * sp,
        lt: getStarLifetime(caliber) * (0.6 + Math.random() * 0.4),
      });
    }
    return s;
  }, [caliber]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    // Rocket Y position
    const motorPhase = Math.min(1, progress / motorEnd);
    const rocketY = motorPhase * motorPhase * apogee; // accelerating ascent

    // Exhaust particles
    if (exhaustRef.current && progress < burstStart) {
      for (let i = 0; i < EXHAUST_COUNT; i++) {
        const seed = exhaustSeeds[i];
        const age = ((time * 4 + i * 0.1) % seed.lt) / seed.lt;
        if (progress > motorEnd || age > motorPhase) {
          exhaustPos[i * 3] = 0; exhaustPos[i * 3 + 1] = -200; exhaustPos[i * 3 + 2] = 0;
          exhaustCol[i * 3] = 0; exhaustCol[i * 3 + 1] = 0; exhaustCol[i * 3 + 2] = 0;
          continue;
        }
        const t = age * seed.lt;
        exhaustPos[i * 3] = Math.cos(seed.angle) * seed.spread * t;
        exhaustPos[i * 3 + 1] = rocketY - seed.speed * t;
        exhaustPos[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * t;

        const fade = (1 - age) * (progress < motorEnd ? 1 : 0);
        const thermal = 1 - age;
        exhaustCol[i * 3] = THREE.MathUtils.lerp(1.0, 0.4, age) * fade;
        exhaustCol[i * 3 + 1] = THREE.MathUtils.lerp(0.8, 0.15, age) * fade;
        exhaustCol[i * 3 + 2] = THREE.MathUtils.lerp(0.3, 0.05, age) * fade;
      }
      const geo = exhaustRef.current.geometry;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // Burst particles
    if (burstRef.current && progress > burstStart) {
      const burstAge = (progress - burstStart) / (1 - burstStart);
      for (let i = 0; i < BURST_COUNT; i++) {
        const seed = burstSeeds[i];
        const t = burstAge * seed.lt * 2;
        const drag = Math.exp(-0.06 * t);
        burstPos[i * 3] = seed.vx * t * 0.3 * drag;
        burstPos[i * 3 + 1] = apogee + seed.vy * t * 0.3 * drag + 0.5 * GRAVITY * t * t * 0.1;
        burstPos[i * 3 + 2] = seed.vz * t * 0.3 * drag;

        const fade = Math.max(0, 1 - burstAge * 1.2);
        const flash = burstAge < 0.05 ? 1.0 : 0;
        burstCol[i * 3] = (baseColor.r + flash) * fade;
        burstCol[i * 3 + 1] = (baseColor.g + flash * 0.9) * fade;
        burstCol[i * 3 + 2] = (baseColor.b + flash * 0.6) * fade;
      }
      const geo = burstRef.current.geometry;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1) return null;
  const motorPhase = Math.min(1, progress / motorEnd);
  const rocketY = motorPhase * motorPhase * apogee;

  return (
    <group position={position}>
      {/* Rocket body + stick during ascent */}
      {progress < burstStart && (
        <>
          {/* Body */}
          <mesh position={[0, rocketY, 0]}>
            <cylinderGeometry args={[0.03 + caliber * 0.01, 0.05 + caliber * 0.015, 0.3 + caliber * 0.05, 6]} />
            <meshBasicMaterial color="#555555" />
          </mesh>
          {/* Stick */}
          <mesh position={[0, rocketY - 0.4, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.8, 4]} />
            <meshBasicMaterial color="#8B7355" />
          </mesh>
          {/* Motor flame */}
          {progress < motorEnd && (
            <mesh position={[0, rocketY - 0.15, 0]}>
              <sphereGeometry args={[0.08 + caliber * 0.02, 8, 8]} />
              <meshBasicMaterial color="#FFDD44" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          )}
        </>
      )}

      {/* Exhaust trail */}
      <points ref={exhaustRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[exhaustPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[exhaustCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Apogee burst */}
      {progress > burstStart && (
        <>
          {progress < burstStart + 0.05 && (
            <mesh position={[0, apogee, 0]} scale={1.5 + caliber * 0.5}>
              <sphereGeometry args={[1, 12, 12]} />
              <meshBasicMaterial color="#FFFFEE" transparent opacity={0.5 * (1 - (progress - burstStart) / 0.05)} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          )}
          <points ref={burstRef} frustumCulled={false}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[burstPos, 3]} />
              <bufferAttribute attach="attributes-color" args={[burstCol, 3]} />
            </bufferGeometry>
            <pointsMaterial size={0.1 + caliber * 0.03} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
          </points>
        </>
      )}
    </group>
  );
}
