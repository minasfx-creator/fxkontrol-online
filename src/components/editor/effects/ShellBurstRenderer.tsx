import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createShellBurst,
  stepParticle,
  getBreakSpeed,
  getStarCount,
  getStarLifetime,
  getStarSpread,
  type BurstPattern,
  type ParticleState,
} from '@/lib/pyroPhysics';
import { useSceneStore } from '@/store/useSceneStore';
import { getThreeBlending, getMaxEnergy, GROUND_LIGHT_SCALE } from '@/lib/niagaraBlenderRules';

// ── Custom GPU Shaders (Skybrush-grade thermal rendering) ───────────

const BURST_VERTEX = `
  attribute float aLife;
  attribute float aMaxLife;
  attribute float aBrightness;
  attribute vec3 aVelocity;
  
  varying float vLife;
  varying float vMaxLife;
  varying float vBrightness;
  varying float vSpeed;
  
  uniform float uTime;
  uniform float uBaseSize;
  uniform float uHDRMultiplier;
  
  void main() {
    vLife = aLife;
    vMaxLife = aMaxLife;
    vBrightness = aBrightness;
    vSpeed = length(aVelocity);
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Size: larger at birth, shrinking as star burns out
    float lifeRatio = clamp(aLife / aMaxLife, 0.0, 1.0);
    float sizeDecay = mix(1.0, 0.15, pow(lifeRatio, 0.8));
    // Slight bloom pulse at birth
    float birthPulse = lifeRatio < 0.05 ? 1.0 + (1.0 - lifeRatio / 0.05) * 0.8 : 1.0;
    
    gl_PointSize = uBaseSize * sizeDecay * birthPulse * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const BURST_FRAGMENT = `
  varying float vLife;
  varying float vMaxLife;
  varying float vBrightness;
  varying float vSpeed;
  
  uniform vec3 uColor;
  uniform float uHDRMultiplier;
  uniform float uTime;
  uniform float uThermalSpeed;
  uniform float uMaxEnergy;

  void main() {
    // Gaussian sprite: soft circle with hot core
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    // Thermal speed controls how fast the color cools down
    float rawRatio = clamp(vLife / vMaxLife, 0.0, 1.0);
    float lifeRatio = clamp(rawRatio * uThermalSpeed, 0.0, 1.0);
    
    // Thermal color transition: white-hot → saturated → ember → charcoal
    // The ignition keeps some hue from shell color to avoid full white lock.
    vec3 whiteHot = mix(vec3(1.0, 0.98, 0.85), uColor + vec3(0.15), 0.35) * (0.4 + uHDRMultiplier * 0.15);
    vec3 saturated = uColor * 1.0;
    vec3 ember = vec3(uColor.r * 0.6 + 0.2, uColor.g * 0.2, uColor.b * 0.05);
    vec3 charcoal = vec3(0.15, 0.08, 0.02);
    
    vec3 thermalColor;
    if (lifeRatio < 0.08) {
      // Birth flash: white-hot core (Skybrush ignition phase)
      thermalColor = mix(whiteHot, saturated, lifeRatio / 0.08);
    } else if (lifeRatio < 0.45) {
      // Peak: full saturated color
      thermalColor = mix(saturated, uColor, (lifeRatio - 0.08) / 0.37);
    } else if (lifeRatio < 0.75) {
      // Cooling: desaturating to ember
      thermalColor = mix(uColor, ember, (lifeRatio - 0.45) / 0.30);
    } else {
      // Dying: ember to charcoal
      thermalColor = mix(ember, charcoal, (lifeRatio - 0.75) / 0.25);
    }
    
    // Gaussian glow: bright core, soft edges
    float coreGlow = exp(-dist * dist * 18.0);
    float outerGlow = exp(-dist * dist * 6.0);
    float glow = coreGlow * 0.7 + outerGlow * 0.3;
    
    // Flicker: subtle random twinkle
    float flicker = 0.85 + 0.15 * sin(vLife * 47.0 + gl_PointCoord.x * 13.0);
    
    // Opacity fade: quick fade-in, gradual burnout
    float fadeIn = smoothstep(0.0, 0.03, rawRatio);
    float fadeOut = 1.0 - pow(rawRatio, 1.8);
    float alpha = fadeIn * fadeOut * vBrightness * glow * flicker;

    // Energy conservation: cap luminance to prevent additive white-out
    vec3 finalColor = min(thermalColor * glow, vec3(uMaxEnergy));
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ── Afterglow shader (persistent glow cloud after burst) ────────────

const AFTERGLOW_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AFTERGLOW_FRAGMENT = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uAfterglowIntensity;
  
  void main() {
    float dist = length(vUv - vec2(0.5)) * 2.0;
    float glow = exp(-dist * dist * 2.5);
    // Subtle color shift over time
    vec3 warmShift = uColor + vec3(0.1, -0.05, -0.1) * sin(uTime * 0.5);
    gl_FragColor = vec4(warmShift * glow * 1.2, uOpacity * glow * uAfterglowIntensity);
  }
`;

// ── Constants ───────────────────────────────────────────────────────

const MAX_PARTICLES = 1500;

interface ShellBurstRendererProps {
  position: [number, number, number];
  color: string;
  progress: number; // 0 = just burst, 1 = fully faded
  caliber?: number;
  pattern?: BurstPattern;
  secondaryColor?: string;
}

/**
 * GPU-accelerated shell burst renderer with real-time store controls.
 * 
 * Connected Skybrush/Scene store parameters:
 * - hdrMultiplier: Controls peak brightness of white-hot core (1-8x)
 * - starDrag: Aerodynamic drag coefficient on star particles
 * - windSpeed/windDirection: Environmental wind from Flockwave protocol
 * - afterglowDuration/afterglowIntensity: Post-burst glow cloud
 * - burstFlashIntensity: Detonation flash sphere brightness
 * - thermalTransitionSpeed: Rate of thermal color cooling
 */
export default function ShellBurstRenderer({
  position,
  color,
  progress,
  caliber = 4,
  pattern = 'peony',
  secondaryColor,
}: ShellBurstRendererProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const afterglowRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<ParticleState[] | null>(null);
  const initTimeRef = useRef<number>(0);

  // ── Read real-time store values (Skybrush environment + pyro controls) ──
  const sceneSettings = useSceneStore(st => st.settings);
  const {
    hdrMultiplier,
    starDrag,
    windSpeed,
    windDirection,
    afterglowDuration,
    afterglowIntensity,
    burstFlashIntensity,
    thermalTransitionSpeed,
  } = sceneSettings;

  // Compute wind vector from speed + direction (Skybrush Flockwave convention: 0°=North, CW)
  const windVec = useMemo<[number, number, number]>(() => {
    const dirRad = (windDirection * Math.PI) / 180;
    return [
      Math.sin(dirRad) * windSpeed,
      0,
      -Math.cos(dirRad) * windSpeed,
    ];
  }, [windSpeed, windDirection]);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const starCount = useMemo(() => Math.min(MAX_PARTICLES, getStarCount(caliber)), [caliber]);
  const breakSpeed = useMemo(() => getBreakSpeed(caliber), [caliber]);
  const starLifetime = useMemo(() => getStarLifetime(caliber), [caliber]);
  const burstSpread = useMemo(() => getStarSpread(caliber), [caliber]);
  const baseSize = useMemo(() => 0.5 + caliber * 0.35, [caliber]);

  // Initialize particles on first render
  useEffect(() => {
    particlesRef.current = createShellBurst(starCount, breakSpeed, pattern, starLifetime);
    initTimeRef.current = 0;
  }, [starCount, breakSpeed, pattern, starLifetime]);

  // Buffer attributes (reused — no GC pressure)
  const { posBuffer, lifeBuffer, maxLifeBuffer, brightnessBuffer, velocityBuffer } = useMemo(() => ({
    posBuffer: new Float32Array(MAX_PARTICLES * 3),
    lifeBuffer: new Float32Array(MAX_PARTICLES),
    maxLifeBuffer: new Float32Array(MAX_PARTICLES),
    brightnessBuffer: new Float32Array(MAX_PARTICLES),
    velocityBuffer: new Float32Array(MAX_PARTICLES * 3),
  }), []);

  // Shader uniforms — updated every frame from store
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uBaseSize: { value: baseSize },
    uHDRMultiplier: { value: hdrMultiplier },
    uTime: { value: 0 },
    uThermalSpeed: { value: thermalTransitionSpeed },
    uMaxEnergy: { value: getMaxEnergy(0) },
  }), []);

  // Pre-compute blend configs (Screen for secondary elements)
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);
  const additiveBlend = useMemo(() => getThreeBlending('additive'), []);

  const afterglowUniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: 0 },
    uTime: { value: 0 },
    uAfterglowIntensity: { value: afterglowIntensity },
  }), []);

  // Crossette sub-bursts
  const crossetteRef = useRef<ParticleState[][]>([]);
  const crossetteTriggered = useRef(new Set<number>());

  useFrame((_, delta) => {
    if (!pointsRef.current || !particlesRef.current || progress <= 0) return;
    const particles = particlesRef.current;

    const dt = Math.min(delta, 0.05);
    initTimeRef.current += dt;
    const time = initTimeRef.current;

    // Step physics using store-driven drag and wind
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.life < p.maxLife) {
        stepParticle(p, dt, windVec, starDrag);
      }

      // Crossette: sub-burst when star reaches ~40% life
      if (pattern === 'crossette' && p.life > p.maxLife * 0.4 && !crossetteTriggered.current.has(i)) {
        crossetteTriggered.current.add(i);
        const subCount = 4 + Math.floor(Math.random() * 4);
        const subParticles: ParticleState[] = [];
        for (let j = 0; j < subCount; j++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const sp = breakSpeed * 0.3;
          subParticles.push({
            x: p.x, y: p.y, z: p.z,
            vx: Math.sin(phi) * Math.cos(theta) * sp,
            vy: Math.cos(phi) * sp,
            vz: Math.sin(phi) * Math.sin(theta) * sp,
            life: 0, maxLife: starLifetime * 0.4, brightness: 1,
          });
        }
        crossetteRef.current.push(subParticles);
      }

      posBuffer[i * 3] = p.x;
      posBuffer[i * 3 + 1] = p.y;
      posBuffer[i * 3 + 2] = p.z;
      lifeBuffer[i] = p.life;
      maxLifeBuffer[i] = p.maxLife;
      brightnessBuffer[i] = p.brightness;
      velocityBuffer[i * 3] = p.vx;
      velocityBuffer[i * 3 + 1] = p.vy;
      velocityBuffer[i * 3 + 2] = p.vz;
    }

    // Step crossette sub-particles with store wind/drag
    for (const subGroup of crossetteRef.current) {
      for (const sp of subGroup) {
        if (sp.life < sp.maxLife) stepParticle(sp, dt, windVec, starDrag * 1.5);
      }
    }

    // Update GPU buffers — reuse existing attributes, never create new ones
    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const lifeAttr = geo.getAttribute('aLife') as THREE.BufferAttribute;
    const maxLifeAttr = geo.getAttribute('aMaxLife') as THREE.BufferAttribute;
    const brightAttr = geo.getAttribute('aBrightness') as THREE.BufferAttribute;
    const velAttr = geo.getAttribute('aVelocity') as THREE.BufferAttribute;
    if (posAttr) { posAttr.needsUpdate = true; }
    if (lifeAttr) { lifeAttr.needsUpdate = true; }
    if (maxLifeAttr) { maxLifeAttr.needsUpdate = true; }
    if (brightAttr) { brightAttr.needsUpdate = true; }
    if (velAttr) { velAttr.needsUpdate = true; }

    // ── Live-update uniforms from store ──
    const mat = pointsRef.current.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = time;
    mat.uniforms.uColor.value.copy(baseColor);
    mat.uniforms.uHDRMultiplier.value = hdrMultiplier;
    mat.uniforms.uBaseSize.value = baseSize;
    mat.uniforms.uThermalSpeed.value = thermalTransitionSpeed;

    // ── Afterglow cloud (duration + intensity from store) ──
    if (afterglowRef.current) {
      const afterglowMaxProgress = afterglowDuration / (starLifetime + afterglowDuration);
      const afterglowProgress = Math.max(0, progress - 0.1);
      const spread = burstSpread * 0.4 * Math.min(1, afterglowProgress * 3);
      afterglowRef.current.scale.setScalar(spread);
      const amat = afterglowRef.current.material as THREE.ShaderMaterial;
      const afterglowFade = Math.max(0, 1 - progress / Math.max(0.1, afterglowMaxProgress));
      amat.uniforms.uOpacity.value = 0.15 * afterglowFade;
      amat.uniforms.uTime.value = time;
      amat.uniforms.uAfterglowIntensity.value = afterglowIntensity;
    }
  });

  if (progress <= 0 || progress > 1.1) return null;

  return (
    <group position={position}>
      {/* Main burst particles */}
      <points ref={pointsRef} frustumCulled={false}>
        <bufferGeometry drawRange={{ start: 0, count: starCount }}>
          <bufferAttribute attach="attributes-position" args={[posBuffer, 3]} />
          <bufferAttribute attach="attributes-aLife" args={[lifeBuffer, 1]} />
          <bufferAttribute attach="attributes-aMaxLife" args={[maxLifeBuffer, 1]} />
          <bufferAttribute attach="attributes-aBrightness" args={[brightnessBuffer, 1]} />
          <bufferAttribute attach="attributes-aVelocity" args={[velocityBuffer, 3]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={BURST_VERTEX}
          fragmentShader={BURST_FRAGMENT}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Crossette sub-bursts */}
      {crossetteRef.current.map((subGroup, gi) => (
        <CrossetteSubBurst key={gi} particles={subGroup} color={color} caliber={caliber} windVec={windVec} drag={starDrag} />
      ))}

      {/* Burst flash — instant bright sphere at detonation (intensity from store) */}
      {progress < 0.08 && (
        <mesh>
          <sphereGeometry args={[1.5 + caliber * 0.8, 16, 16]} />
          <meshBasicMaterial
            color={secondaryColor || color}
            transparent
            opacity={burstFlashIntensity * 0.45 * (1 - progress / 0.08)}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Secondary flash ring */}
      {progress < 0.12 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[caliber * 0.5 + progress * 40, caliber * 0.8 + progress * 45, 32]} />
          <meshBasicMaterial
            color={secondaryColor || color}
            transparent
            opacity={burstFlashIntensity * 0.3 * (1 - progress / 0.12)}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Afterglow cloud */}
      <mesh ref={afterglowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <shaderMaterial
          vertexShader={AFTERGLOW_VERTEX}
          fragmentShader={AFTERGLOW_FRAGMENT}
          uniforms={afterglowUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Ground illumination */}
      {progress < 0.5 && (
        <pointLight
          color={color}
          intensity={Math.max(0, (1 - progress * 2)) * caliber * 2 * burstFlashIntensity}
          distance={burstSpread * 3}
          decay={2}
        />
      )}
    </group>
  );
}

// ── Crossette Sub-Burst (now uses store wind/drag) ──────────────────

function CrossetteSubBurst({
  particles,
  color,
  caliber,
  windVec,
  drag,
}: {
  particles: ParticleState[];
  color: string;
  caliber: number;
  windVec: [number, number, number];
  drag: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  // Pre-allocate buffers once based on particle count
  const buffers = useMemo(() => ({
    pos: new Float32Array(particles.length * 3),
    col: new Float32Array(particles.length * 3),
  }), [particles.length]);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const { pos, col } = buffers;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      const fade = p.brightness;
      col[i * 3] = baseColor.r * fade * 1.1;
      col[i * 3 + 1] = baseColor.g * fade * 0.95;
      col[i * 3 + 2] = baseColor.b * fade * 0.85;
    }

    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    if (posAttr) posAttr.needsUpdate = true;
    if (colAttr) colAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[buffers.col, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15 + caliber * 0.04}
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}
