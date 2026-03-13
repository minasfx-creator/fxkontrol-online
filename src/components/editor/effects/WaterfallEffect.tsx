import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 300;

/**
 * Waterfall / Cascade Effect: Sparks falling from an elevated line.
 * Realistic: dense curtain of sparks, mostly golden/silver, 
 * individual flicker with wind drift, gravity-dominated fall,
 * very slow initial velocity, long lifetime for dramatic curtain.
 */
export default function WaterfallEffect({
  position,
  color,
  progress,
  width = 5,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  width?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { x: number; vy: number; vx: number; lt: number; phase: number; flicker: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        x: (Math.random() - 0.5) * width,
        vy: -0.3 - Math.random() * 0.8, // very slow initial fall
        vx: (Math.random() - 0.5) * 0.2,
        lt: 2.0 + Math.random() * 2.5, // long burn time
        phase: Math.random() * Math.PI * 2,
        flicker: 20 + Math.random() * 40, // individual flicker frequency
      });
    }
    return s;
  }, [width]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const posArr = new Float32Array(PARTICLE_COUNT * 3);
    const colArr = new Float32Array(PARTICLE_COUNT * 3);
    const time = clock.getElapsedTime();
    const GRAVITY = -9.81;

    const intensity = progress < 0.05 ? progress / 0.05 : progress > 0.9 ? (1 - progress) / 0.1 : 1;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 0.4 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      // Position: starts at emission line, falls with gravity
      posArr[i * 3] = seed.x + seed.vx * t + Math.sin(time * 0.7 + seed.phase) * 0.05;
      posArr[i * 3 + 1] = seed.vy * t + 0.5 * GRAVITY * t * t * 0.12; // attenuated gravity for visual
      posArr[i * 3 + 2] = Math.sin(seed.phase + time * 0.3) * 0.1;

      const fade = Math.max(0, 1 - cycleTime * 0.9) * intensity;
      // Individual spark flicker — characteristic of real waterfalls
      const flicker = 0.5 + Math.sin(i * 11 + time * seed.flicker) * 0.25 + Math.sin(i * 3 + time * seed.flicker * 0.7) * 0.25;
      
      // Golden/silver base with color tint that fades
      const heightFade = Math.min(1, cycleTime * 2);
      colArr[i * 3] = THREE.MathUtils.lerp(1.0, baseColor.r * 0.8, heightFade) * fade * flicker;
      colArr[i * 3 + 1] = THREE.MathUtils.lerp(0.85, baseColor.g * 0.7, heightFade) * fade * flicker;
      colArr[i * 3 + 2] = THREE.MathUtils.lerp(0.35, baseColor.b * 0.5, heightFade) * fade * flicker;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {/* Top emission line — glowing wire */}
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, width, 8]} />
        <meshBasicMaterial 
          color="#FFDD88" 
          transparent 
          opacity={0.25 * (progress < 0.9 ? Math.min(1, progress / 0.05) : (1 - progress) / 0.1)} 
          blending={THREE.AdditiveBlending} 
        />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
