import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { temporalFlicker, thermalColorRamp } from '@/lib/pyroNoise';

const PARTICLE_COUNT = 500;

/**
 * Waterfall / Cascade / Niagara Effect
 * Integrated with wind, temporal flicker, and thermal color ramp.
 */
export default function WaterfallEffect({
  position,
  color,
  progress,
  width = 5,
  caliber = 3,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  width?: number;
  caliber?: number;
}) {
  const scaledWidth = width * (0.7 + caliber * 0.12);
  const SCALED_PARTICLE_COUNT = Math.min(800, Math.round(PARTICLE_COUNT * (0.7 + caliber * 0.12)));
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  const posArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);
  const colArr = useMemo(() => new Float32Array(SCALED_PARTICLE_COUNT * 3), [SCALED_PARTICLE_COUNT]);

  const seeds = useMemo(() => {
    const s: { x: number; vy: number; vx: number; lt: number; phase: number; flicker: number; offset: number; seed: number }[] = [];
    for (let i = 0; i < SCALED_PARTICLE_COUNT; i++) {
      s.push({
        x: (Math.random() - 0.5) * scaledWidth,
        vy: -0.2 - Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.15,
        lt: 1.8 + Math.random() * 3.0,
        phase: Math.random() * Math.PI * 2,
        flicker: 15 + Math.random() * 50,
        offset: Math.random() * 0.3,
        seed: Math.random() * 999 + i,
      });
    }
    return s;
  }, [scaledWidth, SCALED_PARTICLE_COUNT]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const time = clock.getElapsedTime();
    const GRAVITY = -9.81;

    // Wind integration
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
      const drag = Math.exp(-0.03 * t);

      // Ground collision — particles that go below 0 bounce with restitution
      const rawY = seed.vy * t * drag + 0.5 * GRAVITY * t * t * 0.08;
      const bounced = rawY < -0.1;
      const yPos = bounced ? Math.abs(rawY) * 0.1 : rawY;

      posArr[i * 3] = seed.x + seed.vx * t * drag + Math.sin(time * 0.5 + seed.phase) * 0.04 + windX * t;
      posArr[i * 3 + 1] = yPos;
      posArr[i * 3 + 2] = Math.sin(seed.phase + time * 0.25) * 0.08 + windZ * t;

      const fade = Math.max(0, 1 - cycleTime * 0.85) * intensity;
      
      // Organic temporal flicker per-particle
      const flicker = temporalFlicker(seed.seed, time, 0.6, 0.32, 0.30);
      
      // Thermal color ramp for natural cooling
      const thermal = thermalColorRamp(baseColor.r, baseColor.g, baseColor.b, cycleTime, 1.2);
      
      colArr[i * 3] = thermal.r * fade * flicker;
      colArr[i * 3 + 1] = thermal.g * fade * flicker;
      colArr[i * 3 + 2] = thermal.b * fade * flicker;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  const wireOpacity = progress < 0.88 ? Math.min(1, progress / 0.04) * 0.35 : (1 - progress) / 0.12 * 0.35;

  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, scaledWidth, 8]} />
        <meshBasicMaterial color="#FFEEAA" transparent opacity={wireOpacity} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, scaledWidth, 6]} />
        <meshBasicMaterial color="#FFFFF0" transparent opacity={wireOpacity * 0.8} blending={THREE.AdditiveBlending} />
      </mesh>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posArr, 3]} />
          <bufferAttribute attach="attributes-color" args={[colArr, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.055} vertexColors transparent opacity={0.92} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
