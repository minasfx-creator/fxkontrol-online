import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Finale-grade Mine Effect
 * - Instantaneous ground-level mortar burst
 * - Narrow upward cone (~15° from vertical, real mine spec)
 * - Caliber-proportional star count and break speed
 * - White-hot initial flash → saturated color → ember fade
 * - Ground-level muzzle flash + smoke puff
 * - Per-star flicker and drag
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
  const count = useMemo(() => Math.min(500, Math.round(180 + caliber * caliber * 12)), [caliber]);
  const pointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const emberColor = useMemo(() => {
    return new THREE.Color().setHSL(0.05, 0.8, 0.12);
  }, []);

  const { velocities, lifetimes, twinklePhases } = useMemo(() => {
    const v = new Float32Array(count * 3);
    const l = new Float32Array(count);
    const tp = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      // Narrow upward cone: 0-15° from vertical (tight mine burst)
      const upAngle = Math.random() * Math.PI * 0.085;
      const speed = 14 + Math.random() * 20 + caliber * 3;
      v[i * 3] = Math.cos(theta) * Math.sin(upAngle) * speed;
      v[i * 3 + 1] = Math.cos(upAngle) * speed + 4;
      v[i * 3 + 2] = Math.sin(theta) * Math.sin(upAngle) * speed;
      l[i] = 0.5 + Math.random() * 0.9;
      tp[i] = Math.random() * Math.PI * 2;
    }
    return { velocities: v, lifetimes: l, twinklePhases: tp };
  }, [count, caliber]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posArr = new Float32Array(count * 3);
    const colArr = new Float32Array(count * 3);
    const t = progress * 2.2;
    const GRAV = -9.81;
    const time = clock.getElapsedTime();

    for (let i = 0; i < count; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const age = progress / lt;
      const fade = Math.max(0, 1 - age);
      const fadeSq = fade * fade;
      const dragH = Math.exp(-0.07 * t);
      const dragV = Math.exp(-0.025 * t);

      posArr[i * 3] = vx * t * dragH;
      posArr[i * 3 + 1] = Math.max(0, vy * t * dragV + 0.5 * GRAV * t * t);
      posArr[i * 3 + 2] = vz * t * dragH;

      // Finale HDR color pipeline
      const flashIntensity = Math.max(0, 1 - progress * 20);
      const emberPhase = Math.max(0, (progress - 0.4) / 0.6);
      
      const twinkle = 0.55
        + Math.sin(twinklePhases[i] + time * 30 + i * 5) * 0.2
        + Math.sin(twinklePhases[i] * 2.1 + time * 50) * 0.15
        + (Math.random() > 0.97 ? 0.5 : 0);
      
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
      colArr[i * 3] = r * fadeSq * twinkle * hdrBoost;
      colArr[i * 3 + 1] = g * fadeSq * twinkle * hdrBoost;
      colArr[i * 3 + 2] = b * fadeSq * twinkle * hdrBoost;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  });

  const flashSize = 1.0 + caliber * 0.4;

  return (
    <group position={position}>
      {/* Ground muzzle flash — massive bright burst */}
      {progress < 0.06 && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[flashSize + progress * 15, 16, 16]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={0.8 * (1 - progress / 0.06)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Colored flash halo */}
      {progress < 0.1 && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[flashSize * 1.5 + progress * 10, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.4 * (1 - progress / 0.1)} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* Ground illumination disc */}
      {progress < 0.15 && (
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[2 + progress * 20, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.08 * (1 - progress / 0.15)} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Smoke puff — rises and expands */}
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
