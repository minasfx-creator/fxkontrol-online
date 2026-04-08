/**
 * FireworkRenderer — FireworkBurst particle system, TimelineEffects orchestrator,
 * LiveSFXEffects, and supporting helpers extracted from SkyCanvas.
 */
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { useSceneStore } from '@/store/useSceneStore';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
import { useLOD } from '@/hooks/useLOD';
import { getLiftTime, getBreakHeight, getBreakSpeed, getTypedPrefire, getTypedDuration, getStarLifetime, type FinalePartType } from '@/lib/pyroPhysics';
import { parseVDL, vdlToEffect } from '@/lib/vdlParser';
import { temporalFlicker, getFlickerParams, strobeFlicker, getCombustionHdrBoost } from '@/lib/pyroNoise';
import { updateFrustum, isSphereInFrustum } from '@/lib/frustumCuller';
import { clampNiagaraHDR, getNiagaraBudgets } from '@/lib/niagaraBlenderRules';
import { thermalColor, autoMatchFormulation } from '@/render_ultra/fireworks/particleChemistry';
import { getBurstConfig, type BurstPattern } from '@/render_ultra/fireworks/burstSimulation';
import {
  hexToCompound,
  getEffectById,
  getWindForce,
  getWindAtPosition,
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
  GirandolaEffect,
  RocketEffect,
} from '../effects';
import QuadcopterModel from '../QuadcopterModel';

