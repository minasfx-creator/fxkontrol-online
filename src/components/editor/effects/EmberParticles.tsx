import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const EMBER_COUNT = 180;

/**
 * Ember / Falling Spark Particles: Glowing embers that drift down after a burst.
 * Enhanced with wind drift, flicker variation, and proper thermal color shift.
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
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { x: number; z: number; vy: number; driftX: number; driftZ: number; lt: number; flicker: number; size: number }[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spreadRadius;
      s.push({
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        vy: -1.0 - Math.random() * 3.5,
        driftX: (Math.random() - 0.5) * 0.8,
        driftZ: (Math.random() - 0.5) * 0.8,
        lt: 1.5 + Math.random() * 4.0,
        flicker: 12 + Math.random() * 60,
        size: 0.5 + Math.random() * 1.0,
      });
    }
    return s;
  }, [spreadRadius]);

  useFrame(({ clock }) => {
    if (!pointsRef.current || progress < 0.12) return;
    const posArr = new Float32Array(EMBER_COUNT * 3);
    const colArr = new Float32Array(EMBER_COUNT * 3);
    const time = clock.getElapsedTime();
    const emberProgress = (progress - 0.12) / 0.88;

    for (let i = 0; i < EMBER_COUNT; i++) {
      const seed = seeds[i];
      const age = emberProgress * seed.lt;
      if (age <= 0 || age > seed.lt) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        continue;
      }

      // Gravity + air resistance for embers (light particles fall slower)
      const gravityEffect = 4.9 * age * age * 0.1;
      const y = startHeight + seed.vy * age - gravityEffect;
      if (y < 0) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        continue;
      }

      // Wind drift accumulates over time
      posArr[i * 3] = seed.x + seed.driftX * age + Math.sin(time * 0.3 + i * 0.7) * 0.4;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = seed.z + seed.driftZ * age + Math.cos(time * 0.25 + i * 1.1) * 0.3;

      const lifeFrac = age / seed.lt;
      const fade = Math.max(0, 1 - lifeFrac);
      const fadeCurve = Math.pow(fade, 0.4); // stays bright longer, then drops
      
      // Multi-frequency flicker for realism
      const flicker = 0.3 
        + Math.sin(time * seed.flicker + i * 7) * 0.25
        + Math.sin(time * seed.flicker * 0.6 + i * 3) * 0.2
        + Math.sin(time * seed.flicker * 1.7 + i * 13) * 0.15
        + (Math.random() > 0.96 ? 0.4 : 0); // occasional bright pop
      
      // Thermal color: starts as shell color → shifts to orange → deep red → charcoal
      const thermalShift = Math.pow(lifeFrac, 0.7);
      const r = THREE.MathUtils.lerp(baseColor.r, 0.85, thermalShift * 0.5);
      const g = THREE.MathUtils.lerp(baseColor.g, 0.25, thermalShift * 0.7);
      const b = THREE.MathUtils.lerp(baseColor.b, 0.03, thermalShift * 0.9);
      
      colArr[i * 3] = r * fadeCurve * flicker;
      colArr[i * 3 + 1] = g * fadeCurve * flicker * 0.7;
      colArr[i * 3 + 2] = b * fadeCurve * flicker * 0.3;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  if (progress < 0.12) return null;

  return (
    <group position={position}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(EMBER_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(EMBER_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
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

export default EmberParticlesInner;
