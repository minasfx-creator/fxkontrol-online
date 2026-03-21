import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { readDensityAt, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';

const FOG_PUFFS = 70;

/**
 * FogMachineEffect — Soft-particle-style fog with NiagaraFluids grid integration.
 * Reads density from shared fluid grid for realistic advection.
 */
export default function FogMachineEffect({
  position,
  color = '#8a8a8a',
  progress,
  spread = 12,
  lowFog = false,
}: {
  position: [number, number, number];
  color?: string;
  progress: number;
  spread?: number;
  lowFog?: boolean;
}) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const puffs = useMemo(() => {
    return Array.from({ length: FOG_PUFFS }, () => ({
      x: (Math.random() - 0.5) * spread * (lowFog ? 1.5 : 1),
      z: (Math.random() - 0.5) * spread * (lowFog ? 1.5 : 1),
      phase: Math.random() * Math.PI * 2,
      lift: lowFog ? 0.01 + Math.random() * 0.03 : 0.08 + Math.random() * 0.22,
      delay: Math.random() * 0.3,
      scale: lowFog ? 1.5 + Math.random() * 3.0 : 0.9 + Math.random() * 2.2,
      drift: (Math.random() - 0.5) * (lowFog ? 0.8 : 0.4),
    }));
  }, [spread, lowFog]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const { wind } = useProjectStore.getState();
    const wr = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(wr) * wind.speed * 0.2 : 0;
    const windZ = wind.enabled ? Math.cos(wr) * wind.speed * 0.2 : 0;

    // Read from shared fluid grid for density modulation
    const fluidGrid = (window as any).__niagaraFluidGrid as FluidGrid | undefined;

    puffs.forEach((puff, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;

      const age = Math.max(0, progress - puff.delay);
      if (age <= 0 || age > 0.98) {
        mesh.visible = false;
        return;
      }

      mesh.visible = true;
      const t = age * 2.6;
      const growth = puff.scale * (1 + t * 2.3);

      const baseX = puff.x + windX * t * 2.2 + Math.sin(time * 0.35 + puff.phase) * 0.35;
      const baseZ = puff.z + windZ * t * 2.2 + Math.cos(time * 0.28 + puff.phase) * 0.3 + puff.drift * t;

      // Fluid grid advection — offset position based on local density
      let fluidOffset = 0;
      if (fluidGrid) {
        const worldX = position[0] + baseX;
        const worldZ = position[2] + baseZ;
        fluidOffset = readDensityAt(fluidGrid, worldX, worldZ) * 0.5;
      }

      mesh.position.set(
        baseX + fluidOffset * Math.sin(time * 0.5),
        puff.lift * t + fluidOffset * 0.2,
        baseZ + fluidOffset * Math.cos(time * 0.3),
      );
      mesh.scale.setScalar(growth);

      const mat = mesh.material as THREE.MeshBasicMaterial;
      const fadeIn = Math.min(1, age * 8);
      const fadeOut = Math.max(0, 1 - Math.pow(age / 0.95, 1.8));
      // Soft-particle-style opacity: ground proximity reduces opacity
      const groundProximity = Math.min(1, mesh.position.y * 3 + 0.3);
      mat.opacity = 0.09 * fadeIn * fadeOut * groundProximity;
    });
  });

  return (
    <group position={position}>
      {puffs.map((_, i) => (
        <mesh key={i} ref={(el) => { meshRefs.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
