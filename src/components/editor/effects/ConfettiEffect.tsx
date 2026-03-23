import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 200;

// Pre-allocated color object to avoid per-frame GC
const _color = new THREE.Color();

/**
 * Finale-grade Confetti / Streamer Effect
 * - Realistic paper physics: flutter, tumble, air resistance
 * - Rainbow multi-color with metallic shimmer
 * - Slow descent with oscillating drift
 * - Initial pneumatic burst then gravity-dominated fall
 * - Ribbon streamers mixed with confetti squares
 * 
 * Zero-GC: all buffers pre-allocated via useMemo
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

  // Pre-allocated buffers — reused every frame, zero GC
  const posArr = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const colArr = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  const seeds = useMemo(() => {
    const s: { vx: number; vy: number; vz: number; lt: number; colorShift: number;
               flutterFreq: number; flutterAmp: number; tumbleRate: number; drag: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const upAngle = Math.random() * Math.PI * 0.45;
      const speed = 6 + Math.random() * 10;
      s.push({
        vx: Math.cos(theta) * Math.sin(upAngle) * speed,
        vy: Math.cos(upAngle) * speed + 3,
        vz: Math.sin(theta) * Math.sin(upAngle) * speed,
        lt: 3 + Math.random() * 5,
        colorShift: Math.random(),
        flutterFreq: 2 + Math.random() * 6,
        flutterAmp: 0.3 + Math.random() * 0.8,
        tumbleRate: 1 + Math.random() * 4,
        drag: 0.15 + Math.random() * 0.25,
      });
    }
    return s;
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const GRAVITY = -2.5;
    const t = progress * 5;
    const time = clock.getElapsedTime();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const age = progress / (seed.lt / 6);
      const i3 = i * 3;

      if (age > 1) {
        posArr[i3] = 0; posArr[i3 + 1] = -100; posArr[i3 + 2] = 0;
        colArr[i3] = 0; colArr[i3 + 1] = 0; colArr[i3 + 2] = 0;
        continue;
      }

      const dragFactor = Math.exp(-seed.drag * t);
      const flutter = Math.sin(time * seed.flutterFreq + i * 2) * seed.flutterAmp * t * 0.3;
      const tumble = Math.cos(time * seed.tumbleRate + i * 5) * 0.3 * t;
      
      posArr[i3] = seed.vx * t * 0.25 * dragFactor + flutter;
      posArr[i3 + 1] = Math.max(0, seed.vy * t * 0.25 * dragFactor + 0.5 * GRAVITY * t * t);
      posArr[i3 + 2] = seed.vz * t * 0.25 * dragFactor + tumble;

      const fade = Math.max(0, 1 - age * 0.4);
      const shimmer = 0.6 + Math.sin(time * seed.tumbleRate * 3 + i * 11) * 0.3;
      
      // Reuse pre-allocated color — no new THREE.Color() per particle
      _color.setHSL(seed.colorShift, 0.95, 0.55 + shimmer * 0.15);
      colArr[i3] = _color.r * fade * shimmer;
      colArr[i3 + 1] = _color.g * fade * shimmer;
      colArr[i3 + 2] = _color.b * fade * shimmer;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  return (
    <group position={position}>
      {progress < 0.05 && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.5 + progress * 10, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.3 * (1 - progress / 0.05)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.2} vertexColors transparent opacity={0.92} depthWrite={false} sizeAttenuation />
      </points>
    </group>
  );
}
