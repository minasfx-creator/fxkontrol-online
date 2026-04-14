import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getMortarVelocity, getBreakHeight, getLiftTime, GRAVITY } from '@/lib/pyroPhysics';
import { hash01 } from '@/lib/pyroNoise';

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

// Spark point shader
const SPARK_VERTEX = `
  attribute vec3 aSparkColor;
  attribute float aSparkAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vColor = aSparkColor;
    vAlpha = aSparkAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 3.0 * (200.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 12.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SPARK_FRAGMENT = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    float glow = exp(-dist * dist * 8.0);
    gl_FragColor = vec4(vColor * glow, vAlpha * glow);
  }
`;

/**
 * PrefireShell: Renders a shell rising from the mortar to its break height
 * with a glowing comet head, dense sparking trail, and muzzle flash.
 */
const PrefireShell = React.forwardRef<THREE.Group, {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
  heading?: number;
  pitch?: number;
}>(function PrefireShell({
  position,
  color,
  progress,
  caliber = 4,
  heading = 0,
  pitch = 85,
}, _ref) {
  const trailPointsRef = useRef<THREE.Points>(null);
  const sparkPointsRef = useRef<THREE.Points>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const breakH = useMemo(() => getBreakHeight(caliber), [caliber]);
  const v0 = useMemo(() => getMortarVelocity(caliber), [caliber]);
  const liftTime = useMemo(() => getLiftTime(caliber), [caliber]);

  // Memoized launch direction (Fix 3)
  const { pitchRad, headingRad, dirX, dirY, dirZ } = useMemo(() => {
    const pRad = (pitch || 85) * (Math.PI / 180);
    const hRad = (heading || 0) * (Math.PI / 180);
    return {
      pitchRad: pRad,
      headingRad: hRad,
      dirX: Math.sin(hRad) * Math.cos(pRad),
      dirY: Math.sin(pRad),
      dirZ: -Math.cos(hRad) * Math.cos(pRad),
    };
  }, [heading, pitch]);

  // Pre-allocate trail buffers
  const trailBuffers = useMemo(() => ({
    positions: new Float32Array(TRAIL_PARTICLES * 3),
    colors: new Float32Array(TRAIL_PARTICLES * 3),
    indices: (() => {
      const idx = new Float32Array(TRAIL_PARTICLES);
      for (let i = 0; i < TRAIL_PARTICLES; i++) idx[i] = i / TRAIL_PARTICLES;
      return idx;
    })(),
  }), []);

  // Pre-allocate spark buffers (Fix 2)
  const sparkBuffers = useMemo(() => ({
    positions: new Float32Array(SPARK_COUNT * 3),
    colors: new Float32Array(SPARK_COUNT * 3),
    alphas: new Float32Array(SPARK_COUNT),
  }), []);

  // Deterministic spark offsets
  const sparkSeeds = useMemo(() => {
    const s: { angle: number; speed: number; phase: number; life: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      s.push({
        angle: (i / SPARK_COUNT) * Math.PI * 2 + hash01(i * 3.7) * 0.3,
        speed: 0.2 + hash01(i * 5.1) * 0.8,
        phase: hash01(i * 7.3) * Math.PI * 2,
        life: 0.15 + hash01(i * 11.3) * 0.25,
      });
    }
    return s;
  }, []);

  // Update trail + spark buffers every frame
  useFrame(() => {
    if (progress <= 0 || progress > 1) return;

    // Trail update
    if (trailPointsRef.current) {
      const { positions: trailPositions, colors: trailColors } = trailBuffers;
      const headBrightness = Math.max(0.4, 1 - progress * 0.25);

      for (let i = 0; i < TRAIL_PARTICLES; i++) {
        const trailT = Math.max(0, progress - (i / TRAIL_PARTICLES) * 0.4);
        const tt = trailT * liftTime;
        const tDist = Math.max(0, v0 * tt + 0.5 * GRAVITY * tt * tt);
        const fade = Math.pow(1 - i / TRAIL_PARTICLES, 2.0) * headBrightness;

        const tWobbleX = Math.sin(trailT * 14) * 0.12 * caliber * 0.15;
        const tWobbleZ = Math.cos(trailT * 19) * 0.08 * caliber * 0.12;

        // Deterministic spread (Fix 4)
        const spread = (i / TRAIL_PARTICLES) * 0.12;
        const h1 = hash01(i * 0.31 + progress * 7.3) - 0.5;
        const h2 = hash01(i * 0.57 + progress * 11.1) - 0.5;
        trailPositions[i * 3] = dirX * tDist + tWobbleX + h1 * spread;
        trailPositions[i * 3 + 1] = dirY * tDist;
        trailPositions[i * 3 + 2] = dirZ * tDist + tWobbleZ + h2 * spread;

        const tFrac = i / TRAIL_PARTICLES;
        const warmth = Math.pow(tFrac, 0.6);
        trailColors[i * 3] = THREE.MathUtils.lerp(1.2, baseColor.r * 0.5 + 0.3, warmth) * fade;
        trailColors[i * 3 + 1] = THREE.MathUtils.lerp(0.95, baseColor.g * 0.3 + 0.15, warmth) * fade;
        trailColors[i * 3 + 2] = THREE.MathUtils.lerp(0.6, baseColor.b * 0.2, warmth) * fade;
      }

      const geo = trailPointsRef.current.geometry;
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('aTrailColor') as THREE.BufferAttribute;
      if (posAttr) posAttr.needsUpdate = true;
      if (colAttr) colAttr.needsUpdate = true;
    }

    // Spark update (Fix 2 — GPU points instead of 30 meshes)
    if (sparkPointsRef.current) {
      const { positions: sp, colors: sc, alphas: sa } = sparkBuffers;
      let visibleSparks = 0;

      for (let i = 0; i < SPARK_COUNT; i++) {
        const spark = sparkSeeds[i];
        const sparkStart = i * 0.025;
        if (progress < sparkStart) continue;
        const sparkAge = progress - sparkStart;
        if (sparkAge > spark.life) continue;

        const detachT = sparkStart * liftTime;
        const detachDist = Math.max(0, v0 * detachT + 0.5 * GRAVITY * detachT * detachT);
        const fallTime = sparkAge * 2;
        const sparkFade = Math.max(0, 1 - sparkAge / spark.life);

        const idx = visibleSparks * 3;
        sp[idx] = dirX * detachDist + Math.cos(spark.angle) * spark.speed * 0.4;
        sp[idx + 1] = dirY * detachDist - 4.9 * fallTime * fallTime;
        sp[idx + 2] = dirZ * detachDist + Math.sin(spark.angle) * spark.speed * 0.4;

        sc[idx] = baseColor.r;
        sc[idx + 1] = baseColor.g;
        sc[idx + 2] = baseColor.b;
        sa[visibleSparks] = 0.5 * sparkFade;

        visibleSparks++;
      }

      const geo = sparkPointsRef.current.geometry;
      geo.setDrawRange(0, visibleSparks);
      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const colAttr = geo.getAttribute('aSparkColor') as THREE.BufferAttribute;
      const alphaAttr = geo.getAttribute('aSparkAlpha') as THREE.BufferAttribute;
      if (posAttr) posAttr.needsUpdate = true;
      if (colAttr) colAttr.needsUpdate = true;
      if (alphaAttr) alphaAttr.needsUpdate = true;
    }
  });

  if (progress <= 0 || progress > 1) return null;

  // Shell position along launch angle with real gravity
  const t = progress * liftTime;
  const dist = Math.min(breakH, v0 * t + 0.5 * GRAVITY * t * t);
  const shellX = dirX * dist;
  const shellY = dirY * dist;
  const shellZ = dirZ * dist;

  const wobbleX = Math.sin(progress * 14) * 0.12 * caliber * 0.15;
  const wobbleZ = Math.cos(progress * 19) * 0.08 * caliber * 0.12;

  const headRadius = 0.035 + caliber * 0.012;
  const headGlow = 0.12 + caliber * 0.035;
  const headBrightness = Math.max(0.4, 1 - progress * 0.25);

  const smokeRadius = 0.3 + caliber * caliber * 0.02 + progress * 3.0;
  const smokeOpacity = (0.06 + caliber * 0.008) * (1 - progress / 0.35);

  return (
    <group position={position}>
      {/* Muzzle flash */}
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

      {/* Mortar smoke */}
      {progress < 0.35 && (
        <mesh position={[0, progress * 2.5, 0]}>
          <sphereGeometry args={[smokeRadius, 8, 8]} />
          <meshBasicMaterial
            color="#776655"
            transparent
            opacity={Math.max(0, smokeOpacity)}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Secondary smoke */}
      {progress < 0.4 && progress > 0.02 && (
        <mesh position={[0, progress * 1.8, 0]}>
          <sphereGeometry args={[smokeRadius * 1.4, 8, 8]} />
          <meshBasicMaterial
            color="#665544"
            transparent
            opacity={Math.max(0, 0.03 * (1 - progress / 0.4))}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* GPU Comet trail */}
      <points ref={trailPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trailBuffers.positions, 3]} />
          <bufferAttribute attach="attributes-aTrailColor" args={[trailBuffers.colors, 3]} />
          <bufferAttribute attach="attributes-aTrailIndex" args={[trailBuffers.indices, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={COMET_VERTEX}
          fragmentShader={COMET_FRAGMENT}
          uniforms={{ uSize: { value: 1.8 + caliber * 0.5 } }}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* GPU Spark points (replaces 30 individual meshes) */}
      <points ref={sparkPointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkBuffers.positions, 3]} />
          <bufferAttribute attach="attributes-aSparkColor" args={[sparkBuffers.colors, 3]} />
          <bufferAttribute attach="attributes-aSparkAlpha" args={[sparkBuffers.alphas, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={SPARK_VERTEX}
          fragmentShader={SPARK_FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Shell head */}
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
});

export default PrefireShell;
