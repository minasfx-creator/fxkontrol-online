import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { temporalFlicker, thermalColorRamp } from '@/lib/pyroNoise';

const SPARK_COUNT = 300;
const NOZZLE_COUNT = 6; // 6 radial nozzles

/**
 * GirandolaEffect — Spinning firework wheel that lifts off the ground.
 * 
 * Physics model:
 * - N radial nozzles produce thrust tangentially → angular acceleration
 * - Vertical thrust component lifts the device
 * - Angular velocity increases over time (spin-up)
 * - Sparks are emitted from each nozzle tip with centrifugal + thrust velocity
 * - Wind affects the lifted device and sparks independently
 * - Drag and gravity on sparks
 */
export default function GirandolaEffect({
  position,
  color,
  progress,
  caliber = 3,
  nozzleCount = NOZZLE_COUNT,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
  nozzleCount?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const sparkPosArr = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);
  const sparkColArr = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);

  // Pre-computed spark seeds
  const sparkSeeds = useMemo(() => {
    const s = new Float32Array(SPARK_COUNT * 5); // nozzle, detachProgress, speed, drag, seed
    for (let i = 0; i < SPARK_COUNT; i++) {
      s[i * 5] = i % nozzleCount; // which nozzle
      s[i * 5 + 1] = (Math.floor(i / nozzleCount) / (SPARK_COUNT / nozzleCount)); // detach progress
      s[i * 5 + 2] = 2.0 + Math.random() * 4.0; // ejection speed
      s[i * 5 + 3] = 0.92 + Math.random() * 0.06; // drag factor
      s[i * 5 + 4] = Math.random() * 999 + i; // flicker seed
    }
    return s;
  }, [nozzleCount]);

  // Girandola physics constants
  const armLength = 0.6 + caliber * 0.15; // radius of the wheel
  const thrustForce = 12 + caliber * 3; // thrust per nozzle
  const liftFraction = 0.35; // fraction of thrust going up
  const mass = 0.5 + caliber * 0.2;

  useFrame(({ clock }) => {
    if (!pointsRef.current || progress <= 0) return;

    const time = clock.getElapsedTime();
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.03 : 0;
    const windZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.03 : 0;

    // Spin physics: angular velocity increases with progress (spin-up)
    const spinUpRate = 3.5;
    const maxOmega = 15 + caliber * 3;
    const omega = maxOmega * (1 - Math.exp(-spinUpRate * progress));
    const totalAngle = maxOmega * (progress + (Math.exp(-spinUpRate * progress) - 1) / spinUpRate);

    // Lift
    const liftAccel = (thrustForce * nozzleCount * liftFraction / mass) - 9.81;
    const liftT = progress * 3.0;
    const deviceY = Math.max(0, 0.5 * Math.max(0, liftAccel) * liftT * liftT * 0.15);
    const deviceDriftX = windX * liftT * liftT * 0.2;
    const deviceDriftZ = windZ * liftT * liftT * 0.2;

    // Gyroscopic precession: spin axis traces a cone
    // Precession rate inversely proportional to omega (gyroscopic stability)
    const precessionRate = 0.8 / (1 + omega * 0.1);
    const precessionAngle = time * precessionRate;
    // Tilt angle grows with omega, capped at ~15°
    const tiltAngle = Math.min(0.25, omega * 0.008);
    // Precession rotation: tilt axis direction rotates around Y
    const tiltX = Math.sin(precessionAngle) * tiltAngle;
    const tiltZ = Math.cos(precessionAngle) * tiltAngle;

    // Intensity envelope
    const intensity = progress < 0.05 ? progress / 0.05 :
                      progress > 0.85 ? (1 - progress) / 0.15 : 1.0;

    // Helper: apply precession tilt to a point (small angle rotation around X and Z axes)
    const applyTilt = (x: number, y: number, z: number) => {
      // Rodrigues-lite: rotate around tilted axis
      const tx = x + tiltZ * y;  // tilt around Z axis
      const ty = y - tiltZ * x + tiltX * z; // combined
      const tz = z - tiltX * y;  // tilt around X axis
      return { x: tx, y: ty, z: tz };
    };

    for (let i = 0; i < SPARK_COUNT; i++) {
      const nozzle = sparkSeeds[i * 5];
      const detachProg = sparkSeeds[i * 5 + 1];
      const ejSpeed = sparkSeeds[i * 5 + 2];
      const dragFactor = sparkSeeds[i * 5 + 3];
      const seed = sparkSeeds[i * 5 + 4];

      const sparkAge = progress - detachProg;
      if (sparkAge < 0 || sparkAge > 0.25 || progress < 0.01) {
        sparkPosArr[i * 3] = 0; sparkPosArr[i * 3 + 1] = -1000; sparkPosArr[i * 3 + 2] = 0;
        sparkColArr[i * 3] = 0; sparkColArr[i * 3 + 1] = 0; sparkColArr[i * 3 + 2] = 0;
        continue;
      }

      // Nozzle position at detach time in the spin plane
      const progRatio = detachProg / Math.max(0.001, progress);
      const detachAngle = totalAngle * progRatio + (nozzle / nozzleCount) * Math.PI * 2;
      const localNX = Math.cos(detachAngle) * armLength;
      const localNZ = Math.sin(detachAngle) * armLength;

      // Transform nozzle through precession tilt
      const tilted = applyTilt(localNX, 0, localNZ);
      const nozzleX = tilted.x + deviceDriftX * progRatio;
      const nozzleZ = tilted.z + deviceDriftZ * progRatio;
      const nozzleY = tilted.y + deviceY * progRatio;

      // Ejection direction: tangential + radial, also tilted
      const tangentX = -Math.sin(detachAngle);
      const tangentZ = Math.cos(detachAngle);
      const radialX = Math.cos(detachAngle);
      const radialZ = Math.sin(detachAngle);

      const sparkT = sparkAge * 4.0;
      const drag = Math.pow(dragFactor, sparkT * 30);

      // Ejection in local frame then tilt
      const localEjX = (tangentX * ejSpeed * 0.7 + radialX * ejSpeed * 0.4) * sparkT * drag;
      const localEjZ = (tangentZ * ejSpeed * 0.7 + radialZ * ejSpeed * 0.4) * sparkT * drag;
      const localEjY = ejSpeed * 0.3 * sparkT * drag + 0.5 * (-9.81) * sparkT * sparkT;
      const tiltedEj = applyTilt(localEjX, localEjY, localEjZ);

      sparkPosArr[i * 3] = nozzleX + tiltedEj.x + windX * sparkT * sparkT * 0.5;
      sparkPosArr[i * 3 + 1] = Math.max(-0.1, nozzleY + tiltedEj.y);
      sparkPosArr[i * 3 + 2] = nozzleZ + tiltedEj.z + windZ * sparkT * sparkT * 0.5;

      // Color: thermal ramp + flicker
      const lifeFrac = sparkAge / 0.25;
      const fade = Math.max(0, 1 - lifeFrac) * intensity;
      const flicker = temporalFlicker(seed, time, 0.6, 0.35, 0.3);
      const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, lifeFrac * 0.7, 1.3);

      sparkColArr[i * 3] = thermal.r * fade * flicker;
      sparkColArr[i * 3 + 1] = thermal.g * fade * flicker;
      sparkColArr[i * 3 + 2] = thermal.b * fade * flicker;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  if (progress <= 0) return null;

  // Wheel body visualization — with precession
  const vizMaxOmega = 15 + caliber * 3;
  const vizOmega = vizMaxOmega * (1 - Math.exp(-3.5 * progress));
  const vizTotalAngle = vizMaxOmega * (progress + (Math.exp(-3.5 * progress) - 1) / 3.5);
  const vizLiftT = progress * 3.0;
  const vizLiftAccel = (thrustForce * nozzleCount * liftFraction / mass) - 9.81;
  const deviceY = Math.max(0, 0.5 * Math.max(0, vizLiftAccel) * vizLiftT * vizLiftT * 0.15);
  // Precession tilt for visual hub
  const vizPrecRate = 0.8 / (1 + vizOmega * 0.1);
  const vizTiltAngle = Math.min(0.25, vizOmega * 0.008);

  return (
    <group position={position} renderOrder={50}>
      {/* Spinning hub */}
      <group position={[0, deviceY, 0]} rotation={[vizTiltAngle * 0.5, vizTotalAngle, vizTiltAngle * 0.3]}>
        {/* Central axis */}
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 6]} />
          <meshBasicMaterial color="#666" transparent opacity={Math.min(1, progress * 5)} depthTest={false} />
        </mesh>
        {/* Arms */}
        {Array.from({ length: nozzleCount }).map((_, n) => {
          const angle = (n / nozzleCount) * Math.PI * 2;
          return (
            <mesh key={n} position={[Math.cos(angle) * armLength * 0.5, 0, Math.sin(angle) * armLength * 0.5]} rotation={[0, -angle, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, armLength, 4]} />
              <meshBasicMaterial color="#888" transparent opacity={Math.min(0.6, progress * 4)} depthTest={false} />
            </mesh>
          );
        })}
        {/* Nozzle glow points */}
        {Array.from({ length: nozzleCount }).map((_, n) => {
          const angle = (n / nozzleCount) * Math.PI * 2;
          const glowIntensity = progress > 0.02 && progress < 0.9 ? 0.8 : 0;
          return (
            <mesh key={`glow-${n}`} position={[Math.cos(angle) * armLength, 0, Math.sin(angle) * armLength]}>
              <sphereGeometry args={[0.08, 6, 6]} />
              <meshBasicMaterial color={color} transparent opacity={glowIntensity} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
            </mesh>
          );
        })}
      </group>

      {/* Spark particles */}
      <group position={[0, deviceY, 0]}>
        <points ref={pointsRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[sparkPosArr, 3]} />
            <bufferAttribute attach="attributes-color" args={[sparkColArr, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.06}
            vertexColors
            transparent
            opacity={0.92}
            depthWrite={false}
            depthTest={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
          />
        </points>
      </group>

      {/* Lift thrust glow under device */}
      {progress > 0.1 && deviceY > 0.5 && (
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.4 + deviceY * 0.1, 8, 8]} />
          <meshBasicMaterial
            color="#FFDDAA"
            transparent
            opacity={0.08 * Math.min(1, progress * 3)}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}
