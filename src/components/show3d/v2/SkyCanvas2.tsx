/**
 * SkyCanvas 2.0 — Public viewport.
 *
 * Composição:
 *   <Canvas>
 *     <NightSky />
 *     <GroundPlane />
 *     <PyroPadsLayer />
 *     <LightPointsLayer />
 *     <ExplosionsLayer />
 *   </Canvas>
 *
 * Princípios:
 *   - Presentation-only. Lê apenas useProjectStore.
 *   - Cada layer é um arquivo isolado, com seu próprio selector.
 *   - Nada de side effects fora do canvas; nada de hardware.
 *   - Otimizado: selectors memoizados, geometrias/materiais reusados,
 *     attributes em buffers tipados.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense } from 'react';
import { NightSky, GroundPlane } from './Environment';
import { LightPointsLayer } from './LightPointsLayer';
import { PyroPadsLayer } from './PyroPadsLayer';
import { ExplosionsLayer } from './ExplosionsLayer';
import type { SkyCanvas2Props } from './types';

export default function SkyCanvas2({
  dpr = [1, 1.75],
  cameraPosition = [60, 35, 60],
  cameraTarget = [0, 10, 0],
  hideGrid = false,
  hideStars = false,
  className,
}: SkyCanvas2Props) {
  return (
    <div className={className} style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        dpr={dpr}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        shadows={false}
      >
        <PerspectiveCamera
          makeDefault
          position={cameraPosition}
          fov={55}
          near={0.5}
          far={2000}
        />
        <OrbitControls
          target={cameraTarget}
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI * 0.495}
          minDistance={5}
          maxDistance={500}
        />
        <Suspense fallback={null}>
          <NightSky stars={!hideStars} />
          <GroundPlane grid={!hideGrid} />
          <PyroPadsLayer />
          <LightPointsLayer />
          <ExplosionsLayer />
        </Suspense>
      </Canvas>
    </div>
  );
}

export type { SkyCanvas2Props };
