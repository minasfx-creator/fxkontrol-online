import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const PARTICLE_COUNT = 350;

/**
 * Finale-grade Gerb / Fountain / Cold Spark Effect
 * - Ultra-narrow emission cone (< 8° real gerb spec)
 * - White-hot base → golden mid → colored tip → charcoal fallback
 * - Individual spark flicker with thermal variation
 * - Gravity parabolic falloff with air drag
 * - Intensity ramp-up/down matching real ignition/burnout
 * - Ground-level spark scatter at base
 */
export default function GerbEffect({
  position,
  color,
  progress,
  height = 5,
  caliber = 3,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
  caliber?: number;
}) {
  // Scale particle count and height based on caliber
  const scaledHeight = height * (0.6 + caliber * 0.15);
  const SCALED_PARTICLE_COUNT = Math.min(600, Math.round(PARTICLE_COUNT * (0.7 + caliber * 0.12)));
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number; size: number }[] = [];
    for (let i = 0; i < SCALED_PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: scaledHeight * (0.65 + Math.random() * 0.7),
        spread: 0.02 + Math.random() * 0.06,
        lt: 0.4 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        size: 0.5 + Math.random() * 1.0,
      });
    }
    return s;
  }, [scaledHeight, SCALED_PARTICLE_COUNT]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const posArr = new Float32Array(SCALED_PARTICLE_COUNT * 3);
    const colArr = new Float32Array(SCALED_PARTICLE_COUNT * 3);
    const time = clock.getElapsedTime();
    const GRAVITY = -9.81;

    // Realistic ignition/burnout ramp
    const intensity = progress < 0.03 ? Math.pow(progress / 0.03, 0.5) :
                      progress > 0.92 ? Math.pow((1 - progress) / 0.08, 2) : 1;

    for (let i = 0; i < SCALED_PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 2.5 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      const drag = Math.exp(-0.08 * t);
      // Narrow spray with gravity + drag
      posArr[i * 3] = Math.cos(seed.angle) * seed.spread * scaledHeight * t * drag;
      posArr[i * 3 + 1] = Math.max(0, seed.speed * t * drag + 0.5 * GRAVITY * t * t * 0.15);
      posArr[i * 3 + 2] = Math.sin(seed.angle) * seed.spread * scaledHeight * t * drag;

      const fade = Math.max(0, 1 - cycleTime * 0.8) * intensity;
      const heightRatio = cycleTime;
      
      // Multi-frequency flicker for organic spark shimmer
      const flicker = 0.5
        + Math.sin(i * 31 + time * 50) * 0.18
        + Math.sin(i * 7 + time * 85) * 0.15
        + Math.sin(i * 53 + time * 120) * 0.1
        + (Math.random() > 0.96 ? 0.4 : 0);
      
      // Thermal gradient: white-hot core → golden → colored → charcoal
      const thermalPhase = Math.pow(heightRatio, 0.5);
      let r = THREE.MathUtils.lerp(1.2, baseColor.r, thermalPhase * 0.75);
      let g = THREE.MathUtils.lerp(0.95, baseColor.g, thermalPhase * 0.85);
      let b = THREE.MathUtils.lerp(0.35, baseColor.b, thermalPhase * 0.92);
      
      // Late-life charcoal
      if (heightRatio > 0.7) {
        const charcoal = (heightRatio - 0.7) / 0.3;
        r = THREE.MathUtils.lerp(r, 0.15, charcoal * 0.5);
        g = THREE.MathUtils.lerp(g, 0.06, charcoal * 0.6);
        b = THREE.MathUtils.lerp(b, 0.02, charcoal * 0.7);
      }
      
      colArr[i * 3] = r * fade * flicker;
      colArr[i * 3 + 1] = g * fade * flicker;
      colArr[i * 3 + 2] = b * fade * flicker;
    }

    const geo = pointsRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  const isActive = progress > 0.02 && progress < 0.95;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {/* Hot emission point glow — Screen */}
      {isActive && (
        <>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#FFDD55" transparent opacity={0.45} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          {/* Inner white core — Additive (incandescent source) */}
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshBasicMaterial color="#FFFFF0" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          {/* Ground scatter light — Screen */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.8 + height * 0.12, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.04} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
        </>
      )}
      {/* Spark particles — Additive (core) */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(PARTICLE_COUNT * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
