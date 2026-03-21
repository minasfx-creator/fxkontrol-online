import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  createShellBurst,
  createGlitterTrailParticle,
  stepParticle,
  getBreakSpeed,
  getStarCount,
  getStarLifetime,
  getStarSpread,
  type BurstPattern,
  type ParticleState,
  type StepModifiers,
  getFormulationModifiers,
} from '@/lib/pyroPhysics';
import { useSceneStore } from '@/store/useSceneStore';
import { getThreeBlending, getMaxEnergy, GROUND_LIGHT_SCALE } from '@/lib/niagaraBlenderRules';
import { getRealFormulation, formulationToCompound } from '@/render_ultra/fireworks/particleChemistry';

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
  uniform vec3 uColor2;
  uniform float uColorChangePoint;
  uniform float uHDRMultiplier;
  uniform float uTime;
  uniform float uThermalSpeed;
  uniform float uMaxEnergy;

  void main() {
    // Velocity-based sprite elongation (Niagara Sprite Alignment → Velocity)
    float speedFactor = clamp(vSpeed * 0.05, 0.0, 3.0);
    vec2 stretchedCoord = gl_PointCoord;
    stretchedCoord.y = (stretchedCoord.y - 0.5) / (1.0 + speedFactor) + 0.5;
    
    float dist = length(stretchedCoord - vec2(0.5));
    if (dist > 0.5) discard;
    
    float rawRatio = clamp(vLife / vMaxLife, 0.0, 1.0);
    float lifeRatio = clamp(rawRatio * uThermalSpeed, 0.0, 1.0);
    
    // Color-change
    vec3 baseHue = mix(uColor, uColor2, smoothstep(uColorChangePoint - 0.1, uColorChangePoint + 0.1, rawRatio));
    
    // Thermal color transition: white-hot → saturated → ember → charcoal
    vec3 whiteHot = mix(vec3(1.0, 0.95, 0.8), baseHue * 1.4 + vec3(0.1), 0.5) * (0.25 + uHDRMultiplier * 0.06);
    vec3 saturated = baseHue * 1.5;
    vec3 ember = vec3(baseHue.r * 0.5 + 0.25, baseHue.g * 0.15 + 0.05, baseHue.b * 0.05);
    vec3 charcoal = vec3(0.12, 0.06, 0.02);
    
    vec3 thermalColor;
    if (lifeRatio < 0.04) {
      thermalColor = mix(whiteHot, saturated, lifeRatio / 0.04);
    } else if (lifeRatio < 0.55) {
      thermalColor = mix(saturated, baseHue * 1.2, (lifeRatio - 0.04) / 0.51);
    } else if (lifeRatio < 0.80) {
      thermalColor = mix(baseHue, ember, (lifeRatio - 0.55) / 0.25);
    } else {
      thermalColor = mix(ember, charcoal, (lifeRatio - 0.80) / 0.20);
    }
    
    // Soft particle edge — Gaussian with speed-dependent tightness
    float coreRadius = mix(28.0, 15.0, clamp(speedFactor * 0.3, 0.0, 1.0));
    float coreGlow = exp(-dist * dist * coreRadius);
    float outerGlow = exp(-dist * dist * 10.0);
    float glow = coreGlow * 0.6 + outerGlow * 0.4;
    
    // Flicker
    float flicker = 0.85 + 0.15 * sin(vLife * 47.0 + stretchedCoord.x * 13.0);
    
    // Opacity fade
    float fadeIn = smoothstep(0.0, 0.03, rawRatio);
    float fadeOut = 1.0 - pow(rawRatio, 1.8);
    float alpha = fadeIn * fadeOut * vBrightness * glow * flicker;

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
    gl_FragColor = vec4(warmShift * glow * 0.6, uOpacity * glow * uAfterglowIntensity * 0.5);
  }
