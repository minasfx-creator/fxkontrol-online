import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const SPARK_COUNT = 250;
const ARM_COUNT = 4;

/**
 * SaxonEffect — Horizontal ground spinner (margarita/girasol).
 * Manual de Pirotecnia: flat ground-level device with 2-4 radiating flame arms.
 * Rotation accelerates as composition burns, spiral spark trails from arm tips.
 */
export default function SaxonEffect({
  position,
  color,
  progress,
  armCount = 4,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  armCount?: number;
}) {
  const sparksRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const arms = Math.min(armCount, ARM_COUNT);

  const sparkPos = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);
  const sparkCol = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);

  const seeds = useMemo(() => {
    const s: { arm: number; radial: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      s.push({
        arm: i % arms,
        radial: 0.2 + Math.random() * 0.8,
        lt: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, [arms]);

  useFrame(({ clock }) => {
    if (!sparksRef.current) return;
    const time = clock.getElapsedTime();
    const active = progress > 0.02 && progress < 0.95;
    const fadeIn = Math.min(1, progress * 8);
    const fadeOut = Math.min(1, (1 - progress) * 8);
    const envelope = fadeIn * fadeOut;

    // Rotation accelerates over duration (composition burns = less weight = faster)
    const rotSpeed = (2 + progress * 15) * Math.PI;
    const rotation = time * rotSpeed;
    const radius = 0.5 + progress * 0.3; // slight radius increase

    for (let i = 0; i < SPARK_COUNT; i++) {
      const seed = seeds[i];
      if (!active) {
        sparkPos[i * 3] = 0; sparkPos[i * 3 + 1] = -100; sparkPos[i * 3 + 2] = 0;
        sparkCol[i * 3] = 0; sparkCol[i * 3 + 1] = 0; sparkCol[i * 3 + 2] = 0;
        continue;
      }

      const armAngle = (seed.arm / arms) * Math.PI * 2 + rotation;
      const age = ((time * 5 + seed.phase) % seed.lt) / seed.lt;
      const r = radius * seed.radial;
      const throwR = r + age * 0.8; // sparks fly outward

      sparkPos[i * 3] = Math.cos(armAngle - age * 0.5) * throwR;
      sparkPos[i * 3 + 1] = 0.03 + age * 0.15; // slight upward drift
      sparkPos[i * 3 + 2] = Math.sin(armAngle - age * 0.5) * throwR;

      const fade = (1 - age) * envelope;
      const thermal = 1 - age * 0.7;
      sparkCol[i * 3] = THREE.MathUtils.lerp(1.2, baseColor.r * 0.8, age) * fade;
      sparkCol[i * 3 + 1] = THREE.MathUtils.lerp(0.9, baseColor.g * 0.5, age) * fade;
      sparkCol[i * 3 + 2] = THREE.MathUtils.lerp(0.3, baseColor.b * 0.3, age) * fade;
    }

    const geo = sparksRef.current.geometry;
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  });

  if (progress <= 0 || progress > 1) return null;

  const rotSpeed = (2 + progress * 15) * Math.PI;

  return (
    <group position={position}>
      {/* Central pivot */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.06, 8]} />
        <meshBasicMaterial color="#444444" />
      </mesh>

      {/* Ground glow */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.2, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.04 * Math.min(1, progress * 5)} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Sparks */}
      <points ref={sparksRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[sparkCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
