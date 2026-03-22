import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { temporalFlicker, thermalColorRamp } from '@/lib/pyroNoise';
import { getChemistryForRendering, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';

const BASE_RAYS = 9;
const BASE_PARTICLES_PER_RAY = 30;

/**
 * Fan effect: Multiple rays of particles spreading in an arc pattern.
 * Integrated with wind, combustion flicker, and thermal color ramp.
 */
export default function FanEffect({
  position,
  color,
  progress,
  spreadAngle = 90,
  caliber = 3,
  formulationId,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  spreadAngle?: number;
  caliber?: number;
  formulationId?: string;
}) {
  const caliberScale = 0.7 + caliber * 0.12;
  // Scale particle density by caliber
  const RAYS = Math.min(15, Math.round(BASE_RAYS * caliberScale));
  const PARTICLES_PER_RAY = Math.min(50, Math.round(BASE_PARTICLES_PER_RAY * caliberScale));
  const TOTAL_PARTICLES = RAYS * PARTICLES_PER_RAY;

  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const chemistry = useMemo(() => {
    const fId = formulationId || autoMatchFormulation(color, 'gerb', caliber);
    return fId ? getChemistryForRendering(fId) : null;
  }, [formulationId, color, caliber]);

  const baseColor = useMemo(() => {
    if (chemistry?.resultColor) return chemistry.resultColor.clone();
    return new THREE.Color(color);
  }, [color, chemistry]);

  const posArr = useRef(new Float32Array(TOTAL_PARTICLES * 3));
  const colArr = useRef(new Float32Array(TOTAL_PARTICLES * 3));
  const linePos = useRef(new Float32Array(RAYS * 2 * 3));
  const lineCol = useRef(new Float32Array(RAYS * 2 * 3));

  useFrame(({ clock }) => {
    if (!pointsRef.current || !linesRef.current) return;

    const p = posArr.current;
    const c = colArr.current;
    const lp = linePos.current;
    const lc = lineCol.current;
    const halfSpread = (spreadAngle * Math.PI) / 360;
    const t = progress * 2;
    const time = clock.getElapsedTime();

    // Wind
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const wX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.04 : 0;
    const wZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.04 : 0;

    for (let ray = 0; ray < RAYS; ray++) {
      const rayAngle = -halfSpread + (ray / (RAYS - 1)) * halfSpread * 2;
      const speed = (4 + Math.sin(ray * 1.5) * 1.5) * caliberScale;

      const dirX = Math.sin(rayAngle);
      const dirY = Math.cos(rayAngle) * 0.8 + 0.5;
      const dirZ = 0;

      const tipDist = speed * t * 0.8;
      const rayFade = Math.max(0, 1 - progress * 0.7);
      lp[ray * 6] = 0;
      lp[ray * 6 + 1] = 0;
      lp[ray * 6 + 2] = 0;
      lp[ray * 6 + 3] = dirX * tipDist + wX * t * t;
      lp[ray * 6 + 4] = dirY * tipDist;
      lp[ray * 6 + 5] = dirZ * tipDist + wZ * t * t;

      lc[ray * 6] = baseColor.r * rayFade * 0.4;
      lc[ray * 6 + 1] = baseColor.g * rayFade * 0.4;
      lc[ray * 6 + 2] = baseColor.b * rayFade * 0.4;
      lc[ray * 6 + 3] = baseColor.r * rayFade * 0.1;
      lc[ray * 6 + 4] = baseColor.g * rayFade * 0.1;
      lc[ray * 6 + 5] = baseColor.b * rayFade * 0.1;

      for (let j = 0; j < PARTICLES_PER_RAY; j++) {
        const idx = ray * PARTICLES_PER_RAY + j;
        const pct = j / PARTICLES_PER_RAY;
        const dist = pct * speed * t;
        const gravity = -2 * pct * pct * t;
        const scatter = Math.sin(j * 13.7 + ray * 5.1) * 0.3 * pct;

        p[idx * 3] = dirX * dist + scatter + wX * pct * t;
        p[idx * 3 + 1] = dirY * dist + gravity;
        p[idx * 3 + 2] = dirZ * dist + Math.cos(j * 7.3 + ray * 3.3) * 0.2 * pct + wZ * pct * t;

        const fade = Math.max(0, 1 - pct * 0.6) * Math.max(0, 1 - progress * 0.8);
        
        // Combustion flicker per-particle (organic brightness)
        const flicker = temporalFlicker(idx * 17.3 + ray * 5.1, time, 0.65, 0.30, 0.28);
        
        // Thermal color ramp: white-hot at birth → base → ember
        const lifeRatio = pct * 0.8 + progress * 0.3;
        const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, lifeRatio, 1.3);
        
        c[idx * 3] = thermal.r * fade * flicker;
        c[idx * 3 + 1] = thermal.g * fade * flicker;
        c[idx * 3 + 2] = thermal.b * fade * flicker;
      }
    }

    const pGeo = pointsRef.current.geometry;
    pGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;

    const lGeo = linesRef.current.geometry;
    lGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lGeo.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    lGeo.attributes.position.needsUpdate = true;
    lGeo.attributes.color.needsUpdate = true;
  });

  return (
    <group position={position}>
      {progress < 0.1 && (
        <pointLight color={color} intensity={10 * (1 - progress / 0.1)} distance={15} decay={2} />
      )}
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(RAYS * 2 * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(RAYS * 2 * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(TOTAL_PARTICLES * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(TOTAL_PARTICLES * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.14} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
      {progress < 0.3 && (
        <mesh>
          <sphereGeometry args={[0.4 + progress * 2, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.1 * (1 - progress / 0.3)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
    </group>
  );
}
