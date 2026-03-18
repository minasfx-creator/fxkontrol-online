import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * WheelEffect — Rotating Catherine wheel with radial gerb emissions.
 * Multiple arms spin around a central axis, each emitting spark trails.
 */

interface WheelEffectProps {
  position: [number, number, number];
  progress: number; // 0 = start, 1 = done
  color?: string;
  secondaryColor?: string;
  armCount?: number;
  radius?: number;
  rotationSpeed?: number; // revolutions per second
}

const MAX_PARTICLES = 600;

export default function WheelEffect({
  position,
  progress,
  color = '#FFD700',
  secondaryColor = '#FF4500',
  armCount = 4,
  radius = 2,
  rotationSpeed = 2,
}: WheelEffectProps) {
  const trailRef = useRef<THREE.Points>(null);
  const posBuffer = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const colBuffer = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const altColor = useMemo(() => new THREE.Color(secondaryColor), [secondaryColor]);

  // Store spark history
  const sparkHistory = useRef<{ x: number; y: number; z: number; age: number; armIdx: number }[]>([]);

  useFrame((_, delta) => {
    if (!trailRef.current || progress <= 0 || progress > 1) return;

    const dt = Math.min(delta, 0.05);
    const rotation = progress * rotationSpeed * Math.PI * 2;
    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    // Emit new sparks from each arm tip
    if (intensity > 0.1) {
      for (let arm = 0; arm < armCount; arm++) {
        const armAngle = rotation + (arm / armCount) * Math.PI * 2;
        const tipX = Math.cos(armAngle) * radius;
        const tipY = Math.sin(armAngle) * radius;

        // Emit 2-3 sparks per arm per frame
        const emitCount = 2 + Math.floor(Math.random() * 2);
        for (let e = 0; e < emitCount; e++) {
          // Radial outward velocity + slight tangential
          const radialSpeed = 1.5 + Math.random() * 2;
          const tangentialSpeed = (Math.random() - 0.5) * 1;
          sparkHistory.current.push({
            x: tipX + Math.cos(armAngle) * radialSpeed * 0.02 + (Math.random() - 0.5) * 0.1,
            y: tipY + Math.sin(armAngle) * radialSpeed * 0.02 + (Math.random() - 0.5) * 0.1,
            z: (Math.random() - 0.5) * 0.3,
            age: 0,
            armIdx: arm,
          });
        }
      }
    }

    // Age and cull sparks
    sparkHistory.current = sparkHistory.current
      .map(s => ({ ...s, age: s.age + dt, y: s.y - 2 * dt * s.age })) // gravity pull down
      .filter(s => s.age < 0.6)
      .slice(-MAX_PARTICLES);

    // Fill buffers
    const count = Math.min(sparkHistory.current.length, MAX_PARTICLES);
    for (let i = 0; i < count; i++) {
      const s = sparkHistory.current[i];
      const fade = Math.max(0, 1 - s.age / 0.6);
      posBuffer[i * 3] = s.x;
      posBuffer[i * 3 + 1] = s.y;
      posBuffer[i * 3 + 2] = s.z;

      const c = s.armIdx % 2 === 0 ? baseColor : altColor;
      colBuffer[i * 3] = c.r * fade;
      colBuffer[i * 3 + 1] = c.g * fade * 0.9;
      colBuffer[i * 3 + 2] = c.b * fade * 0.7;
    }

    const geo = trailRef.current.geometry;
    geo.setDrawRange(0, count);
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  if (progress <= 0 || progress > 1) return null;

  const rotation = progress * rotationSpeed * Math.PI * 2;

  return (
    <group position={position}>
      {/* Arm structure (thin lines) */}
      {Array.from({ length: armCount }).map((_, arm) => {
        const angle = rotation + (arm / armCount) * Math.PI * 2;
        return (
          <mesh key={arm} rotation={[0, 0, angle]}>
            <boxGeometry args={[radius * 2, 0.04, 0.04]} />
            <meshBasicMaterial color="#333" transparent opacity={0.3} />
          </mesh>
        );
      })}

      {/* Spark trails */}
      <points ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[colBuffer, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Central hub */}
      <mesh>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 12]} />
        <meshBasicMaterial color="#555" />
      </mesh>
    </group>
  );
}
