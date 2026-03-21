import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const PARTICLE_COUNT = 300;
const EMBER_COUNT = 60;

/**
 * Finale-grade Flame Projector / Fireball Effect
 * Niagara-grade: denser particles, ember layer, heat shimmer mesh, volumetric column.
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
  preset?: { id: string; maxHeightM: number; nozzles: number; colorCount: number };
}) {
  const effectiveHeight = preset ? Math.min(height, preset.maxHeightM) : height;
  const pointsRef = useRef<THREE.Points>(null);
  const emberRef = useRef<THREE.Points>(null);
  const heatRef = useRef<THREE.Mesh>(null);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number; turbulence: number; nozzle: number }[] = [];
    const nozzleCount = preset?.nozzles ?? 1;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const nozzle = i % nozzleCount;
      const nozzleAngle = nozzleCount > 1 ? (nozzle / nozzleCount) * Math.PI * 2 : Math.random() * Math.PI * 2;
      s.push({
        angle: nozzleAngle + (Math.random() - 0.5) * 0.3,
        speed: effectiveHeight * (0.35 + Math.random() * 0.65),
        spread: 0.05 + Math.random() * 0.12,
        lt: 0.15 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        turbulence: 0.5 + Math.random() * 1.5,
        nozzle,
      });
    }
    return s;
  }, [effectiveHeight, preset?.nozzles]);

  const emberSeeds = useMemo(() => {
    const s: { angle: number; speed: number; lt: number; phase: number; drift: number }[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: effectiveHeight * (0.2 + Math.random() * 0.4),
        lt: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.8,
      });
    }
    return s;
  }, [effectiveHeight]);

  const posBuffer = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const colBuffer = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const emberPosBuffer = useMemo(() => new Float32Array(EMBER_COUNT * 3), []);
  const emberColBuffer = useMemo(() => new Float32Array(EMBER_COUNT * 3), []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const time = clock.getElapsedTime();

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
        posBuffer[i3] = 0; posBuffer[i3 + 1] = -100; posBuffer[i3 + 2] = 0;
        colBuffer[i3] = 0; colBuffer[i3 + 1] = 0; colBuffer[i3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      const turbX = Math.sin(time * 6 + i * 0.7) * seed.turbulence * 0.15 * t;
      const turbZ = Math.cos(time * 5 + i * 1.1) * seed.turbulence * 0.12 * t;
      const turbY = Math.sin(time * 8 + i * 2.3) * 0.2 * t;

      posBuffer[i3] = Math.cos(seed.angle) * seed.spread * t * effectiveHeight * 0.4 + turbX;
      posBuffer[i3 + 1] = seed.speed * t + turbY;
      posBuffer[i3 + 2] = Math.sin(seed.angle) * seed.spread * t * effectiveHeight * 0.4 + turbZ;

      const fade = Math.max(0, 1 - cycleTime) * intensity;
      const h = cycleTime;

      let r: number, g: number, b: number;

      if (h < 0.1) {
        r = 0.15; g = 0.3; b = 1.0;
      } else if (h < 0.25) {
        const t2 = (h - 0.1) / 0.15;
        r = THREE.MathUtils.lerp(0.15, 1.3, t2);
        g = THREE.MathUtils.lerp(0.3, 1.1, t2);
        b = THREE.MathUtils.lerp(1.0, 0.85, t2);
      } else if (h < 0.5) {
        const t2 = (h - 0.25) / 0.25;
        r = THREE.MathUtils.lerp(1.3, 1.2, t2);
        g = THREE.MathUtils.lerp(1.1, 0.75, t2);
        b = THREE.MathUtils.lerp(0.85, 0.1, t2);
      } else if (h < 0.75) {
        const t2 = (h - 0.5) / 0.25;
        r = THREE.MathUtils.lerp(1.2, 0.9, t2);
        g = THREE.MathUtils.lerp(0.75, 0.3, t2);
        b = THREE.MathUtils.lerp(0.1, 0.02, t2);
      } else {
        const t2 = (h - 0.75) / 0.25;
        r = THREE.MathUtils.lerp(0.9, 0.2, t2);
        g = THREE.MathUtils.lerp(0.3, 0.08, t2);
        b = THREE.MathUtils.lerp(0.02, 0.01, t2);
      }

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
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;

    // Ember particles — tiny additive dots rising from flame tip
    if (emberRef.current && intensity > 0.3) {
      for (let i = 0; i < EMBER_COUNT; i++) {
        const seed = emberSeeds[i];
        const cycleTime = ((time * 1.5 + seed.phase) % seed.lt) / seed.lt;
        const i3 = i * 3;

        const t2 = cycleTime * seed.lt;
        emberPosBuffer[i3] = Math.cos(seed.angle) * 0.3 + seed.drift * t2;
        emberPosBuffer[i3 + 1] = effectiveHeight * 0.6 + seed.speed * t2 * 0.5;
        emberPosBuffer[i3 + 2] = Math.sin(seed.angle) * 0.3;

        const fade = Math.max(0, 1 - cycleTime) * intensity * 0.8;
        emberColBuffer[i3] = 1.0 * fade;
        emberColBuffer[i3 + 1] = 0.4 * fade;
        emberColBuffer[i3 + 2] = 0.05 * fade;
      }

      const eGeo = emberRef.current.geometry;
      const ePosAttr = eGeo.getAttribute('position') as THREE.BufferAttribute;
      const eColAttr = eGeo.getAttribute('color') as THREE.BufferAttribute;
      if (ePosAttr) ePosAttr.needsUpdate = true;
      if (eColAttr) eColAttr.needsUpdate = true;
    }

    // Heat distortion mesh — scale and shimmer
    if (heatRef.current) {
      const heatScale = effectiveHeight * 0.4 * intensity;
      heatRef.current.scale.set(heatScale * 0.5, heatScale, heatScale * 0.5);
      heatRef.current.position.y = effectiveHeight * 0.3;
      const mat = heatRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.015 * intensity;
    }
  });

  const isActive = progress > 0.03 && progress < 0.92;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {/* Flame particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posBuffer, 3]} />
          <bufferAttribute attach="attributes-color" args={[colBuffer, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.22} vertexColors transparent opacity={0.88} depthWrite={false} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} sizeAttenuation />
      </points>

      {/* Ember particles — tiny hot dots */}
      {isActive && (
        <points ref={emberRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[emberPosBuffer, 3]} />
            <bufferAttribute attach="attributes-color" args={[emberColBuffer, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.04} vertexColors transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
        </points>
      )}

      {/* Heat distortion layer — subtle transparent mesh */}
      {isActive && (
        <mesh ref={heatRef} position={[0, height * 0.3, 0]}>
          <cylinderGeometry args={[0.3, 0.6, 1, 12]} />
          <meshBasicMaterial color="#FF4400" transparent opacity={0.015} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Volumetric inner glow column */}
      {isActive && (
        <>
          <mesh position={[0, height * 0.25, 0]}>
            <cylinderGeometry args={[0.08, 0.25, height * 0.5, 8]} />
            <meshBasicMaterial color="#FF8800" transparent opacity={0.1} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color="#4488FF" transparent opacity={0.3} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.5 + height * 0.2, 16]} />
            <meshBasicMaterial color="#FF6600" transparent opacity={0.06} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}
