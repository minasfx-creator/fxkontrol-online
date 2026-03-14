import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getMortarVelocity, getBreakHeight, getLiftTime, GRAVITY, AIR_DRAG } from '@/lib/pyroPhysics';

const TRAIL_PARTICLES = 30;
const SPARK_COUNT = 12;

/**
 * PrefireShell: Renders a shell rising from the mortar to its break height
 * with a glowing comet head and a sparking trail behind it.
 * Based on Finale 3D lift physics: velocity = f(caliber), breakHeight = f(caliber).
 *
 * @param progress 0→1 across the PREFIRE duration (lift time)
 * @param caliber Shell caliber in inches
 * @param color The shell's effect color (trail tint)
 */
export default function PrefireShell({
  position,
  color,
  progress,
  caliber = 4,
  heading = 0,
  pitch = 85,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
  heading?: number;
  pitch?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const breakH = useMemo(() => getBreakHeight(caliber), [caliber]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);

  // Launch angle in radians
  const pitchRad = (pitch || 85) * (Math.PI / 180);
  const headingRad = (heading || 0) * (Math.PI / 180);

  // Deterministic spark offsets
  const sparkSeeds = useMemo(() => {
    const s: { angle: number; speed: number; phase: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      s.push({
        angle: (i / SPARK_COUNT) * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return s;
  }, []);

  if (progress <= 0 || progress > 1) return null;

  // Shell position along launch angle
  const liftTime = getLiftTime(caliber);
  const t = progress * liftTime;
  const dist = Math.min(breakH, v0 * t + 0.5 * GRAVITY * t * t);
  // Apply launch angle: shell travels along heading/pitch direction
  const shellX = Math.sin(headingRad) * Math.cos(pitchRad) * dist;
  const shellY = Math.sin(pitchRad) * dist;
  const shellZ = -Math.cos(headingRad) * Math.cos(pitchRad) * dist;
  const shellVy = v0 + GRAVITY * t;

  // Slight wobble
  const wobbleX = Math.sin(progress * 12) * 0.15 * caliber * 0.2;
  const wobbleZ = Math.cos(progress * 17) * 0.1 * caliber * 0.15;

  // Head size scales with caliber
  const headRadius = 0.04 + caliber * 0.015;
  const headGlow = 0.15 + caliber * 0.04;
  const headBrightness = Math.max(0.3, 1 - progress * 0.3);

  // Trail positions — particles behind the head
  const trailPositions = new Float32Array(TRAIL_PARTICLES * 3);
  const trailColors = new Float32Array(TRAIL_PARTICLES * 3);

  for (let i = 0; i < TRAIL_PARTICLES; i++) {
    const trailT = Math.max(0, progress - (i / TRAIL_PARTICLES) * 0.35);
    const tt = trailT * liftTime;
    const ty = Math.max(0, v0 * tt + 0.5 * GRAVITY * tt * tt);
    const fade = Math.pow(1 - i / TRAIL_PARTICLES, 1.8) * headBrightness;

    const tWobbleX = Math.sin(trailT * 12) * 0.15 * caliber * 0.2;
    const tWobbleZ = Math.cos(trailT * 17) * 0.1 * caliber * 0.15;

    trailPositions[i * 3] = tWobbleX + (Math.random() - 0.5) * 0.08;
    trailPositions[i * 3 + 1] = ty;
    trailPositions[i * 3 + 2] = tWobbleZ + (Math.random() - 0.5) * 0.08;

    // Comet trail: white-hot near head → golden → colored → dim
    const tFrac = i / TRAIL_PARTICLES;
    trailColors[i * 3] = THREE.MathUtils.lerp(1.0, baseColor.r * 0.6, tFrac) * fade;
    trailColors[i * 3 + 1] = THREE.MathUtils.lerp(0.85, baseColor.g * 0.4, tFrac) * fade;
    trailColors[i * 3 + 2] = THREE.MathUtils.lerp(0.5, baseColor.b * 0.3, tFrac) * fade;
  }

  return (
    <group position={position}>
      {/* Muzzle flash at mortar — only at start */}
      {progress < 0.08 && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.4 + caliber * 0.1 + progress * 3, 12, 12]} />
          <meshBasicMaterial
            color="#FFEECC"
            transparent
            opacity={0.5 * (1 - progress / 0.08)}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Smoke puff at mortar */}
      {progress < 0.25 && (
        <mesh position={[0, progress * 3, 0]}>
          <sphereGeometry args={[0.3 + progress * 2, 8, 8]} />
          <meshBasicMaterial
            color="#887766"
            transparent
            opacity={0.08 * (1 - progress / 0.25)}
          />
        </mesh>
      )}

      {/* Comet trail particles */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.08 + caliber * 0.02}
          vertexColors
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Falling sparks from trail */}
      {sparkSeeds.map((spark, i) => {
        const sparkProgress = Math.max(0, progress - i * 0.03);
        if (sparkProgress <= 0) return null;
        const sparkT = sparkProgress * liftTime;
        const sparkBaseY = Math.max(0, v0 * sparkT + 0.5 * GRAVITY * sparkT * sparkT);
        const fallTime = (progress - sparkProgress + 0.05) * 2;
        const sparkY = sparkBaseY - 4.9 * fallTime * fallTime; // fast gravity fall
        if (sparkY < 0) return null;
        const sparkFade = Math.max(0, 1 - fallTime * 2);
        return (
          <mesh
            key={i}
            position={[
              Math.cos(spark.angle + progress * 5) * spark.speed * 0.5,
              sparkY,
              Math.sin(spark.angle + progress * 5) * spark.speed * 0.5,
            ]}
          >
            <sphereGeometry args={[0.025, 4, 4]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.4 * sparkFade}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Shell head — bright comet */}
      <mesh position={[wobbleX, shellY, wobbleZ]}>
        <sphereGeometry args={[headRadius, 8, 8]} />
        <meshBasicMaterial
          color="#FFFFDD"
          transparent
          opacity={headBrightness}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Head glow halo */}
      <mesh position={[wobbleX, shellY, wobbleZ]}>
        <sphereGeometry args={[headGlow, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15 * headBrightness}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
