import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackReleaseEnvelope, temporalFlicker } from '@/lib/pyroNoise';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

/**
 * Mine Effect — Ground burst upward
 * Real mine behavior: wide cone (30-60°), heavy spread in X/Z,
 * stars erupt from ground level and spread outward while rising.
 * NOT a comet (narrow rising trail) — mines are WIDE bursts.
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

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const emberColor = useMemo(() => new THREE.Color().setHSL(0.05, 0.8, 0.12), []);

  const { velocities, lifetimes, sparkleSeeds } = useMemo(() => {
    const v = new Float32Array(count * 3);
    const l = new Float32Array(count);
    const s = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      // CRITICAL: Real mine cone angle is 30-60° from vertical (0.5-1.0 rad)
      // This creates the wide "fountain burst" characteristic of mines
      const upAngle = 0.15 + Math.random() * 0.85; // 8° to 57° from vertical
      const speed = 10 + Math.random() * 18 + caliber * 4;

      // Strong X/Z spread — mines spray outward
      v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
      v[i * 3 + 1] = Math.cos(upAngle) * speed + 2; // upward component
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

    for (let i = 0; i < count; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      const fadeSq = fade * fade;
      
      // Different drag for horizontal vs vertical — stars spread wide then fall
      const dragH = Math.exp(-0.04 * t); // less horizontal drag = wider spread
      const dragV = Math.exp(-0.03 * t);

      posArr[i * 3] = vx * t * dragH;
      posArr[i * 3 + 1] = Math.max(0, vy * t * dragV + 0.5 * GRAV * t * t);
      posArr[i * 3 + 2] = vz * t * dragH;

      const flashIntensity = Math.max(0, 1 - progress * 15);
      const emberPhase = Math.max(0, (progress - 0.35) / 0.65);
      const twinkle = temporalFlicker(sparkleSeeds[i], time, 0.6, 0.34, 0.36);

      // Vibrant color — stronger saturation
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
      colArr[i * 3] = r * fadeSq * twinkle * hdrBoost * envelope;
      colArr[i * 3 + 1] = g * fadeSq * twinkle * hdrBoost * envelope;
      colArr[i * 3 + 2] = b * fadeSq * twinkle * hdrBoost * envelope;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  const flashSize = 1.2 + caliber * 0.5;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {/* Ground flash — wide burst light */}
      {progress < 0.08 && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[flashSize + progress * 20, 16, 16]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={0.7 * (1 - progress / 0.08)} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
        </mesh>
      )}
      {/* Wide ground ring — characteristic of mines */}
      {progress < 0.2 && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1, 3 + progress * 30 + caliber * 2, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.12 * (1 - progress / 0.2)} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Smoke cloud at base */}
      {progress > 0.02 && progress < 0.6 && (
        <mesh position={[0, progress * 4, 0]}>
          <sphereGeometry args={[0.6 + progress * 6, 8, 8]} />
          <meshBasicMaterial color="#887766" transparent opacity={0.06 * (1 - progress / 0.6)} />
        </mesh>
      )}
      {/* Star particles — Additive */}
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
