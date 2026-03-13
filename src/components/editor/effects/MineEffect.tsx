import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 120;

/**
 * Mine Effect: Ground-level burst propelling stars upward in a narrow cone.
 * Realistic: instantaneous burst, narrow upward cone (< 35° from vertical),
 * white-hot initial flash, gravity pulls stars into arcing fall, 
 * short lifetime (~1.5s), sparks scatter near ground.
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
      // Narrow cone: 0-30° from vertical (real mines are tight)
      const upAngle = Math.random() * Math.PI * 0.17;
      const speed = 10 + Math.random() * 14; // 10-24 m/s
      v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
      v[i * 3 + 1] = Math.cos(upAngle) * speed + 2;
      v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
      l[i] = 0.8 + Math.random() * 0.7; // 0.8-1.5s lifetime
    }
    return { velocities: v, lifetimes: l };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const t = progress * 2.0;
    const GRAVITY = -9.81;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      // Realistic drag on horizontal components
      const dragH = Math.exp(-0.08 * t);
      const dragV = Math.exp(-0.03 * t);

      posArr[i * 3] = vx * t * dragH;
      posArr[i * 3 + 1] = Math.max(0, vy * t * dragV + 0.5 * GRAVITY * t * t);
      posArr[i * 3 + 2] = vz * t * dragH;

      // White-hot initial flash → base color → dim
      const flashPhase = Math.max(0, 1 - progress * 12);
      const sparkle = 0.7 + Math.sin(i * 17 + progress * 35) * 0.3;
      colArr[i * 3] = THREE.MathUtils.lerp(baseColor.r, 1.0, flashPhase) * fade * sparkle;
      colArr[i * 3 + 1] = THREE.MathUtils.lerp(baseColor.g, 0.95, flashPhase) * fade * sparkle;
      colArr[i * 3 + 2] = THREE.MathUtils.lerp(baseColor.b, 0.75, flashPhase) * fade * sparkle;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Ground flash — bright and fast */}
      {progress < 0.1 && (
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.6 + progress * 8, 16, 16]} />
          <meshBasicMaterial color="#FFFFCC" transparent opacity={0.5 * (1 - progress / 0.1)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Smoke puff at base */}
      {progress < 0.3 && progress > 0.03 && (
        <mesh position={[0, progress * 2, 0]}>
          <sphereGeometry args={[0.4 + progress * 3, 8, 8]} />
          <meshBasicMaterial color="#998877" transparent opacity={0.06 * (1 - progress / 0.3)} />
        </mesh>
      )}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.18} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
