/**
 * FireworkRenderer — FireworkBurst particle system, TimelineEffects orchestrator,
 * LiveSFXEffects, and supporting helpers extracted from SkyCanvas.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useLOD } from '@/hooks/useLOD';
import { getLiftTime, getBreakHeight, getBreakSpeed, getTypedPrefire, getTypedDuration, getStarLifetime, type FinalePartType } from '@/lib/pyroPhysics';
import { parseVDL, vdlToEffect } from '@/lib/vdlParser';
import { temporalFlicker } from '@/lib/pyroNoise';
import { isInFrustum } from '@/lib/spatialCuller';
import { clampNiagaraHDR, getNiagaraBudgets } from '@/lib/niagaraBlenderRules';
import { thermalColor, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';
import { getBurstConfig, type BurstPattern } from '@/render_ultra/fireworks/burstSimulation';
import {
  hexToCompound,
  getEffectById,
  getWindForce,
  getAdaptiveExposure,
  GRAVITY,
  _posQuat, _effQuat, _pitchQuat, _posEuler, _effEuler, _launchDir, _pitchAxis,
} from './sharedState';
import {
  CometEffect,
  ShockwaveEffect,
  MultiBurstEffect,
  FanEffect,
  MineEffect,
  RomanCandleEffect,
  WaterfallEffect,
  GerbEffect,
  FlameEffect,
  CryoJetEffect,
  LaserEffect,
  CakeEffect,
  ConfettiEffect,
  MovingHeadEffect,
  PrefireShell,
  SmokeTrail,
  EmberParticles,
  SparkShower,
  FogMachineEffect,
  HazeMachineEffect,
  SnowMachineEffect,
  BubbleMachineEffect,
} from '../effects';
import QuadcopterModel from '../QuadcopterModel';

// ═══════════════════════════════════════════════════════════════════════
// Star sprite shaders
// ═══════════════════════════════════════════════════════════════════════
const STAR_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aLife;
  varying vec3 vColor;
  varying float vLife;
  varying float vSize;
  void main() {
    vColor = color;
    vLife = aLife;
    vSize = aSize;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (8000.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 140.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const STAR_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vLife;
  varying float vSize;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    
    float core = exp(-dist * dist * 80.0);
    float inner = exp(-dist * dist * 25.0);
    float outer = exp(-dist * dist * 8.0);
    
    float alpha = core * 1.0 + inner * 0.7 + outer * 0.15;
    
    vec3 whiteHot = vec3(1.18, 1.08, 0.90);
    vec3 col = mix(vColor, whiteHot, core * 0.45);
    col += vColor * outer * 0.35;
    
    float youth = max(0.0, 1.0 - vLife * 4.0);
    col += mix(vColor, whiteHot, 0.4) * youth * 0.35;
    
    float edge = 1.0 - smoothstep(0.42, 0.5, dist);

    gl_FragColor = vec4(col, alpha * edge);
  }
`;

let _starMaterialInstance: THREE.ShaderMaterial | null = null;
let _starMaterialVersion = 0;
function _sharedStarMaterial(): THREE.ShaderMaterial {
  if (!_starMaterialInstance) {
    _starMaterialInstance = new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    _starMaterialVersion++;
  }
  return _starMaterialInstance;
}

// ═══════════════════════════════════════════════════════════════════════
// FireworkBurst — Niagara-inspired GPU particle system
// ═══════════════════════════════════════════════════════════════════════
export const FireworkBurst = React.forwardRef<THREE.Group, { 
  position: [number, number, number]; color: string; progress: number; 
  caliber?: number; pattern?: string;
  angleOffset?: number; trailType?: string; noTrail?: boolean;
  secondaryColor?: string; colorTransition?: string;
  hasPistil?: boolean; pistilColor?: string;
  niagaraProfile?: {
    starCount: number; lifetime: number; velocity: number;
    drag: number; gravityScale: number; sparkleRate: number;
    glowIntensity: number; fadeProfile: 'linear' | 'exponential' | 'ember';
  };
}>(function FireworkBurst({ 
  position, color, progress, caliber = 4, pattern = 'peony',
  angleOffset = 0, trailType, noTrail, secondaryColor, colorTransition,
  hasPistil, pistilColor, niagaraProfile,
}, _ref) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  
  const lod = useLOD(position);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const { particleDensity, hdrMultiplier, effectBrightness } = useSceneStore(st => st.settings);

  const STAR_COUNT = useMemo(() => {
    const densityScale = THREE.MathUtils.clamp(particleDensity, 0.5, 2.0);
    const baseCount = (60 + caliber * caliber * 10) * lod.particleMultiplier * densityScale;
    const cap = isMobileViewport ? 120 : 320;
    return Math.max(24, Math.min(cap, Math.round(baseCount)));
  }, [caliber, lod.particleMultiplier, isMobileViewport, particleDensity]);
  const TRAIL_LENGTH = useMemo(() => {
    const trailCap = isMobileViewport ? 3 : 6;
    const densityTrail = particleDensity >= 1 ? 1 : 0.8;
    return Math.max(2, Math.min(trailCap, Math.floor((4 + caliber * 0.8) * lod.trailLength * densityTrail)));
  }, [caliber, lod.trailLength, isMobileViewport, particleDensity]);
  
  const breakSpeed = useMemo(() => getBreakSpeed(caliber), [caliber]);
  const burstCfg = useMemo(() => getBurstConfig((pattern || 'peony') as BurstPattern), [pattern]);
  const gravityMult = burstCfg?.gravityMult ?? 1.0;
  const tailFactor = burstCfg?.tailFactor ?? 1.0;
  
  const starLife = useMemo(() => {
    const baseLife = caliber <= 3 ? 1.6 : caliber <= 4 ? 2.2 : caliber <= 5 ? 2.8
      : caliber <= 6 ? 3.5 : caliber <= 8 ? 4.5 : caliber <= 10 ? 6.0 : 7.5;
    if (pattern === 'willow' || pattern === 'kamuro') return baseLife * 2.2;
    if (pattern === 'palm' || pattern === 'brocade') return baseLife * 1.6;
    if (pattern === 'chrysanthemum') return baseLife * 1.2;
    if (pattern === 'dahlia') return baseLife * 0.5;
    return baseLife;
  }, [caliber, pattern]);
  
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const secondaryBaseColor = useMemo(() => secondaryColor ? new THREE.Color(secondaryColor) : null, [secondaryColor]);
  const compound = useMemo(() => hexToCompound(color), [color]);
  const emberColor = useMemo(() => {
    const c = new THREE.Color(color);
    return new THREE.Color().setHSL(
      Math.min(c.getHSL({ h: 0, s: 0, l: 0 }).h, 0.06),
      0.85, 0.12
    );
  }, [color]);
  
  const { velocities, lifetimes, twinklePhases, sparkleSeeds } = useMemo(() => {
    const v = new Float32Array(STAR_COUNT * 3);
    const l = new Float32Array(STAR_COUNT);
    const tp = new Float32Array(STAR_COUNT);
    const sparkle = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      let vx: number, vy: number, vz: number;
      let life = starLife * (0.6 + Math.random() * 0.4);
      const speedVar = Math.pow(0.4 + Math.random() * 0.6, 0.7);
      tp[i] = Math.random() * Math.PI * 2;
      sparkle[i] = Math.random() * 999 + i;

      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.sin(theta);

      switch (pattern) {
        case 'willow':
          vx = sx * breakSpeed * 0.42 * speedVar; vy = sy * breakSpeed * 0.42 * speedVar; vz = sz * breakSpeed * 0.42 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.4); break;
        case 'palm':
          vx = sx * breakSpeed * 0.52 * speedVar; vy = Math.abs(sy) * breakSpeed * 0.85 + breakSpeed * 0.45; vz = sz * breakSpeed * 0.52 * speedVar;
          life = starLife * (1.1 + Math.random() * 0.6); break;
        case 'chrysanthemum':
          vx = sx * breakSpeed * speedVar; vy = sy * breakSpeed * 0.93 * speedVar; vz = sz * breakSpeed * speedVar;
          life = starLife * (0.85 + Math.random() * 0.3); break;
        case 'kamuro':
          vx = sx * breakSpeed * 0.35 * speedVar; vy = sy * breakSpeed * 0.35 * speedVar + 1.2; vz = sz * breakSpeed * 0.35 * speedVar;
          life = starLife * (1.8 + Math.random() * 1.8); break;
        case 'ring':
          vx = Math.cos(theta) * breakSpeed * speedVar; vy = (Math.random() - 0.5) * breakSpeed * 0.08; vz = Math.sin(theta) * breakSpeed * speedVar; break;
        case 'dahlia':
          vx = sx * breakSpeed * 1.25 * speedVar; vy = sy * breakSpeed * 1.18 * speedVar; vz = sz * breakSpeed * 1.25 * speedVar;
          life = starLife * (0.35 + Math.random() * 0.25); break;
        case 'brocade':
          vx = sx * breakSpeed * 0.58 * speedVar; vy = sy * breakSpeed * 0.58 * speedVar; vz = sz * breakSpeed * 0.58 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.0); break;
        case 'crossette': {
          const arm = i % 6; const armTheta = (arm / 6) * Math.PI * 2; const armPhi = Math.PI * 0.45; const jitter = 0.12;
          vx = Math.sin(armPhi) * Math.cos(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          vy = Math.cos(armPhi + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          vz = Math.sin(armPhi) * Math.sin(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          break;
        }
        default:
          vx = sx * breakSpeed * speedVar; vy = sy * breakSpeed * speedVar * 0.9 + 0.6; vz = sz * breakSpeed * speedVar; break;
      }

      v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz;
      l[i] = life;
    }

    return { velocities: v, lifetimes: l, twinklePhases: tp, sparkleSeeds: sparkle };
  }, [STAR_COUNT, breakSpeed, starLife, pattern]);

  const particleBuffers = useMemo(() => {
    const trailVertCount = STAR_COUNT * TRAIL_LENGTH * 2;
    return {
      positions: new Float32Array(STAR_COUNT * 3),
      colors: new Float32Array(STAR_COUNT * 3),
      sizes: new Float32Array(STAR_COUNT),
      lives: new Float32Array(STAR_COUNT),
      trailPos: new Float32Array(trailVertCount * 3),
      trailCol: new Float32Array(trailVertCount * 3),
      trailVertCount,
    };
  }, [STAR_COUNT, TRAIL_LENGTH]);

  const trailVertCount = particleBuffers.trailVertCount;
  const starMaterial = useMemo(() => _sharedStarMaterial(), [_starMaterialVersion]);

  useEffect(() => {
    return () => {
      if (pointsRef.current) pointsRef.current.geometry.dispose();
      if (trailRef.current) {
        trailRef.current.geometry.dispose();
        if (trailRef.current.material instanceof THREE.Material) trailRef.current.material.dispose();
      }
    };
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current || !trailRef.current) return;
    const pos = particleBuffers.positions;
    const cols = particleBuffers.colors;
    const sizes = particleBuffers.sizes;
    const lives = particleBuffers.lives;
    const tPos = particleBuffers.trailPos;
    const tCol = particleBuffers.trailCol;
    const t = progress * (starLife * 0.88);
    const trailDt = 0.035;
    const w = getWindForce();
    const time = clock.getElapsedTime();
    const _adaptiveExposure = getAdaptiveExposure();
    
    const dragCoeff = caliber <= 3 ? 0.065 : caliber <= 4 ? 0.055 : caliber <= 5 ? 0.048
      : caliber <= 6 ? 0.042 : caliber <= 8 ? 0.035 : caliber <= 10 ? 0.028 : 0.024;
    const isTrailingPattern = pattern === 'willow' || pattern === 'kamuro' || pattern === 'brocade' || pattern === 'palm';
    
    const baseSize = caliber <= 3 ? 0.4 : caliber <= 4 ? 0.6 : caliber <= 6 ? 0.9
      : caliber <= 8 ? 1.2 : caliber <= 10 ? 1.5 : 1.8;
    
    const dragPos = (v0: number, t: number, k: number) => {
      if (k < 0.001) return v0 * t;
      return v0 * (1 - Math.exp(-k * t)) / k;
    };

    for (let i = 0; i < STAR_COUNT; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const starAge = Math.min(1, t / lt);
      
      const fade = Math.max(0, 1 - starAge);
      const fadeSmooth = fade * fade * (3 - 2 * fade);
      const fadeCubed = fade * fade * fade;
      
      const px = dragPos(vx, t, dragCoeff) + w[0] * t * t * 0.3;
      const py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * gravityMult * t * t;
      const pz = dragPos(vz, t, dragCoeff) + w[2] * t * t * 0.3;
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;

      const flashIntensity = Math.max(0, 1 - starAge * 20);
      const emberPhase = Math.max(0, (starAge - 0.45) / 0.55);
      
      const lifeRatio = 1 - starAge;
      const adaptiveScale = THREE.MathUtils.clamp(_adaptiveExposure / 1.2, 0.45, 1.35);
      const hdrScale = THREE.MathUtils.clamp((hdrMultiplier / 3.5) * adaptiveScale, 0.6, 2.4);
      const chemColor = thermalColor(compound, lifeRatio, hdrScale);
      const chemR = chemColor.r, chemG = chemColor.g, chemB = chemColor.b;
      
      let twinkle: number;
      if (isTrailingPattern) {
        twinkle = 0.8 + Math.sin(twinklePhases[i] + starAge * 15) * 0.2;
      } else {
        twinkle = temporalFlicker(sparkleSeeds[i], time, 0.65, 0.30, 0.35);
      }
      
      const userFade = 1 - starAge;
      
      let blendR = baseColor.r, blendG = baseColor.g, blendB = baseColor.b;
      if (secondaryBaseColor && colorTransition) {
        if (colorTransition === 'to') {
          blendR = THREE.MathUtils.lerp(baseColor.r, secondaryBaseColor.r, starAge);
          blendG = THREE.MathUtils.lerp(baseColor.g, secondaryBaseColor.g, starAge);
          blendB = THREE.MathUtils.lerp(baseColor.b, secondaryBaseColor.b, starAge);
        } else if (colorTransition === 'changing') {
          const pingPong = Math.sin(starAge * Math.PI);
          blendR = THREE.MathUtils.lerp(baseColor.r, secondaryBaseColor.r, pingPong);
          blendG = THREE.MathUtils.lerp(baseColor.g, secondaryBaseColor.g, pingPong);
          blendB = THREE.MathUtils.lerp(baseColor.b, secondaryBaseColor.b, pingPong);
        } else if (colorTransition === 'alternating') {
          if (i % 2 === 1) {
            blendR = secondaryBaseColor.r; blendG = secondaryBaseColor.g; blendB = secondaryBaseColor.b;
          }
        }
      }
      
      const r = THREE.MathUtils.lerp(blendR * userFade, chemR, 0.7);
      const g = THREE.MathUtils.lerp(blendG * userFade, chemG, 0.7);
      const b = THREE.MathUtils.lerp(blendB * userFade, chemB, 0.7);
      const brightnessScale = THREE.MathUtils.clamp(effectBrightness, 0.6, 1.8);
      
      const niagaraGlow = niagaraProfile ? niagaraProfile.glowIntensity / 2.0 : 1.0;
      
      const [safeR, safeG, safeB] = clampNiagaraHDR(
        r * twinkle * brightnessScale * niagaraGlow,
        g * twinkle * brightnessScale * niagaraGlow,
        b * twinkle * brightnessScale * niagaraGlow
      );

      cols[i * 3] = safeR; cols[i * 3 + 1] = safeG; cols[i * 3 + 2] = safeB;
      
      const sizeOverLife = starAge < 0.05 
        ? 0.6 + starAge * 8
        : starAge < 0.4 ? 1.0 : 1.0 - (starAge - 0.4) / 0.6 * 0.7;
      sizes[i] = baseSize * Math.max(0.1, sizeOverLife) * (1 + flashIntensity * 0.8);
      lives[i] = starAge;

      for (let s = 0; s < TRAIL_LENGTH; s++) {
        const t0 = Math.max(0, t - s * trailDt);
        const t1 = Math.max(0, t - (s + 1) * trailDt);
        const base2 = (i * TRAIL_LENGTH + s) * 6;
        tPos[base2] = dragPos(vx, t0, dragCoeff) + w[0] * t0 * t0 * 0.3;
        tPos[base2 + 1] = dragPos(vy, t0, dragCoeff) + 0.5 * GRAVITY * gravityMult * t0 * t0;
        tPos[base2 + 2] = dragPos(vz, t0, dragCoeff) + w[2] * t0 * t0 * 0.3;
        tPos[base2 + 3] = dragPos(vx, t1, dragCoeff) + w[0] * t1 * t1 * 0.3;
        tPos[base2 + 4] = dragPos(vy, t1, dragCoeff) + 0.5 * GRAVITY * gravityMult * t1 * t1;
        tPos[base2 + 5] = dragPos(vz, t1, dragCoeff) + w[2] * t1 * t1 * 0.3;
        
        const segFrac = s / TRAIL_LENGTH;
        const segFade = fadeCubed * Math.pow(1 - segFrac, 2.5) * 0.7;
        const endFade = fadeCubed * Math.pow(1 - (s + 1) / TRAIL_LENGTH, 2.5) * 0.7;
        
        const trailWarmth = Math.pow(segFrac, 0.4);
        tCol[base2] = THREE.MathUtils.lerp(0.9, r * 0.75, trailWarmth) * segFade;
        tCol[base2 + 1] = THREE.MathUtils.lerp(0.55, g * 0.5, trailWarmth) * segFade;
        tCol[base2 + 2] = THREE.MathUtils.lerp(0.25, b * 0.2, trailWarmth) * segFade;
        tCol[base2 + 3] = THREE.MathUtils.lerp(0.9, r * 0.75, trailWarmth) * endFade;
        tCol[base2 + 4] = THREE.MathUtils.lerp(0.55, g * 0.5, trailWarmth) * endFade;
        tCol[base2 + 5] = THREE.MathUtils.lerp(0.25, b * 0.2, trailWarmth) * endFade;
      }
    }

    const pGeo = pointsRef.current.geometry;
    const posAttr = pGeo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = pGeo.getAttribute('color') as THREE.BufferAttribute;
    const sizeAttr = pGeo.getAttribute('aSize') as THREE.BufferAttribute;
    const lifeAttr = pGeo.getAttribute('aLife') as THREE.BufferAttribute;
    if (posAttr) { posAttr.array = pos; posAttr.needsUpdate = true; }
    if (colAttr) { colAttr.array = cols; colAttr.needsUpdate = true; }
    if (sizeAttr) { sizeAttr.array = sizes; sizeAttr.needsUpdate = true; }
    if (lifeAttr) { lifeAttr.array = lives; lifeAttr.needsUpdate = true; }

    const lGeo = trailRef.current.geometry;
    const tPosAttr = lGeo.getAttribute('position') as THREE.BufferAttribute;
    const tColAttr = lGeo.getAttribute('color') as THREE.BufferAttribute;
    if (tPosAttr) { tPosAttr.array = tPos; tPosAttr.needsUpdate = true; }
    if (tColAttr) { tColAttr.array = tCol; tColAttr.needsUpdate = true; }
  });

  const flashSize = 0.6 + caliber * 0.8;

  return (
    <group position={position}>
      <points ref={pointsRef} material={starMaterial} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleBuffers.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleBuffers.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[particleBuffers.sizes, 1]} />
          <bufferAttribute attach="attributes-aLife" args={[particleBuffers.lives, 1]} />
        </bufferGeometry>
      </points>
      
      <lineSegments ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleBuffers.trailPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleBuffers.trailCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={Math.min(1, 0.8 * tailFactor)} depthWrite={false} blending={THREE.AdditiveBlending} linewidth={3} />
      </lineSegments>
      
      {progress < 0.06 && (
        <mesh renderOrder={100}>
          <sphereGeometry args={[flashSize * 0.4 * (1 + progress * 6), 8, 8]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={0.2 * (1 - progress / 0.06)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {progress < 0.12 && (
        <mesh renderOrder={99}>
          <sphereGeometry args={[flashSize * (1 + progress * 6), 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.08 * Math.pow(1 - progress / 0.12, 2)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
});

// ═══════════════════════════════════════════════════════════════════════
// LightPoint
// ═══════════════════════════════════════════════════════════════════════
function LightPoint({ position, color }: { position: [number, number, number]; color: string }) {
  return <QuadcopterModel position={position} color={color} />;
}

// ═══════════════════════════════════════════════════════════════════════
// estimateFireworkStarCost
// ═══════════════════════════════════════════════════════════════════════
export function estimateFireworkStarCost(
  effect: (typeof EFFECT_LIBRARY)[number],
  particleDensity: number,
  isMobileViewport: boolean
) {
  const caliber = Math.max(1, effect.caliber || 4);
  const densityScale = THREE.MathUtils.clamp(particleDensity, 0.5, 2.0);
  const budgets = getNiagaraBudgets(isMobileViewport);

  const shellStars = Math.max(
    24,
    Math.min(budgets.maxStarsPerBurst, Math.round((60 + caliber * caliber * 10) * densityScale))
  );
  let stars = shellStars;

  if (effect.partType === 'cake') stars *= 1.2;
  else if (effect.partType === 'candle') stars *= 0.8;
  else if (effect.partType === 'mine') stars *= 0.9;
  else if (effect.partType === 'waterfall') stars *= 0.6;

  if (effect.id.startsWith('mburst-')) stars *= effect.id === 'mburst-02' ? 3.2 : 2.4;

  return Math.max(32, Math.min(budgets.maxStarBudget, Math.round(stars)));
}

// ═══════════════════════════════════════════════════════════════════════
// TimelineEffects — renders all timeline-driven VFX
// ═══════════════════════════════════════════════════════════════════════
export function TimelineEffects() {
  const { camera } = useThree();
  const { timelineItems, currentTime, positions } = useProjectStore();
  const sceneSettings = useSceneStore(st => st.settings);
  const activeEffects = useMemo(() => {
    const effectScale = sceneSettings.effectScale;
    const weatherDampening = sceneSettings.weather === 'heavy-rain' ? 0.6 :
      sceneSettings.weather === 'light-rain' ? 0.8 :
      sceneSettings.weather === 'fog' ? 0.7 : 1.0;
    const humidityFactor = 1 - sceneSettings.humidity * 0.3;

    return timelineItems.map((item) => {
      let effect = getEffectById(item.effectId);

      if (!effect && item.effectId.startsWith('vdl-')) {
        const vdlText = item.notes?.match(/VDL:\s*([^|]+)/i)?.[1]?.trim();
        if (vdlText) {
          const parsed = parseVDL(vdlText);
          if (parsed.valid) {
            effect = {
              ...vdlToEffect(parsed),
              id: item.effectId,
              icon: '🎆',
              type: 'firework',
              partType: parsed.partType as (typeof EFFECT_LIBRARY)[number]['partType'],
              duration: Math.max(0.8, parsed.duration),
            } as (typeof EFFECT_LIBRARY)[number];
          }
        }
      }

      if (effect && effect.vdl && !item.effectId.startsWith('vdl-')) {
        const parsed = parseVDL(effect.vdl);
        if (parsed.valid) {
          const vdlDerived = vdlToEffect(parsed);
          effect = {
            ...effect,
            caliber: vdlDerived.caliber || effect.caliber,
            heightMeters: vdlDerived.heightMeters || effect.heightMeters,
            prefire: vdlDerived.prefire ?? effect.prefire,
            partType: (vdlDerived.partType || effect.partType) as (typeof EFFECT_LIBRARY)[number]['partType'],
            pattern: vdlDerived.pattern || effect.pattern,
            shotCount: vdlDerived.shotCount || effect.shotCount,
            angleOffset: vdlDerived.angleOffset ?? effect.angleOffset,
            trailType: vdlDerived.trailType || effect.trailType,
            noTrail: vdlDerived.noTrail ?? effect.noTrail,
            secondaryColor: vdlDerived.secondaryColor || effect.secondaryColor,
            colorTransition: vdlDerived.colorTransition || effect.colorTransition,
            hasPistil: vdlDerived.hasPistil ?? effect.hasPistil,
            pistilColor: vdlDerived.pistilColor || effect.pistilColor,
            firingPattern: vdlDerived.firingPattern || effect.firingPattern,
            impliesTrail: vdlDerived.impliesTrail ?? effect.impliesTrail,
            niagaraProfile: vdlDerived.niagaraProfile || effect.niagaraProfile,
          } as typeof effect;
        }
      }

      if (!effect) return null;

      let resolvedPos = item.position;
      let launchHeading = 0;
      let launchPitch = 85;
      if (item.positionId) {
        const linkedPos = positions.find(p => p.id === item.positionId);
        if (linkedPos) {
          resolvedPos = { x: linkedPos.x, y: linkedPos.y, z: linkedPos.z };
          launchHeading = item.cueHeading ?? linkedPos.heading ?? 0;
          launchPitch = item.cuePitch ?? linkedPos.pitch ?? 85;
        }
      }

      const caliber = effect.caliber || 4;
      const partType = (effect.partType || 'shell') as FinalePartType;
      const isShellType = partType === 'shell' || partType === 'single_shot' || partType === 'rocket';
      const isCakeType = partType === 'cake' || partType === 'candle';
      const isGroundType = partType === 'gerb' || partType === 'waterfall' || partType === 'flame' || partType === 'fan' || partType === 'ground' || partType === 'sfx' || partType === 'light';

      const prefireDuration = getTypedPrefire(partType, caliber, effect.prefire);
      const typedDuration = getTypedDuration(partType, caliber, effect.duration, effect.shotCount);
      const weatherDuration = typedDuration * weatherDampening * humidityFactor;
      const totalDuration = (isShellType ? prefireDuration : 0) + weatherDuration;

      if (currentTime < item.startTime || currentTime > item.startTime + totalDuration) return null;
      const elapsed = currentTime - item.startTime;

      const inPrefire = isShellType && elapsed < prefireDuration;
      const prefireProgress = prefireDuration > 0 ? Math.min(1, elapsed / prefireDuration) : 0;
      const burstProgress = isShellType && prefireDuration > 0
        ? Math.max(0, (elapsed - prefireDuration) / weatherDuration)
        : elapsed / weatherDuration;

      return { item, effect, progress: burstProgress, inPrefire, prefireProgress, caliber, prefireDuration, resolvedPos, effectScale, effectBrightness: sceneSettings.effectBrightness, launchHeading, launchPitch };
    }).filter(Boolean) as {
      item: typeof timelineItems[0];
      effect: typeof EFFECT_LIBRARY[0];
      progress: number;
      inPrefire: boolean;
      prefireProgress: number;
      caliber: number;
      prefireDuration: number;
      resolvedPos: { x: number; y: number; z: number };
      effectScale: number;
      effectBrightness: number;
      launchHeading: number;
      launchPitch: number;
    }[];
  }, [timelineItems, currentTime, positions, sceneSettings.effectScale, sceneSettings.weather, sceneSettings.humidity, sceneSettings.effectBrightness]);

  const cappedEffects = useMemo(() => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    const budgets = getNiagaraBudgets(isMobileViewport);
    const maxConcurrentBursts = budgets.maxConcurrentBursts;
    const maxStarBudget = budgets.maxStarBudget;

    let burstCount = 0;
    let usedStarBudget = 0;

    return activeEffects.filter(({ effect }) => {
      if (effect.type !== 'firework') return true;
      const estimatedStars = estimateFireworkStarCost(effect, sceneSettings.particleDensity, isMobileViewport);
      const exceedsCount = burstCount >= maxConcurrentBursts;
      const exceedsBudget = usedStarBudget + estimatedStars > maxStarBudget;
      if (exceedsCount || exceedsBudget) return false;
      burstCount++;
      usedStarBudget += estimatedStars;
      return true;
    });
  }, [activeEffects, sceneSettings.particleDensity]);

  // Export burst count for PostProcessing
  TimelineEffects._activeBurstCount = cappedEffects.filter(e => e.effect.type === 'firework').length;

  return (
    <>
      {cappedEffects.map(({ item, effect, progress, inPrefire, prefireProgress, caliber, resolvedPos, effectScale, effectBrightness, launchHeading, launchPitch }) => {
        const effectPos: [number, number, number] = [resolvedPos.x, resolvedPos.y, resolvedPos.z];
        const cullRadius = effect.type === 'firework' ? (caliber || 4) * 25 : 50;
        if (!isInFrustum(camera, effectPos, cullRadius)) return null;
        const pos: [number, number, number] = [resolvedPos.x, resolvedPos.y, resolvedPos.z];
        const eid = effect.id;
        const pt = effect.partType;

        if (inPrefire) {
          return (
            <PrefireShell
              key={`prefire-${item.id}`}
              position={pos}
              color={effect.color}
              progress={prefireProgress}
              caliber={caliber}
              heading={launchHeading}
              pitch={launchPitch}
            />
          );
        }

        const isShell = pt === 'shell' || pt === 'single_shot';
        const realBreakHeight = getBreakHeight(caliber) * effectScale;
        
        const posHeadingRad = (launchHeading || 0) * (Math.PI / 180);
        const posPitchRad = (launchPitch || 85) * (Math.PI / 180);
        
        const effPan = (item.pan ?? 90) * (Math.PI / 180);
        const effTilt = (item.tilt ?? 0) * (Math.PI / 180);
        
        _posEuler.set(0, -posHeadingRad, 0, 'YZX');
        _posQuat.setFromEuler(_posEuler);
        _launchDir.set(0, 1, 0);
        _pitchAxis.set(1, 0, 0).applyQuaternion(_posQuat);
        _pitchQuat.setFromAxisAngle(_pitchAxis, -(Math.PI / 2 - posPitchRad));
        _posQuat.multiply(_pitchQuat);
        
        _effEuler.set(effTilt, effPan - Math.PI / 2, 0, 'YXZ');
        _effQuat.setFromEuler(_effEuler);
        
        _posQuat.multiply(_effQuat);
        _launchDir.set(0, 1, 0).applyQuaternion(_posQuat).normalize();
        
        const burstPos: [number, number, number] = isShell
          ? [
              pos[0] + _launchDir.x * realBreakHeight,
              pos[1] + _launchDir.y * realBreakHeight,
              pos[2] + _launchDir.z * realBreakHeight,
            ]
          : pos;

        const scaledHeight = (effect.heightMeters || 4) * effectScale;

        const vdlAngle = effect.angleOffset || 0;
        const vdlTrailType = effect.trailType;
        const vdlNoTrail = effect.noTrail;
        const vdlSecondaryColor = effect.secondaryColor;
        const vdlColorTransition = effect.colorTransition;
        const vdlHasPistil = effect.hasPistil;
        const vdlPistilColor = effect.pistilColor;
        const vdlFiringPattern = effect.firingPattern;

        const effFormulationId = effect.formulationId || autoMatchFormulation(effect.color, pt || 'shell', caliber);

        if (pt === 'mine') return <MineEffect key={item.id} position={pos} color={effect.color} progress={progress} caliber={caliber} angleOffset={vdlAngle} heightMeters={effect.heightMeters} formulationId={effFormulationId} />;
        if (pt === 'candle') return <RomanCandleEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 8} caliber={caliber} angleOffset={vdlAngle} formulationId={effFormulationId} />;
        if (pt === 'waterfall') return <WaterfallEffect key={item.id} position={pos} color={effect.color} progress={progress} width={scaledHeight} caliber={caliber} formulationId={effFormulationId} />;
        if (pt === 'gerb') return <GerbEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} caliber={caliber} formulationId={effFormulationId} />;
        if (pt === 'flame') return <FlameEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'cake') return <CakeEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 25} pattern={vdlFiringPattern} caliber={caliber} formulationId={effFormulationId} />;
        if (pt === 'laser') return <LaserEffect key={item.id} position={pos} color={effect.color} progress={progress} pattern={effect.laserPattern || 'fan'} beamCount={effect.beamCount || 8} />;
        if (pt === 'light' && effect.beamType) return <MovingHeadEffect key={item.id} position={pos} color={effect.color} progress={progress} beamType={effect.beamType} />;

        if (eid === 'sfx-01') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 6} />;
        if (eid === 'sfx-02') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 8} horizontal />;
        if (eid === 'sfx-06' || eid === 'sfx-07') return <ConfettiEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (eid === 'sfx-08') return <FogMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={8 + (scaledHeight || 4)} />;
        if (eid === 'sfx-09') return <HazeMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} radius={16 + (scaledHeight || 4)} />;
        if (eid === 'sfx-10') return <SnowMachineEffect key={item.id} position={pos} progress={progress} width={6 + (scaledHeight || 4)} height={Math.max(6, (scaledHeight || 8) * 1.2)} />;
        if (eid === 'sfx-11') return <BubbleMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={6 + (scaledHeight || 3)} />;

        if (eid.startsWith('comet-')) return <CometEffect key={item.id} position={pos} color={effect.color} progress={progress} direction={eid === 'comet-02' ? 'down' : 'up'} caliber={caliber} angleOffset={vdlAngle} formulationId={effFormulationId} />;
        if (eid.startsWith('mburst-')) return <MultiBurstEffect key={item.id} position={burstPos} color={effect.color} progress={progress} burstCount={eid === 'mburst-02' ? 5 : 3} caliber={caliber} />;
        if (eid.startsWith('fan-')) return <FanEffect key={item.id} position={pos} color={effect.color} progress={progress} spreadAngle={eid === 'fan-02' ? 180 : 90} caliber={caliber} formulationId={effFormulationId} />;

        if (effect.type === 'firework') return (
          <FireworkBurst 
            key={item.id}
            position={burstPos} 
            color={effect.color} 
            progress={progress} 
            caliber={caliber}
            pattern={effect.pattern || 'peony'}
            angleOffset={vdlAngle}
            trailType={vdlTrailType}
            noTrail={vdlNoTrail}
            secondaryColor={vdlSecondaryColor}
            colorTransition={vdlColorTransition}
            hasPistil={vdlHasPistil}
            pistilColor={vdlPistilColor}
            niagaraProfile={effect.niagaraProfile}
          />
        );
        return <LightPoint key={item.id} position={pos} color={effect.color} />;
      })}
    </>
  );
}

// Static property to expose burst count to parent
TimelineEffects._activeBurstCount = 0;

// ═══════════════════════════════════════════════════════════════════════
// LiveSFXEffects — renders effects fired from the Live SFX Console
// ═══════════════════════════════════════════════════════════════════════
export const LiveSFXEffects = React.forwardRef<any>(function LiveSFXEffects(_props, _ref) {
  const activeEffects = useLiveSfxStore((s) => s.activeEffects);
  const stopEffect = useLiveSfxStore((s) => s.stopEffect);
  const frameRef = useRef(0);

  useFrame(() => {
    if (activeEffects.length === 0) return;
    frameRef.current++;
    if (frameRef.current % 10 === 0) {
      const now = performance.now();
      for (const fx of activeEffects) {
        if (now - fx.startedAt > fx.duration) {
          stopEffect(fx.id);
        }
      }
    }
  });

  return (
    <>
      {activeEffects.map((fx) => {
        const elapsed = (performance.now() - fx.startedAt) / fx.duration;
        const progress = Math.min(1, Math.max(0, elapsed));
        if (progress >= 1) return null;

        const pos = fx.position;
        const intensityScale = fx.intensity / 255;

        switch (fx.type) {
          case 'co2':
          case 'cryo':
            return <group key={fx.id}><CryoJetEffect position={pos} color={fx.color} progress={progress} height={6 * intensityScale + 2} /></group>;
          case 'flame':
            return <group key={fx.id}><FlameEffect position={pos} color={fx.color} progress={progress} height={8 * intensityScale + 2} /></group>;
          case 'confetti':
          case 'streamer':
            return <group key={fx.id}><ConfettiEffect position={pos} color={fx.color} progress={progress} /></group>;
          case 'haze':
            return <group key={fx.id}><HazeMachineEffect position={pos} color={fx.color} progress={progress} radius={12} /></group>;
          case 'spark':
            return <group key={fx.id}><SparkShower position={pos} color={fx.color} progress={progress} height={6 * intensityScale + 2} spread={3} /></group>;
          default:
            return <group key={fx.id}><GerbEffect position={pos} color={fx.color} progress={progress} height={4 * intensityScale + 1} /></group>;
        }
      })}
    </>
  );
});
