import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { temporalFlicker, thermalColorRamp } from '@/lib/pyroNoise';
import { getChemistryForRendering, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';

const PARTICLE_COUNT = 500;
const SPLASH_COUNT = 60;

/**
 * Waterfall / Cascade / Niagara Effect
 * Enhanced cascade physics:
 *  - Quadratic drag on falling particles
 *  - Ground collision with restitution coefficient (0.15) and energy loss
 *  - Splash particles on impact — lateral scatter
 *  - Multiple emission points along wire for realistic curtain
 *  - Turbulent lateral drift (Perlin-style)
 *  - Wind integration, temporal flicker, thermal color ramp
 */
export default function WaterfallEffect({
  position,
  color,
  progress,
  width = 5,
  caliber = 3,
  formulationId,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  width?: number;
  caliber?: number;
  formulationId?: string;
}) {
  const scaledWidth = width * (0.7 + caliber * 0.12);
  const SCALED_PARTICLE_COUNT = Math.min(800, Math.round(PARTICLE_COUNT * (0.7 + caliber * 0.12)));
  const pointsRef = useRef<THREE.Points>(null);
  const splashRef = useRef<THREE.Points>(null);

  const chemistry = useMemo(() => {
    const fId = formulationId || autoMatchFormulation(color, 'waterfall', caliber);
    return fId ? getChemistryForRendering(fId) : null;
  }, [formulationId, color, caliber]);

  const baseColor = useMemo(() => {
    if (chemistry?.resultColor) return chemistry.resultColor.clone();
    return new THREE.Color(color);
  }, [color, chemistry]);

  const posArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);
  const colArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);
  const splashPos = useMemo(() => new Float32Array(SPLASH_COUNT * 3), []);
  const splashCol = useMemo(() => new Float32Array(SPLASH_COUNT * 3), []);

  const seeds = useMemo(() => {
    const s: {
      x: number; vy0: number; vx: number; vz: number;
      lt: number; phase: number; seed: number;
      turbFreq: number; turbAmp: number;
    }[] = [];
    for (let i = 0; i < SCALED_PARTICLE_COUNT; i++) {
      s.push({
        x: (Math.random() - 0.5) * scaledWidth,
        vy0: -0.3 - Math.random() * 0.5, // initial downward velocity
        vx: (Math.random() - 0.5) * 0.12,
        vz: (Math.random() - 0.5) * 0.08,
        lt: 2.0 + Math.random() * 3.5,
        phase: Math.random() * Math.PI * 2,
        seed: Math.random() * 999 + i,
        turbFreq: 1.5 + Math.random() * 3,
        turbAmp: 0.02 + Math.random() * 0.04,
      });
    }
    return s;
  }, [scaledWidth, SCALED_PARTICLE_COUNT]);

  // Splash seeds — particles that scatter on ground impact
  const splashSeeds = useMemo(() => {
    const s: { x: number; vx: number; vz: number; vy: number; lt: number; seed: number }[] = [];
    for (let i = 0; i < SPLASH_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.8;
      s.push({
        x: (Math.random() - 0.5) * scaledWidth,
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 0.5 + Math.random() * 1.5,
        lt: 0.3 + Math.random() * 0.5,
        seed: Math.random() * 999 + i + SCALED_PARTICLE_COUNT,
      });
    }
    return s;
  }, [scaledWidth, SCALED_PARTICLE_COUNT]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const time = clock.getElapsedTime();
    const GRAVITY = 9.81;
    const RESTITUTION = 0.15;
    const GROUND_Y = -0.05;

    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.04 : 0;
    const windZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.04 : 0;

    const intensity = progress < 0.04 ? Math.pow(progress / 0.04, 0.4) :
                      progress > 0.88 ? Math.pow((1 - progress) / 0.12, 2) : 1;

    for (let i = 0; i < SCALED_PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 0.35 + seed.phase) % seed.lt) / seed.lt;

      if (cycleTime > intensity) {
        posArr[i * 3] = 0; posArr[i * 3 + 1] = -100; posArr[i * 3 + 2] = 0;
        colArr[i * 3] = 0; colArr[i * 3 + 1] = 0; colArr[i * 3 + 2] = 0;
        continue;
      }

      const t = cycleTime * seed.lt;
      const dragCoeff = 0.04; // quadratic drag approximation
      const dragFactor = 1 / (1 + dragCoeff * t * t);

      // Vertical: v0*t + 0.5*g*t² (downward), with quadratic drag
      let rawY = seed.vy0 * t * dragFactor - 0.5 * GRAVITY * t * t * 0.08;

      // Ground collision with restitution
      if (rawY < GROUND_Y) {
        const bounceEnergy = Math.abs(rawY - GROUND_Y) * RESTITUTION;
        rawY = GROUND_Y + bounceEnergy * Math.exp(-t * 2); // damped bounce
      }

      // Turbulent lateral drift
      const turbX = Math.sin(time * seed.turbFreq + seed.phase) * seed.turbAmp * t;
      const turbZ = Math.cos(time * seed.turbFreq * 0.7 + seed.phase * 1.3) * seed.turbAmp * 0.6 * t;

      posArr[i * 3] = seed.x + seed.vx * t * dragFactor + turbX + windX * t;
      posArr[i * 3 + 1] = rawY;
      posArr[i * 3 + 2] = seed.vz * t * dragFactor + turbZ + windZ * t;

      const fade = Math.max(0, 1 - cycleTime * 0.85) * intensity;
      const flicker = temporalFlicker(seed.seed, time, 0.6, 0.32, 0.30);
      const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, cycleTime, 1.2);

      colArr[i * 3] = thermal.r * fade * flicker;
      colArr[i * 3 + 1] = thermal.g * fade * flicker;
      colArr[i * 3 + 2] = thermal.b * fade * flicker;
    }

    const geo = pointsRef.current.geometry;
    (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    // ── Splash particles at ground level ──
    if (splashRef.current && intensity > 0.1) {
      for (let i = 0; i < SPLASH_COUNT; i++) {
        const seed = splashSeeds[i];
        const cycleT = ((time * 0.6 + seed.seed * 0.01) % seed.lt) / seed.lt;
        const t = cycleT * seed.lt;
        const grav = -4.9 * t * t;
        const drag = Math.exp(-3 * t);

        splashPos[i * 3] = seed.x + seed.vx * t * drag + windX * t * 0.5;
        splashPos[i * 3 + 1] = GROUND_Y + seed.vy * t * drag * 0.3 + grav * 0.05;
        splashPos[i * 3 + 2] = seed.vz * t * drag + windZ * t * 0.5;

        const fade = Math.max(0, 1 - cycleT) * intensity * 0.6;
        const flicker = temporalFlicker(seed.seed, time, 0.4, 0.25, 0.25);
        splashCol[i * 3] = baseColor.r * fade * flicker * 0.8;
        splashCol[i * 3 + 1] = baseColor.g * fade * flicker * 0.5;
        splashCol[i * 3 + 2] = baseColor.b * fade * flicker * 0.3;
      }

      (splashRef.current.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (splashRef.current.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  const wireOpacity = progress < 0.88 ? Math.min(1, progress / 0.04) * 0.35 : (1 - progress) / 0.12 * 0.35;

  return (
    <group position={position} renderOrder={50}>
      {/* Suspension wire */}
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, scaledWidth, 8]} />
        <meshBasicMaterial color="#FFEEAA" transparent opacity={wireOpacity} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, scaledWidth, 6]} />
        <meshBasicMaterial color="#FFFFF0" transparent opacity={wireOpacity * 0.8} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Main cascade particles */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.055} vertexColors transparent opacity={0.92} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>

      {/* Ground splash particles */}
      <points ref={splashRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[splashPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[splashCol, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.04} vertexColors transparent opacity={0.7} depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
