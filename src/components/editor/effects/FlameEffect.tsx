import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const PARTICLE_COUNT = 200;

/**
 * Finale-grade Flame Projector / Fireball Effect
 * Supports: Flamaniac, G-Flame, Wave Flamer, LPG fire systems
 * - Realistic combustion gradient: blue base → white core → yellow → orange → red tip → smoke
 * - Turbulent flame shape with multi-frequency noise
 * - Heat shimmer via particle jitter
 * - Volumetric inner glow column
 * - Ground illumination
 */
export default function FlameEffect({
  position,
  color,
  progress,
  height = 8,
  preset,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
  /** Showven flamer preset — constrains max height and enables multi-nozzle/color */
  preset?: { id: string; maxHeightM: number; nozzles: number; colorCount: number };
}) {
  // Constrain height to hardware limit
  const effectiveHeight = preset ? Math.min(height, preset.maxHeightM) : height;
  const pointsRef = useRef<THREE.Points>(null);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number; turbulence: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: height * (0.35 + Math.random() * 0.65),
        spread: 0.05 + Math.random() * 0.12,
        lt: 0.15 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        turbulence: 0.5 + Math.random() * 1.5,
      });
    }
    return s;
  }, [height]);

  const posBuffer = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const colBuffer = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const time = clock.getElapsedTime();

    // Realistic ignition: fast ramp-up, fast ramp-down
    const intensity = progress < 0.08
      ? Math.pow(progress / 0.08, 0.3)
      : progress > 0.88
        ? Math.pow((1 - progress) / 0.12, 0.5)
        : 1;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 4 + seed.phase) % seed.lt) / seed.lt;
      const i3 = i * 3;

      if (cycleTime > intensity) {
        posBuffer[i3] = 0;
        posBuffer[i3 + 1] = -100;
        posBuffer[i3 + 2] = 0;
        colBuffer[i3] = 0;
        colBuffer[i3 + 1] = 0;
        colBuffer[i3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      // Turbulent flame: multi-frequency noise displaces particles
      const turbX = Math.sin(time * 6 + i * 0.7) * seed.turbulence * 0.15 * t;
      const turbZ = Math.cos(time * 5 + i * 1.1) * seed.turbulence * 0.12 * t;
      const turbY = Math.sin(time * 8 + i * 2.3) * 0.2 * t;

      posBuffer[i3] = Math.cos(seed.angle) * seed.spread * t * height * 0.4 + turbX;
      posBuffer[i3 + 1] = seed.speed * t + turbY;
      posBuffer[i3 + 2] = Math.sin(seed.angle) * seed.spread * t * height * 0.4 + turbZ;

      const fade = Math.max(0, 1 - cycleTime) * intensity;
      const h = cycleTime; // normalized height in flame

      // Realistic combustion gradient
      let r: number;
      let g: number;
      let b: number;

      if (h < 0.1) {
        // Blue base (gas combustion zone)
        r = 0.15; g = 0.3; b = 1.0;
      } else if (h < 0.25) {
        // White-hot core (peak temperature ~1200°C)
        const t2 = (h - 0.1) / 0.15;
        r = THREE.MathUtils.lerp(0.15, 1.3, t2);
        g = THREE.MathUtils.lerp(0.3, 1.1, t2);
        b = THREE.MathUtils.lerp(1.0, 0.85, t2);
      } else if (h < 0.5) {
        // Bright yellow
        const t2 = (h - 0.25) / 0.25;
        r = THREE.MathUtils.lerp(1.3, 1.2, t2);
        g = THREE.MathUtils.lerp(1.1, 0.75, t2);
        b = THREE.MathUtils.lerp(0.85, 0.1, t2);
      } else if (h < 0.75) {
        // Orange
        const t2 = (h - 0.5) / 0.25;
        r = THREE.MathUtils.lerp(1.2, 0.9, t2);
        g = THREE.MathUtils.lerp(0.75, 0.3, t2);
        b = THREE.MathUtils.lerp(0.1, 0.02, t2);
      } else {
        // Red tip → smoke
        const t2 = (h - 0.75) / 0.25;
        r = THREE.MathUtils.lerp(0.9, 0.2, t2);
        g = THREE.MathUtils.lerp(0.3, 0.08, t2);
        b = THREE.MathUtils.lerp(0.02, 0.01, t2);
      }

      // Flame flicker — deterministic (avoids extra random calls each frame)
      const flicker = 0.72
        + Math.sin(time * 15 + i * 3) * 0.15
        + Math.sin(time * 25 + i * 7) * 0.1
        + Math.sin(time * 40 + i * 11) * 0.03;

      colBuffer[i3] = r * fade * flicker;
      colBuffer[i3 + 1] = g * fade * flicker;
      colBuffer[i3 + 2] = b * fade * flicker;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (!posAttr || !colAttr) return;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  const isActive = progress > 0.03 && progress < 0.92;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {/* Flame particles — Screen blending (V-Ray fire preset) */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[colBuffer, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.22} vertexColors transparent opacity={0.88} depthWrite={false} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} sizeAttenuation />
      </points>
      {/* Volumetric inner glow column — Screen */}
      {isActive && (
        <>
          <mesh position={[0, height * 0.25, 0]}>
            <cylinderGeometry args={[0.08, 0.25, height * 0.5, 8]} />
            <meshBasicMaterial color="#FF8800" transparent opacity={0.1} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          {/* Blue base glow — Screen */}
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color="#4488FF" transparent opacity={0.3} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          {/* Ground illumination — Screen */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.5 + height * 0.2, 16]} />
            <meshBasicMaterial color="#FF6600" transparent opacity={0.06} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}
