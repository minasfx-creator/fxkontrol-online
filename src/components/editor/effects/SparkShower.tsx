import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { temporalFlicker } from '@/lib/pyroNoise';
import { getChemistryForRendering, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';

const SPARK_COUNT = 150;

/**
 * SparkShower: Dense shower of tiny bright sparks cascading down.
 * Integrated with wind and temporal flicker for organic brightness.
 */
export default function SparkShower({
  position,
  color,
  progress,
  height = 20,
  spread = 6,
  sparkularModel,
  formulationId,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
  spread?: number;
  sparkularModel?: 'vertical' | 'circular' | 'waterfall' | 'wheel' | 'blast' | 'mobile';
  formulationId?: string;
}) {
  const isColdSpark = !!sparkularModel;
  const pointsRef = useRef<THREE.Points>(null);
  const chemistry = useMemo(() => {
    const fId = formulationId || autoMatchFormulation(color, 'gerb', 3);
    return fId ? getChemistryForRendering(fId) : null;
  }, [formulationId, color]);

  const baseColor = useMemo(() => {
    if (isColdSpark) return new THREE.Color('#FFD700');
    if (chemistry?.resultColor) return chemistry.resultColor.clone();
    return new THREE.Color(color);
  }, [color, isColdSpark, chemistry]);

  const posArr = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);
  const colArr = useMemo(() => new Float32Array(SPARK_COUNT * 3), []);

  const seeds = useMemo(() => {
    const s: { angle: number; r: number; vy: number; phase: number; lt: number; speed: number; seed: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const isWaterfall = sparkularModel === 'waterfall';
      const isWheel = sparkularModel === 'wheel';
      s.push({
        angle: isWheel ? (i / SPARK_COUNT) * Math.PI * 2 : Math.random() * Math.PI * 2,
        r: isWaterfall ? Math.random() * spread * 0.3 : Math.random() * spread,
        vy: isWaterfall ? -4 - Math.random() * 4 : isColdSpark ? -1 - Math.random() * 3 : -2 - Math.random() * 6,
        phase: Math.random() * Math.PI * 2,
        lt: isColdSpark ? 0.5 + Math.random() * 1.0 : 0.3 + Math.random() * 1.2,
        speed: 0.5 + Math.random() * 2,
        seed: Math.random() * 999 + i,
      });
    }
    return s;
  }, [spread]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || progress < 0.1 || progress > 0.95) return;
    const time = clock.getElapsedTime();

    // Wind integration
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.06 : 0;
    const windZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.06 : 0;

    for (let i = 0; i < SPARK_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * seed.speed + seed.phase) % seed.lt) / seed.lt;
      
      const x = Math.cos(seed.angle) * seed.r * (0.5 + cycleTime * 0.5) + windX * cycleTime * seed.lt;
      const y = height * (1 - cycleTime * 0.3) + seed.vy * cycleTime * seed.lt;
      const z = Math.sin(seed.angle) * seed.r * (0.5 + cycleTime * 0.5) + windZ * cycleTime * seed.lt;

      if (y < 0) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      posArr[i * 3] = x;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = z;

      const fade = Math.max(0, 1 - cycleTime);
      // White-hot spawn boost (first 10% of life)
      const spawnBoost = cycleTime < 0.1 ? 1.0 + (1 - cycleTime / 0.1) * 0.5 : 1.0;
      // Organic temporal flicker
      const flicker = temporalFlicker(seed.seed, time, 0.6, 0.34, 0.32);
      
      colArr[i * 3] = Math.min(1.5, baseColor.r * fade * spawnBoost * flicker * 1.2);
      colArr[i * 3 + 1] = Math.min(1.5, baseColor.g * fade * spawnBoost * flicker * 0.8);
      colArr[i * 3 + 2] = Math.min(1.5, baseColor.b * fade * spawnBoost * flicker * 0.5);
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  if (progress < 0.1 || progress > 0.95) return null;

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.04}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
