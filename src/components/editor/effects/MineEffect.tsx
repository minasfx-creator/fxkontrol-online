import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 250;

/**
 * Mine Effect: Ground-level burst propelling stars upward in a narrow cone.
 * Realistic: instantaneous burst, narrow upward cone, white-hot initial flash,
 * gravity pulls stars into arcing fall, dense particle field.
 */
export default function MineEffect({
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
  const count = Math.min(400, Math.round(PARTICLE_COUNT * (1 + caliber * 0.3)));
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const { velocities, lifetimes } = useMemo(() => {
    const v = new Float32Array(count * 3);
    const l = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      // Narrow cone: 0-17° from vertical (real mines are VERY tight)
      const upAngle = Math.random() * Math.PI * 0.095;
      const speed = 12 + Math.random() * 18 + caliber * 2;
      v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
      v[i * 3 + 1] = Math.cos(upAngle) * speed + 3;
      v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
      l[i] = 0.6 + Math.random() * 0.8;
    }
    return { velocities: v, lifetimes: l };
  }, [count, caliber]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posArr = new Float32Array(count * 3);
    const colArr = new Float32Array(count * 3);
    const t = progress * 2.0;
    const GRAV = -9.81;

    for (let i = 0; i < count; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      const dragH = Math.exp(-0.06 * t);
      const dragV = Math.exp(-0.02 * t);

      posArr[i * 3] = vx * t * dragH;
      posArr[i * 3 + 1] = Math.max(0, vy * t * dragV + 0.5 * GRAV * t * t);
      posArr[i * 3 + 2] = vz * t * dragH;

      // White-hot initial flash → base color → dim ember
      const flashPhase = Math.max(0, 1 - progress * 15);
      const sparkle = 0.7 + Math.sin(i * 17 + progress * 40) * 0.15 + Math.sin(i * 41 + progress * 70) * 0.15;
      colArr[i * 3] = THREE.MathUtils.lerp(baseColor.r, 1.0, flashPhase) * fade * sparkle;
      colArr[i * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.95, flashPhase) * fade * sparkle;
      colArr[i * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.75, flashPhase) * fade * sparkle;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  const flashSize = 0.8 + caliber * 0.3;

  return (
    <group position={position}>
      {/* Ground flash — massive bright burst */}
      {progress < 0.08 && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[flashSize + progress * 12, 16, 16]} />
          <meshBasicMaterial color="#FFFFCC" transparent opacity={0.6 * (1 - progress / 0.08)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* White core flash */}
      {progress < 0.04 && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[flashSize * 0.5 + progress * 6, 12, 12]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.7 * (1 - progress / 0.04)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Smoke puff at base */}
      {progress < 0.4 && progress > 0.03 && (
        <mesh position={[0, progress * 3, 0]}>
          <sphereGeometry args={[0.5 + progress * 4, 8, 8]} />
          <meshBasicMaterial color="#887766" transparent opacity={0.06 * (1 - progress / 0.4)} />
        </mesh>
      )}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(count * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(count * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.2 + caliber * 0.03} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
