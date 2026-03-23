import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { temporalFlicker } from '@/lib/pyroNoise';

const EMBER_COUNT = 240;

/**
 * Embers refinados — Zero-GC:
 * - buffers pré-alocados via useMemo (não useRef para Float32Array)
 * - setAttribute chamado apenas 1x na montagem (via JSX args)
 * - needsUpdate sem recriação de BufferAttribute
 */
function EmberParticlesInner({
  position,
  color,
  progress,
  spreadRadius = 8,
  startHeight = 15,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  spreadRadius?: number;
  startHeight?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const posArr = useMemo(() => new Float32Array(EMBER_COUNT * 3), []);
  const colArr = useMemo(() => new Float32Array(EMBER_COUNT * 3), []);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { x: number; z: number; vy: number; driftX: number; driftZ: number; lt: number; size: number; reignite: number; noiseSeed: number }[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spreadRadius;
      s.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        vy: -0.8 - Math.random() * 3.0,
        driftX: (Math.random() - 0.5) * 1.0,
        driftZ: (Math.random() - 0.5) * 1.0,
        lt: 2.0 + Math.random() * 5.0,
        size: 0.4 + Math.random() * 0.8,
        reignite: Math.random(),
        noiseSeed: Math.random() * 1000 + i,
      });
    }
    return s;
  }, [spreadRadius]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || progress < 0.1) return;

    const time = clock.getElapsedTime();
    const emberProgress = (progress - 0.1) / 0.9;
    const { wind } = useProjectStore.getState();
    const wr = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(wr) * wind.speed * 0.05 : 0;
    const windZ = wind.enabled ? Math.cos(wr) * wind.speed * 0.05 : 0;

    for (let i = 0; i < EMBER_COUNT; i++) {
      const seed = seeds[i];
      const age = emberProgress * seed.lt;
      const i3 = i * 3;

      if (age <= 0 || age > seed.lt) {
        posArr[i3] = 0; posArr[i3 + 1] = -100; posArr[i3 + 2] = 0;
        colArr[i3] = 0; colArr[i3 + 1] = 0; colArr[i3 + 2] = 0;
        continue;
      }

      const gravityEffect = 4.9 * age * age * 0.08;
      const y = startHeight + seed.vy * age - gravityEffect;
      if (y < 0) {
        posArr[i3] = 0; posArr[i3 + 1] = -100; posArr[i3 + 2] = 0;
        colArr[i3] = 0; colArr[i3 + 1] = 0; colArr[i3 + 2] = 0;
        continue;
      }

      posArr[i3] = seed.x + seed.driftX * age + Math.sin(time * 0.25 + i * 0.7) * 0.5 + windX * age * 12;
      posArr[i3 + 1] = y;
      posArr[i3 + 2] = seed.z + seed.driftZ * age + Math.cos(time * 0.2 + i * 1.1) * 0.4 + windZ * age * 12;

      const lifeFrac = age / seed.lt;
      const fadeCurve = Math.pow(Math.max(0, 1 - lifeFrac), 0.35);
      const flicker = temporalFlicker(seed.noiseSeed, time, 0.58, 0.35, 0.4);
      const reignition = (seed.reignite > 0.85 && Math.sin(time * 5 + i * 11) > 0.95) ? 1.5 : 0;

      const thermalShift = Math.pow(lifeFrac, 0.6);
      const r = THREE.MathUtils.lerp(baseColor.r, 0.8, thermalShift * 0.55) + reignition * 0.3;
      const g = THREE.MathUtils.lerp(baseColor.g, 0.2, thermalShift * 0.75) + reignition * 0.15;
      const b = THREE.MathUtils.lerp(baseColor.b, 0.02, thermalShift * 0.92);

      colArr[i3] = r * fadeCurve * flicker;
      colArr[i3 + 1] = g * fadeCurve * flicker * 0.65;
      colArr[i3 + 2] = b * fadeCurve * flicker * 0.25;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  if (progress < 0.1) return null;

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.055}
          vertexColors
          transparent
          opacity={0.92}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

export default EmberParticlesInner;
