import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LIFT_SMOKE_CONFIG, getBurstSmokeDensity, type LiftChargeType } from '@/lib/pyroPhysics';

const BASE_SMOKE_COUNT = 80;

/**
 * Finale-grade Smoke Trail with Manual de Pirotecnia chemistry:
 * - Pólvora Negra (KNO3+C+S): thick sulfurous yellow-gray (#B8A87A), slow rise
 * - Flash Powder: light gray-white (#CCCCCC), dissipates faster  
 * - Composite: neutral gray, medium behavior
 * 
 * Caliber-proportional puff count via getBurstSmokeDensity().
 * Niagara-grade: FBM turbulence on puff edges, billboard orientation.
 */
function SmokeTrailInner({
  position,
  progress,
  intensity = 1,
  color,
  liftChargeType = 'black_powder',
  caliber = 4,
}: {
  position: [number, number, number];
  progress: number;
  intensity?: number;
  color?: string;
  liftChargeType?: LiftChargeType;
  caliber?: number;
}) {
  // Get smoke config from manual-derived lift charge data
  const smokeConfig = LIFT_SMOKE_CONFIG[liftChargeType];
  const smokeColor = color || smokeConfig.color;
  const smokeDensityMult = getBurstSmokeDensity(caliber);
  const SMOKE_COUNT = Math.min(120, Math.round(BASE_SMOKE_COUNT * smokeDensityMult));
  
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  const puffs = useMemo(() => {
    const p: { x: number; z: number; vy: number; scale: number; phase: number; delay: number; drift: number }[] = [];
    // Spread and scale influenced by charge type
    const spreadMult = liftChargeType === 'black_powder' ? 1.3 : 0.9; // black powder = thicker cloud
    const scaleMult = smokeConfig.density;
    
    for (let i = 0; i < SMOKE_COUNT; i++) {
      p.push({
        x: (Math.random() - 0.5) * 3.5 * spreadMult,
        z: (Math.random() - 0.5) * 3.5 * spreadMult,
        vy: smokeConfig.riseSpeed * (0.8 + Math.random() * 1.2),
        scale: (0.6 + Math.random() * 1.8) * scaleMult,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.3,
      });
    }
    return p;
  }, [SMOKE_COUNT, liftChargeType, smokeConfig]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    puffs.forEach((puff, i) => {
      const mesh = meshRefs.current[i];
      if (!mesh) return;
      const age = Math.max(0, progress - puff.delay);
      if (age <= 0 || progress > 0.95) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;
      const t = age * 2.5;
      
      // Black powder smoke lingers longer (heavier particulate from charcoal+sulfur)
      const lingerFactor = liftChargeType === 'black_powder' ? 0.7 : 1.0;
      const expand = puff.scale * (1 + t * 3.0 * lingerFactor);
      
      mesh.position.set(
        puff.x + Math.sin(time * 0.2 + puff.phase) * 0.6 * t + puff.drift * t * 2,
        puff.vy * t * 0.6,
        puff.z + Math.cos(time * 0.15 + puff.phase) * 0.5 * t
      );
      mesh.scale.setScalar(expand);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      
      // Persistent opacity — black powder smoke lingers much longer
      const fadeIn = Math.min(1, age * 8);
      const fadeOutPower = liftChargeType === 'black_powder' ? 1.5 : 2.0;
      const fadeOut = Math.max(0, 1 - Math.pow(age / 0.85, fadeOutPower));
      const baseOpacity = liftChargeType === 'black_powder' ? 0.08 : 0.05;
      mat.opacity = Math.max(0, baseOpacity * intensity * fadeIn * fadeOut * smokeDensityMult);
    });
  });

  if (progress <= 0) return null;

  return (
    <group position={position}>
      {puffs.map((_, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el; }}
          visible={false}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={smokeColor} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export default SmokeTrailInner;
