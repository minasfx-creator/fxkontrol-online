import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getThreeBlending } from '@/lib/niagaraBlenderRules';

const PARTICLE_COUNT = 400;
const EMBER_COUNT = 80;

// ── Niagara-grade Flame Vertex Shader ───────────────────────────────
const FLAME_VERTEX = `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aSeed;
  
  varying float vLife;
  varying float vMaxLife;
  varying float vSeed;
  varying float vSize;
  
  uniform float uTime;
  
  void main() {
    vLife = aLife;
    vMaxLife = aMaxLife;
    vSeed = aSeed;
    
    float lifeRatio = clamp(aLife / aMaxLife, 0.0, 1.0);
    
    // Size: grow then shrink (UE5 Niagara size-over-life curve)
    float sizeOverLife = lifeRatio < 0.15 
      ? lifeRatio / 0.15 
      : 1.0 - pow((lifeRatio - 0.15) / 0.85, 0.6);
    vSize = sizeOverLife;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = sizeOverLife * 18.0 * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 48.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FLAME_FRAGMENT = `
  varying float vLife;
  varying float vMaxLife;
  varying float vSeed;
  varying float vSize;
  
  uniform float uTime;
  uniform float uIntensity;
  
  // Procedural noise for flame shape
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }
  
  void main() {
    float lifeRatio = clamp(vLife / vMaxLife, 0.0, 1.0);
    vec2 uv = gl_PointCoord;
    float dist = length(uv - vec2(0.5));
    
    // Turbulent flame shape via noise distortion
    float turb = fbm(uv * 4.0 + vec2(vSeed * 10.0, -uTime * 2.0)) * 0.3;
    float shape = smoothstep(0.5 + turb, 0.1, dist);
    
    if (shape < 0.01) discard;
    
    // Thermal color: blue core → white → yellow → orange → dark red
    vec3 col;
    if (lifeRatio < 0.08) {
      col = mix(vec3(0.15, 0.3, 1.0), vec3(1.0, 0.95, 0.85), lifeRatio / 0.08);
    } else if (lifeRatio < 0.2) {
      float t = (lifeRatio - 0.08) / 0.12;
      col = mix(vec3(1.0, 0.95, 0.85), vec3(1.3, 1.1, 0.2), t);
    } else if (lifeRatio < 0.5) {
      float t = (lifeRatio - 0.2) / 0.3;
      col = mix(vec3(1.3, 1.1, 0.2), vec3(1.1, 0.5, 0.05), t);
    } else if (lifeRatio < 0.8) {
      float t = (lifeRatio - 0.5) / 0.3;
      col = mix(vec3(1.1, 0.5, 0.05), vec3(0.6, 0.15, 0.02), t);
    } else {
      float t = (lifeRatio - 0.8) / 0.2;
      col = mix(vec3(0.6, 0.15, 0.02), vec3(0.1, 0.03, 0.01), t);
    }
    
    // Flicker
    float flicker = 0.7 + 0.3 * sin(uTime * 15.0 + vSeed * 50.0);
    
    // Opacity: fade in fast, fade out slow
    float fadeIn = smoothstep(0.0, 0.05, lifeRatio);
    float fadeOut = 1.0 - pow(lifeRatio, 1.5);
    float alpha = shape * fadeIn * fadeOut * flicker * uIntensity;
    
    gl_FragColor = vec4(col * shape, alpha);
  }
