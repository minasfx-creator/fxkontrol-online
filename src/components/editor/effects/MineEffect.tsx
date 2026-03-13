import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 80;

/**
 * Mine Effect: Ground-level burst propelling stars upward in a cone.
 * Based on Finale 3D mine behavior — instantaneous upward burst.
 */
export default function MineEffect({
  position,
  color,
  progress,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const { velocities, lifetimes } = useMemo(() => {
    const v = new Float32Array(PARTICLE_COUNT * 3);
    const l = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const upAngle = Math.random() * Math.PI * 0.35; // mostly upward cone
      const speed = 8 + Math.random() * 12;
      v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
      v[i * 3 + 1] = Math.cos(upAngle) * speed + 3;
      v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
      l[i] = 0.5 + Math.random() * 0.5;
    }
    return { velocities: v, lifetimes: l };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const t = progress * 1.8;
    const GRAVITY = -9.81;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const fade = Math.max(0, 1 - progress / lt);
      const drag = 0.92;

      posArr[i * 3] = vx * t * drag;
      posArr[i * 3 + 1] = Math.max(0, vy * t + 0.5 * GRAVITY * t * t);
      posArr[i * 3 + 2] = vz * t * drag;

      const sparkle = 0.7 + Math.sin(i * 17 + progress * 40) * 0.3;
      colArr[i * 3] = THREE.MathUtils.lerp(1, baseColor.r, progress) * fade * sparkle;
      colArr[i * 3 + 1] = THREE.MathUtils.lerp(0.95, baseColor.g, progress) * fade * sparkle;
      colArr[i * 3 + 2] = THREE.MathUtils.lerp(0.8, baseColor.b, progress) * fade * sparkle;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Ground flash */}
      {progress < 0.15 && (
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[1 + progress * 6, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.3 * (1 - progress / 0.15)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.2} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
