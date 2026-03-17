import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getMortarVelocity, GRAVITY } from '@/lib/pyroPhysics';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const TRAIL_POINTS = 120;
const SPARK_COUNT = 40;
const DRIP_COUNT = 16;

/**
 * Comet effect — realistic rising comet with:
 * - Physics-based trajectory with lateral spread (X/Z wobble)
 * - Incandescent white-hot head with golden-to-red trail
 * - Individual falling sparks that detach along trajectory
 * - Dripping sparks with gravity and drag
 * - Muzzle flash at mortar
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

  // Pre-generate spark seeds with lateral spread
  const sparkSeeds = useMemo(() => {
    const s: { angleXZ: number; spreadX: number; spreadZ: number; speed: number; detachT: number; drag: number; size: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      s.push({
        angleXZ: angle,
        spreadX: Math.cos(angle) * (0.3 + Math.random() * 1.2),
        spreadZ: Math.sin(angle) * (0.3 + Math.random() * 1.2),
        speed: 0.5 + Math.random() * 1.5,
        detachT: 0.05 + Math.random() * 0.75,
        drag: 0.92 + Math.random() * 0.06,
        size: 0.015 + Math.random() * 0.025,
      });
    }
    return s;
  }, []);

  // Dripping sparks — heavier, fall faster
  const dripSeeds = useMemo(() => {
    const d: { angleXZ: number; lateralV: number; detachT: number; size: number }[] = [];
    for (let i = 0; i < DRIP_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      d.push({
        angleXZ: angle,
        lateralV: 0.1 + Math.random() * 0.4,
        detachT: 0.15 + Math.random() * 0.6,
        size: 0.01 + Math.random() * 0.015,
      });
    }
    return d;
  }, []);

  // Wobble path seed for lateral movement of the head
  const wobbleSeeds = useMemo(() => ({
    freqX: 8 + Math.random() * 6,
    freqZ: 7 + Math.random() * 5,
    ampX: 0.08 + Math.random() * 0.15,
    ampZ: 0.06 + Math.random() * 0.12,
    phaseX: Math.random() * Math.PI * 2,
    phaseZ: Math.random() * Math.PI * 2,
  }), []);

  const posArr = useRef(new Float32Array(TRAIL_POINTS * 3));
  const colArr = useRef(new Float32Array(TRAIL_POINTS * 3));

  useFrame(() => {
    if (!lineRef.current) return;

    const p = posArr.current;
    const c = colArr.current;
    const dir = direction === 'up' ? 1 : -1;

    const maxT = v0 / Math.abs(GRAVITY) * 1.5;
    const t = progress * maxT * 0.5;

    // Head position with lateral wobble
    const headY = dir * Math.max(0, v0 * t * 0.25 + 0.5 * GRAVITY * t * t * 0.06);
    const headX = Math.sin(progress * wobbleSeeds.freqX + wobbleSeeds.phaseX) * wobbleSeeds.ampX;
    const headZ = Math.cos(progress * wobbleSeeds.freqZ + wobbleSeeds.phaseZ) * wobbleSeeds.ampZ;

    for (let i = 0; i < TRAIL_POINTS; i++) {
      const frac = i / TRAIL_POINTS; // 0 = head, 1 = tail
      const trailT = Math.max(0, t - frac * t * 0.85);
      const trailY = dir * Math.max(0, v0 * trailT * 0.25 + 0.5 * GRAVITY * trailT * trailT * 0.06);

      // Trail lateral spread increases toward tail (dispersion)
      const lateralSpread = frac * frac * 0.3;
      const trailX = headX * (1 - frac * 0.7) + Math.sin(frac * 12 + progress * 15) * lateralSpread;
      const trailZ = headZ * (1 - frac * 0.7) + Math.cos(frac * 9 + progress * 12) * lateralSpread * 0.8;

      // Opacity: bright head, fast falloff
      const fade = Math.pow(1 - frac, 3.0) * Math.max(0, 1 - progress * 0.5);

      p[i * 3] = trailX;
      p[i * 3 + 1] = trailY;
      p[i * 3 + 2] = trailZ;

      // Color: white-hot head → saturated color → ember red → dark
      const headMix = Math.pow(1 - frac, 4);
      const emberMix = Math.pow(frac, 2);
      const r = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(1.0, baseColor.r * 1.3, 1 - headMix),
        0.4, emberMix * 0.6
      ) * fade;
      const g = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.97, baseColor.g * 0.9, 1 - headMix),
        0.15, emberMix * 0.7
      ) * fade;
      const b = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(0.8, baseColor.b * 0.5, 1 - headMix),
        0.05, emberMix * 0.8
      ) * fade;
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
      glowRef.current.position.set(headX, headY, headZ);
      const pulse = 1 + Math.sin(progress * 40) * 0.15;
      glowRef.current.scale.setScalar((0.2 + (1 - progress) * 0.35) * pulse);
    }
  });

  const headFade = Math.max(0, 1 - progress * 0.5);
  const dir = direction === 'up' ? 1 : -1;
  const maxT = v0 / Math.abs(GRAVITY) * 1.5;
  const t = progress * maxT * 0.5;
  const headY = dir * Math.max(0, v0 * t * 0.25 + 0.5 * GRAVITY * t * t * 0.06);
  const headX = Math.sin(progress * wobbleSeeds.freqX + wobbleSeeds.phaseX) * wobbleSeeds.ampX;
  const headZ = Math.cos(progress * wobbleSeeds.freqZ + wobbleSeeds.phaseZ) * wobbleSeeds.ampZ;

  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  // Helper: compute spark Y at time after detach
  const getSparkDetachY = (detachT: number) => {
    const sparkBaseT = detachT * maxT * 0.5;
    return dir * Math.max(0, v0 * sparkBaseT * 0.25 + 0.5 * GRAVITY * sparkBaseT * sparkBaseT * 0.06);
  };

  return (
    <group position={position}>
      {/* Muzzle flash */}
      {progress < 0.05 && (
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.25 + progress * 6, 8, 8]} />
          <meshBasicMaterial
            color="#FFEEAA"
            transparent
            opacity={0.6 * (1 - progress / 0.05)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Trail line */}
      <line ref={lineRef as any}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(TRAIL_POINTS * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(TRAIL_POINTS * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={screenBlend.blending}
          blendEquation={screenBlend.blendEquation}
          blendSrc={screenBlend.blendSrc as any}
          blendDst={screenBlend.blendDst as any}
        />
      </line>

      {/* Lateral-spread sparks — fly outward in X/Z */}
      {sparkSeeds.map((spark, i) => {
        if (progress < spark.detachT) return null;
        const elapsed = (progress - spark.detachT) * 2.5;
        const dragFactor = Math.pow(spark.drag, elapsed * 60);
        const baseY = getSparkDetachY(spark.detachT);
        const sparkY = baseY + GRAVITY * elapsed * elapsed * 0.4;
        if (sparkY < -0.5) return null;
        const sparkFade = Math.max(0, 1 - elapsed * 1.2);
        const lateralX = spark.spreadX * elapsed * dragFactor;
        const lateralZ = spark.spreadZ * elapsed * dragFactor;

        // Color transitions from golden to ember
        const emberT = Math.min(1, elapsed * 2);
        const sr = THREE.MathUtils.lerp(1.0, 0.8, emberT);
        const sg = THREE.MathUtils.lerp(0.75, 0.25, emberT);
        const sb = THREE.MathUtils.lerp(0.2, 0.05, emberT);

        return (
          <mesh key={`s${i}`} position={[lateralX, sparkY, lateralZ]}>
            <sphereGeometry args={[spark.size, 4, 4]} />
            <meshBasicMaterial
              color={new THREE.Color(sr, sg, sb)}
              transparent
              opacity={0.7 * sparkFade}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* Dripping sparks — heavy, fall with slight lateral drift */}
      {dripSeeds.map((drip, i) => {
        if (progress < drip.detachT) return null;
        const elapsed = (progress - drip.detachT) * 3;
        const baseY = getSparkDetachY(drip.detachT);
        const dripY = baseY + GRAVITY * elapsed * elapsed * 0.7;
        if (dripY < -0.5) return null;
        const dripFade = Math.max(0, 1 - elapsed * 1.8);
        const dx = Math.cos(drip.angleXZ) * drip.lateralV * elapsed;
        const dz = Math.sin(drip.angleXZ) * drip.lateralV * elapsed;

        return (
          <mesh key={`d${i}`} position={[dx, dripY, dz]}>
            <sphereGeometry args={[drip.size, 3, 3]} />
            <meshBasicMaterial
              color="#FF6622"
              transparent
              opacity={0.5 * dripFade}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}

      {/* Head glow — pulsing white-hot core */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.25, 12, 12]} />
        <meshBasicMaterial
          color="#FFFFDD"
          transparent
          opacity={0.75 * headFade}
          blending={screenBlend.blending}
          blendEquation={screenBlend.blendEquation}
          blendSrc={screenBlend.blendSrc as any}
          blendDst={screenBlend.blendDst as any}
          depthWrite={false}
        />
      </mesh>

      {/* Secondary halo around head */}
      {headFade > 0.2 && (
        <mesh position={[headX, headY, headZ]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15 * headFade}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
