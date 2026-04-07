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
    // ω(t) = ω_max * (1 - e^(-kt))
    const spinUpRate = 3.5;
    const maxOmega = 15 + caliber * 3; // rad/s at full speed
    const omega = maxOmega * (1 - Math.exp(-spinUpRate * progress));
    const totalAngle = maxOmega * (progress + (Math.exp(-spinUpRate * progress) - 1) / spinUpRate);

    // Lift: device rises as thrust builds
    const liftAccel = (thrustForce * nozzleCount * liftFraction / mass) - 9.81;
    const liftT = progress * 3.0;
    const deviceY = Math.max(0, 0.5 * Math.max(0, liftAccel) * liftT * liftT * 0.15);
    const deviceDriftX = windX * liftT * liftT * 0.2;
    const deviceDriftZ = windZ * liftT * liftT * 0.2;

    // Wobble — imperfect balance
    const wobbleX = Math.sin(time * 2.3 + 1.7) * 0.08 * Math.min(1, progress * 3);
    const wobbleZ = Math.cos(time * 1.9 + 0.3) * 0.06 * Math.min(1, progress * 3);

    // Intensity envelope
    const intensity = progress < 0.05 ? progress / 0.05 :
                      progress > 0.85 ? (1 - progress) / 0.15 : 1.0;

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

      // Nozzle position at detach time
      const detachAngle = totalAngle * (detachProg / Math.max(0.001, progress)) + (nozzle / nozzleCount) * Math.PI * 2;
      const nozzleX = Math.cos(detachAngle) * armLength + deviceDriftX * (detachProg / Math.max(0.001, progress));
      const nozzleZ = Math.sin(detachAngle) * armLength + deviceDriftZ * (detachProg / Math.max(0.001, progress));
      const nozzleY = deviceY * (detachProg / Math.max(0.001, progress));

      // Ejection direction: tangential + radial + upward
      const tangentX = -Math.sin(detachAngle);
      const tangentZ = Math.cos(detachAngle);
      const radialX = Math.cos(detachAngle);
      const radialZ = Math.sin(detachAngle);

      const sparkT = sparkAge * 4.0;
      const drag = Math.pow(dragFactor, sparkT * 30);

      // Spark position: nozzle + ejection velocity + gravity
      const ejX = (tangentX * ejSpeed * 0.7 + radialX * ejSpeed * 0.4) * sparkT * drag;
      const ejZ = (tangentZ * ejSpeed * 0.7 + radialZ * ejSpeed * 0.4) * sparkT * drag;
      const ejY = ejSpeed * 0.3 * sparkT * drag + 0.5 * (-9.81) * sparkT * sparkT;

      sparkPosArr[i * 3] = nozzleX + ejX + windX * sparkT * sparkT * 0.5 + wobbleX;
      sparkPosArr[i * 3 + 1] = Math.max(-0.1, nozzleY + ejY) + wobbleZ * 0.3;
      sparkPosArr[i * 3 + 2] = nozzleZ + ejZ + windZ * sparkT * sparkT * 0.5 + wobbleZ;

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

  // Wheel body visualization
  const omega = (15 + caliber * 3) * (1 - Math.exp(-3.5 * progress));
  const totalAngle = (15 + caliber * 3) * (progress + (Math.exp(-3.5 * progress) - 1) / 3.5);
  const liftT = progress * 3.0;
  const liftAccel = (thrustForce * nozzleCount * liftFraction / mass) - 9.81;
  const deviceY = Math.max(0, 0.5 * Math.max(0, liftAccel) * liftT * liftT * 0.15);

  return (
    <group position={position} renderOrder={50}>
      {/* Spinning hub */}
      <group position={[0, deviceY, 0]} rotation={[0, totalAngle, 0]}>
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