`;

/**
 * Niagara-grade Flame Projector / Fireball Effect
 * Custom GLSL shaders with procedural noise, thermal color model, ember layer, heat distortion.
 */
export default function FlameEffect({
  position,
  color,
  progress,
  height = 8,
  preset,
}: {
  position: [number, number, number];
  color: string;
  progress: number;
  height?: number;
  preset?: { id: string; maxHeightM: number; nozzles: number; colorCount: number };
}) {
  const effectiveHeight = preset ? Math.min(height, preset.maxHeightM) : height;
  const pointsRef = useRef<THREE.Points>(null);
  const emberRef = useRef<THREE.Points>(null);
  const heatRef = useRef<THREE.Mesh>(null);

  const nozzleCount = preset?.nozzles ?? 1;

  const seeds = useMemo(() => {
    const s: { angle: number; speed: number; spread: number; lt: number; phase: number; turbulence: number; seed: number }[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const nozzle = i % nozzleCount;
      const nozzleAngle = nozzleCount > 1 ? (nozzle / nozzleCount) * Math.PI * 2 : Math.random() * Math.PI * 2;
      s.push({
        angle: nozzleAngle + (Math.random() - 0.5) * 0.3,
        speed: effectiveHeight * (0.35 + Math.random() * 0.65),
        spread: 0.05 + Math.random() * 0.12,
        lt: 0.12 + Math.random() * 0.28,
        phase: Math.random() * Math.PI * 2,
        turbulence: 0.5 + Math.random() * 1.5,
        seed: Math.random(),
      });
    }
    return s;
  }, [effectiveHeight, nozzleCount]);

  const emberSeeds = useMemo(() => {
    const s: { angle: number; speed: number; lt: number; phase: number; drift: number; seed: number }[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      s.push({
        angle: Math.random() * Math.PI * 2,
        speed: effectiveHeight * (0.15 + Math.random() * 0.35),
        lt: 0.8 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.6,
        seed: Math.random(),
      });
    }
    return s;
  }, [effectiveHeight]);

  // Flame particle buffers (custom shader attributes)
  const posBuffer = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);
  const lifeBuffer = useMemo(() => new Float32Array(PARTICLE_COUNT), []);
  const maxLifeBuffer = useMemo(() => new Float32Array(PARTICLE_COUNT), []);
  const seedBuffer = useMemo(() => {
    const buf = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) buf[i] = Math.random();
    return buf;
  }, []);

  const emberPosBuffer = useMemo(() => new Float32Array(EMBER_COUNT * 3), []);
  const emberColBuffer = useMemo(() => new Float32Array(EMBER_COUNT * 3), []);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: 1 },
  }), []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const time = clock.getElapsedTime();

    const intensity = progress < 0.08
      ? Math.pow(progress / 0.08, 0.3)
      : progress > 0.88
        ? Math.pow((1 - progress) / 0.12, 0.5)
        : 1;

    uniforms.uTime.value = time;
    uniforms.uIntensity.value = intensity;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const seed = seeds[i];
      const cycleTime = ((time * 4 + seed.phase) % seed.lt) / seed.lt;
      const i3 = i * 3;

      if (cycleTime > intensity) {
        posBuffer[i3] = 0; posBuffer[i3 + 1] = -100; posBuffer[i3 + 2] = 0;
        lifeBuffer[i] = 0; maxLifeBuffer[i] = 1;
        continue;
      }

      const t = cycleTime * seed.lt;
      const turbX = Math.sin(time * 6 + i * 0.7) * seed.turbulence * 0.15 * t;
      const turbZ = Math.cos(time * 5 + i * 1.1) * seed.turbulence * 0.12 * t;
      const turbY = Math.sin(time * 8 + i * 2.3) * 0.2 * t;

      posBuffer[i3] = Math.cos(seed.angle) * seed.spread * t * effectiveHeight * 0.4 + turbX;
      posBuffer[i3 + 1] = seed.speed * t + turbY;
      posBuffer[i3 + 2] = Math.sin(seed.angle) * seed.spread * t * effectiveHeight * 0.4 + turbZ;

      lifeBuffer[i] = cycleTime * seed.lt;
      maxLifeBuffer[i] = seed.lt;
    }

    const geo = pointsRef.current.geometry;
    ['position', 'aLife', 'aMaxLife'].forEach(attr => {
      const a = geo.getAttribute(attr) as THREE.BufferAttribute;
      if (a) a.needsUpdate = true;
    });

    // Ember particles
    if (emberRef.current && intensity > 0.3) {
      for (let i = 0; i < EMBER_COUNT; i++) {
        const seed = emberSeeds[i];
        const cycleTime = ((time * 1.5 + seed.phase) % seed.lt) / seed.lt;
        const i3 = i * 3;
        const t2 = cycleTime * seed.lt;

        // Embers rise with turbulent drift and decelerate
        const drag = Math.exp(-0.3 * t2);
        emberPosBuffer[i3] = Math.cos(seed.angle) * 0.2 + seed.drift * t2 + Math.sin(time * 3 + i) * 0.1 * t2;
        emberPosBuffer[i3 + 1] = effectiveHeight * 0.5 + seed.speed * t2 * 0.5 * drag;
        emberPosBuffer[i3 + 2] = Math.sin(seed.angle) * 0.2 + Math.cos(time * 2.5 + i * 0.7) * 0.05 * t2;

        const fade = Math.max(0, 1 - cycleTime) * intensity * 0.9;
        // Hot ember color: orange-white → red → dark
        const emberLife = cycleTime;
        if (emberLife < 0.3) {
          emberColBuffer[i3] = 1.2 * fade;
          emberColBuffer[i3 + 1] = 0.7 * fade;
          emberColBuffer[i3 + 2] = 0.15 * fade;
        } else {
          const t3 = (emberLife - 0.3) / 0.7;
          emberColBuffer[i3] = (1.2 - t3 * 0.8) * fade;
          emberColBuffer[i3 + 1] = (0.7 - t3 * 0.55) * fade;
          emberColBuffer[i3 + 2] = (0.15 - t3 * 0.1) * fade;
        }
      }

      const eGeo = emberRef.current.geometry;
      const ePosAttr = eGeo.getAttribute('position') as THREE.BufferAttribute;
      const eColAttr = eGeo.getAttribute('color') as THREE.BufferAttribute;
      if (ePosAttr) ePosAttr.needsUpdate = true;
      if (eColAttr) eColAttr.needsUpdate = true;
    }

    // Heat distortion mesh
    if (heatRef.current) {
      const heatScale = effectiveHeight * 0.5 * intensity;
      heatRef.current.scale.set(heatScale * 0.6, heatScale * 1.2, heatScale * 0.6);
      heatRef.current.position.y = effectiveHeight * 0.35;
      const mat = heatRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.02 * intensity;
    }
  });

  const isActive = progress > 0.03 && progress < 0.92;
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);

  return (
    <group position={position}>
      {/* Flame particles — custom GLSL shader */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[posBuffer, 3]} />
          <bufferAttribute attach="attributes-aLife" args={[lifeBuffer, 1]} />
          <bufferAttribute attach="attributes-aMaxLife" args={[maxLifeBuffer, 1]} />
          <bufferAttribute attach="attributes-aSeed" args={[seedBuffer, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={FLAME_VERTEX}
          fragmentShader={FLAME_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Ember particles — tiny additive hot dots */}
      {isActive && (
        <points ref={emberRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[emberPosBuffer, 3]} />
            <bufferAttribute attach="attributes-color" args={[emberColBuffer, 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.035} vertexColors transparent opacity={0.95} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
        </points>
      )}

      {/* Heat distortion layer */}
      {isActive && (
        <mesh ref={heatRef} position={[0, height * 0.3, 0]}>
          <cylinderGeometry args={[0.3, 0.6, 1, 12]} />
          <meshBasicMaterial color="#FF4400" transparent opacity={0.02} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Volumetric inner glow column */}
      {isActive && (
        <>
          <mesh position={[0, height * 0.25, 0]}>
            <cylinderGeometry args={[0.08, 0.25, height * 0.5, 8]} />
            <meshBasicMaterial color="#FF8800" transparent opacity={0.1} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.2, 8, 8]} />
            <meshBasicMaterial color="#4488FF" transparent opacity={0.3} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.5 + height * 0.2, 16]} />
            <meshBasicMaterial color="#FF6600" transparent opacity={0.06} blending={screenBlend.blending} blendEquation={screenBlend.blendEquation} blendSrc={screenBlend.blendSrc as any} blendDst={screenBlend.blendDst as any} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}
