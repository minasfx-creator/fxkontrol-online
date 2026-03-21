import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { getGerbParticleCount, getParticleSize } from '@/lib/pyroPhysics';

const TRAIL_HISTORY = 4;

/**
 * Finale-grade Gerb / Fountain / Cold Spark Effect
 * Niagara-grade: reusable buffers, ribbon trails, ground bounce, thermal gradient.
 * 
 * Enhanced with Manual de Pirotecnia:
 * - Caliber-proportional particle count via getGerbParticleCount()
 * - Particle size via getParticleSize() (quadratic relationship)
 * - Differentiated black powder gerbs (golden-orange) vs cold sparks (silver-white)
 * - Spread radius scales with caliber
 */
export default function GerbEffect({
  position,
  color,
  progress,
  height = 5,
  caliber = 3,
  coldSpark = false,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
  caliber?: number;
  coldSpark?: boolean;
}) {
  const scaledHeight = height * (0.6 + caliber * 0.15);
  const SCALED_PARTICLE_COUNT = Math.min(700, getGerbParticleCount(caliber));
  const particleVisualSize = getParticleSize(caliber) * 0.04;
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // Pre-allocate buffers — zero GC pressure
  const posArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);
  const colArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);

  // Trail ribbon buffers: each particle has TRAIL_HISTORY positions → (TRAIL_HISTORY-1) line segments
  const trailSegments = SCALED_PARTICLE_COUNT * (TRAIL_HISTORY - 1);
  const trailPosArr = useMemo(() => new Float32Array(trailSegments * 2 * 3), [trailSegments]);
  const trailColArr = useMemo(() => new Float32Array(trailSegments * 2 * 3), [trailSegments]);

  // Store particle trail history
  const trailHistory = useRef<Float32Array | null>(null);
  if (!trailHistory.current || trailHistory.current.length !== SCALED_PARTICLE_COUNT * TRAIL_HISTORY * 3) {
    trailHistory.current = new Float32Array(SCALED_PARTICLE_COUNT * TRAIL_HISTORY * 3);
    trailHistory.current.fill(-100);
  }

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number; size: number; bounceVx: number; bounceVz: number }[] = [];
    for (let i = 0; i < SCALED_PARTICLE_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: scaledHeight * (0.65 + Math.random() * 0.7),
        spread: 0.02 + Math.random() * 0.06,
        lt: 0.4 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        size: 0.5 + Math.random() * 1.0,
        bounceVx: (Math.random() - 0.5) * 2,
        bounceVz: (Math.random() - 0.5) * 2,
      });
    }
    return s;
  }, [scaledHeight, SCALED_PARTICLE_COUNT]);

  // Frame counter for trail update cadence
  const frameCount = useRef(0);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const time = clock.getElapsedTime();
    const GRAVITY = -9.81;
    frameCount.current++;

    const intensity = progress < 0.03 ? Math.pow(progress / 0.03, 0.5) :
                      progress > 0.92 ? Math.pow((1 - progress) / 0.08, 2) : 1;

    const updateTrails = frameCount.current % 3 === 0;
    const history = trailHistory.current!;

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
      let px = Math.cos(seed.angle) * seed.spread * scaledHeight * t * drag;
      let py = seed.speed * t * drag + 0.5 * GRAVITY * t * t * 0.15;
      let pz = Math.sin(seed.angle) * seed.spread * scaledHeight * t * drag;

      // Ground bounce: if particle hits y=0 with downward velocity, bounce
      if (py < 0) {
        py = Math.abs(py) * 0.3; // 0.3 restitution
        px += seed.bounceVx * (t - cycleTime * seed.lt * 0.5) * 0.15;
        pz += seed.bounceVz * (t - cycleTime * seed.lt * 0.5) * 0.15;
      }

      posArr[i * 3] = px;
      posArr[i * 3 + 1] = Math.max(0, py);
      posArr[i * 3 + 2] = pz;

      // Shift trail history every N frames
      if (updateTrails) {
        for (let h = TRAIL_HISTORY - 1; h > 0; h--) {
          const dst = (i * TRAIL_HISTORY + h) * 3;
          const src = (i * TRAIL_HISTORY + h - 1) * 3;
          history[dst] = history[src];
          history[dst + 1] = history[src + 1];
          history[dst + 2] = history[src + 2];
        }
        const h0 = i * TRAIL_HISTORY * 3;
        history[h0] = px;
        history[h0 + 1] = Math.max(0, py);
        history[h0 + 2] = pz;
      }

      const fade = Math.max(0, 1 - cycleTime * 0.8) * intensity;
      const heightRatio = cycleTime;
      
      const flicker = 0.5
        + Math.sin(i * 31 + time * 50) * 0.18
        + Math.sin(i * 7 + time * 85) * 0.15
        + Math.sin(i * 53 + time * 120) * 0.1
        + (Math.random() > 0.96 ? 0.4 : 0);
      
      const thermalPhase = Math.pow(heightRatio, 0.5);
      let r = THREE.MathUtils.lerp(1.2, baseColor.r, thermalPhase * 0.75);
      let g = THREE.MathUtils.lerp(0.95, baseColor.g, thermalPhase * 0.85);
      let b = THREE.MathUtils.lerp(0.35, baseColor.b, thermalPhase * 0.92);
      
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

    // Build trail line segments
    if (trailRef.current) {
      for (let i = 0; i < SCALED_PARTICLE_COUNT; i++) {
        for (let h = 0; h < TRAIL_HISTORY - 1; h++) {
          const segIdx = (i * (TRAIL_HISTORY - 1) + h) * 6;
          const srcA = (i * TRAIL_HISTORY + h) * 3;
          const srcB = (i * TRAIL_HISTORY + h + 1) * 3;
          trailPosArr[segIdx] = history[srcA];
          trailPosArr[segIdx + 1] = history[srcA + 1];
          trailPosArr[segIdx + 2] = history[srcA + 2];
          trailPosArr[segIdx + 3] = history[srcB];
          trailPosArr[segIdx + 4] = history[srcB + 1];
          trailPosArr[segIdx + 5] = history[srcB + 2];
          
          const trailFade = (1 - h / (TRAIL_HISTORY - 1)) * 0.4;
          trailColArr[segIdx] = baseColor.r * trailFade;
          trailColArr[segIdx + 1] = baseColor.g * trailFade * 0.6;
          trailColArr[segIdx + 2] = baseColor.b * trailFade * 0.3;
          trailColArr[segIdx + 3] = baseColor.r * trailFade * 0.5;
          trailColArr[segIdx + 4] = baseColor.g * trailFade * 0.3;
          trailColArr[segIdx + 5] = baseColor.b * trailFade * 0.15;
        }
      }
      const tGeo = trailRef.current.geometry;
      const tPos = tGeo.getAttribute('position') as THREE.BufferAttribute;
      const tCol = tGeo.getAttribute('color') as THREE.BufferAttribute;
      if (tPos) tPos.needsUpdate = true;
      if (tCol) tCol.needsUpdate = true;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  const isActive = progress > 0.02 && progress < 0.95;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {isActive && (
        <>
          <mesh position={[0, 0.06, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial color="#FFDD55" transparent opacity={0.45} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshBasicMaterial color="#FFFFF0" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.8 + scaledHeight * 0.12, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.04} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
        </>
      )}
      {/* Ribbon trails */}
      <lineSegments ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPosArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColArr, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {/* Spark particles */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
