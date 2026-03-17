import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackReleaseEnvelope, temporalFlicker } from '@/lib/pyroNoise';
import { getThreeBlending, GROUND_LIGHT_SCALE } from '@/lib/niagaraBlenderRules';

/**
 * Mine Effect refinado:
 * - cone vertical realista
 * - cintilação determinística (sem ruído por frame)
 * - ciclo térmico HDR consistente
 * - buffers reutilizados para melhor performance
 */
export default function MineEffect({
  position,
  color,
  progress,
  caliber = 3,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
}) {
  const count = useMemo(() => Math.min(520, Math.round(180 + caliber * caliber * 12)), [caliber]);
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
      const upAngle = Math.random() * Math.PI * 0.085;
      const speed = 14 + Math.random() * 20 + caliber * 3;
      v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
      v[i * 3 + 1] = Math.cos(upAngle) * speed + 4;
      v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
      l[i] = 0.5 + Math.random() * 0.9;
      s[i] = Math.random() * 999 + i;
    }

    return { velocities: v, lifetimes: l, sparkleSeeds: s };
  }, [count, caliber]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;

    const geo = pointsRef.current.geometry;
    const posArr = posRef.current;
    const colArr = colRef.current;
    const t = progress * 2.2;
    const GRAV = -9.81;
    const time = clock.getElapsedTime();
    const envelope = attackReleaseEnvelope(progress, 0.03, 0.9, 2.2);

    for (let i = 0; i < count; i++) {
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      const fadeSq = fade * fade;
      const dragH = Math.exp(-0.07 * t);
      const dragV = Math.exp(-0.025 * t);

      posArr[i * 3] = vx * t * dragH;
      posArr[i * 3 + 1] = Math.max(0, vy * t * dragV + 0.5 * GRAV * t * t);
      posArr[i * 3 + 2] = vz * t * dragH;

      const flashIntensity = Math.max(0, 1 - progress * 20);
      const emberPhase = Math.max(0, (progress - 0.4) / 0.6);
      const twinkle = temporalFlicker(sparkleSeeds[i], time, 0.6, 0.34, 0.36);

      let r = THREE.MathUtils.lerp(baseColor.r, 1.3, flashIntensity);
      let g = THREE.MathUtils.lerp(baseColor.g, 1.1, flashIntensity);
      let b = THREE.MathUtils.lerp(baseColor.b, 0.85, flashIntensity);

      if (emberPhase > 0) {
        const ep = emberPhase * emberPhase;
        r = THREE.MathUtils.lerp(r, emberColor.r, ep * 0.7);
        g = THREE.MathUtils.lerp(g, emberColor.g, ep * 0.8);
        b = THREE.MathUtils.lerp(b, emberColor.b, ep * 0.9);
      }

      const hdrBoost = 1.1 + flashIntensity * 2.5;
      colArr[i * 3] = r * fadeSq * twinkle * hdrBoost * envelope;
      colArr[i * 3 + 1] = g * fadeSq * twinkle * hdrBoost * envelope;
      colArr[i * 3 + 2] = b * fadeSq * twinkle * hdrBoost * envelope;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  const flashSize = 1.0 + caliber * 0.4;

  return (
    <group position={position}>
      {progress < 0.06 && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[flashSize + progress * 15, 16, 16]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={0.8 * (1 - progress / 0.06)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {progress < 0.1 && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[flashSize * 1.5 + progress * 10, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.4 * (1 - progress / 0.1)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {progress < 0.15 && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2 + progress * 20, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.08 * (1 - progress / 0.15)} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      )}
      {progress > 0.02 && progress < 0.5 && (
        <mesh position={[0, progress * 6, 0]}>
          <sphereGeometry args={[0.4 + progress * 5, 8, 8]} />
          <meshBasicMaterial color="#776655" transparent opacity={0.05 * (1 - progress / 0.5)} />
        </mesh>
      )}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(count * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(count * 3), 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.18 + caliber * 0.04} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </group>
  );
}