`;

// ── Constants ───────────────────────────────────────────────────────

const MAX_PARTICLES = 2000;

interface ShellBurstRendererProps {
  position: [number, number, number];
  color: string;
  progress: number;
  caliber?: number;
  pattern?: BurstPattern;
  secondaryColor?: string;
  hasPistil?: boolean;
  pistilColor?: string;
  colorTransition?: 'none' | 'to' | 'changing' | 'alternating';
  trailType?: 'none' | 'comet' | 'glitter' | 'brocade' | 'charcoal' | 'smoke';
  fallingLeaves?: boolean;
  formulationId?: string;
  /** VDL angle offset in degrees — rotates entire burst */
  angleOffset?: number;
  /** VDL noTrail flag — suppresses trails even for types that force them */
  noTrail?: boolean;
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
  hasPistil = false,
  pistilColor = '#FFFFFF',
  colorTransition = 'none',
  trailType = 'none',
  fallingLeaves = false,
  formulationId,
  angleOffset = 0,
  noTrail = false,
}: ShellBurstRendererProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const pistilPointsRef = useRef<THREE.Points>(null);
  const glitterRef = useRef<THREE.Points>(null);
  const afterglowRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<ParticleState[] | null>(null);
  const pistilParticlesRef = useRef<ParticleState[] | null>(null);
  const glitterParticlesRef = useRef<ParticleState[]>([]);
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

  // ── Real formulation override ──
  const realFormulation = useMemo(() => formulationId ? getRealFormulation(formulationId) : undefined, [formulationId]);
  const realCompound = useMemo(() => realFormulation ? formulationToCompound(realFormulation) : undefined, [realFormulation]);
  const formMods = useMemo(() => formulationId ? getFormulationModifiers(formulationId) : null, [formulationId]);

  // Use formulation color if available, otherwise prop color
  const baseColor = useMemo(() => {
    if (realCompound) return realCompound.color.clone();
    return new THREE.Color(color);
  }, [color, realCompound]);

  const starCount = useMemo(() => Math.min(MAX_PARTICLES, getStarCount(caliber)), [caliber]);
  const breakSpeed = useMemo(() => {
    const base = getBreakSpeed(caliber);
    return formMods ? base * formMods.velocityScale : base;
  }, [caliber, formMods]);
  const starLifetime = useMemo(() => {
    const base = getStarLifetime(caliber);
    return formMods ? base * formMods.burnRateScale : base;
  }, [caliber, formMods]);
  const burstSpread = useMemo(() => getStarSpread(caliber), [caliber]);
  const baseSize = useMemo(() => {
    const base = 0.5 + caliber * 0.35;
    return formMods ? base * formMods.sparkSizeScale : base;
  }, [caliber, formMods]);

  const pistilCount = useMemo(() => hasPistil ? Math.round(starCount * 0.25) : 0, [hasPistil, starCount]);
  const pistilColorObj = useMemo(() => new THREE.Color(pistilColor), [pistilColor]);
  const secondaryColorObj = useMemo(() => new THREE.Color(secondaryColor || color), [secondaryColor, color]);
  const stepMods = useMemo<StepModifiers | undefined>(
    () => fallingLeaves ? { fallingLeaves: true, reducedGravity: 0.3 } : undefined,
    [fallingLeaves]
  );

  // Initialize particles on first render
  useEffect(() => {
    const mainParticles = createShellBurst(starCount, breakSpeed, pattern, starLifetime);
    if (fallingLeaves) mainParticles.forEach((p, i) => { p.seed = i / starCount; });
    particlesRef.current = mainParticles;

    if (hasPistil) {
      const pistilPs = createShellBurst(pistilCount, breakSpeed * 0.4, 'peony', starLifetime * 0.8);
      pistilPs.forEach((p, i) => { p.seed = i / pistilCount; });
      pistilParticlesRef.current = pistilPs;
    }
    glitterParticlesRef.current = [];
    initTimeRef.current = 0;
  }, [starCount, breakSpeed, pattern, starLifetime, hasPistil, pistilCount, fallingLeaves]);

  // Buffer attributes (reused — no GC pressure)
  const { posBuffer, lifeBuffer, maxLifeBuffer, brightnessBuffer, velocityBuffer } = useMemo(() => ({
    posBuffer: new Float32Array(MAX_PARTICLES * 3),
    lifeBuffer: new Float32Array(MAX_PARTICLES),
    maxLifeBuffer: new Float32Array(MAX_PARTICLES),
    brightnessBuffer: new Float32Array(MAX_PARTICLES),
    velocityBuffer: new Float32Array(MAX_PARTICLES * 3),
  }), []);

  // Pistil buffers
  const pistilBuffers = useMemo(() => ({
    pos: new Float32Array(MAX_PARTICLES * 3),
    life: new Float32Array(MAX_PARTICLES),
    maxLife: new Float32Array(MAX_PARTICLES),
    brightness: new Float32Array(MAX_PARTICLES),
    velocity: new Float32Array(MAX_PARTICLES * 3),
  }), []);

  // Glitter trail buffers
  const GLITTER_MAX = 800;
  const glitterBuffers = useMemo(() => ({
    pos: new Float32Array(GLITTER_MAX * 3),
    col: new Float32Array(GLITTER_MAX * 3),
  }), []);

  // Color change point: where in life (0-1) the color switches
  const colorChangePoint = colorTransition !== 'none' ? 0.45 : 2.0; // >1 means no change

  // Shader uniforms — updated every frame from store
  const uniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(color) },
    uColor2: { value: new THREE.Color(secondaryColor || color) },
    uColorChangePoint: { value: colorChangePoint },
    uBaseSize: { value: baseSize },
    uHDRMultiplier: { value: hdrMultiplier },
    uTime: { value: 0 },
    uThermalSpeed: { value: thermalTransitionSpeed },
    uMaxEnergy: { value: getMaxEnergy(0) },
  }), []);

  // Pre-compute blend configs (Screen for secondary elements)
  const screenBlend = useMemo(() => getThreeBlending('screen'), []);
  const additiveBlend = useMemo(() => getThreeBlending('additive'), []);

  const pistilUniforms = useMemo(() => ({
    uColor: { value: new THREE.Color(pistilColor) },
    uColor2: { value: new THREE.Color(pistilColor) },
    uColorChangePoint: { value: 2.0 },
    uBaseSize: { value: baseSize * 0.7 },
    uHDRMultiplier: { value: hdrMultiplier },
    uTime: { value: 0 },
    uThermalSpeed: { value: thermalTransitionSpeed },
    uMaxEnergy: { value: getMaxEnergy(0) },
  }), []);

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

    // Step physics using store-driven drag and wind (formulation override if present)
    const effectiveDrag = formMods ? formMods.dragOverride : starDrag;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.life < p.maxLife) {
        stepParticle(p, dt, windVec, effectiveDrag, stepMods);

        // Glitter trail: emit micro-particles from active stars
        if (trailType === 'glitter' && p.life > 0.1 && Math.random() < 0.15) {
          const gp = createGlitterTrailParticle(p);
          glitterParticlesRef.current.push(gp);
          if (glitterParticlesRef.current.length > GLITTER_MAX) {
            glitterParticlesRef.current.shift();
          }
        }
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

    // Step pistil particles
    if (pistilParticlesRef.current && pistilPointsRef.current) {
      const pp = pistilParticlesRef.current;
      for (let i = 0; i < pp.length; i++) {
        if (pp[i].life < pp[i].maxLife) stepParticle(pp[i], dt, windVec, starDrag * 0.8, stepMods);
        pistilBuffers.pos[i * 3] = pp[i].x;
        pistilBuffers.pos[i * 3 + 1] = pp[i].y;
        pistilBuffers.pos[i * 3 + 2] = pp[i].z;
        pistilBuffers.life[i] = pp[i].life;
        pistilBuffers.maxLife[i] = pp[i].maxLife;
        pistilBuffers.brightness[i] = pp[i].brightness;
        pistilBuffers.velocity[i * 3] = pp[i].vx;
        pistilBuffers.velocity[i * 3 + 1] = pp[i].vy;
        pistilBuffers.velocity[i * 3 + 2] = pp[i].vz;
      }
      const pGeo = pistilPointsRef.current.geometry;
      ['position', 'aLife', 'aMaxLife', 'aBrightness', 'aVelocity'].forEach(attr => {
        const a = pGeo.getAttribute(attr) as THREE.BufferAttribute;
        if (a) a.needsUpdate = true;
      });
      const pMat = pistilPointsRef.current.material as THREE.ShaderMaterial;
      pMat.uniforms.uTime.value = time;
      pMat.uniforms.uColor.value.copy(pistilColorObj);
      pMat.uniforms.uColor2.value.copy(pistilColorObj);
      pMat.uniforms.uColorChangePoint.value = 2.0;
      pMat.uniforms.uHDRMultiplier.value = hdrMultiplier;
      pMat.uniforms.uBaseSize.value = baseSize * 0.7;
      pMat.uniforms.uThermalSpeed.value = thermalTransitionSpeed;
      pMat.uniforms.uMaxEnergy.value = getMaxEnergy(0);
    }

    // Step glitter trail particles
    if (glitterRef.current && glitterParticlesRef.current.length > 0) {
      const gp = glitterParticlesRef.current;
      // Remove dead glitter
      for (let i = gp.length - 1; i >= 0; i--) {
        gp[i].life += dt;
        gp[i].vy += -9.81 * dt * 0.5;
        gp[i].x += gp[i].vx * dt;
        gp[i].y += gp[i].vy * dt;
        gp[i].z += gp[i].vz * dt;
        gp[i].brightness = Math.max(0, 1 - gp[i].life / gp[i].maxLife);
        if (gp[i].life > gp[i].maxLife) { gp.splice(i, 1); }
      }
      const gCount = Math.min(gp.length, GLITTER_MAX);
      for (let i = 0; i < gCount; i++) {
        glitterBuffers.pos[i * 3] = gp[i].x;
        glitterBuffers.pos[i * 3 + 1] = gp[i].y;
        glitterBuffers.pos[i * 3 + 2] = gp[i].z;
        const fade = gp[i].brightness;
        glitterBuffers.col[i * 3] = baseColor.r * fade * 0.8;
        glitterBuffers.col[i * 3 + 1] = baseColor.g * fade * 0.7;
        glitterBuffers.col[i * 3 + 2] = baseColor.b * fade * 0.5;
      }
      const gGeo = glitterRef.current.geometry;
      gGeo.setDrawRange(0, gCount);
      const gPosAttr = gGeo.getAttribute('position') as THREE.BufferAttribute;
      const gColAttr = gGeo.getAttribute('color') as THREE.BufferAttribute;
      if (gPosAttr) gPosAttr.needsUpdate = true;
      if (gColAttr) gColAttr.needsUpdate = true;
    }

    // Step crossette sub-particles with store wind/drag
    for (const subGroup of crossetteRef.current) {
      for (const sp of subGroup) {
        if (sp.life < sp.maxLife) stepParticle(sp, dt, windVec, starDrag * 1.5);
      }
    }

    // Update GPU buffers
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
    mat.uniforms.uColor2.value.copy(secondaryColorObj);
    mat.uniforms.uColorChangePoint.value = colorChangePoint;
    mat.uniforms.uHDRMultiplier.value = hdrMultiplier;
    mat.uniforms.uBaseSize.value = baseSize;
    mat.uniforms.uThermalSpeed.value = thermalTransitionSpeed;
    mat.uniforms.uMaxEnergy.value = getMaxEnergy(0);

    // ── Afterglow cloud (duration + intensity from store) ──
    if (afterglowRef.current) {
       const afterglowMaxProgress = afterglowDuration * 0.5 / (starLifetime + afterglowDuration);
       const afterglowProgress = Math.max(0, progress - 0.05);
       const spread = burstSpread * 0.3 * Math.min(1, afterglowProgress * 4);
       afterglowRef.current.scale.setScalar(spread);
       const amat = afterglowRef.current.material as THREE.ShaderMaterial;
       const afterglowFade = Math.max(0, 1 - progress / Math.max(0.1, afterglowMaxProgress));
       amat.uniforms.uOpacity.value = 0.08 * afterglowFade * afterglowFade;
      amat.uniforms.uTime.value = time;
      amat.uniforms.uAfterglowIntensity.value = afterglowIntensity;
    }
  });

  if (progress <= 0 || progress > 1.1) return null;

  // Apply angleOffset rotation to the group
  const groupRotation: [number, number, number] = [0, 0, angleOffset ? -(angleOffset * Math.PI) / 180 : 0];

  return (
    <group position={position} rotation={groupRotation}>
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
          blending={additiveBlend.blending}
          blendEquation={additiveBlend.blendEquation}
          blendSrc={additiveBlend.blendSrc as any}
          blendDst={additiveBlend.blendDst as any}
        />
      </points>

      {/* Pistil inner burst — smaller, different color */}
      {hasPistil && pistilCount > 0 && (
        <points ref={pistilPointsRef} frustumCulled={false}>
          <bufferGeometry drawRange={{ start: 0, count: pistilCount }}>
            <bufferAttribute attach="attributes-position" args={[pistilBuffers.pos, 3]} />
            <bufferAttribute attach="attributes-aLife" args={[pistilBuffers.life, 1]} />
            <bufferAttribute attach="attributes-aMaxLife" args={[pistilBuffers.maxLife, 1]} />
            <bufferAttribute attach="attributes-aBrightness" args={[pistilBuffers.brightness, 1]} />
            <bufferAttribute attach="attributes-aVelocity" args={[pistilBuffers.velocity, 3]} />
          </bufferGeometry>
          <shaderMaterial
            vertexShader={BURST_VERTEX}
            fragmentShader={BURST_FRAGMENT}
            uniforms={pistilUniforms}
            transparent
            depthWrite={false}
            blending={additiveBlend.blending}
            blendEquation={additiveBlend.blendEquation}
            blendSrc={additiveBlend.blendSrc as any}
            blendDst={additiveBlend.blendDst as any}
          />
        </points>
      )}

      {/* Glitter trail particles */}
      {trailType === 'glitter' && (
        <points ref={glitterRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[glitterBuffers.pos, 3]} />
            <bufferAttribute attach="attributes-color" args={[glitterBuffers.col, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.08 + caliber * 0.02}
            vertexColors
            transparent
            opacity={0.7}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
          />
        </points>
      )}

      {/* Crossette sub-bursts */}
      {crossetteRef.current.map((subGroup, gi) => (
        <CrossetteSubBurst key={gi} particles={subGroup} color={color} caliber={caliber} windVec={windVec} drag={starDrag} />
      ))}

      {/* Burst flash — Screen blending to prevent white-out accumulation */}
      {progress < 0.08 && (
        <mesh>
          <sphereGeometry args={[1.5 + caliber * 0.8, 16, 16]} />
          <meshBasicMaterial
            color={secondaryColor || color}
            transparent
            opacity={burstFlashIntensity * 0.2 * (1 - progress / 0.08)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Secondary flash ring — Screen blending */}
      {progress < 0.12 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[caliber * 0.5 + progress * 40, caliber * 0.8 + progress * 45, 32]} />
          <meshBasicMaterial
            color={secondaryColor || color}
            transparent
            opacity={burstFlashIntensity * 0.12 * (1 - progress / 0.12)}
            blending={screenBlend.blending}
            blendEquation={screenBlend.blendEquation}
            blendSrc={screenBlend.blendSrc as any}
            blendDst={screenBlend.blendDst as any}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Afterglow cloud — Screen blending for energy conservation */}
      <mesh ref={afterglowRef}>
        <sphereGeometry args={[1, 16, 16]} />
        <shaderMaterial
          vertexShader={AFTERGLOW_VERTEX}
          fragmentShader={AFTERGLOW_FRAGMENT}
          uniforms={afterglowUniforms}
          transparent
          depthWrite={false}
          blending={screenBlend.blending}
          blendEquation={screenBlend.blendEquation}
          blendSrc={screenBlend.blendSrc as any}
          blendDst={screenBlend.blendDst as any}
        />
      </mesh>

      {/* Ground illumination — reduced intensity per V-Ray/Blender rules */}
      {progress < 0.5 && (
        <pointLight
          color={color}
          intensity={Math.max(0, (1 - progress * 2)) * caliber * 1.0 * burstFlashIntensity * GROUND_LIGHT_SCALE}
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
