import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getMortarVelocity, getBreakHeight, getLiftTime, GRAVITY, AIR_DRAG } from '@/lib/pyroPhysics';

const TRAIL_PARTICLES = 80;
const SPARK_COUNT = 30;

// GPU comet trail shader
const COMET_VERTEX = `
  attribute float aTrailIndex;
  attribute vec3 aTrailColor;
  varying vec3 vColor;
  varying float vIndex;
  uniform float uSize;
  
  void main() {
    vColor = aTrailColor;
    vIndex = aTrailIndex;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float sizeFade = mix(1.0, 0.1, aTrailIndex);
    gl_PointSize = uSize * sizeFade * (250.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 48.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const COMET_FRAGMENT = `
  varying vec3 vColor;
  varying float vIndex;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float glow = exp(-dist * dist * 12.0);
    float core = exp(-dist * dist * 30.0);
    vec3 finalColor = vColor * (glow * 0.6 + core * 0.4);
    float alpha = (glow * 0.8 + core * 0.2) * (1.0 - vIndex * 0.7);
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

/**
 * PrefireShell: Renders a shell rising from the mortar to its break height
 * with a glowing comet head, dense sparking trail, and muzzle flash.
 * Based on Finale 3D lift physics: velocity = f(caliber), breakHeight = f(caliber).
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
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const breakH = useMemo(() => getBreakHeight(caliber), [caliber]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);
  const liftTime = useMemo(() => getLiftTime(caliber), [caliber]);

  // Launch angle in radians
  const pitchRad = (pitch || 85) * (Math.PI / 180);
  const headingRad = (heading || 0) * (Math.PI / 180);

  // Direction unit vector for launch
  const dirX = Math.sin(headingRad) * Math.cos(pitchRad);
  const dirY = Math.sin(pitchRad);
  const dirZ = -Math.cos(headingRad) * Math.cos(pitchRad);

  // Deterministic spark offsets
  const sparkSeeds = useMemo(() => {
    const s: { angle: number; speed: number; phase: number; life: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      s.push({
        angle: (i / SPARK_COUNT) * Math.PI * 2 + Math.random() * 0.3,
        speed: 0.2 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        life: 0.15 + Math.random() * 0.25,
      });
    }
    return s;
  }, []);

  if (progress <= 0 || progress > 1) return null;

  // Shell position along launch angle with real gravity
  const t = progress * liftTime;
  const dist = Math.min(breakH, v0 * t + 0.5 * GRAVITY * t * t);
  const shellX = dirX * dist;
  const shellY = dirY * dist;
  const shellZ = dirZ * dist;

  // Slight wobble for realism
  const wobbleX = Math.sin(progress * 14) * 0.12 * caliber * 0.15;
  const wobbleZ = Math.cos(progress * 19) * 0.08 * caliber * 0.12;

  // Head size scales with caliber
  const headRadius = 0.035 + caliber * 0.012;
  const headGlow = 0.12 + caliber * 0.035;
  const headBrightness = Math.max(0.4, 1 - progress * 0.25);

  // Trail positions — dense particles behind the head
  const trailPositions = new Float32Array(TRAIL_PARTICLES * 3);
  const trailColors = new Float32Array(TRAIL_PARTICLES * 3);

  for (let i = 0; i < TRAIL_PARTICLES; i++) {
    const trailT = Math.max(0, progress - (i / TRAIL_PARTICLES) * 0.4);
    const tt = trailT * liftTime;
    const tDist = Math.max(0, v0 * tt + 0.5 * GRAVITY * tt * tt);
    const fade = Math.pow(1 - i / TRAIL_PARTICLES, 2.0) * headBrightness;

    const tWobbleX = Math.sin(trailT * 14) * 0.12 * caliber * 0.15;
    const tWobbleZ = Math.cos(trailT * 19) * 0.08 * caliber * 0.12;

    // Trail follows launch angle with slight spread
    const spread = (i / TRAIL_PARTICLES) * 0.12;
    const tx = dirX * tDist + tWobbleX + (Math.random() - 0.5) * spread;
    const ty = dirY * tDist;
    const tz = dirZ * tDist + tWobbleZ + (Math.random() - 0.5) * spread;

    trailPositions[i * 3] = tx;
    trailPositions[i * 3 + 1] = ty;
    trailPositions[i * 3 + 2] = tz;

    // Thermal gradient: white-hot near head → golden → amber → dim
    const tFrac = i / TRAIL_PARTICLES;
    const warmth = Math.pow(tFrac, 0.6);
    trailColors[i * 3] = THREE.MathUtils.lerp(1.2, baseColor.r * 0.5 + 0.3, warmth) * fade;
    trailColors[i * 3 + 1] = THREE.MathUtils.lerp(0.95, baseColor.g * 0.3 + 0.15, warmth) * fade;
    trailColors[i * 3 + 2] = THREE.MathUtils.lerp(0.6, baseColor.b * 0.2, warmth) * fade;
  }

  return (
    <group position={position}>
      {/* Muzzle flash at mortar — quick bright burst */}
      {progress < 0.1 && (
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.3 + caliber * 0.12 + progress * 4, 12, 12]} />
          <meshBasicMaterial
            color="#FFEECC"
            transparent
            opacity={0.6 * Math.pow(1 - progress / 0.1, 2)}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Mortar smoke puff */}
      {progress < 0.3 && (
        <mesh position={[0, progress * 2.5, 0]}>
          <sphereGeometry args={[0.25 + progress * 2.5, 8, 8]} />
          <meshBasicMaterial
            color="#776655"
            transparent
            opacity={0.06 * (1 - progress / 0.3)}
          />
        </mesh>
      )}

      {/* GPU Comet trail — custom shader with gaussian sprites */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailPositions, 3]} />
          <bufferAttribute attach="attributes-aTrailColor" args={[trailColors, 3]} />
          <bufferAttribute attach="attributes-aTrailIndex" args={[(() => {
            const idx = new Float32Array(TRAIL_PARTICLES);
            for (let i = 0; i < TRAIL_PARTICLES; i++) idx[i] = i / TRAIL_PARTICLES;
            return idx;
          })(), 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={COMET_VERTEX}
          fragmentShader={COMET_FRAGMENT}
          uniforms={{ uSize: { value: 1.2 + caliber * 0.3 } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Falling sparks from trail — shedding hot particles */}
      {sparkSeeds.map((spark, i) => {
        const sparkStart = i * 0.025;
        if (progress < sparkStart) return null;
        const sparkAge = progress - sparkStart;
        if (sparkAge > spark.life) return null;
        
        const sparkNorm = sparkAge / spark.life;
        // Spark detaches from trail and falls
        const detachT = sparkStart * liftTime;
        const detachDist = Math.max(0, v0 * detachT + 0.5 * GRAVITY * detachT * detachT);
        const detachX = dirX * detachDist;
        const detachY = dirY * detachDist;
        const detachZ = dirZ * detachDist;
        
        const fallTime = sparkAge * 2;
        const sparkFade = Math.max(0, 1 - sparkNorm);
        
        return (
          <mesh
            key={i}
            position={[
              detachX + Math.cos(spark.angle) * spark.speed * 0.4,
              detachY - 4.9 * fallTime * fallTime,
              detachZ + Math.sin(spark.angle) * spark.speed * 0.4,
            ]}
          >
            <sphereGeometry args={[0.02, 4, 4]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.5 * sparkFade}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Shell head — bright comet point */}
      <mesh position={[shellX + wobbleX, shellY, shellZ + wobbleZ]}>
        <sphereGeometry args={[headRadius, 8, 8]} />
        <meshBasicMaterial
          color="#FFFFDD"
          transparent
          opacity={headBrightness}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Head glow halo */}
      <mesh position={[shellX + wobbleX, shellY, shellZ + wobbleZ]}>
        <sphereGeometry args={[headGlow, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.18 * headBrightness}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