// ═══════════════════════════════════════════════════════════════════════
// GC-free pre-allocated singletons for render loop
// ═══════════════════════════════════════════════════════════════════════
const _rPosEuler = new THREE.Euler();
const _rPosQuat = new THREE.Quaternion();
const _rLaunchDir = new THREE.Vector3();
const _rPitchAxis = new THREE.Vector3();
const _rPitchQuat = new THREE.Quaternion();
const _rEffEuler = new THREE.Euler();
const _rEffQuat = new THREE.Quaternion();
const _smokeBlendColor = new THREE.Color();
const _smokeGrayTarget = new THREE.Color(0.35, 0.30, 0.25);
const _smokeBlendResult = new THREE.Color();

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
    gl_PointSize = aSize * (6000.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 0.5, 192.0);
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
      depthTest: true,
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
  const pistilRef = useRef<THREE.Points>(null);
  const crossetteSplitRef = useRef<Set<number>>(new Set());
  
  const lod = useLOD(position);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const { particleDensity, hdrMultiplier, effectBrightness, gpuParticlePhysics, frustumCullingBursts } = useSceneStore(st => st.settings);

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
    if (pattern === 'willow' || pattern === 'kamuro') return baseLife * 3.0;
    if (pattern === 'palm' || pattern === 'brocade') return baseLife * 1.6;
    if (pattern === 'chrysanthemum') return baseLife * 1.2;
    if (pattern === 'dahlia') return baseLife * 0.35;
    if (pattern === 'dragon_egg') return baseLife * 1.8;
    if (pattern === 'multi_break') return baseLife * 1.4;
    if (pattern === 'time_rain') return baseLife * 4.0;
    if (pattern === 'falling_leaves') return baseLife * 3.5;
    if (pattern === 'glitter') return baseLife * 2.5;
    if (pattern === 'horsetail') return baseLife * 3.5;
    if (pattern === 'brocade_crown') return baseLife * 1.8;
    if (pattern === 'saturn') return baseLife * 1.3;
    if (pattern === 'coconut_tree') return baseLife * 2.8;
    if (pattern === 'spider_web') return baseLife * 1.6;
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
      const speedVar = Math.pow(0.4 + Math.random() * 0.6, 0.5); // was 0.7 — more uniform distribution
      tp[i] = Math.random() * Math.PI * 2;
      sparkle[i] = Math.random() * 999 + i;

      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.sin(theta);

      switch (pattern) {
        case 'willow':
          vx = sx * breakSpeed * 0.55 * speedVar; vy = sy * breakSpeed * 0.55 * speedVar; vz = sz * breakSpeed * 0.55 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.4); break;
        case 'palm': {
          // Palm: 6 symmetric fronds with upward bias
          const FROND_COUNT = 6;
          const frondIdx = i % FROND_COUNT;
          const frondAngle = (frondIdx / FROND_COUNT) * Math.PI * 2;
          const frondJitter = (Math.random() - 0.5) * 2 * (6 * Math.PI / 180);
          const palmTheta = frondAngle + frondJitter;
          const palmPhi = Math.random() * Math.PI * 0.35;
          const palmSpd = breakSpeed * (0.6 + Math.random() * 0.4);
          vx = Math.sin(palmPhi) * Math.cos(palmTheta) * palmSpd * 0.48 * speedVar;
          vy = Math.cos(palmPhi) * palmSpd * 0.95 + breakSpeed * 0.55;
          vz = Math.sin(palmPhi) * Math.sin(palmTheta) * palmSpd * 0.48 * speedVar;
          life = starLife * (1.1 + Math.random() * 0.6); break;
        }
        case 'chrysanthemum':
          vx = sx * breakSpeed * speedVar; vy = sy * breakSpeed * 0.93 * speedVar + breakSpeed * 0.08; vz = sz * breakSpeed * speedVar;
          life = starLife * (0.85 + Math.random() * 0.3); break;
        case 'kamuro':
          vx = sx * breakSpeed * 0.45 * speedVar; vy = sy * breakSpeed * 0.45 * speedVar + 1.2; vz = sz * breakSpeed * 0.45 * speedVar;
          life = starLife * (1.8 + Math.random() * 1.8); break;
        case 'ring': {
          const ringAngle = (i / STAR_COUNT) * Math.PI * 2;
          const ringJitter = (Math.random() - 0.5) * 0.06;
          vx = Math.cos(ringAngle + ringJitter) * breakSpeed * (0.92 + Math.random() * 0.08);
          vy = (Math.random() - 0.5) * breakSpeed * 0.04;
          vz = Math.sin(ringAngle + ringJitter) * breakSpeed * (0.92 + Math.random() * 0.08);
          break;
        }
        case 'dahlia':
          // Dahlia: HIGH velocity, short life — bright detonation flash with fewer large stars
          vx = sx * breakSpeed * 1.7 * speedVar; vy = sy * breakSpeed * 1.6 * speedVar + 0.5; vz = sz * breakSpeed * 1.7 * speedVar;
          life = starLife * (0.2 + Math.random() * 0.1); break;
        case 'brocade':
          vx = sx * breakSpeed * 0.58 * speedVar; vy = sy * breakSpeed * 0.58 * speedVar; vz = sz * breakSpeed * 0.58 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.0); break;
        case 'crossette': {
          const arm = i % 4; const armTheta = (arm / 4) * Math.PI * 2; const armPhi = Math.PI * 0.40; const jitter = 0.08;
          vx = Math.sin(armPhi) * Math.cos(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          vy = Math.cos(armPhi + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82 + breakSpeed * 0.06;
          vz = Math.sin(armPhi) * Math.sin(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          break;
        }
        case 'heart': {
          const t_h = (i / STAR_COUNT) * Math.PI * 2;
          const hx = 16 * Math.pow(Math.sin(t_h), 3);
          const hy = 13 * Math.cos(t_h) - 5 * Math.cos(2 * t_h) - 2 * Math.cos(3 * t_h) - Math.cos(4 * t_h);
          const scale_h = breakSpeed * 0.045;
          vx = hx * scale_h + (Math.random() - 0.5) * 0.8;
          vy = hy * scale_h + (Math.random() - 0.5) * 0.8;
          vz = (Math.random() - 0.5) * breakSpeed * 0.06;
          break;
        }
        case 'multi_break': {
          // Multi-break: standard spherical, secondary bursts handled below
          vx = sx * breakSpeed * speedVar * 0.85; vy = sy * breakSpeed * speedVar * 0.85 + 0.8; vz = sz * breakSpeed * speedVar * 0.85;
          life = starLife * (0.7 + Math.random() * 0.3);
          break;
        }
        case 'time_rain': {
          const upBias = 0.4 + Math.random() * 0.3;
          vx = sx * breakSpeed * 0.5 * speedVar;
          vy = Math.abs(sy) * breakSpeed * 0.35 * speedVar + breakSpeed * upBias;
          vz = sz * breakSpeed * 0.5 * speedVar;
          life = starLife * (2.5 + Math.random() * 1.5);
          break;
        }
        case 'falling_leaves': {
          // Wide spread, tumbling: each star gets a random tumble phase
          vx = sx * breakSpeed * 0.9 * speedVar;
          vy = sy * breakSpeed * 0.5 * speedVar + breakSpeed * 0.08;
          vz = sz * breakSpeed * 0.9 * speedVar;
          life = starLife * (1.5 + Math.random() * 2.0);
          break;
        }
        case 'glitter': {
          vx = sx * breakSpeed * speedVar * 0.9;
          vy = sy * breakSpeed * speedVar * 0.9 + 0.5;
          vz = sz * breakSpeed * speedVar * 0.9;
          life = starLife * (0.8 + Math.random() * 0.4);
          break;
        }
        case 'horsetail': {
          // Horsetail: tight upward cone, heavy charcoal stars with extreme droop
          const htPhi = Math.random() * Math.PI * 0.25;
          const htTheta = Math.random() * Math.PI * 2;
          vx = Math.sin(htPhi) * Math.cos(htTheta) * breakSpeed * 0.35 * speedVar;
          vy = Math.cos(htPhi) * breakSpeed * 0.7 * speedVar;
          vz = Math.sin(htPhi) * Math.sin(htTheta) * breakSpeed * 0.35 * speedVar;
          life = starLife * (2.0 + Math.random() * 2.0);
          break;
        }
        case 'brocade_crown': {
          // Brocade crown: wide brocade with auto-pistil (pistil handled by hasPistil prop)
          vx = sx * breakSpeed * 0.55 * speedVar;
          vy = sy * breakSpeed * 0.55 * speedVar + 0.8;
          vz = sz * breakSpeed * 0.55 * speedVar;
          life = starLife * (1.4 + Math.random() * 0.8);
          break;
        }
        case 'saturn': {
          // Saturn: 60% equatorial ring + 40% polar burst
          const isRingStar = (i / STAR_COUNT) < 0.6;
          if (isRingStar) {
            const satAngle = ((i / (STAR_COUNT * 0.6)) * Math.PI * 2) + (Math.random() - 0.5) * 0.06;
            const satSpeed = breakSpeed * (0.88 + Math.random() * 0.12);
            vx = Math.cos(satAngle) * satSpeed;
            vy = (Math.random() - 0.5) * satSpeed * 0.02;
            vz = Math.sin(satAngle) * satSpeed;
          } else {
            const polPhi = Math.random() * Math.PI * 0.3;
            vx = Math.sin(polPhi) * Math.cos(theta) * breakSpeed * 0.25 * speedVar;
            vy = Math.cos(polPhi) * breakSpeed * 0.6 * speedVar;
            vz = Math.sin(polPhi) * Math.sin(theta) * breakSpeed * 0.25 * speedVar;
          }
          break;
        }
        case 'coconut_tree': {
          // Coconut tree: very tight upward cone, heavy charcoal stars droop into "fronds"
          const ctPhi = Math.random() * Math.PI * 0.22;
          const ctTheta = Math.random() * Math.PI * 2;
          vx = Math.sin(ctPhi) * Math.cos(ctTheta) * breakSpeed * 0.3 * speedVar;
          vy = Math.cos(ctPhi) * breakSpeed * 0.75 * speedVar + breakSpeed * 0.3;
          vz = Math.sin(ctPhi) * Math.sin(ctTheta) * breakSpeed * 0.3 * speedVar;
          life = starLife * (1.5 + Math.random() * 1.5);
          break;
        }
        case 'spider_web': {
          // Spider web: radial arms + concentric ring connectors
          const swArmCount = 10;
          const isArm = (i % 3) !== 2;
          if (isArm) {
            const arm = i % swArmCount;
            const armAngle = (arm / swArmCount) * Math.PI * 2;
            const jitter = (Math.random() - 0.5) * 0.04;
            const spd = breakSpeed * (0.7 + Math.random() * 0.3);
            vx = Math.cos(armAngle + jitter) * spd;
            vy = (Math.random() - 0.5) * spd * 0.08 + 0.3;
            vz = Math.sin(armAngle + jitter) * spd;
          } else {
            const ringR = 0.3 + Math.random() * 0.7;
            const ringA = Math.random() * Math.PI * 2;
            const spd = breakSpeed * ringR;
            vx = Math.cos(ringA) * spd;
            vy = (Math.random() - 0.5) * spd * 0.1 + 0.2;
            vz = Math.sin(ringA) * spd;
          }
          life = starLife * (0.8 + Math.random() * 0.5);
          break;
        }
        default: {
          // Peony: 12 petal clusters with azimuthal grouping
          const PETAL_CT = 12;
          const petalIdx = i % PETAL_CT;
          const petalAngle = (petalIdx / PETAL_CT) * Math.PI * 2;
          const petalJitter = (Math.random() - 0.5) * 2 * (8 * Math.PI / 180);
          const pTheta = petalAngle + petalJitter;
          const pPhi = Math.acos(0.3 + Math.random() * 0.5);
          const psx = Math.sin(pPhi) * Math.cos(pTheta);
          const psy = Math.cos(pPhi);
          const psz = Math.sin(pPhi) * Math.sin(pTheta);
          vx = psx * breakSpeed * speedVar; vy = psy * breakSpeed * speedVar * 0.9 + 0.6; vz = psz * breakSpeed * speedVar; break;
        }
      }

      v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz;
      l[i] = life;
    }

    return { velocities: v, lifetimes: l, twinklePhases: tp, sparkleSeeds: sparkle };
  }, [STAR_COUNT, breakSpeed, starLife, pattern]);

  // ── Pistil velocities (25% star count, 40% speed, inner burst) ──
  const PISTIL_COUNT = hasPistil ? Math.max(8, Math.round(STAR_COUNT * 0.25)) : 0;
  const pistilBaseColor = useMemo(() => pistilColor ? new THREE.Color(pistilColor) : new THREE.Color('#FFD700'), [pistilColor]);
  const pistilData = useMemo(() => {
    if (!PISTIL_COUNT) return null;
    const pv = new Float32Array(PISTIL_COUNT * 3);
    const pl = new Float32Array(PISTIL_COUNT);
    for (let i = 0; i < PISTIL_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = breakSpeed * 0.4 * (0.5 + Math.random() * 0.5);
      pv[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      pv[i * 3 + 1] = Math.cos(phi) * speed;
      pv[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
      pl[i] = starLife * (0.5 + Math.random() * 0.3);
    }
    return { velocities: pv, lifetimes: pl };
  }, [PISTIL_COUNT, breakSpeed, starLife]);

  const pistilBuffers = useMemo(() => {
    if (!PISTIL_COUNT) return null;
    return {
      positions: new Float32Array(PISTIL_COUNT * 3),
      colors: new Float32Array(PISTIL_COUNT * 3),
      sizes: new Float32Array(PISTIL_COUNT),
      lives: new Float32Array(PISTIL_COUNT),
    };
  }, [PISTIL_COUNT]);

  // ── Crossette sub-break buffer (pre-allocated slots after main stars) ──
  const CROSSETTE_SUB_COUNT = pattern === 'crossette' ? STAR_COUNT * 4 : 0;
  const crossetteSubData = useMemo(() => {
    if (!CROSSETTE_SUB_COUNT) return null;
    return {
      velocities: new Float32Array(CROSSETTE_SUB_COUNT * 3),
      positions: new Float32Array(CROSSETTE_SUB_COUNT * 3),
      colors: new Float32Array(CROSSETTE_SUB_COUNT * 3),
      sizes: new Float32Array(CROSSETTE_SUB_COUNT),
      lives: new Float32Array(CROSSETTE_SUB_COUNT),
      activeCount: 0,
      spawnTimes: new Float32Array(CROSSETTE_SUB_COUNT),
    };
  }, [CROSSETTE_SUB_COUNT]);

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

  useFrame(({ clock, camera }) => {
    if (!pointsRef.current || !trailRef.current) return;
    // Frustum culling: skip if burst center is off-screen
    // Note: updateFrustum(camera) is called once per frame in TimelineEffects
    // Zero-GC: uses pre-allocated singletons from frustumCuller module
    if (frustumCullingBursts) {
      if (!isSphereInFrustum(position[0], position[1], position[2], caliber * 30)) return;
    }

    const pos = particleBuffers.positions;
    const cols = particleBuffers.colors;
    const sizes = particleBuffers.sizes;
    const lives = particleBuffers.lives;
    const tPos = particleBuffers.trailPos;
    const tCol = particleBuffers.trailCol;
    const t = progress * (starLife * 0.88);
    const trailDt = (pattern === 'willow' || pattern === 'kamuro' || pattern === 'brocade') ? 0.020
      : pattern === 'palm' ? 0.025 : 0.035;
    const w = getWindForce('ember', position[1]);
    const time = clock.getElapsedTime();
    const _adaptiveExposure = getAdaptiveExposure();
    
    // Reduced drag for larger calibers — heavier stars travel further
    const baseDrag = caliber <= 3 ? 0.058 : caliber <= 4 ? 0.048 : caliber <= 5 ? 0.040
      : caliber <= 6 ? 0.034 : caliber <= 8 ? 0.026 : caliber <= 10 ? 0.020 : 0.016;
    const isTrailingPattern = pattern === 'willow' || pattern === 'kamuro' || pattern === 'brocade' || pattern === 'palm' || pattern === 'horsetail' || pattern === 'brocade_crown';
    // Pattern-specific drag multiplier — heavier stars = less air resistance
    const dragMult = pattern === 'kamuro' ? 0.55 : pattern === 'willow' ? 0.55
      : pattern === 'horsetail' ? 0.40 : pattern === 'brocade' ? 0.60
      : pattern === 'brocade_crown' ? 0.55 : pattern === 'palm' ? 0.75 : 1.0;
    const dragCoeff = baseDrag * dragMult;
    
    // Larger star sizes for bigger calibers — was 0.9 for 6", now 1.4
    const baseSize = caliber <= 3 ? 0.5 : caliber <= 4 ? 0.8 : caliber <= 6 ? 1.4
      : caliber <= 8 ? 1.8 : caliber <= 10 ? 2.2 : 2.6;
    
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
      // Exponential decay for peony/chrysanthemum — holds brightness longer then drops naturally
      const useExpFade = pattern === 'peony' || pattern === 'chrysanthemum';
      const fadeCubed = useExpFade ? Math.exp(-starAge * 3.5) : fade * fade * fade;
      
      let px: number, py: number, pz: number;
      
      if (pattern === 'time_rain') {
        // Time rain: stars rise, hang at apogee (30-60% life), then rain down sharply
        const hangStart = 0.25;
        const hangEnd = 0.55;
        const rainPhase = Math.max(0, (starAge - hangEnd) / (1 - hangEnd));
        
        // Fixed hangT: time at which this star reaches apogee (fraction of its total flight)
        const hangT = hangStart * starLife * 0.88;
        const hangPx = dragPos(vx, hangT, dragCoeff) + w[0] * hangT * hangT * 0.3;
        const hangPy = dragPos(vy, hangT, dragCoeff) + 0.5 * GRAVITY * 0.15 * hangT * hangT;
        const hangPz = dragPos(vz, hangT, dragCoeff) + w[2] * hangT * hangT * 0.3;
        
        if (starAge < hangStart) {
          // Rising phase — normal ballistics
          px = dragPos(vx, t, dragCoeff) + w[0] * t * t * 0.3;
          py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * 0.15 * t * t;
          pz = dragPos(vz, t, dragCoeff) + w[2] * t * t * 0.3;
        } else if (starAge < hangEnd) {
          // Hanging phase — tight vertical columns with minimal lateral drift
          const driftT = (starAge - hangStart) / (hangEnd - hangStart);
          // Column grouping: stars sharing same column index drift together
          const columnIdx = sparkleSeeds[i] % 8;
          const columnScatter = ((columnIdx % 8) - 4) * 0.001;
          px = hangPx + w[0] * driftT * 0.6 + Math.sin(time * 0.3 + columnIdx) * 0.03 + columnScatter * driftT;
          py = hangPy - driftT * 0.35;
          pz = hangPz + w[2] * driftT * 0.6 + Math.cos(time * 0.25 + columnIdx) * 0.02 + columnScatter * driftT * 0.7;
        } else {
          // Rain phase — sharp vertical descent with 2.5x gravity, minimal horizontal movement
          const rainT = rainPhase * 4.0;
          const columnIdx = sparkleSeeds[i] % 8;
          const columnScatter = ((columnIdx % 8) - 4) * 0.001;
          px = hangPx + w[0] * 0.6 + columnScatter + w[0] * rainT * 0.08;
          py = hangPy - 0.35 + 0.5 * GRAVITY * 2.5 * rainT * rainT;
          pz = hangPz + w[2] * 0.6 + columnScatter * 0.7 + w[2] * rainT * 0.08;
        }
      } else if (pattern === 'falling_leaves') {
        // Falling leaves: aerodynamic tumble — multi-axis sinusoidal flutter + heavy gravity
        // Each star tumbles at its own frequency/amplitude (from sparkleSeeds)
        const tumbleFreq = 1.8 + (sparkleSeeds[i] % 5) * 0.6;
        const tumbleAmp = 0.6 + (sparkleSeeds[i] % 7) * 0.12;
        const basePx = dragPos(vx, t, dragCoeff * 0.5); // reduced drag = wider drift
        const basePy = dragPos(vy, t, dragCoeff * 0.35) + 0.5 * GRAVITY * 1.8 * t * t;
        const basePz = dragPos(vz, t, dragCoeff * 0.5);
        const tumblePhase = twinklePhases[i];
        // Multi-axis tumble: primary lateral + secondary vertical wobble + perpendicular sway
        const tumbleScale = starAge * (1 + starAge); // amplifies as leaf slows
        px = basePx + Math.sin(time * tumbleFreq + tumblePhase) * tumbleAmp * tumbleScale + w[0] * t * t * 0.5;
        py = basePy + Math.cos(time * tumbleFreq * 1.3 + tumblePhase) * tumbleAmp * 0.45 * tumbleScale;
        pz = basePz + Math.cos(time * tumbleFreq * 0.8 + tumblePhase + 2.1) * tumbleAmp * tumbleScale + w[2] * t * t * 0.5;
      } else if (pattern === 'glitter') {
        // Glitter: normal ballistics with stochastic flash scatter
        px = dragPos(vx, t, dragCoeff) + w[0] * t * t * 0.3;
        py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * gravityMult * t * t;
        pz = dragPos(vz, t, dragCoeff) + w[2] * t * t * 0.3;
    } else if (pattern === 'willow') {
        // Willow: normal ballistics but progressive gravity increase in last 40% for droop
        const willowGravMult = starAge > 0.6 
          ? gravityMult * (1 + (starAge - 0.6) / 0.4 * 3.5) // ramp to 4.5x gravity
          : gravityMult * 0.7; // lighter gravity early for wide spread
        px = dragPos(vx, t, dragCoeff * 0.85) + w[0] * t * t * 0.4; // less drag horizontally
        py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * willowGravMult * t * t;
        pz = dragPos(vz, t, dragCoeff * 0.85) + w[2] * t * t * 0.4;
      } else if (pattern === 'horsetail') {
        // Horsetail: heavy charcoal stars with aggressive progressive droop (heavier than willow)
        const htGravMult = starAge < 0.5
          ? gravityMult * 1.2
          : gravityMult * (1.2 + (starAge - 0.5) / 0.5 * 5.5); // ramp to 6.7x (charcoal heavier than willow 4.5x)
        px = dragPos(vx, t, dragCoeff * 0.55) + w[0] * t * t * 0.5; // less horiz drag = charcoal weight dominates
        py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * htGravMult * t * t;
        pz = dragPos(vz, t, dragCoeff * 0.55) + w[2] * t * t * 0.5;
      } else if (pattern === 'coconut_tree') {
        // Coconut tree: 3-phase — ascent, frond spread, heavy droop
        let cocoGravMult: number;
        let cocoDragH: number;
        const frondSeed = sparkleSeeds[i];
        if (starAge < 0.3) {
          // Ascent: low gravity, low drag — stars climb fast
          cocoGravMult = gravityMult * 0.4;
          cocoDragH = dragCoeff * 0.5;
        } else if (starAge < 0.6) {
          // Frond spread: moderate gravity, sinusoidal lateral sway
          cocoGravMult = gravityMult * 1.5;
          cocoDragH = dragCoeff * 0.8;
        } else {
          // Droop: heavy gravity, near-zero horizontal drag — fronds fall
          cocoGravMult = gravityMult * 5.0;
          cocoDragH = dragCoeff * 0.15;
        }
        px = dragPos(vx, t, cocoDragH) + w[0] * t * t * 0.3;
        py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * cocoGravMult * t * t;
        pz = dragPos(vz, t, cocoDragH) + w[2] * t * t * 0.3;
        // Frond lateral sway during spread phase
        if (starAge >= 0.3 && starAge < 0.6) {
          const frondPhase = (frondSeed % 100) / 100 * Math.PI * 2;
          const frondAmp = 0.8 + (frondSeed % 50) / 50 * 0.6;
          const spreadProgress = (starAge - 0.3) / 0.3;
          px += Math.sin(time * 2.5 + frondPhase) * frondAmp * spreadProgress;
          pz += Math.cos(time * 2.5 + frondPhase + 1.5) * frondAmp * spreadProgress;
        }
      } else if (pattern === 'kamuro') {
        // Kamuro: heavy metal-coated stars — progressive gravity buildup for golden cascade
        const kamGravMult = starAge < 0.4
          ? gravityMult * 0.8
          : gravityMult * (0.8 + (starAge - 0.4) / 0.6 * 2.7); // peaks at 3.5x
        px = dragPos(vx, t, dragCoeff * 0.7) + w[0] * t * t * 0.4;
        py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * kamGravMult * t * t;
        pz = dragPos(vz, t, dragCoeff * 0.7) + w[2] * t * t * 0.4;
      } else {
        px = dragPos(vx, t, dragCoeff) + w[0] * t * t * 0.3;
        py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * gravityMult * t * t;
        pz = dragPos(vz, t, dragCoeff) + w[2] * t * t * 0.3;
      }
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;

      const flashIntensity = Math.max(0, 1 - starAge * 20);
      const emberPhase = Math.max(0, (starAge - 0.45) / 0.55);
      
      const lifeRatio = 1 - starAge;
      const adaptiveScale = THREE.MathUtils.clamp(_adaptiveExposure / 1.2, 0.45, 1.35);
      // Apply combustion heat HDR boost per compound (Al=1.0, Fe=0.22, etc.)
      const compoundHdr = getCombustionHdrBoost(String(compound));
      const hdrScale = THREE.MathUtils.clamp((hdrMultiplier / 3.5) * adaptiveScale * (0.7 + compoundHdr * 0.6), 0.6, 2.8);
      const chemColor = thermalColor(compound, lifeRatio, hdrScale);
      const chemR = chemColor.r, chemG = chemColor.g, chemB = chemColor.b;
      
      let twinkle: number;
      const compoundStr = String(compound);
      const isMagnaliumOrDragonEgg = compoundStr.includes('magnalium') || pattern === 'dragon_egg';
      
      if (pattern === 'glitter') {
        // Glitter: delayed stochastic flashes — each star ignites at a random time
        // Per-star random flash interval and brightness for cascade effect
        const igniteTime = 0.25 + (sparkleSeeds[i] % 100) / 180; // 25-80% of life
        const flashInterval = 0.08 + (sparkleSeeds[i] % 50) / 500; // 80-180ms per star
        const flashWindow = 0.04 + (sparkleSeeds[i] % 30) / 1000; // 40-70ms flash width
        const flashBrightness = 1.8 + (sparkleSeeds[i] % 40) / 40; // 1.8-2.8x
        const timeSinceIgnite = starAge - igniteTime;
        const flashPhase = timeSinceIgnite > 0 ? timeSinceIgnite % flashInterval : -1;
        if (timeSinceIgnite > 0 && flashPhase >= 0 && flashPhase < flashWindow) {
          twinkle = flashBrightness; // bright flash — varies per star
        } else if (timeSinceIgnite > 0) {
          twinkle = 0.1; // dim between flashes — smoldering
        } else {
          twinkle = 0.5; // pre-ignition: subdued glow
        }
      } else if (isMagnaliumOrDragonEgg) {
        // Dragon eggs: "oscillatory burning much more vigorous than strobe mix" — Chemistry of Pyrotechnics
        // Lead/bismuth oxide + magnalium = ~15Hz violent oscillation (vs 10Hz standard strobe)
        const isDragonEgg = pattern === 'dragon_egg';
        const smolder = isDragonEgg ? 0.04 : 0.06;
        const burn = isDragonEgg ? 0.025 : 0.04;
        twinkle = strobeFlicker(sparkleSeeds[i], time, smolder, burn) * (isDragonEgg ? 1.3 : 1.0);
      } else if (isTrailingPattern) {
        // Nishiki detection: kamuro + gold-like base color → high-freq aluminum shimmer
        const isNishiki = pattern === 'kamuro' && baseColor.r > 0.85 && baseColor.g > 0.7 && baseColor.b < 0.4;
        if (isNishiki) {
          // 25Hz shimmer overlay modeling aluminum/charcoal combustion oscillation
          const shimmer = Math.sin(time * 50 + sparkleSeeds[i] * 3.7) * 0.15;
          twinkle = temporalFlicker(sparkleSeeds[i], time, 0.70, 0.30, 0.12) + shimmer;
        } else {
          twinkle = temporalFlicker(sparkleSeeds[i], time, 0.82, 0.15, 0.10);
        }
      } else {
        // Chemical-compound-specific flicker params
        const fp = getFlickerParams(compoundStr);
        twinkle = temporalFlicker(sparkleSeeds[i], time, fp.base, fp.amplitude, fp.popStrength);
        
        // ── Discrete blink pattern for non-trailing patterns ──
        const blinkVal = Math.sin(time * 18.0 + twinklePhases[i] * 6.28);
        if (pattern === 'crossette') {
          twinkle *= blinkVal > 0.0 ? 1.0 : 0.08; // 50% duty, strong blink
        } else if (pattern === 'peony' || pattern === 'chrysanthemum') {
          twinkle *= blinkVal > -0.4 ? 1.0 : 0.35; // 70% duty, subtle
        } else if (pattern === 'heart') {
          twinkle *= blinkVal > -0.6 ? 1.0 : 0.5; // 80% duty, gentle
        }
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
      
      // ── Height extinction: stars dim as they reach max travel distance for this caliber ──
      const dist = Math.sqrt(px * px + py * py + pz * pz);
      const maxRadius = breakSpeed * starLife * 0.4;
      const extinctionT = maxRadius > 0 ? THREE.MathUtils.clamp((dist / maxRadius - 0.7) / 0.3, 0, 1) : 0;
      const heightExtinction = 1 - extinctionT;
      
      const [safeR, safeG, safeB] = clampNiagaraHDR(
        r * twinkle * brightnessScale * niagaraGlow * heightExtinction,
        g * twinkle * brightnessScale * niagaraGlow * heightExtinction,
        b * twinkle * brightnessScale * niagaraGlow * heightExtinction
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
        
        // Compute per-segment gravity multiplier for droop patterns
        const segAge0 = lt > 0 ? Math.min(1, t0 / lt) : 0;
        const segAge1 = lt > 0 ? Math.min(1, t1 / lt) : 0;
        let trailGrav0 = gravityMult;
        let trailGrav1 = gravityMult;
        let trailDragH0 = dragCoeff;
        let trailDragH1 = dragCoeff;
        
        if (pattern === 'horsetail') {
          trailGrav0 = segAge0 < 0.5 ? gravityMult * 1.2 : gravityMult * (1.2 + (segAge0 - 0.5) / 0.5 * 5.5);
          trailGrav1 = segAge1 < 0.5 ? gravityMult * 1.2 : gravityMult * (1.2 + (segAge1 - 0.5) / 0.5 * 5.5);
          trailDragH0 = dragCoeff * 0.55;
          trailDragH1 = dragCoeff * 0.55;
        } else if (pattern === 'coconut_tree') {
          trailGrav0 = segAge0 < 0.3 ? gravityMult * 0.4 : segAge0 < 0.6 ? gravityMult * 1.5 : gravityMult * 5.0;
          trailGrav1 = segAge1 < 0.3 ? gravityMult * 0.4 : segAge1 < 0.6 ? gravityMult * 1.5 : gravityMult * 5.0;
          trailDragH0 = segAge0 < 0.3 ? dragCoeff * 0.5 : segAge0 < 0.6 ? dragCoeff * 0.8 : dragCoeff * 0.15;
          trailDragH1 = segAge1 < 0.3 ? dragCoeff * 0.5 : segAge1 < 0.6 ? dragCoeff * 0.8 : dragCoeff * 0.15;
        } else if (pattern === 'willow') {
          trailGrav0 = segAge0 > 0.6 ? gravityMult * (1 + (segAge0 - 0.6) / 0.4 * 3.5) : gravityMult * 0.7;
          trailGrav1 = segAge1 > 0.6 ? gravityMult * (1 + (segAge1 - 0.6) / 0.4 * 3.5) : gravityMult * 0.7;
          trailDragH0 = dragCoeff * 0.85;
          trailDragH1 = dragCoeff * 0.85;
        } else if (pattern === 'time_rain') {
          const hangStart = 0.25;
          const hangEnd = 0.55;
          trailGrav0 = segAge0 < hangStart ? gravityMult * 0.15 : segAge0 < hangEnd ? gravityMult * 0.05 : gravityMult * 2.5;
          trailGrav1 = segAge1 < hangStart ? gravityMult * 0.15 : segAge1 < hangEnd ? gravityMult * 0.05 : gravityMult * 2.5;
        } else if (pattern === 'crossette') {
          trailGrav0 = segAge0 > 0.4 ? gravityMult * 1.5 : gravityMult;
          trailGrav1 = segAge1 > 0.4 ? gravityMult * 1.5 : gravityMult;
        } else if (pattern === 'kamuro') {
          trailGrav0 = segAge0 < 0.4 ? gravityMult * 0.8 : gravityMult * (0.8 + (segAge0 - 0.4) / 0.6 * 2.7);
          trailGrav1 = segAge1 < 0.4 ? gravityMult * 0.8 : gravityMult * (0.8 + (segAge1 - 0.4) / 0.6 * 2.7);
          trailDragH0 = dragCoeff * 0.7;
          trailDragH1 = dragCoeff * 0.7;
        } else if (pattern === 'saturn') {
          // Ring stars (first 60%) get reduced gravity to stay flat
          const isRingStar = (i / STAR_COUNT) < 0.6;
          if (isRingStar) {
            trailGrav0 = gravityMult * 0.3;
            trailGrav1 = gravityMult * 0.3;
          }
        }
        
        // Trail segment start
        const sx0 = dragPos(vx, t0, trailDragH0);
        const sy0 = dragPos(vy, t0, dragCoeff) + 0.5 * GRAVITY * trailGrav0 * t0 * t0;
        const sz0 = dragPos(vz, t0, trailDragH0);
        const w0 = isTrailingPattern 
          ? getWindAtPosition(position[0] + sx0, position[1] + sy0, position[2] + sz0, 'ember')
          : w;
        tPos[base2] = sx0 + w0[0] * t0 * t0 * 0.3;
        tPos[base2 + 1] = sy0;
        tPos[base2 + 2] = sz0 + w0[2] * t0 * t0 * 0.3;
        
        // Trail segment end
        const sx1 = dragPos(vx, t1, trailDragH1);
        const sy1 = dragPos(vy, t1, dragCoeff) + 0.5 * GRAVITY * trailGrav1 * t1 * t1;
        const sz1 = dragPos(vz, t1, trailDragH1);
        const w1 = isTrailingPattern
          ? getWindAtPosition(position[0] + sx1, position[1] + sy1, position[2] + sz1, 'ember')
          : w;
        tPos[base2 + 3] = sx1 + w1[0] * t1 * t1 * 0.3;
        tPos[base2 + 4] = sy1;
        tPos[base2 + 5] = sz1 + w1[2] * t1 * t1 * 0.3;
        
        const segFrac = s / TRAIL_LENGTH;
        const segFade = fadeCubed * Math.pow(1 - segFrac, 2.5) * 0.95;
        const endFade = fadeCubed * Math.pow(1 - (s + 1) / TRAIL_LENGTH, 2.5) * 0.95;
        
        const trailWarmth = Math.pow(segFrac, 0.4);
        // Ember glow: late-phase stars (>60% life) get warm amber trail instead of fading out
        const isEmberPhase = starAge > 0.6;
        const emberGlow = isEmberPhase ? Math.max(0, 1 - (starAge - 0.6) / 0.4) * 0.4 : 0;
        const trR = THREE.MathUtils.lerp(0.9, r * 0.75, trailWarmth) + (isEmberPhase ? 0.5 * emberGlow : 0);
        const trG = THREE.MathUtils.lerp(0.55, g * 0.5, trailWarmth) + (isEmberPhase ? 0.2 * emberGlow : 0);
        const trB = THREE.MathUtils.lerp(0.25, b * 0.2, trailWarmth) + (isEmberPhase ? 0.05 * emberGlow : 0);
        tCol[base2] = trR * segFade;
        tCol[base2 + 1] = trG * segFade;
        tCol[base2 + 2] = trB * segFade;
        tCol[base2 + 3] = trR * endFade;
        tCol[base2 + 4] = trG * endFade;
        tCol[base2 + 5] = trB * endFade;
      }
    }

    // ── Crossette sub-breaks: spawn exactly 4 directional arms at 40% life ──
    if (pattern === 'crossette' && crossetteSubData) {
      for (let i = 0; i < STAR_COUNT; i++) {
        const lt = lifetimes[i];
        const starAge = Math.min(1, t / lt);
        if (starAge > 0.4 && !crossetteSplitRef.current.has(i)) {
          crossetteSplitRef.current.add(i);
          const parentPx = pos[i * 3], parentPy = pos[i * 3 + 1], parentPz = pos[i * 3 + 2];
          const pvx = velocities[i * 3], pvy = velocities[i * 3 + 1], pvz = velocities[i * 3 + 2];
          // Compute perpendicular axes to parent velocity for 4-arm cross
          const pSpeed = Math.sqrt(pvx * pvx + pvy * pvy + pvz * pvz) || 1;
          const dxN = pvx / pSpeed, dyN = pvy / pSpeed, dzN = pvz / pSpeed;
          // Find a perpendicular vector (cross with up, fallback to right)
          let perpX = -dzN, perpY = 0, perpZ = dxN;
          const perpLen = Math.sqrt(perpX * perpX + perpZ * perpZ);
          if (perpLen < 0.01) { perpX = 1; perpY = 0; perpZ = 0; }
          else { perpX /= perpLen; perpZ /= perpLen; }
          // Second perpendicular via cross product
          const perp2X = dyN * perpZ - dzN * perpY;
          const perp2Y = dzN * perpX - dxN * perpZ;
          const perp2Z = dxN * perpY - dyN * perpX;
          
          const subSpeed = breakSpeed * 0.4;
          const subCount = 4; // exactly 4 arms — crossette = cross
          for (let s = 0; s < subCount && crossetteSubData.activeCount < CROSSETTE_SUB_COUNT; s++) {
            const idx = crossetteSubData.activeCount;
            const armAngle = (s / 4) * Math.PI * 2;
            const jitter = (sparkleSeeds[i] + s * 17.3) % 1 * 0.14 - 0.07; // ±4° cone
            const cosA = Math.cos(armAngle + jitter), sinA = Math.sin(armAngle + jitter);
            // Arm direction in the plane perpendicular to parent velocity
            const armDx = perpX * cosA + perp2X * sinA;
            const armDy = perpY * cosA + perp2Y * sinA;
            const armDz = perpZ * cosA + perp2Z * sinA;
            crossetteSubData.velocities[idx * 3] = armDx * subSpeed;
            crossetteSubData.velocities[idx * 3 + 1] = armDy * subSpeed;
            crossetteSubData.velocities[idx * 3 + 2] = armDz * subSpeed;
            crossetteSubData.positions[idx * 3] = parentPx;
            crossetteSubData.positions[idx * 3 + 1] = parentPy;
            crossetteSubData.positions[idx * 3 + 2] = parentPz;
            crossetteSubData.spawnTimes[idx] = t;
            crossetteSubData.activeCount++;
          }
        }
      }
      // Simulate crossette sub-particles with increased gravity
      for (let i = 0; i < crossetteSubData.activeCount; i++) {
        const subAge = t - crossetteSubData.spawnTimes[i];
        const subFade = Math.max(0, 1 - subAge / 0.8);
        const svx = crossetteSubData.velocities[i * 3];
        const svy = crossetteSubData.velocities[i * 3 + 1];
        const svz = crossetteSubData.velocities[i * 3 + 2];
        const spx = crossetteSubData.positions[i * 3] + dragPos(svx, subAge, dragCoeff * 1.2);
        const spy = crossetteSubData.positions[i * 3 + 1] + dragPos(svy, subAge, dragCoeff * 1.2) + 0.5 * GRAVITY * 1.5 * subAge * subAge;
        const spz = crossetteSubData.positions[i * 3 + 2] + dragPos(svz, subAge, dragCoeff * 1.2);
        // Write into reserved tail region of buffer (last 15%)
        const reserveStart = Math.floor(STAR_COUNT * 0.85);
        const targetIdx = reserveStart + (i % (STAR_COUNT - reserveStart));
        if (subFade > 0.01) {
          pos[targetIdx * 3] = spx; pos[targetIdx * 3 + 1] = spy; pos[targetIdx * 3 + 2] = spz;
          cols[targetIdx * 3] = baseColor.r * subFade; cols[targetIdx * 3 + 1] = baseColor.g * subFade; cols[targetIdx * 3 + 2] = baseColor.b * subFade;
          sizes[targetIdx] = baseSize * 0.6 * subFade;
        }
      }
    }

    // ── Multi-break: secondary burst at 50% star life ──
    if (pattern === 'multi_break') {
      for (let i = 0; i < STAR_COUNT; i++) {
        const lt = lifetimes[i];
        const starAge = Math.min(1, t / lt);
        if (starAge > 0.5 && starAge < 0.95) {
          const subAge = (starAge - 0.5) / 0.45;
          const subFade = Math.max(0, 1 - subAge * subAge);
          const reigniteFlash = subAge < 0.05 ? (1 - subAge / 0.05) * 2.0 : 0;
          const subTheta = sparkleSeeds[i] * 6.28;
          const subPhi = Math.acos(2 * ((sparkleSeeds[i] * 3.7) % 1) - 1);
          const subSpeed = breakSpeed * 0.35 * (0.5 + ((sparkleSeeds[i] * 7.3) % 1) * 0.5);
          const subT = (starAge - 0.5) * lt / (starLife * 0.88) * 0.8;
          const parentPx = pos[i * 3], parentPy = pos[i * 3 + 1], parentPz = pos[i * 3 + 2];
          const svx = Math.sin(subPhi) * Math.cos(subTheta) * subSpeed;
          const svy = Math.cos(subPhi) * subSpeed;
          const svz = Math.sin(subPhi) * Math.sin(subTheta) * subSpeed;
          pos[i * 3] = parentPx + dragPos(svx, subT, dragCoeff * 1.2);
          pos[i * 3 + 1] = parentPy + dragPos(svy, subT, dragCoeff * 1.2) + 0.5 * GRAVITY * subT * subT;
          pos[i * 3 + 2] = parentPz + dragPos(svz, subT, dragCoeff * 1.2);
          const secBright = (subFade + reigniteFlash) * 0.8;
          cols[i * 3] = baseColor.r * secBright;
          cols[i * 3 + 1] = baseColor.g * secBright;
          cols[i * 3 + 2] = baseColor.b * secBright;
          sizes[i] = baseSize * 0.7 * Math.max(0.2, subFade);
        }
      }
    }

    // ── Pistil simulation ──
    if (pistilData && pistilBuffers && pistilRef.current) {
      const pp = pistilBuffers.positions;
      const pc = pistilBuffers.colors;
      const ps = pistilBuffers.sizes;
      const plv = pistilBuffers.lives;
      const pistilDrag = dragCoeff * 0.8;
      const pistilGravMult = gravityMult * 0.7;
      const pistilDelay = pattern === 'brocade_crown' ? 0.25 : 0.15;
      for (let i = 0; i < PISTIL_COUNT; i++) {
        const pvx = pistilData.velocities[i * 3];
        const pvy = pistilData.velocities[i * 3 + 1];
        const pvz = pistilData.velocities[i * 3 + 2];
        const plt = pistilData.lifetimes[i];
        const delayedT = Math.max(0, t - pistilDelay);
        const pistilAge = Math.min(1, delayedT / plt);
        
        if (t < pistilDelay) {
          // Pre-delay: pistil invisible
          pp[i * 3] = 0; pp[i * 3 + 1] = 0; pp[i * 3 + 2] = 0;
          pc[i * 3] = 0; pc[i * 3 + 1] = 0; pc[i * 3 + 2] = 0;
          ps[i] = 0;
          plv[i] = 0;
        } else {
          const pistilFade = Math.exp(-pistilAge * 4.0);
          // Ignition flash when pistil just detonates
          const ignitionFlash = delayedT < 0.08 ? (1 - delayedT / 0.08) * 1.5 : 0;
          pp[i * 3] = dragPos(pvx, delayedT, pistilDrag) + w[0] * delayedT * delayedT * 0.2;
          pp[i * 3 + 1] = dragPos(pvy, delayedT, pistilDrag) + 0.5 * GRAVITY * pistilGravMult * delayedT * delayedT;
          pp[i * 3 + 2] = dragPos(pvz, delayedT, pistilDrag) + w[2] * delayedT * delayedT * 0.2;
          const flashBoost = 1 + ignitionFlash;
          pc[i * 3] = Math.min(1.5, pistilBaseColor.r * pistilFade * flashBoost + ignitionFlash * 0.3);
          pc[i * 3 + 1] = Math.min(1.5, pistilBaseColor.g * pistilFade * flashBoost + ignitionFlash * 0.25);
          pc[i * 3 + 2] = Math.min(1.5, pistilBaseColor.b * pistilFade * flashBoost + ignitionFlash * 0.15);
          ps[i] = baseSize * 0.7 * Math.max(0.1, pistilFade) * (1 + ignitionFlash * 0.5);
          plv[i] = pistilAge;
        }
      }
      const piGeo = pistilRef.current.geometry;
      const piPos = piGeo.getAttribute('position') as THREE.BufferAttribute;
      const piCol = piGeo.getAttribute('color') as THREE.BufferAttribute;
      const piSize = piGeo.getAttribute('aSize') as THREE.BufferAttribute;
      const piLife = piGeo.getAttribute('aLife') as THREE.BufferAttribute;
      if (piPos) { piPos.array = pp; piPos.needsUpdate = true; }
      if (piCol) { piCol.array = pc; piCol.needsUpdate = true; }
      if (piSize) { piSize.array = ps; piSize.needsUpdate = true; }
      if (piLife) { piLife.array = plv; piLife.needsUpdate = true; }
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
      <points ref={pointsRef} material={starMaterial} frustumCulled={false} renderOrder={50}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleBuffers.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleBuffers.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[particleBuffers.sizes, 1]} />
          <bufferAttribute attach="attributes-aLife" args={[particleBuffers.lives, 1]} />
        </bufferGeometry>
      </points>
      
      <lineSegments ref={trailRef} frustumCulled={false} renderOrder={50}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleBuffers.trailPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleBuffers.trailCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={Math.min(1, 0.8 * tailFactor)} depthWrite={false} depthTest={true} blending={THREE.AdditiveBlending} linewidth={3} />
      </lineSegments>

      {/* Pistil — inner burst with different color */}
      {hasPistil && pistilBuffers && (
        <points ref={pistilRef} material={starMaterial} frustumCulled={false} renderOrder={50}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pistilBuffers.positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[pistilBuffers.colors, 3]} />
            <bufferAttribute attach="attributes-aSize" args={[pistilBuffers.sizes, 1]} />
            <bufferAttribute attach="attributes-aLife" args={[pistilBuffers.lives, 1]} />
          </bufferGeometry>
        </points>
      )}
      
      {/* Core flash — bright white, 80ms */}
      {progress < 0.08 && (
        <mesh renderOrder={100}>
          <sphereGeometry args={[flashSize * 0.3 * (1 + progress * 15), 8, 8]} />
          <meshBasicMaterial color="#FFFDF0" transparent opacity={0.7 * (1 - progress / 0.08)} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </mesh>
      )}
      {/* Halo — color-synced, 150ms */}
      {progress < 0.15 && (
        <mesh renderOrder={99}>
          <sphereGeometry args={[flashSize * (1 + progress * 10), 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.35 * Math.pow(1 - progress / 0.15, 2)} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </mesh>
      )}
      {/* Shockwave ring — expanding white ring, 200ms */}
      {progress < 0.20 && (
        <mesh renderOrder={98} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[flashSize * progress * 18, flashSize * progress * 18 + flashSize * 0.15, 32]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.3 * Math.pow(1 - progress / 0.20, 2)} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Volumetric smoke cloud — expands from burst center */}
      {progress > 0.35 && (
        <>
          <SmokeTrail
            position={[0, 0, 0]}
            progress={(progress - 0.35) / 0.65}
            intensity={0.8}
            color={color}
            caliber={caliber}
          />
          {/* Expanding volumetric smoke sphere */}
          <mesh renderOrder={45}>
            <sphereGeometry args={[
              (caliber * 0.8 + 1.5) * Math.min(1, (progress - 0.35) / 0.3) * 3,
              12, 12
            ]} />
            <meshBasicMaterial
              color={_smokeBlendResult.copy(_smokeBlendColor.set(color).lerp(_smokeGrayTarget, 0.7))}
              transparent
              opacity={0.04 * Math.pow(Math.max(0, 1 - (progress - 0.35) / 0.65), 1.5)}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
          {/* Secondary smoke wisps rising */}
          {progress > 0.5 && (
            <mesh position={[0, (progress - 0.5) * caliber * 2, 0]} renderOrder={44}>
              <sphereGeometry args={[
                (caliber * 0.5 + 1) * Math.min(1, (progress - 0.5) / 0.2) * 2,
                8, 8
              ]} />
              <meshBasicMaterial
                color="#665544"
                transparent
                opacity={0.025 * Math.pow(Math.max(0, 1 - (progress - 0.5) / 0.5), 2)}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
          )}
        </>
      )}
      {/* Ember particles — falling hot debris with glow trail */}
      {progress > 0.25 && (
        <EmberParticles
          position={[0, 0, 0]}
          color={color}
          progress={(progress - 0.25) / 0.75}
          spreadRadius={caliber * 3.5}
          startHeight={0}
        />
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

  // Update frustum once per render (not per-burst)
  updateFrustum(camera);

  return (
    <>
      {cappedEffects.map(({ item, effect, progress, inPrefire, prefireProgress, caliber, resolvedPos, effectScale, effectBrightness, launchHeading, launchPitch }) => {
        const effectPos: [number, number, number] = [resolvedPos.x, resolvedPos.y, resolvedPos.z];
        const pt = effect.partType;
        const patternStr = String(pt || '');
        const isTrailing = patternStr === 'willow' || patternStr === 'kamuro' || patternStr === 'brocade' || patternStr === 'palm';
        const cullRadius = effect.type === 'firework' ? (caliber || 4) * (isTrailing ? 40 : 25) : 50;
        if (!isSphereInFrustum(effectPos[0], effectPos[1], effectPos[2], cullRadius)) return null;
        const pos: [number, number, number] = [resolvedPos.x, resolvedPos.y, resolvedPos.z];
        const eid = effect.id;

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
        
        // GC-free: reuse pre-allocated singletons (synchronous per-burst, safe)
        _rPosEuler.set(0, -posHeadingRad, 0, 'YZX');
        _rPosQuat.setFromEuler(_rPosEuler);
        _rPitchAxis.set(1, 0, 0).applyQuaternion(_rPosQuat);
        _rPitchQuat.setFromAxisAngle(_rPitchAxis, -(Math.PI / 2 - posPitchRad));
        _rPosQuat.multiply(_rPitchQuat);
        
        _rEffEuler.set(effTilt, effPan - Math.PI / 2, 0, 'YXZ');
        _rEffQuat.setFromEuler(_rEffEuler);
        
        _rPosQuat.multiply(_rEffQuat);
        _rLaunchDir.set(0, 1, 0).applyQuaternion(_rPosQuat).normalize();
        
        const burstPos: [number, number, number] = isShell
          ? [
              pos[0] + _rLaunchDir.x * realBreakHeight,
              pos[1] + _rLaunchDir.y * realBreakHeight,
              pos[2] + _rLaunchDir.z * realBreakHeight,
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

        if (pt === 'mine') return <MineEffect key={item.id} position={pos} color={effect.color} progress={progress} caliber={caliber} angleOffset={vdlAngle} heightMeters={effect.heightMeters} formulationId={effFormulationId} launchHeading={launchHeading} launchPitch={launchPitch} />;
        if (pt === 'candle') return <RomanCandleEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 8} caliber={caliber} angleOffset={vdlAngle} formulationId={effFormulationId} launchHeading={launchHeading} launchPitch={launchPitch} />;
        if (pt === 'waterfall') return <WaterfallEffect key={item.id} position={pos} color={effect.color} progress={progress} width={scaledHeight} caliber={caliber} formulationId={effFormulationId} />;
        if (pt === 'gerb') return <GerbEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} caliber={caliber} formulationId={effFormulationId} />;
        if (pt === 'flame') return <FlameEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'girandola') return <GirandolaEffect key={item.id} position={pos} color={effect.color} progress={progress} caliber={caliber} />;
        if (pt === 'cake') return <CakeEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 25} pattern={vdlFiringPattern} caliber={caliber} formulationId={effFormulationId} launchHeading={launchHeading} launchPitch={launchPitch} />;
        if (pt === 'laser') return <LaserEffect key={item.id} position={pos} color={effect.color} progress={progress} pattern={effect.laserPattern || 'fan'} beamCount={effect.beamCount || 8} />;
        if (pt === 'light' && effect.beamType) return <MovingHeadEffect key={item.id} position={pos} color={effect.color} progress={progress} beamType={effect.beamType} />;

        if (eid === 'sfx-01') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 6} />;
        if (eid === 'sfx-02') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 8} horizontal />;
        if (eid === 'sfx-06' || eid === 'sfx-07') return <ConfettiEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (eid === 'sfx-08') return <FogMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={8 + (scaledHeight || 4)} />;
        if (eid === 'sfx-09') return <HazeMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} radius={16 + (scaledHeight || 4)} />;
        if (eid === 'sfx-10') return <SnowMachineEffect key={item.id} position={pos} progress={progress} width={6 + (scaledHeight || 4)} height={Math.max(6, (scaledHeight || 8) * 1.2)} />;
        if (eid === 'sfx-11') return <BubbleMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={6 + (scaledHeight || 3)} />;

        if (eid.startsWith('comet-')) return <CometEffect key={item.id} position={pos} color={effect.color} progress={progress} direction={eid === 'comet-02' ? 'down' : 'up'} caliber={caliber} angleOffset={vdlAngle} formulationId={effFormulationId} launchHeading={launchHeading} launchPitch={launchPitch} />;
        if (eid.startsWith('mburst-')) return <MultiBurstEffect key={item.id} position={burstPos} color={effect.color} progress={progress} burstCount={eid === 'mburst-02' ? 5 : 3} caliber={caliber} />;
        if (eid.startsWith('fan-')) return <FanEffect key={item.id} position={pos} color={effect.color} progress={progress} spreadAngle={eid === 'fan-02' ? 180 : 90} caliber={caliber} formulationId={effFormulationId} launchHeading={launchHeading} launchPitch={launchPitch} />;

        if (pt === 'rocket') return (
          <group key={item.id}>
            {prefireProgress < 1 && (
              <RocketEffect position={pos} color={effect.color} progress={prefireProgress} caliber={caliber} />
            )}
            {progress > 0 && (
              <FireworkBurst
                position={burstPos} color={effect.color} progress={progress} caliber={caliber}
                pattern={effect.pattern || 'peony'} angleOffset={vdlAngle} trailType={vdlTrailType}
                noTrail={vdlNoTrail} secondaryColor={vdlSecondaryColor} colorTransition={vdlColorTransition}
                hasPistil={vdlHasPistil} pistilColor={vdlPistilColor} niagaraProfile={effect.niagaraProfile}
              />
            )}
          </group>
        );


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
