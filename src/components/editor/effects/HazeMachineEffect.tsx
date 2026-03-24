import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { readDensityAt, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';

const HAZE_POINTS = 360;

/**
 * HazeMachineEffect — Zero-GC: pre-allocated buffer, no setAttribute per frame.
 * Soft-particle-style haze with NiagaraFluids grid integration.
 */
export default function HazeMachineEffect({
  position,
  color = '#a7a7a7',
  progress,
  radius = 24,
}: {
  position: [number, number, number];
  color?: string;
  progress: number;
  radius?: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const posArr = useMemo(() => new Float32Array(HAZE_POINTS * 3), []);

  const seeds = useMemo(() => {
    return Array.from({ length: HAZE_POINTS }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * radius,
      y: 0.15 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      drift: 0.2 + Math.random() * 0.8,
    }));
  }, [radius]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const { wind } = useProjectStore.getState();
    const wr = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(wr) * wind.speed * 0.04 : 0;
    const windZ = wind.enabled ? Math.cos(wr) * wind.speed * 0.04 : 0;

    const envelope = progress < 0.08 ? progress / 0.08 : progress > 0.95 ? (1 - progress) / 0.05 : 1;

    const fluidGrid = (window as any).__niagaraFluidGrid as FluidGrid | undefined;

    for (let i = 0; i < HAZE_POINTS; i++) {
      const s = seeds[i];
      const idx = i * 3;
      const driftT = t * s.drift;

      const baseX = Math.cos(s.angle) * s.dist + Math.sin(driftT + s.phase) * 1.2 + windX * t * 20;
      const baseZ = Math.sin(s.angle) * s.dist + Math.cos(driftT + s.phase) * 1.2 + windZ * t * 20;

      let fluidDrift = 0;
      if (fluidGrid) {
        const worldX = position[0] + baseX;
        const worldZ = position[2] + baseZ;
        fluidDrift = readDensityAt(fluidGrid, worldX, worldZ) * 0.8;
      }

      posArr[idx] = baseX + fluidDrift * Math.sin(t * 0.3 + i);
      posArr[idx + 1] = s.y + Math.sin(driftT * 0.6 + s.phase) * 0.2 + fluidDrift * 0.15;
      posArr[idx + 2] = baseZ + fluidDrift * Math.cos(t * 0.2 + i);
    }

    const material = pointsRef.current.material as THREE.PointsMaterial;
    material.opacity = 0.045 * Math.max(0, envelope);

    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
  });

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={color}
          size={1.8}
          transparent
          opacity={0.03}
          depthWrite={false}
          blending={THREE.NormalBlending}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
