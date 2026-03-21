import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackReleaseEnvelope, temporalFlicker } from '@/lib/pyroNoise';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';
import { useProjectStore } from '@/store/useProjectStore';
import { readDensityAt, injectDensity, injectVelocity, type FluidGrid } from '@/render_ultra/fireworks/niagaraFluids';

/**
 * Mine Effect — Ground burst upward
 * Integrated with NiagaraFluids for smoke advection + wind force modules.
 */
export default function MineEffect({
  position,
  color,
  progress,
  caliber = 3,
  angleOffset = 0,
  heightMeters,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
  angleOffset?: number;
  heightMeters?: number;
}) {
  const count = useMemo(() => Math.min(600, Math.round(200 + caliber * caliber * 14)), [caliber]);
  const pointsRef = useRef<THREE.Points>(null);
  const posRef = useRef(new Float32Array(count * 3));
  const colRef = useRef(new Float32Array(count * 3));
  const injectedRef = useRef(false);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const emberColor = useMemo(() => new THREE.Color().setHSL(0.05, 0.8, 0.12), []);

  const { velocities, lifetimes, sparkleSeeds } = useMemo(() => {
    const v = new Float32Array(count * 3);
    const l = new Float32Array(count);
    const s = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const upAngle = 0.15 + Math.random() * 0.85;
      const speed = 10 + Math.random() * 18 + caliber * 4;

      v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
      v[i * 3 + 1] = Math.cos(upAngle) * speed + 2;
      v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;

      l[i] = 0.4 + Math.random() * 1.0;
      s[i] = Math.random() * 999 + i;
    }

    return { velocities: v, lifetimes: l, sparkleSeeds: s };
  }, [count, caliber]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const geo = pointsRef.current.geometry;
    const posArr = posRef.current;
    const colArr = colRef.current;
    const t = progress * 2.5;
    const GRAV = -9.81;
    const time = clock.getElapsedTime();
    const envelope = attackReleaseEnvelope(progress, 0.02, 0.85, 2.5);

    // Wind integration from project store
    const { wind } = useProjectStore.getState();
    const windRad = (wind.direction * Math.PI) / 180;
    const windX = wind.enabled ? Math.sin(windRad) * wind.speed * 0.08 : 0;
    const windZ = wind.enabled ? Math.cos(windRad) * wind.speed * 0.08 : 0;

    // Inject density into fluid grid on burst (once)
    const fluidGrid = (window as any).__niagaraFluidGrid as FluidGrid | undefined;
    if (fluidGrid && progress > 0.01 && progress < 0.1 && !injectedRef.current) {
      injectDensity(fluidGrid, position[0], position[2], 3.0 * caliber, caliber * 2);
      injectVelocity(fluidGrid, position[0], position[2], 0, -2, caliber * 2);
      injectedRef.current = true;
    }
    if (progress <= 0) injectedRef.current = false;

    // Read fluid density for smoke modulation
    const fluidDensity = fluidGrid ? readDensityAt(fluidGrid, position[0], position[2]) : 0;
    const smokeBoost = 1 + fluidDensity * 0.3;

    for (let i = 0; i < count; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      const fadeSq = fade * fade;

      const dragH = Math.exp(-0.04 * t);
      const dragV = Math.exp(-0.03 * t);

      // Wind + collision: particles that hit ground bounce with restitution
      const rawY = vy * t * dragV + 0.5 * GRAV * t * t;
      const bounced = rawY < 0;
      const restitution = 0.2;

      posArr[i * 3] = vx * t * dragH + windX * t * t * 0.5;
      posArr[i * 3 + 1] = bounced ? Math.abs(rawY) * restitution : rawY;
      posArr[i * 3 + 2] = vz * t * dragH + windZ * t * t * 0.5;

      const flashIntensity = Math.max(0, 1 - progress * 15);
      const emberPhase = Math.max(0, (progress - 0.35) / 0.65);
      const twinkle = temporalFlicker(sparkleSeeds[i], time, 0.6, 0.34, 0.36);

      let r = THREE.MathUtils.lerp(baseColor.r * 1.3, 1.4, flashIntensity);
      let g = THREE.MathUtils.lerp(baseColor.g * 1.3, 1.15, flashIntensity);
      let b = THREE.MathUtils.lerp(baseColor.b * 1.3, 0.9, flashIntensity);

      if (emberPhase > 0) {
        const ep = emberPhase * emberPhase;
        r = THREE.MathUtils.lerp(r, emberColor.r, ep * 0.6);
        g = THREE.MathUtils.lerp(g, emberColor.g, ep * 0.7);
        b = THREE.MathUtils.lerp(b, emberColor.b, ep * 0.8);
      }

      const hdrBoost = 1.4 + flashIntensity * 3.0;
      colArr[i * 3] = r * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;
      colArr[i * 3 + 1] = g * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;
      colArr[i * 3 + 2] = b * fadeSq * twinkle * hdrBoost * envelope * smokeBoost;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  const flashSize = 1.2 + caliber * 0.5;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);
  const angleOffsetRad = (angleOffset * Math.PI) / 180;

  return (
    <group position={position} rotation={[0, 0, angleOffsetRad]}>
      {progress < 0.08 && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[flashSize + progress * 20, 16, 16]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={0.7 * (1 - progress / 0.08)} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
        </mesh>
      )}
      {progress < 0.2 && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1, 3 + progress * 30 + caliber * 2, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.12 * (1 - progress / 0.2)} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {progress > 0.02 && progress < 0.6 && (
        <mesh position={[0, progress * 4, 0]}>
          <sphereGeometry args={[0.6 + progress * 6, 8, 8]} />
          <meshBasicMaterial color="#887766" transparent opacity={0.06 * (1 - progress / 0.6)} />
        </mesh>
      )}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(count * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(count * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.22 + caliber * 0.05} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
