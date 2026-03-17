import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getMortarVelocity, GRAVITY } from '@/lib/pyroPhysics';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const TRAIL_POINTS = 100;
const SPARK_COUNT = 20;

/**
 * Comet effect: a bright head rising with a long sparking trail.
 * Realistic: physics-based trajectory (mortar velocity + gravity),
 * white-hot head with golden trail, individual falling sparks,
 * smoke puff at mortar, trail thins and dims with distance.
 */
export default function CometEffect({
  position,
  color,
  progress,
  direction = 'up',
  caliber = 3,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  direction?: 'up' | 'down';
  caliber?: number;
}) {
  const lineRef = useRef<THREE.Line>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);

  const sparkSeeds = useMemo(() => {
    const s: { angle: number; speed: number; detachT: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.8,
        detachT: 0.1 + Math.random() * 0.7,
      });
    }
    return s;
  }, []);

  const posArr = useRef(new Float32Array(TRAIL_POINTS * 3));
  const colArr = useRef(new Float32Array(TRAIL_POINTS * 3));

  useFrame(() => {
    if (!lineRef.current) return;

    const p = posArr.current;
    const c = colArr.current;
    const dir = direction === 'up' ? 1 : -1;

    // Physics-based head position
    const maxT = v0 / Math.abs(GRAVITY) * 1.5;
    const t = progress * maxT * 0.5;
    const headY = dir * Math.max(0, v0 * t * 0.25 + 0.5 * GRAVITY * t * t * 0.06);
    const wobbleX = Math.sin(progress * 15) * 0.12;

    for (let i = 0; i < TRAIL_POINTS; i++) {
      const frac = i / TRAIL_POINTS; // 0 = head, 1 = tail
      const trailT = Math.max(0, t - frac * t * 0.8);
      const trailY = dir * Math.max(0, v0 * trailT * 0.25 + 0.5 * GRAVITY * trailT * trailT * 0.06);
      const fade = Math.pow(1 - frac, 2.0) * Math.max(0, 1 - progress * 0.6);

      p[i * 3] = wobbleX * (1 - frac * 0.8) + Math.sin(frac * 8 + progress * 12) * 0.08 * frac;
      p[i * 3 + 1] = trailY;
      p[i * 3 + 2] = Math.cos(frac * 5 + progress * 10) * 0.06 * frac;

      // White-hot head → golden → reddish → dim
      const r = THREE.MathUtils.lerp(1.0, baseColor.r * 0.6, frac * 0.6) * fade;
      const g = THREE.MathUtils.lerp(0.95, baseColor.g * 0.4, frac * 0.7) * fade;
      const b = THREE.MathUtils.lerp(0.7, baseColor.b * 0.3, frac * 0.8) * fade;
      c[i * 3] = r;
      c[i * 3 + 1] = g;
      c[i * 3 + 2] = b;
    }

    const geo = lineRef.current.geometry;
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;

    if (glowRef.current) {
      glowRef.current.position.set(wobbleX, headY, 0);
      glowRef.current.scale.setScalar(0.25 + (1 - progress) * 0.4);
    }
  });

  const headFade = Math.max(0, 1 - progress * 0.6);
  const dir = direction === 'up' ? 1 : -1;
  const maxT = v0 / Math.abs(GRAVITY) * 1.5;
  const t = progress * maxT * 0.5;
  const headY = dir * Math.max(0, v0 * t * 0.25 + 0.5 * GRAVITY * t * t * 0.06);

  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {/* Muzzle flash — Screen */}
      {progress < 0.06 && (
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.3 + progress * 5, 8, 8]} />
          <meshBasicMaterial color="#FFEEAA" transparent opacity={0.5 * (1 - progress / 0.06)} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
        </mesh>
      )}

      {/* Trail line — Screen (trail glow, not core) */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(TRAIL_POINTS * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(TRAIL_POINTS * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.9} depthWrite={false} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} />
      </line>

      {/* Falling sparks — Additive (small, incandescent) */}
      {sparkSeeds.map((spark, i) => {
        if (progress < spark.detachT) return null;
        const fallTime = (progress - spark.detachT) * 2;
        const sparkBaseT = spark.detachT * maxT * 0.5;
        const sparkBaseY = dir * Math.max(0, v0 * sparkBaseT * 0.25 + 0.5 * GRAVITY * sparkBaseT * sparkBaseT * 0.06);
        const sparkY = sparkBaseY + GRAVITY * fallTime * fallTime * 0.5;
        if (sparkY < 0) return null;
        const sparkFade = Math.max(0, 1 - fallTime * 1.5);
        return (
          <mesh key={i} position={[
            Math.cos(spark.angle) * spark.speed * 0.4,
            sparkY,
            Math.sin(spark.angle) * spark.speed * 0.4,
          ]}>
            <sphereGeometry args={[0.02, 4, 4]} />
            <meshBasicMaterial color="#FFCC44" transparent opacity={0.5 * sparkFade} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        );
      })}

      {/* Head glow — Screen */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color="#FFFFDD" transparent opacity={0.7 * headFade} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
      </mesh>
    </group>
  );
}
