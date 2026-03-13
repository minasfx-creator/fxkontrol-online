import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 200;

/**
 * Gerb / Fountain Effect: Continuous narrow spray of sparks from ground level.
 * Realistic: very narrow cone (< 15°), sparks white-hot at base turning 
 * golden/colored at apex, gravity causes parabolic falloff, 
 * individual spark flicker, height-dependent particle density.
 */
export default function GerbEffect({
  position,
  color,
  progress,
  height = 5,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: height * (0.7 + Math.random() * 0.6), // velocity proportional to height
        spread: 0.04 + Math.random() * 0.08, // very narrow cone
        lt: 0.5 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, [height]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const time = clock.getElapsedTime();
    const GRAVITY = -9.81;

    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 2.0 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      // Narrow spray with gravity
      posArr[i * 3] = Math.cos(seed.angle) * seed.spread * height * t;
      posArr[i * 3 + 1] = Math.max(0, seed.speed * t + 0.5 * GRAVITY * t * t);
      posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * height * t;

      const fade = Math.max(0, 1 - cycleTime * 0.85) * intensity;
      const heightRatio = cycleTime; // 0 at base, 1 at peak
      // Individual spark flicker
      const flicker = 0.6 + Math.sin(i * 31 + time * 45) * 0.2 + Math.sin(i * 7 + time * 80) * 0.2;
      
      // White-hot at base → golden in middle → colored at top → dim
      const r = THREE.MathUtils.lerp(1.0, baseColor.r, heightRatio * 0.8);
      const g = THREE.MathUtils.lerp(0.92, baseColor.g, heightRatio * 0.85);
      const b = THREE.MathUtils.lerp(0.4, baseColor.b, heightRatio * 0.9);
      colArr[i * 3] = r * fade * flicker;
      colArr[i * 3 + 1] = g * fade * flicker;
      colArr[i * 3 + 2] = b * fade * flicker;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Hot base emission point glow */}
      <mesh position={[0, 0.08, 0]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial
          color="#FFCC44"
          transparent
          opacity={0.35 * (progress > 0.05 && progress < 0.9 ? 1 : 0)}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
