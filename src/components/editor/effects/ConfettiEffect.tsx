import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 100;

/**
 * Confetti / Streamer Effect: Burst of colorful confetti pieces.
 */
export default function ConfettiEffect({
  position,
  color,
  progress,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);

  const seeds = useMemo(() => {
    const s: { vx: number; vy: number; vz: number; lt: number; colorShift: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const upAngle = Math.random() * Math.PI * 0.5;
      const speed = 5 + Math.random() * 8;
      s.push({
        vx: Math.cos(theta) * Math.sin(upAngle) * speed,
        vy: Math.cos(upAngle) * speed + 2,
        vz: Math.sin(theta) * Math.sin(upAngle) * speed,
        lt: 2 + Math.random() * 3,
        colorShift: Math.random(),
      });
    }
    return s;
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const GRAVITY = -3; // Confetti falls slowly
    const t = progress * 4;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const age = progress / (seed.lt / 5);
      if (age > 1) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        continue;
      }

      // Flutter: confetti drifts sideways as it falls
      const flutter = Math.sin(t * 3 + i * 5) * 0.5 * t;
      posArr[i * 3] = seed.vx * t * 0.3 + flutter;
      posArr[i * 3 + 1] = Math.max(0, seed.vy * t * 0.3 + 0.5 * GRAVITY * t * t);
      posArr[i * 3 + 2] = seed.vz * t * 0.3;

      const fade = Math.max(0, 1 - age * 0.5);
      // Rainbow confetti colors
      const hue = seed.colorShift;
      const c = new THREE.Color().setHSL(hue, 0.9, 0.6);
      colArr[i * 3] = c.r * fade;
      colArr[i * 3 + 1] = c.g * fade;
      colArr[i * 3 + 2] = c.b * fade;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.25} vertexColors transparent opacity={0.9} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}
