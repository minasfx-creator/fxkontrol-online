import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import React, { useRef, useMemo, useEffect, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { PerfCollector, PerformanceHUD, type PerfStats } from './PerformanceHUD';
import ViewportTerminal, { pushLog } from './ViewportTerminal';
import * as THREE from 'three';
import PositionPins from './PositionPins';
import PyroLaunchAngles from './PyroLaunchAngle';
import PostProcessing from './PostProcessing';
import { BoxSelectR3F } from './BoxSelectOverlay';
import AlignmentTools from './AlignmentTools';
import CameraAnimator, { CameraPathPreview } from './CameraAnimator';
import TrajectoryPaths from './TrajectoryPaths';
import DroneChoreography from './DroneChoreography';
import Rack3DView from './Rack3DView';
import BoidsVisualizer from './BoidsVisualizer';
import CollisionAvoidanceOverlay from './CollisionAvoidanceOverlay';
import AudioSpectrumVisualizer from './AudioSpectrumVisualizer';
import { DEFAULT_AVOIDANCE } from '@/lib/collisionAvoidance';
import QuadcopterModel from './QuadcopterModel';
// GeofenceVisual removed — green squares issue
import { Camera, Eye, Video, Plane, Users, Maximize, Minimize, AlertTriangle, Globe, Download, ScanEye, Cog, Paintbrush, MapPinned, Film, ChevronDown } from 'lucide-react';
import SelectionStatusBar from './SelectionStatusBar';
import { cn } from '@/lib/utils';
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
} from './effects';
import { getLiftTime, getBreakHeight, getBreakSpeed } from '@/lib/pyroPhysics';
import { parseVDL, vdlToEffect } from '@/lib/vdlParser';
import { temporalFlicker } from '@/lib/pyroNoise';
// MiniMap removed per user request
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLiveSfxStore } from '@/store/useLiveSfxStore';
// ═══ render_ultra integrations — Blender/Cycles-grade tech ═══
import { createExposureController, updateExposure, flashEvent } from '@/render_ultra/postprocessing/exposure';
import { getCompound, thermalColor, type ChemicalCompound } from '@/render_ultra/fireworks/particleChemistry';
import { GlobalIlluminationSystem } from '@/render_ultra/lighting/globalIllumination';
import { SmokeSystem } from '@/render_ultra/fireworks/smokeSimulation';
import { createLensFlareSprite, flashLensFlare, decayLensFlare } from '@/render_ultra/postprocessing/lensFlare';
import { getBurstConfig, type BurstPattern } from '@/render_ultra/fireworks/burstSimulation';
import { createSparkTrailSystem, updateSparkTrail, writeSparkTrailsToBuffers, type SparkState } from '@/render_ultra/fireworks/sparkTrailsGPU';
import { createHDRLightingRig } from '@/render_ultra/lighting/hdrLighting';
// ═══ LOD System — distance-based quality scaling ═══
import { useLOD, calculateLOD, useSceneLOD, type LODFactors } from '@/hooks/useLOD';
import ViewportGeoTools, { type GeoToolMode, type GeoMarker, type GeoRulerPoint, type GeoPath } from './ViewportGeoTools';
import { GeoToolsScene, GeoToolClickHandler } from './GeoToolsR3F';

// ═══ PyroChem: map hex colors → real chemical compounds ═══
function hexToCompound(hexColor: string): ChemicalCompound {
  const c = new THREE.Color(hexColor);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const h = hsl.h * 360;
  
  // Map hue ranges to real pyrotechnic compounds
  if (hsl.l > 0.85) return getCompound('magnesium');     // White/silver → Magnalium
  if (hsl.l > 0.7 && hsl.s < 0.2) return getCompound('titanium'); // Bright white → Titanium
  if (h >= 0 && h < 30) return getCompound('strontium');   // Red → Strontium Carbonate
  if (h >= 30 && h < 55) return getCompound('iron');        // Orange → Iron filings
  if (h >= 55 && h < 75) return getCompound('sodium');      // Yellow → Sodium Oxalate
  if (h >= 75 && h < 170) return getCompound('barium');     // Green → Barium Chlorate
  if (h >= 170 && h < 260) return getCompound('copper');    // Blue → Copper Acetoarsenite
  if (h >= 260 && h < 310) return getCompound('strontium'); // Purple → Strontium + Copper mix
  if (h >= 310 && h < 345) return getCompound('strontium'); // Magenta/Pink → Strontium
  return getCompound('charcoal');                            // Fallback → Charcoal streamer
}

// lumaTonemapScale REMOVED — PostProcessing ACES Filmic is the single tonemap pass

// FX KONTROL — Show Design Platform Renderer
class WebGLErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('WebGL unavailable:', error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-0 gap-3 p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-yellow-500" />
          <h3 className="text-sm font-semibold text-foreground">3D Engine Unavailable</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            WebGL could not be initialized. Try enabling hardware acceleration or use a different browser.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Camera presets calibrated for real-world firework heights (55m-300m break heights)
// Audience distance: typically 100-300m from launch site (NFPA 1123)
const CAMERA_PRESETS = [
  { id: 'free', label: 'Free', icon: Eye, position: [0, 25, 400] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'satellite', label: 'Top', icon: Plane, position: [0, 1200, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 3, 500] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'front', label: 'Front', icon: Users, position: [0, 8, 600] as [number, number, number], target: [0, 120, 0] as [number, number, number] },
  { id: 'side', label: 'Side', icon: Video, position: [600, 50, 0] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'back', label: 'Back', icon: Video, position: [0, 50, -400] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aerial 45°', icon: Plane, position: [0, 600, 600] as [number, number, number], target: [0, 60, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [30, 40, 150] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'cinematic', label: 'Cinema', icon: Video, position: [-150, 12, 450] as [number, number, number], target: [0, 120, 0] as [number, number, number] },
  { id: 'drone-follow', label: 'Drone POV', icon: Eye, position: [25, 180, 60] as [number, number, number], target: [0, 120, 0] as [number, number, number] },
  { id: 'vip', label: 'VIP Box', icon: Users, position: [100, 8, 400] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
] as const;

// --- Playback clock ---
function PlaybackClock() {
  const { isPlaying, currentTime, duration, setCurrentTime, setPlaying, playbackSpeed } = useProjectStore();
  const prevTime = useRef(performance.now());

  useFrame(() => {
    const now = performance.now();
    if (isPlaying) {
      const delta = ((now - prevTime.current) / 1000) * playbackSpeed;
      const next = currentTime + delta;
      if (next >= duration) { setCurrentTime(duration); setPlaying(false); } else { setCurrentTime(next); }
    }
    prevTime.current = now;
  });
  return null;
}

// --- Particle system ---
const GRAVITY = -9.81; // Real-world gravity for accurate ballistics

// Module-level ref for sky scatter uniforms (shared between SkyGradient and AdaptiveExposureController)
let _skyScatterUniforms: { uExplosionScatter: { value: THREE.Color }; uScatterIntensity: { value: number } } | null = null;

function getWindForce(): [number, number, number] {
  const { wind } = useProjectStore.getState();
  if (!wind.enabled) return [0, 0, 0];
  const rad = (wind.direction * Math.PI) / 180;
  const gust = 1 + (Math.sin(performance.now() * 0.001) * 0.5 + 0.5) * wind.gustStrength;
  const s = wind.speed * gust * 0.15;
  return [Math.sin(rad) * s, 0, Math.cos(rad) * s];
}

// ═══════════════════════════════════════════════════════════════════════
// Niagara-inspired star sprite shaders
// - Gaussian core with exponential falloff
// - Thermal color pipeline (white-hot → saturated → ember)
// - Per-particle noise-driven twinkle
// - Size attenuation with distance
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
    gl_PointSize = aSize * (1600.0 / -mvPos.z);
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
    
    // Niagara-style layered glow: tight bright core + soft halo
    float core = exp(-dist * dist * 80.0);
    float inner = exp(-dist * dist * 25.0);
    float outer = exp(-dist * dist * 8.0);
    
    float alpha = core * 1.0 + inner * 0.7 + outer * 0.15;
    
    // Thermal color model: white-hot center fading to star color
    vec3 whiteHot = vec3(1.18, 1.08, 0.90);
    vec3 col = mix(vColor, whiteHot, core * 0.45);
    col += vColor * outer * 0.35;
    
    // Youth flash
    float youth = max(0.0, 1.0 - vLife * 4.0);
    col += mix(vColor, whiteHot, 0.4) * youth * 0.35;
    
    float edge = 1.0 - smoothstep(0.42, 0.5, dist);

    // No manual tonemap — ACES Filmic in PostProcessing handles HDR→SDR
    gl_FragColor = vec4(col, alpha * edge);
  }
`;

// ═══ Star material factory — creates fresh material per Canvas lifecycle ═══
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
// Niagara-inspired FireworkBurst:
// - Custom star sprite shader (gaussian glow discs)
// - Analytical exponential drag integration
// - Thermal color pipeline: white-hot → saturated → ember
// - No smoke — clean particle rendering like Niagara
// - Caliber-proportional star count, size, and lifetime
// ═══════════════════════════════════════════════════════════════════════
const FireworkBurst = React.forwardRef<THREE.Group, { 
  position: [number, number, number]; color: string; progress: number; 
  caliber?: number; pattern?: string;
}>(function FireworkBurst({ 
  position, color, progress, caliber = 4, pattern = 'peony' 
}, _ref) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  
  // ═══ LOD — reduce particles & trails at distance ═══
  const lod = useLOD(position);
  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const particleDensity = useSceneStore(st => st.settings.particleDensity);

  // Niagara-style: particle count scales with shell volume, LOD and quality preset
  // Conservative caps prevent WebGL context loss on dense timelines
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
  
  // Real break speed from pyroPhysics — caliber proportional (m/s)
  const breakSpeed = useMemo(() => getBreakSpeed(caliber), [caliber]);
  
  // ═══ Burst Simulation Config — calibrated per pattern ═══
  const burstCfg = useMemo(() => getBurstConfig((pattern || 'peony') as BurstPattern), [pattern]);
  const gravityMult = burstCfg?.gravityMult ?? 1.0;
  const tailFactor = burstCfg?.tailFactor ?? 1.0;
  
  // ── Star lifetime calibrated to real pyro data ──
  // 3" = 1.5-2s, 4" = 2-2.5s, 6" = 3-4s, 8" = 4-5s, 10" = 5-7s, 12" = 6-8s
  const starLife = useMemo(() => {
    const baseLife = caliber <= 3 ? 1.6
      : caliber <= 4 ? 2.2
      : caliber <= 5 ? 2.8
      : caliber <= 6 ? 3.5
      : caliber <= 8 ? 4.5
      : caliber <= 10 ? 6.0
      : 7.5;
    if (pattern === 'willow' || pattern === 'kamuro') return baseLife * 2.2;
    if (pattern === 'palm' || pattern === 'brocade') return baseLife * 1.6;
    if (pattern === 'chrysanthemum') return baseLife * 1.2;
    if (pattern === 'dahlia') return baseLife * 0.5;
    return baseLife;
  }, [caliber, pattern]);
  
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  // ═══ PyroChem: resolve chemical compound from color ═══
  const compound = useMemo(() => hexToCompound(color), [color]);
  const emberColor = useMemo(() => {
    const c = new THREE.Color(color);
    return new THREE.Color().setHSL(
      Math.min(c.getHSL({ h: 0, s: 0, l: 0 }).h, 0.06),
      0.85,
      0.12
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
      // Niagara-style: velocity varies with cubic curve for natural spread
      const speedVar = Math.pow(0.4 + Math.random() * 0.6, 0.7);
      tp[i] = Math.random() * Math.PI * 2;
      sparkle[i] = Math.random() * 999 + i;

      const sx = Math.sin(phi) * Math.cos(theta);
      const sy = Math.cos(phi);
      const sz = Math.sin(phi) * Math.sin(theta);

      switch (pattern) {
        case 'willow':
          vx = sx * breakSpeed * 0.42 * speedVar;
          vy = sy * breakSpeed * 0.42 * speedVar;
          vz = sz * breakSpeed * 0.42 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.4);
          break;
        case 'palm':
          vx = sx * breakSpeed * 0.52 * speedVar;
          vy = Math.abs(sy) * breakSpeed * 0.85 + breakSpeed * 0.45;
          vz = sz * breakSpeed * 0.52 * speedVar;
          life = starLife * (1.1 + Math.random() * 0.6);
          break;
        case 'chrysanthemum':
          vx = sx * breakSpeed * speedVar;
          vy = sy * breakSpeed * 0.93 * speedVar;
          vz = sz * breakSpeed * speedVar;
          life = starLife * (0.85 + Math.random() * 0.3);
          break;
        case 'kamuro':
          vx = sx * breakSpeed * 0.35 * speedVar;
          vy = sy * breakSpeed * 0.35 * speedVar + 1.2;
          vz = sz * breakSpeed * 0.35 * speedVar;
          life = starLife * (1.8 + Math.random() * 1.8);
          break;
        case 'ring':
          vx = Math.cos(theta) * breakSpeed * speedVar;
          vy = (Math.random() - 0.5) * breakSpeed * 0.08;
          vz = Math.sin(theta) * breakSpeed * speedVar;
          break;
        case 'dahlia':
          vx = sx * breakSpeed * 1.25 * speedVar;
          vy = sy * breakSpeed * 1.18 * speedVar;
          vz = sz * breakSpeed * 1.25 * speedVar;
          life = starLife * (0.35 + Math.random() * 0.25);
          break;
        case 'brocade':
          vx = sx * breakSpeed * 0.58 * speedVar;
          vy = sy * breakSpeed * 0.58 * speedVar;
          vz = sz * breakSpeed * 0.58 * speedVar;
          life = starLife * (1.3 + Math.random() * 1.0);
          break;
        case 'crossette': {
          const arm = i % 6;
          const armTheta = (arm / 6) * Math.PI * 2;
          const armPhi = Math.PI * 0.45;
          const jitter = 0.12;
          vx = Math.sin(armPhi) * Math.cos(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          vy = Math.cos(armPhi + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          vz = Math.sin(armPhi) * Math.sin(armTheta + (Math.random() - 0.5) * jitter) * breakSpeed * 0.82;
          break;
        }
        default: // peony
          vx = sx * breakSpeed * speedVar;
          vy = sy * breakSpeed * speedVar * 0.9 + 0.6;
          vz = sz * breakSpeed * speedVar;
          break;
      }

      v[i * 3] = vx;
      v[i * 3 + 1] = vy;
      v[i * 3 + 2] = vz;
      l[i] = life;
    }

    return {
      velocities: v,
      lifetimes: l,
      twinklePhases: tp,
      sparkleSeeds: sparkle,
    };
  }, [STAR_COUNT, breakSpeed, starLife, pattern]);

  // Pre-allocate typed arrays for per-frame updates (recreated only when STAR_COUNT/TRAIL_LENGTH changes)
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

  // Star material — recreates after WebGL context recovery
  const starMaterial = useMemo(() => _sharedStarMaterial(), [_starMaterialVersion]);

  // ═══ CLEANUP: dispose GPU resources on unmount to prevent context loss ═══
  useEffect(() => {
    return () => {
      if (pointsRef.current) {
        pointsRef.current.geometry.dispose();
      }
      if (trailRef.current) {
        trailRef.current.geometry.dispose();
        if (trailRef.current.material instanceof THREE.Material) {
          trailRef.current.material.dispose();
        }
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
    
    // ── Caliber-specific drag (real pyro data) ──
    // Small shells (3"): lighter stars, more air resistance → higher drag
    // Large shells (10-12"): heavier stars, less relative drag
    // Reference: 3"=0.065, 4"=0.055, 6"=0.042, 8"=0.035, 10"=0.028, 12"=0.024
    const dragCoeff = caliber <= 3 ? 0.065
      : caliber <= 4 ? 0.055
      : caliber <= 5 ? 0.048
      : caliber <= 6 ? 0.042
      : caliber <= 8 ? 0.035
      : caliber <= 10 ? 0.028
      : 0.024;
    const isTrailingPattern = pattern === 'willow' || pattern === 'kamuro' || pattern === 'brocade' || pattern === 'palm';
    
    
    
    // Particle size: caliber-proportional — real world visibility at distance
    // 3" stars are small & fast-fading, 12" stars are large & bright
    const baseSize = caliber <= 3 ? 0.4
      : caliber <= 4 ? 0.6
      : caliber <= 6 ? 0.9
      : caliber <= 8 ? 1.2
      : caliber <= 10 ? 1.5
      : 1.8;
    
    // Helper: proper analytical position for exponential drag
    // With drag a = -k*v, velocity v(t) = v0 * e^(-k*t)
    // Position x(t) = v0 * (1 - e^(-k*t)) / k
    const dragPos = (v0: number, t: number, k: number) => {
      if (k < 0.001) return v0 * t;
      return v0 * (1 - Math.exp(-k * t)) / k;
    };

    for (let i = 0; i < STAR_COUNT; i++) {
      const vx = velocities[i * 3], vy = velocities[i * 3 + 1], vz = velocities[i * 3 + 2];
      const lt = lifetimes[i];
      const starAge = Math.min(1, t / lt);
      
      // Niagara-style fade curve: fast burn at start, slow ember fade at end
      const fade = Math.max(0, 1 - starAge);
      const fadeSmooth = fade * fade * (3 - 2 * fade); // smoothstep curve
      const fadeCubed = fade * fade * fade;
      
      // Analytical position with drag + gravity + wind
      const px = dragPos(vx, t, dragCoeff) + w[0] * t * t * 0.3;
      const py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * gravityMult * t * t;
      const pz = dragPos(vz, t, dragCoeff) + w[2] * t * t * 0.3;
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;

      // === Niagara Thermal Color Pipeline ===
      // Phase 1: White-hot flash (0-5% life)
      const flashIntensity = Math.max(0, 1 - starAge * 20);
      // Phase 2: Full saturated color (5-50% life)
      // Phase 3: Thermal decay to ember (50-100% life)
      const emberPhase = Math.max(0, (starAge - 0.45) / 0.55);
      
      // ═══ PyroChem Thermal Color Pipeline ═══
      // thermalColor returns HDR values (emissionIntensity up to 10x).
      // We must tonemap before using as vertex colors to prevent white-out.
      const lifeRatio = 1 - starAge; // thermalColor expects 1=birth, 0=dead
      // HDR mult reduced: ACES Filmic PostProcessing is the single tonemap
      const chemColor = thermalColor(compound, lifeRatio, 1.0);
      const chemR = chemColor.r;
      const chemG = chemColor.g;
      const chemB = chemColor.b;
      
      // Per-star twinkle — organic shimmer
      let twinkle: number;
      if (isTrailingPattern) {
        twinkle = 0.8 + Math.sin(twinklePhases[i] + starAge * 15) * 0.2;
      } else {
        twinkle = temporalFlicker(sparkleSeeds[i], time, 0.65, 0.30, 0.35);
      }
      
      // Blend tonemapped chemical color with user color (70% chem, 30% user)
      const userFade = 1 - starAge;
      const r = THREE.MathUtils.lerp(baseColor.r * userFade, chemR, 0.7);
      const g = THREE.MathUtils.lerp(baseColor.g * userFade, chemG, 0.7);
      const b = THREE.MathUtils.lerp(baseColor.b * userFade, chemB, 0.7);
      
      cols[i * 3] = r * twinkle;
      cols[i * 3 + 1] = g * twinkle;
      cols[i * 3 + 2] = b * twinkle;
      
      // Size over lifetime: Niagara curve — burst large, steady, then shrink
      const sizeOverLife = starAge < 0.05 
        ? 0.6 + starAge * 8  // rapid expansion
        : starAge < 0.4 
          ? 1.0  // steady plateau
          : 1.0 - (starAge - 0.4) / 0.6 * 0.7; // gradual shrink
      sizes[i] = baseSize * Math.max(0.1, sizeOverLife) * (1 + flashIntensity * 0.8);
      lives[i] = starAge;

      // Star trails — Finale's thermal gradient: white-hot → colored → dim
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
        
        // Finale trail thermal: white center → warm gold → colored → faint
        const trailWarmth = Math.pow(segFrac, 0.4);
        tCol[base2] = THREE.MathUtils.lerp(0.9, r * 0.75, trailWarmth) * segFade;
        tCol[base2 + 1] = THREE.MathUtils.lerp(0.55, g * 0.5, trailWarmth) * segFade;
        tCol[base2 + 2] = THREE.MathUtils.lerp(0.25, b * 0.2, trailWarmth) * segFade;
        tCol[base2 + 3] = THREE.MathUtils.lerp(0.9, r * 0.75, trailWarmth) * endFade;
        tCol[base2 + 4] = THREE.MathUtils.lerp(0.55, g * 0.5, trailWarmth) * endFade;
        tCol[base2 + 5] = THREE.MathUtils.lerp(0.25, b * 0.2, trailWarmth) * endFade;
      }
    }

    // === Update star geometry — reuse existing buffer attributes ===
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

  // Break flash: Blender-calibrated — realistic scale, not oversized
  const flashSize = 0.6 + caliber * 0.8;

  return (
    <group position={position}>
      {/* ═══ Finale Star Sprites — custom shader gaussian glow ═══ */}
      <points ref={pointsRef} material={starMaterial} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleBuffers.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleBuffers.colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[particleBuffers.sizes, 1]} />
          <bufferAttribute attach="attributes-aLife" args={[particleBuffers.lives, 1]} />
        </bufferGeometry>
      </points>
      
      {/* ═══ Star trails — dense thermal gradient lines ═══ */}
      <lineSegments ref={trailRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particleBuffers.trailPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleBuffers.trailCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={Math.min(1, 0.8 * tailFactor)} depthWrite={false} blending={THREE.AdditiveBlending} linewidth={3} />
      </lineSegments>
      
      
      {/* ═══ BREAK FLASH — 2-layer system (reduced from 4 for VRAM savings) ═══ */}
      {progress < 0.06 && (
        <mesh renderOrder={100}>
          <sphereGeometry args={[flashSize * 0.4 * (1 + progress * 6), 8, 8]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={0.4 * (1 - progress / 0.06)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {progress < 0.12 && (
        <mesh renderOrder={99}>
          <sphereGeometry args={[flashSize * (1 + progress * 6), 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.15 * Math.pow(1 - progress / 0.12, 2)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
});

function LightPoint({ position, color }: { position: [number, number, number]; color: string }) {
  return <QuadcopterModel position={position} color={color} />;
}

// Max simultaneous GPU-heavy firework bursts to prevent context loss
const MAX_CONCURRENT_BURSTS_DESKTOP = 6;
const MAX_CONCURRENT_BURSTS_MOBILE = 2;
const MAX_STAR_BUDGET_DESKTOP = 1400;
const MAX_STAR_BUDGET_MOBILE = 420;

function estimateFireworkStarCost(effect: (typeof EFFECT_LIBRARY)[number], particleDensity: number) {
  const caliber = Math.max(1, effect.caliber || 4);
  const densityScale = THREE.MathUtils.clamp(particleDensity, 0.5, 2.0);

  // Keep estimation aligned with FireworkBurst STAR_COUNT formula and caps.
  const shellStars = Math.max(24, Math.min(320, Math.round((60 + caliber * caliber * 10) * densityScale)));
  let stars = shellStars;

  if (effect.partType === 'cake') stars *= 1.2;
  else if (effect.partType === 'candle') stars *= 0.8;
  else if (effect.partType === 'mine') stars *= 0.9;
  else if (effect.partType === 'waterfall') stars *= 0.6;

  if (effect.id.startsWith('mburst-')) stars *= effect.id === 'mburst-02' ? 3.2 : 2.4;

  return Math.max(32, Math.round(stars));
}

function TimelineEffects() {
  const { timelineItems, currentTime, positions } = useProjectStore();
  const sceneSettings = useSceneStore(st => st.settings);
  const activeEffects = useMemo(() => {
    const effectScale = sceneSettings.effectScale;
    const weatherDampening = sceneSettings.weather === 'heavy-rain' ? 0.6 :
      sceneSettings.weather === 'light-rain' ? 0.8 :
      sceneSettings.weather === 'fog' ? 0.7 : 1.0;
    const humidityFactor = 1 - sceneSettings.humidity * 0.3; // humidity shortens burn time

    return timelineItems.map((item) => {
      let effect = EFFECT_LIBRARY.find((e) => e.id === item.effectId);

      // Fallback para itens VDL dinâmicos criados no editor/quick add
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

      if (!effect) return null;

      // ── Resolve position from linked pyropoint ──
      let resolvedPos = item.position;
      let launchHeading = 0;
      let launchPitch = 85; // default vertical
      if (item.positionId) {
        const linkedPos = positions.find(p => p.id === item.positionId);
        if (linkedPos) {
          resolvedPos = { x: linkedPos.x, y: linkedPos.y, z: linkedPos.z };
          launchHeading = linkedPos.heading || 0;
          launchPitch = linkedPos.pitch || 85;
        }
      }

      // ── Real physics: caliber-based heights ──
      const caliber = effect.caliber || 4;
      const isShellType = effect.partType === 'shell' || effect.partType === 'single_shot' || effect.type === 'firework';
      const prefireDuration = isShellType ? (effect.prefire || getLiftTime(caliber)) : 0;
      // Weather affects duration: rain shortens, humidity shortens
      const weatherDuration = effect.duration * weatherDampening * humidityFactor;
      const totalDuration = prefireDuration + weatherDuration;

      if (currentTime < item.startTime || currentTime > item.startTime + totalDuration) return null;
      const elapsed = currentTime - item.startTime;

      const inPrefire = isShellType && elapsed < prefireDuration;
      const prefireProgress = prefireDuration > 0 ? Math.min(1, elapsed / prefireDuration) : 0;
      const burstProgress = prefireDuration > 0
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

  // Cap simultaneous firework bursts to prevent GPU context loss
  const cappedEffects = useMemo(() => {
    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
    const maxConcurrentBursts = isMobileViewport ? MAX_CONCURRENT_BURSTS_MOBILE : MAX_CONCURRENT_BURSTS_DESKTOP;
    const maxStarBudget = isMobileViewport ? MAX_STAR_BUDGET_MOBILE : MAX_STAR_BUDGET_DESKTOP;

    let burstCount = 0;
    let usedStarBudget = 0;

    return activeEffects.filter(({ effect }) => {
      if (effect.type !== 'firework') return true;

      const estimatedStars = estimateFireworkStarCost(effect, sceneSettings.particleDensity);
      const exceedsCount = burstCount >= maxConcurrentBursts;
      const exceedsBudget = usedStarBudget + estimatedStars > maxStarBudget;

      if (exceedsCount || exceedsBudget) return false;

      burstCount++;
      usedStarBudget += estimatedStars;
      return true;
    });
  }, [activeEffects, sceneSettings.particleDensity]);

  return (
    <>
      {cappedEffects.map(({ item, effect, progress, inPrefire, prefireProgress, caliber, resolvedPos, effectScale, effectBrightness, launchHeading, launchPitch }) => {
        const pos: [number, number, number] = [resolvedPos.x, resolvedPos.y, resolvedPos.z];
        const eid = effect.id;
        const pt = effect.partType;

        // ── PREFIRE PHASE: show comet trail rising from mortar ──
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

        // ── Real break height with angle offset (Finale 3D standard) ──
        const isShell = pt === 'shell' || pt === 'single_shot';
        const realBreakHeight = getBreakHeight(caliber) * effectScale;
        const pitchRad = (launchPitch || 85) * (Math.PI / 180);
        const headingRad = (launchHeading || 0) * (Math.PI / 180);
        const burstPos: [number, number, number] = isShell
          ? [
              pos[0] + Math.sin(headingRad) * Math.cos(pitchRad) * realBreakHeight,
              pos[1] + Math.sin(pitchRad) * realBreakHeight,
              pos[2] - Math.cos(headingRad) * Math.cos(pitchRad) * realBreakHeight,
            ]
          : pos;

        const scaledHeight = (effect.heightMeters || 4) * effectScale;

        if (pt === 'mine') return <MineEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (pt === 'candle') return <RomanCandleEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 8} />;
        if (pt === 'waterfall') return <WaterfallEffect key={item.id} position={pos} color={effect.color} progress={progress} width={scaledHeight} />;
        if (pt === 'gerb') return <GerbEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'flame') return <FlameEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'cake') return <CakeEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 25} />;
        if (pt === 'laser') return <LaserEffect key={item.id} position={pos} color={effect.color} progress={progress} pattern={effect.laserPattern || 'fan'} beamCount={effect.beamCount || 8} />;
        if (pt === 'light' && effect.beamType) return <MovingHeadEffect key={item.id} position={pos} color={effect.color} progress={progress} beamType={effect.beamType} />;

        if (eid === 'sfx-01') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 6} />;
        if (eid === 'sfx-02') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 8} horizontal />;
        if (eid === 'sfx-06' || eid === 'sfx-07') return <ConfettiEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (eid === 'sfx-08') return <FogMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={8 + (scaledHeight || 4)} />;
        if (eid === 'sfx-09') return <HazeMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} radius={16 + (scaledHeight || 4)} />;
        if (eid === 'sfx-10') return <SnowMachineEffect key={item.id} position={pos} progress={progress} width={6 + (scaledHeight || 4)} height={Math.max(6, (scaledHeight || 8) * 1.2)} />;
        if (eid === 'sfx-11') return <BubbleMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={6 + (scaledHeight || 3)} />;

        if (eid.startsWith('comet-')) return <CometEffect key={item.id} position={pos} color={effect.color} progress={progress} direction={eid === 'comet-02' ? 'down' : 'up'} />;
        if (eid.startsWith('mburst-')) return <MultiBurstEffect key={item.id} position={burstPos} color={effect.color} progress={progress} burstCount={eid === 'mburst-02' ? 5 : 3} />;
        if (eid.startsWith('fan-')) return <FanEffect key={item.id} position={pos} color={effect.color} progress={progress} spreadAngle={eid === 'fan-02' ? 180 : 90} />;

        if (effect.type === 'firework') return (
          <FireworkBurst 
            key={item.id}
            position={burstPos} 
            color={effect.color} 
            progress={progress} 
            caliber={caliber}
            pattern={effect.pattern || 'peony'}
          />
        );
        return <LightPoint key={item.id} position={pos} color={effect.color} />;
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Live SFX 3D — renders effects fired from the Live SFX Console
// ═══════════════════════════════════════════════════════════════════════
function LiveSFXEffects() {
  const activeEffects = useLiveSfxStore((s) => s.activeEffects);
  const stopEffect = useLiveSfxStore((s) => s.stopEffect);
  const frameRef = useRef(0);

  useFrame(() => {
    if (activeEffects.length === 0) return;
    frameRef.current++;
    // Clean up expired effects (only check every 10 frames to avoid store churn)
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
}

// ========================================================================
// GOOGLE EARTH-STYLE — Atmospheric sky with realistic horizon
// ========================================================================
function SkyGradient() {
  const skyBrightness = useSceneStore(st => st.settings.skyBrightness);
  const horizonGlow = useSceneStore(st => st.settings.horizonGlow);
  const starDensity = useSceneStore(st => st.settings.starDensity);

  const uniforms = useMemo(() => ({
    uSkyBrightness: { value: skyBrightness },
    uHorizonGlow: { value: horizonGlow },
    uStarDensity: { value: starDensity },
    uTime: { value: 0 },
    uExplosionScatter: { value: new THREE.Color(0, 0, 0) },
    uScatterIntensity: { value: 0 },
  }), []);

  useEffect(() => {
    uniforms.uSkyBrightness.value = skyBrightness;
    uniforms.uHorizonGlow.value = horizonGlow;
    uniforms.uStarDensity.value = starDensity;
  }, [skyBrightness, horizonGlow, starDensity]);

  // Expose scatter uniforms for AdaptiveExposureController
  useEffect(() => {
    _skyScatterUniforms = { uExplosionScatter: uniforms.uExplosionScatter, uScatterIntensity: uniforms.uScatterIntensity };
    return () => { _skyScatterUniforms = null; };
  }, []);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh renderOrder={-1000}>
      <sphereGeometry args={[9000, 64, 64]} />
      <shaderMaterial
        side={THREE.BackSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorldPosition;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uSkyBrightness;
          uniform float uHorizonGlow;
          uniform float uStarDensity;
          uniform float uTime;
          uniform vec3 uExplosionScatter;
          uniform float uScatterIntensity;
          varying vec3 vWorldPosition;
          
          float hash21(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
          }
          
          float noise2d(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash21(i), hash21(i + vec2(1,0)), f.x),
              mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), f.x), f.y
            );
          }
          
          float fbm3(vec2 p) {
            float v = 0.0, a = 0.5;
            for (int i = 0; i < 4; i++) { v += a * noise2d(p); p *= 2.1; a *= 0.45; }
            return v;
          }
          
          float starField(vec3 dir) {
            vec2 uv = vec2(atan(dir.x, dir.z) * 3.183, asin(clamp(dir.y, -1.0, 1.0)) * 6.366);
            vec2 id = floor(uv * 140.0);
            float h = hash21(id);
            float threshold = mix(0.998, 0.972, clamp(uStarDensity, 0.0, 2.0) / 2.0);
            if (h > threshold) {
              vec2 offset = fract(uv * 140.0) - 0.5;
              float brightness = smoothstep(0.12, 0.0, length(offset)) * (0.5 + h * 4.0);
              float twinkle = sin(h * 6283.0 + uTime * (0.5 + h * 2.0)) * 0.35 + 0.65;
              return brightness * twinkle * smoothstep(0.08, 0.35, dir.y);
            }
            return 0.0;
          }
          
          // Shooting stars
          float shootingStar(vec3 dir) {
            float t = uTime * 0.15;
            float star = 0.0;
            for (int i = 0; i < 3; i++) {
              float fi = float(i);
              float phase = fract(t + fi * 0.37);
              if (phase > 0.95) continue; // most of the time hidden
              float startAngle = hash21(vec2(fi, floor(t + fi * 0.37))) * 6.28;
              float startElev = 0.4 + hash21(vec2(fi + 10.0, floor(t + fi * 0.37))) * 0.4;
              vec3 startDir = normalize(vec3(cos(startAngle), startElev, sin(startAngle)));
              vec3 moveDir = normalize(vec3(-0.3, -0.15, 0.1));
              vec3 pos = startDir + moveDir * phase * 0.5;
              float dist = length(cross(dir - startDir, moveDir)) / length(moveDir);
              float along = dot(dir - startDir, moveDir);
              float trail = smoothstep(0.15, 0.0, along) * smoothstep(-0.01, 0.0, along);
              float bright = smoothstep(0.003, 0.0, dist) * trail * (1.0 - phase) * 3.0;
              star += bright;
            }
            return star * smoothstep(0.15, 0.4, dir.y);
          }
          
          void main() {
            vec3 dir = normalize(vWorldPosition);
            float h = dir.y;
            
            // Deep cinematic space — rich midnight blues to warm horizon
            vec3 space     = vec3(0.001, 0.002, 0.012);
            vec3 zenith    = vec3(0.004, 0.008, 0.04);
            vec3 upperSky  = vec3(0.008, 0.018, 0.07);
            vec3 midSky    = vec3(0.02, 0.035, 0.12);
            vec3 lowSky    = vec3(0.04, 0.05, 0.14);
            vec3 horizon   = vec3(0.08, 0.06, 0.12);
            vec3 haze      = vec3(0.12, 0.08, 0.10);
            vec3 ground    = vec3(0.005, 0.005, 0.015);
            
            vec3 color;
            if (h > 0.7) {
              color = mix(upperSky, space, smoothstep(0.7, 1.0, h));
            } else if (h > 0.4) {
              color = mix(midSky, upperSky, smoothstep(0.4, 0.7, h));
            } else if (h > 0.15) {
              color = mix(lowSky, midSky, smoothstep(0.15, 0.4, h));
            } else if (h > 0.02) {
              color = mix(horizon, lowSky, smoothstep(0.02, 0.15, h));
            } else if (h > -0.02) {
              color = mix(haze, horizon, smoothstep(-0.02, 0.02, h));
            } else {
              color = mix(ground, haze, smoothstep(-0.15, -0.02, h));
            }
            
            // Warm amber horizon glow — cinematic sunset afterglow
            float hGlow = exp(-h * h * 50.0);
            color += vec3(0.22, 0.10, 0.04) * hGlow * uHorizonGlow;
            
            // Cool cyan counter-glow opposite side
            float cyanGlow = exp(-(h - 0.05) * (h - 0.05) * 80.0);
            color += vec3(0.02, 0.06, 0.10) * cyanGlow * 0.4;
            
            // Aurora borealis band
            float auroraAngle = dir.x * 0.3 + dir.z * 0.95;
            float auroraBand = exp(-pow(auroraAngle - 0.2, 2.0) * 12.0) * smoothstep(0.2, 0.6, h);
            float auroraWave = sin(dir.x * 8.0 + uTime * 0.3) * 0.5 + 0.5;
            float auroraDetail = fbm3(dir.xz * 20.0 + uTime * 0.05);
            vec3 auroraColor = mix(vec3(0.01, 0.08, 0.04), vec3(0.03, 0.04, 0.10), auroraWave);
            color += auroraColor * auroraBand * auroraDetail * 0.35;
            
            // Enhanced Milky Way with deep structure
            float milkyAngle = dir.x * 0.6 + dir.z * 0.8;
            float milkyBand = exp(-pow(milkyAngle - dir.y * 0.5, 2.0) * 6.0);
            float milkyDetail = fbm3(dir.xz * 30.0) * 0.6 + 0.4;
            float milkyDust = fbm3(dir.xz * 60.0 + 100.0);
            vec3 milkyColor = mix(vec3(0.015, 0.02, 0.045), vec3(0.035, 0.025, 0.045), milkyDust);
            color += milkyColor * milkyBand * milkyDetail * smoothstep(0.15, 0.5, h) * 1.0;
            
            // Dark dust lanes
            float dustLane = smoothstep(0.45, 0.55, fbm3(dir.xz * 20.0 + 50.0));
            color -= vec3(0.01) * milkyBand * dustLane * smoothstep(0.2, 0.5, h);
            
            // Nebula patches — purple and teal
            float nebula1 = fbm3(dir.xz * 15.0 + vec2(200.0, 0.0));
            float nebula2 = fbm3(dir.xz * 12.0 + vec2(0.0, 300.0));
            color += vec3(0.025, 0.008, 0.035) * smoothstep(0.6, 0.8, nebula1) * milkyBand * 0.6;
            color += vec3(0.008, 0.018, 0.035) * smoothstep(0.55, 0.75, nebula2) * smoothstep(0.3, 0.6, h) * 0.5;
            
            // Wispy clouds near horizon
            float cloudUV1 = fbm3(dir.xz * 4.0 + uTime * 0.008);
            float cloudUV2 = fbm3(dir.xz * 8.0 - uTime * 0.006 + 50.0);
            float cloudMask = smoothstep(0.0, 0.12, h) * smoothstep(0.25, 0.08, h);
            float clouds = smoothstep(0.45, 0.7, cloudUV1 * 0.6 + cloudUV2 * 0.4) * cloudMask;
            color += vec3(0.04, 0.04, 0.06) * clouds * 0.3;
            
            // Stars with color temperature variation
            float stars = starField(dir);
            float starHue = hash21(dir.xz * 50.0);
            vec3 starColor = starHue < 0.25 ? vec3(0.6, 0.75, 1.0) :
                             starHue < 0.5 ? vec3(1.0, 0.95, 0.85) :
                             starHue < 0.75 ? vec3(1.0, 0.80, 0.65) :
                             vec3(1.0, 0.55, 0.45);
            color += starColor * stars * 0.9 * uStarDensity;
            
            // Shooting stars
            float shooting = shootingStar(dir);
            color += vec3(0.85, 0.92, 1.0) * shooting * uStarDensity;
            
            // ═══ Explosion sky scatter — atmosphere reflects burst colors ═══
            color += uExplosionScatter * uScatterIntensity * exp(-abs(h) * 3.0);
            
            color *= uSkyBrightness;
            color = max(color, vec3(0.0));
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// --- Volumetric Moon — Blender-calibrated celestial position ---
function Moon() {
  return (
    <group position={[1500, 2800, -2500]}>
      {/* Moon body with procedural surface — radius 12 for proper angular size */}
      <mesh>
        <sphereGeometry args={[90, 64, 64]} />
        <shaderMaterial
          vertexShader={`
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vUv;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              vPosition = position;
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vUv;
            
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p); vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                         mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
            }
            
            void main() {
              vec3 n = normalize(vNormal);
              vec3 lightDir = normalize(vec3(0.3, 0.2, -1.0));
              
              vec3 moonBase = vec3(0.85, 0.82, 0.75);
              
              float craters = noise(vPosition.xy * 0.9) * 0.3 + 
                              noise(vPosition.xz * 1.5) * 0.2 +
                              noise(vPosition.yz * 2.4) * 0.1;
              
              float maria = smoothstep(0.4, 0.6, noise(vPosition.xz * 0.45 + 10.0));
              moonBase = mix(moonBase, vec3(0.55, 0.52, 0.48), maria * 0.3);
              
              float diffuse = max(dot(n, lightDir), 0.0) * 0.6 + 0.4;
              float rim = pow(1.0 - max(dot(n, vec3(0, 0, 1)), 0.0), 3.0);
              
              vec3 color = moonBase * (1.0 - craters * 0.2) * diffuse;
              color += vec3(0.15, 0.18, 0.25) * rim * 0.3;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      {/* Inner glow — proportional to new radius */}
      <mesh>
        <sphereGeometry args={[95, 32, 32]} />
        <meshBasicMaterial color="#d0c8a8" transparent opacity={0.10} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer volumetric halo */}
      <mesh>
        <sphereGeometry args={[160, 32, 32]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.6 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
              vec3 color = vec3(0.3, 0.35, 0.5) * intensity;
              gl_FragColor = vec4(color, intensity * 0.12);
            }
          `}
        />
      </mesh>
      {/* Wide atmospheric scatter */}
      <mesh>
        <sphereGeometry args={[320, 16, 16]} />
        <meshBasicMaterial color="#506080" transparent opacity={0.008} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#8899bb" intensity={0.15} distance={6000} decay={1} />
    </group>
  );
}

// --- Satellite texture ground overlay (real Google Maps imagery) ---
function SatelliteOverlay({ textureUrl }: { textureUrl: string | null }) {
  const texture = useMemo(() => {
    if (!textureUrl) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(textureUrl);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [textureUrl]);

  if (!texture) return null;

  return (
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[300, 300]} />
      <meshBasicMaterial map={texture} transparent={false} />
    </mesh>
  );
}

// --- Google Earth-style satellite terrain ground ---
function GrassGround() {
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    moonDir: { value: new THREE.Vector3(0.5, 0.7, -0.5).normalize() },
    camPos: { value: new THREE.Vector3() },
  }), []);

  useFrame(({ clock, camera }) => {
    uniforms.time.value = clock.getElapsedTime();
    uniforms.camPos.value.copy(camera.position);
  });

  const terrainVertexShader = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 camPos;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      vViewDir = normalize(camPos - wp.xyz);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const terrainFragmentShader = `
    uniform float time;
    uniform vec3 moonDir;
    uniform vec3 camPos;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                 mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.1; a *= 0.48; }
      return v;
    }
    float voronoi(vec2 p) {
      vec2 n = floor(p); vec2 f = fract(p);
      float md = 8.0;
      for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = vec2(hash(n + g), hash(n + g + 42.0));
          vec2 r = g + o - f;
          md = min(md, dot(r, r));
        }
      }
      return sqrt(md);
    }

    void main() {
      vec2 worldUV = vWorldPos.xz;
      
      // Multi-scale terrain
      float large = fbm(worldUV * 0.008);
      float medium = fbm(worldUV * 0.03 + 50.0);
      float fine = fbm(worldUV * 0.15 + 100.0);
      float micro = noise(worldUV * 1.5);
      float roads = voronoi(worldUV * 0.015);
      float parcels = voronoi(worldUV * 0.04);
      
      // Google Earth satellite palette
      vec3 darkForest  = vec3(0.04, 0.09, 0.03);
      vec3 forest      = vec3(0.06, 0.14, 0.04);
      vec3 farmGreen   = vec3(0.10, 0.20, 0.06);
      vec3 fieldGreen  = vec3(0.14, 0.25, 0.08);
      vec3 dryField    = vec3(0.18, 0.17, 0.08);
      vec3 brownEarth  = vec3(0.14, 0.10, 0.05);
      vec3 roadGrey    = vec3(0.12, 0.11, 0.10);
      vec3 urbanGrey   = vec3(0.10, 0.09, 0.08);
      
      // Base terrain blending — agricultural patchwork
      vec3 color = mix(darkForest, forest, smoothstep(0.3, 0.6, large));
      color = mix(color, farmGreen, smoothstep(0.4, 0.65, medium) * 0.7);
      color = mix(color, fieldGreen, smoothstep(0.5, 0.75, fine) * 0.5);
      
      // Agricultural parcels (rectangular patches)
      float parcelEdge = smoothstep(0.05, 0.08, parcels);
      vec3 parcelColor = mix(dryField, farmGreen, step(0.5, hash(floor(worldUV * 0.04))));
      parcelColor = mix(parcelColor, fieldGreen, step(0.7, hash(floor(worldUV * 0.04) + 10.0)));
      color = mix(brownEarth * 0.8, mix(color, parcelColor, 0.4), parcelEdge);
      
      // Roads — thin dark lines along Voronoi edges
      float roadMask = smoothstep(0.02, 0.04, roads);
      color = mix(roadGrey, color, roadMask);
      
      // Sparse built-up areas
      float urbanMask = smoothstep(0.7, 0.85, fbm(worldUV * 0.02 + 300.0));
      color = mix(color, urbanGrey, urbanMask * 0.3);
      
      // Wind ripples on vegetation
      float windWave = sin(worldUV.x * 0.3 + time * 0.4) * cos(worldUV.y * 0.2 + time * 0.3);
      color += vec3(0.008, 0.015, 0.004) * windWave * 0.3;

      // Moonlight lighting
      float NdotL = max(dot(vNormal, moonDir), 0.0);
      float subsurface = max(dot(-vNormal, moonDir), 0.0) * 0.06;
      float ambient = 0.22;
      color *= (NdotL * 0.5 + subsurface + ambient);

      // Specular — wet areas
      vec3 halfDir = normalize(moonDir + vViewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 28.0);
      float wetness = smoothstep(0.6, 0.8, fine) * (1.0 - urbanMask);
      color += vec3(0.03, 0.05, 0.08) * spec * wetness * 0.3;

      // Distance atmosphere — Google Earth blue haze
      float dist = length(worldUV) * 0.0015;
      float fogFactor = smoothstep(0.0, 1.0, dist);
      vec3 atmosphereColor = vec3(0.08, 0.10, 0.18);
      color = mix(color, atmosphereColor, fogFactor * 0.7);
      color *= 1.0 - fogFactor * 0.25;

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // Near-field terrain (performance area) with detailed grass
  const nearFieldFragment = `
    uniform float time;
    uniform vec3 moonDir;
    uniform vec3 camPos;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                 mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
      return v;
    }

    void main() {
      vec2 worldUV = vWorldPos.xz;
      float large = fbm(worldUV * 0.03);
      float fine = noise(worldUV * 5.0);

      vec3 grassA = vec3(0.06, 0.16, 0.04);
      vec3 grassB = vec3(0.10, 0.22, 0.06);
      vec3 color = mix(grassA, grassB, smoothstep(0.3, 0.7, large));
      color += vec3(0.01, 0.025, 0.005) * fine * 0.2;

      // Diamond mowing pattern
      float stripes = sin(worldUV.x * 1.5) * 0.5 + 0.5;
      float crossStripes = sin(worldUV.y * 1.5 + 0.785) * 0.5 + 0.5;
      color = mix(color, color * 1.1, stripes * crossStripes * 0.12);

      float NdotL = max(dot(vNormal, moonDir), 0.0);
      color *= (NdotL * 0.55 + 0.25);

      vec3 halfDir = normalize(moonDir + vViewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 24.0);
      color += vec3(0.03, 0.05, 0.08) * spec * 0.3;

      float edgeDist = length(vWorldPos.xz) / 120.0;
      float edgeFade = smoothstep(0.8, 1.0, edgeDist);
      color = mix(color, vec3(0.05, 0.12, 0.03), edgeFade);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // Unified terrain shader — blends near-field detail into far terrain seamlessly
  const unifiedFragment = `
    uniform float time;
    uniform vec3 moonDir;
    uniform vec3 camPos;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                 mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
    }
    float fbm(vec2 p) {
      float v = 0.0; float a = 0.5;
      for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
      return v;
    }
    float voronoi(vec2 p) {
      vec2 n = floor(p); vec2 f = fract(p);
      float md = 1.0;
      for (int j = -1; j <= 1; j++)
        for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j));
          vec2 o = vec2(hash(n + g), hash(n + g + 37.0));
          vec2 r = g + o - f;
          md = min(md, dot(r, r));
        }
      return sqrt(md);
    }

    void main() {
      vec2 worldUV = vWorldPos.xz;
      float distFromCenter = length(worldUV);
      
      // LOD blend factor: 0 = near (detailed), 1 = far (satellite)
      float lodBlend = smoothstep(200.0, 600.0, distFromCenter);
      
      // === NEAR FIELD: detailed grass with mowing pattern ===
      float largN = fbm(worldUV * 0.03);
      float fineN = noise(worldUV * 5.0);
      vec3 grassA = vec3(0.06, 0.16, 0.04);
      vec3 grassB = vec3(0.10, 0.22, 0.06);
      vec3 nearColor = mix(grassA, grassB, smoothstep(0.3, 0.7, largN));
      nearColor += vec3(0.01, 0.025, 0.005) * fineN * 0.2;
      // Diamond mowing pattern
      float stripes = sin(worldUV.x * 1.5) * 0.5 + 0.5;
      float crossStripes = sin(worldUV.y * 1.5 + 0.785) * 0.5 + 0.5;
      nearColor = mix(nearColor, nearColor * 1.1, stripes * crossStripes * 0.12);
      
      // === FAR FIELD: satellite-style terrain ===
      float large = fbm(worldUV * 0.005);
      float medium = fbm(worldUV * 0.015 + 100.0);
      float fine = noise(worldUV * 0.08);
      float parcels = voronoi(worldUV * 0.008);
      float roads = voronoi(worldUV * 0.003);
      
      vec3 darkForest  = vec3(0.04, 0.07, 0.02);
      vec3 forest      = vec3(0.06, 0.11, 0.04);
      vec3 farmGreen   = vec3(0.08, 0.14, 0.05);
      vec3 fieldGreen  = vec3(0.12, 0.18, 0.06);
      vec3 dryField    = vec3(0.18, 0.17, 0.08);
      vec3 brownEarth  = vec3(0.14, 0.10, 0.05);
      vec3 roadGrey    = vec3(0.12, 0.11, 0.10);
      vec3 urbanGrey   = vec3(0.10, 0.09, 0.08);
      
      vec3 farColor = mix(darkForest, forest, smoothstep(0.3, 0.6, large));
      farColor = mix(farColor, farmGreen, smoothstep(0.4, 0.65, medium) * 0.7);
      farColor = mix(farColor, fieldGreen, smoothstep(0.5, 0.75, fine) * 0.5);
      float parcelEdge = smoothstep(0.05, 0.08, parcels);
      vec3 parcelColor = mix(dryField, farmGreen, step(0.5, hash(floor(worldUV * 0.04))));
      parcelColor = mix(parcelColor, fieldGreen, step(0.7, hash(floor(worldUV * 0.04) + 10.0)));
      farColor = mix(brownEarth * 0.8, mix(farColor, parcelColor, 0.4), parcelEdge);
      float roadMask = smoothstep(0.02, 0.04, roads);
      farColor = mix(roadGrey, farColor, roadMask);
      float urbanMask = smoothstep(0.7, 0.85, fbm(worldUV * 0.02 + 300.0));
      farColor = mix(farColor, urbanGrey, urbanMask * 0.3);
      float windWave = sin(worldUV.x * 0.3 + time * 0.4) * cos(worldUV.y * 0.2 + time * 0.3);
      farColor += vec3(0.008, 0.015, 0.004) * windWave * 0.3 * (1.0 - urbanMask);
      
      // === BLEND near ↔ far ===
      vec3 color = mix(nearColor, farColor, lodBlend);
      
      // Moonlight
      float NdotL = max(dot(vNormal, moonDir), 0.0);
      float subsurface = max(dot(-vNormal, moonDir), 0.0) * 0.04;
      color *= (NdotL * 0.55 + subsurface + 0.22);
      
      // Specular
      vec3 halfDir = normalize(moonDir + vViewDir);
      float spec = pow(max(dot(vNormal, halfDir), 0.0), 26.0);
      float wetness = smoothstep(0.6, 0.8, fineN) * (1.0 - lodBlend);
      color += vec3(0.03, 0.05, 0.08) * spec * (0.3 + wetness * 0.2);
      
      // Distance atmosphere
      float dist = distFromCenter * 0.0015;
      float fogFactor = smoothstep(0.0, 1.0, dist);
      vec3 atmosphereColor = vec3(0.08, 0.10, 0.18);
      color = mix(color, atmosphereColor, fogFactor * 0.7);
      color *= 1.0 - fogFactor * 0.25;
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20000, 20000, 16, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={terrainVertexShader}
        fragmentShader={unifiedFragment}
      />
    </mesh>
  );
}

// --- Atmospheric dust particles floating in the air ---
function AtmosphericParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 200;
  
  const { positions: posData, sizes, velocities: velData } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 400;
      pos[i * 3 + 1] = Math.random() * 60 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
      sz[i] = 0.02 + Math.random() * 0.08;
      vel[i * 3] = (Math.random() - 0.5) * 0.01;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    return { positions: pos, sizes: sz, velocities: vel };
  }, []);

  useFrame(({ clock, camera }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const camX = camera.position.x, camZ = camera.position.z;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += Math.sin(t * 0.08 + i * 0.5) * 0.004 + velData[i * 3];
      arr[i * 3 + 1] += Math.sin(t * 0.12 + i * 0.3) * 0.003 + velData[i * 3 + 1];
      arr[i * 3 + 2] += Math.cos(t * 0.07 + i * 0.7) * 0.004 + velData[i * 3 + 2];
      // Recycle particles that drift too far from camera
      const dx = arr[i * 3] - camX, dz = arr[i * 3 + 2] - camZ;
      if (dx * dx + dz * dz > 40000) {
        arr[i * 3] = camX + (Math.random() - 0.5) * 200;
        arr[i * 3 + 2] = camZ + (Math.random() - 0.5) * 200;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posData, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        color="#8899cc"
        transparent
        opacity={0.08}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  );
}

// --- MINAS FX floor logo — large, transparent, cinematic ---
function FloorLogo() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 4096, 1024);

    // Large "MINAS" in very faint silver
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 360px "Outfit", Arial, sans-serif';
    ctx.fillStyle = 'rgba(180, 195, 210, 0.12)';
    ctx.fillText('MINAS', 1600, 380);

    // "FX" in faint cyan
    ctx.font = 'bold 360px "Outfit", Arial, sans-serif';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
    ctx.fillText('FX', 3100, 380);

    // Subtitle
    ctx.font = '500 90px "Outfit", Arial, sans-serif';
    ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
    ctx.fillText('SPECIAL FX SOLUTIONS', 2048, 680);

    // Decorative line — very subtle
    ctx.strokeStyle = 'rgba(255, 107, 0, 0.10)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(400, 800);
    ctx.quadraticCurveTo(2048, 740, 3696, 800);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    return tex;
  }, []);

  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[200, 50]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}


// ═══ VOLUMETRIC GROUND FOG — render_ultra FBM 4-octave noise ═══
function GroundFog() {
  const fogRef = useRef<THREE.Mesh>(null);
  const fogIntensity = useSceneStore(st => st.settings.groundFogIntensity);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: fogIntensity },
    uHeight: { value: 15.0 },
    uFogColor: { value: new THREE.Color(0.03, 0.04, 0.08) },
  }), []);

  useEffect(() => {
    uniforms.uIntensity.value = fogIntensity;
  }, [fogIntensity]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={fogRef} position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 2000, 1, 1]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying float vWorldY;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldY = worldPos.y;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform float uIntensity;
          uniform float uHeight;
          uniform vec3 uFogColor;
          varying vec2 vUv;
          varying float vWorldY;

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
            v += 0.5 * noise(p); p *= 2.01;
            v += 0.25 * noise(p); p *= 2.02;
            v += 0.125 * noise(p); p *= 2.03;
            v += 0.0625 * noise(p);
            return v;
          }

          void main() {
            vec2 uv = vUv * 4.0 + vec2(uTime * 0.02, uTime * 0.01);
            float n = fbm(uv);
            float heightFade = smoothstep(uHeight, 0.0, vWorldY);
            float edgeFade = smoothstep(0.0, 0.3, min(vUv.x, min(vUv.y, min(1.0 - vUv.x, 1.0 - vUv.y))));
            float alpha = n * heightFade * edgeFade * uIntensity;
            gl_FragColor = vec4(uFogColor, alpha * 0.4);
          }
        `}
      />
    </mesh>
  );
}

// --- Finale 3D dark professional ground with PBR ---
function FinaleDarkGround({ brightness }: { brightness: number }) {
  const b = brightness * 0.4;
  const uniforms = useMemo(() => ({
    time: { value: 0 },
    camPos: { value: new THREE.Vector3() },
  }), []);

  useFrame(({ clock, camera }) => {
    uniforms.time.value = clock.getElapsedTime();
    uniforms.camPos.value.copy(camera.position);
  });

  return (
    <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20000, 20000, 16, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          uniform vec3 camPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            vViewDir = normalize(camPos - wp.xyz);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float time;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vViewDir;
          
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
          }
          float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
            return v;
          }
          
          void main() {
            vec2 wuv = vWorldPos.xz;
            float distFromCenter = length(wuv);
            
            // Multi-scale surface detail — consistent everywhere
            float n1 = noise(wuv * 0.02) * 0.5 + noise(wuv * 0.08) * 0.3 + noise(wuv * 0.4) * 0.2;
            float micro = noise(wuv * 2.0) * 0.1;
            float largeFbm = fbm(wuv * 0.003);
            
            // Dark earth base with subtle variation
            float b = ${b.toFixed(3)};
            vec3 darkBase = vec3(0.015 * b, 0.025 * b, 0.015 * b);
            vec3 lighter = vec3(0.035 * b, 0.055 * b, 0.03 * b);
            vec3 color = mix(darkBase, lighter, n1);
            color += micro * vec3(0.01, 0.015, 0.008);
            
            // Subtle terrain variation at large scale
            vec3 darkPatch = vec3(0.008 * b, 0.012 * b, 0.008 * b);
            color = mix(color, darkPatch, smoothstep(0.3, 0.7, largeFbm) * 0.4);
            
            // Wet specular reflection from moonlight — uniform everywhere
            float fresnel = pow(1.0 - max(vViewDir.y, 0.0), 4.0);
            color += vec3(0.008, 0.012, 0.02) * fresnel * 0.5;
            
            // Clearcoat-like specular near center (launch area wetness)
            float nearBlend = 1.0 - smoothstep(0.0, 400.0, distFromCenter);
            float viewAngle = pow(1.0 - max(vViewDir.y, 0.0), 6.0);
            color += vec3(0.015, 0.02, 0.035) * viewAngle * nearBlend * 0.8;
            
            // Atmospheric fade at extreme distance
            float dist = distFromCenter * 0.001;
            float fogFactor = smoothstep(0.5, 1.5, dist);
            vec3 atmosphereColor = vec3(0.02 * b, 0.025 * b, 0.04 * b);
            color = mix(color, atmosphereColor, fogFactor * 0.5);
            
            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// --- Concrete / urban ground ---
function ConcreteGround({ brightness }: { brightness: number }) {
  const b = brightness * 0.5;
  return (
    <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20000, 20000]} />
      <meshStandardMaterial
        color={new THREE.Color(0.07 * b, 0.07 * b, 0.075 * b)}
        roughness={0.92}
        metalness={0.12}
      />
    </mesh>
  );
}

// ═══ ADAPTIVE EXPOSURE CONTROLLER — Blender Cycles auto-exposure ═══
// Adjusts gl.toneMappingExposure in real-time based on active explosions
const AdaptiveExposureController = React.forwardRef<THREE.Group, {}>(function AdaptiveExposureController(_props, _ref) {
  const exposureRef = useRef(createExposureController());
  const { gl } = useThree();

  // Pre-allocated color to avoid per-frame GC pressure
  const _scatterAccum = useMemo(() => new THREE.Color(), []);
  const _tmpColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const state = exposureRef.current;
    const { timelineItems, currentTime } = useProjectStore.getState();
    let luminance = 0;
    _scatterAccum.setRGB(0, 0, 0);
    let scatterMax = 0;

    // Only check items in a reasonable time window to avoid O(n) every frame
    for (let i = 0; i < timelineItems.length; i++) {
      const item = timelineItems[i];
      const elapsed = currentTime - item.startTime;
      if (elapsed < 0 || elapsed > 2.0) continue;
      if (elapsed < 0.5) {
        luminance += 3.0;
      } else {
        luminance += 0.5;
      }
      // Sky scatter accumulation — reuse color objects
      if (elapsed < 0.3) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          const intensity = 0.4 * (1 - elapsed / 0.3);
          _scatterAccum.add(_tmpColor.set(effect.color).multiplyScalar(intensity * 0.3));
          scatterMax = Math.max(scatterMax, intensity);
        }
      }
    }

    if (luminance > 2 && delta < 0.1) {
      flashEvent(state, Math.min(luminance * 0.15, 0.8));
    }

    const exposure = updateExposure(state, luminance, delta);
    gl.toneMappingExposure = exposure;

    // Update sky scatter uniforms
    if (_skyScatterUniforms) {
      if (scatterMax > 0.05) {
        _skyScatterUniforms.uExplosionScatter.value.copy(_scatterAccum);
        _skyScatterUniforms.uScatterIntensity.value = scatterMax;
      } else {
        _skyScatterUniforms.uScatterIntensity.value *= Math.max(0, 1 - delta * 3);
      }
    }
  });

  return null;
});

// ═══ GLOBAL ILLUMINATION — Hemisphere light probes from explosions ═══
// Fake GI: each explosion registers a color probe that bounces light onto the scene
const GlobalIlluminationController = React.forwardRef<THREE.Group, {}>(function GlobalIlluminationController(_props, _ref) {
  const giRef = useRef<GlobalIlluminationSystem | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    giRef.current = new GlobalIlluminationSystem(scene);
    return () => { giRef.current = null; };
  }, [scene]);

  useFrame((_, delta) => {
    if (!giRef.current) return;
    const gi = giRef.current;

    // Check for fresh explosions to register as light probes
    const { timelineItems, currentTime } = useProjectStore.getState();
    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      // Register probe only on the frame the burst begins (within 0.05s window)
      if (elapsed >= 0 && elapsed < 0.05) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          const compound = hexToCompound(effect.color);
          const pos = new THREE.Vector3(item.position.x, item.position.y, item.position.z);
          // Use chemical compound color for physically accurate GI bounce
          gi.addExplosionProbe(
            pos,
            compound.color.clone(),
            compound.emissionIntensity * 0.6
          );
        }
      }
    }

    gi.update(delta);
  });

  return null;
});

// ═══ VOLUMETRIC SMOKE CONTROLLER — post-burst smoke with wind drift ═══
const SmokeController = React.forwardRef<THREE.Group, {}>(function SmokeController(_props, _ref) {
  const smokeRef = useRef<SmokeSystem | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    const smoke = new SmokeSystem(4096);
    smokeRef.current = smoke;
    scene.add(smoke.mesh);
    return () => {
      scene.remove(smoke.mesh);
      smokeRef.current = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    if (!smokeRef.current) return;
    const smoke = smokeRef.current;

    // Emit smoke for fresh bursts
    const { timelineItems, currentTime } = useProjectStore.getState();
    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      if (elapsed >= 0 && elapsed < 0.05) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          const caliber = effect.caliber || 4;
          const breakH = getBreakHeight(caliber);
          const origin = new THREE.Vector3(item.position.x, item.position.y + breakH, item.position.z);
          const smokeColor = new THREE.Color(0.15, 0.14, 0.12); // warm grey smoke
          smoke.emit(origin, Math.round(15 + caliber * 3), smokeColor, caliber * 2);
        }
      }
    }

    // Update with wind
    const w = getWindForce();
    smoke.update(delta, w[0] * 3, w[2] * 3);
  });

  return null;
});

// ═══ LENS FLARE CONTROLLER — cinematic optics on bright bursts ═══
const LensFlareController = React.forwardRef<THREE.Group, {}>(function LensFlareController(_props, _ref) {
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const poolIdx = useRef(0);
  const { scene } = useThree();

  useEffect(() => {
    const pool: THREE.Sprite[] = [];
    for (let i = 0; i < 10; i++) {
      const sprite = createLensFlareSprite(new THREE.Color(1, 0.9, 0.7), 25);
      scene.add(sprite);
      pool.push(sprite);
    }
    spritesRef.current = pool;
    return () => {
      pool.forEach(s => scene.remove(s));
      spritesRef.current = [];
    };
  }, [scene]);

  useFrame((_, delta) => {
    const sprites = spritesRef.current;
    if (sprites.length === 0) return;

    // Decay all active flares
    for (const sprite of sprites) {
      decayLensFlare(sprite, delta, 3);
    }

    // Flash flares for fresh bursts
    const { timelineItems, currentTime } = useProjectStore.getState();
    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      if (elapsed >= 0 && elapsed < 0.03) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          const caliber = effect.caliber || 4;
          const breakH = getBreakHeight(caliber);
          const pos = new THREE.Vector3(item.position.x, item.position.y + breakH, item.position.z);
          const caliberScale = caliber / 6; // 6" as reference
          const sprite = sprites[poolIdx.current % sprites.length];
          flashLensFlare(sprite, pos, Math.min(1, 0.5 * caliberScale), new THREE.Color(effect.color));
          poolIdx.current++;
        }
      }
    }
  });

  return null;
});

// ═══ GPU SPARK TRAIL CONTROLLER — incandescent trails with 32-point history ═══
const SparkTrailController = React.forwardRef<THREE.Group, {}>(function SparkTrailController(_props, _ref) {
  const { scene } = useThree();
  const sparksRef = useRef<SparkState[]>([]);
  const systemRef = useRef<ReturnType<typeof createSparkTrailSystem> | null>(null);

  useEffect(() => {
    const sys = createSparkTrailSystem();
    systemRef.current = sys;
    scene.add(sys.points);
    return () => {
      scene.remove(sys.points);
      sys.geometry.dispose();
    };
  }, [scene]);

  useFrame((_, delta) => {
    const sys = systemRef.current;
    if (!sys) return;
    const sparks = sparksRef.current;
    const dt = Math.min(delta, 0.05); // cap dt

    // Spawn sparks from fresh bursts
    const { timelineItems, currentTime } = useProjectStore.getState();
    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      if (elapsed >= 0 && elapsed < 0.04 && sparks.length < 1600) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          const caliber = effect.caliber || 4;
          const breakH = getBreakHeight(caliber);
          const breakSpd = getBreakSpeed(caliber);
          const compound = hexToCompound(effect.color);
          const baseColor = thermalColor(compound, 1.0, 1.5);
          const sparkCount = Math.min(24, Math.round(caliber * 3));
          
          for (let s = 0; s < sparkCount; s++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const speed = breakSpd * (0.4 + Math.random() * 0.6);
            sparks.push({
              position: new THREE.Vector3(
                item.position.x,
                item.position.y + breakH,
                item.position.z
              ),
              velocity: new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed * 0.8 + breakSpd * 0.2,
                Math.cos(phi) * speed
              ),
              color: baseColor.clone(),
              life: 0.8 + Math.random() * 1.5 * (caliber / 6),
              maxLife: 0.8 + 1.5 * (caliber / 6),
              size: 0.5 + Math.random() * 0.5,
              trailHistory: [],
            });
          }
        }
      }
    }

    // Update physics & trails
    for (let i = sparks.length - 1; i >= 0; i--) {
      updateSparkTrail(sparks[i], dt, 0.04, -9.81);
      // Thermal color cooling
      const lifeRatio = Math.max(0, sparks[i].life / sparks[i].maxLife);
      const compound = hexToCompound('#' + sparks[i].color.getHexString());
      const cooled = thermalColor(compound, lifeRatio, 0.5);
      sparks[i].color.copy(cooled);
      
      if (sparks[i].life <= 0) {
        sparks.splice(i, 1);
      }
    }

    // Write to GPU buffers
    const vertCount = writeSparkTrailsToBuffers(sparks, sys.positions, sys.colors, sys.opacities);
    sys.geometry.attributes.position.needsUpdate = true;
    sys.geometry.attributes.color.needsUpdate = true;
    (sys.geometry.attributes as any).opacity.needsUpdate = true;
    sys.geometry.setDrawRange(0, vertCount);
  });

  return null;
});


const GroundReflections = React.forwardRef<THREE.Mesh, {}>(function GroundReflections(_props, _ref) {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniformsRef = useRef({
    uWetness: { value: 0.3 },
    uTime: { value: 0 },
    uReflectionColor: { value: new THREE.Color(0.1, 0.15, 0.2) },
    uReflectionIntensity: { value: 0.5 },
  });

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const u = uniformsRef.current;
    u.uTime.value = clock.getElapsedTime();

    // Check for active explosions to flash reflections
    const { timelineItems, currentTime } = useProjectStore.getState();
    let flashColor: THREE.Color | null = null;
    let flashIntensity = 0;

    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      if (elapsed >= 0 && elapsed < 0.3) {
        const effect = EFFECT_LIBRARY.find(e => e.id === item.effectId);
        if (effect && effect.type === 'firework') {
          flashColor = new THREE.Color(effect.color);
          flashIntensity = Math.max(flashIntensity, 2.0 * (1 - elapsed / 0.3));
        }
      }
    }

    if (flashColor && flashIntensity > 0.1) {
      u.uReflectionColor.value.copy(flashColor);
      u.uReflectionIntensity.value = flashIntensity;
    } else {
      // Decay reflection
      u.uReflectionIntensity.value = Math.max(0.5, u.uReflectionIntensity.value * 0.95);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniformsRef.current}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          uniform float uWetness;
          uniform float uTime;
          uniform vec3 uReflectionColor;
          uniform float uReflectionIntensity;
          varying vec2 vUv;
          varying vec3 vWorldPos;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1,0)), f.x),
              mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
              f.y
            );
          }

          void main() {
            float dist = length(vWorldPos.xz) / 600.0;
            float distFade = 1.0 - smoothstep(0.0, 1.0, dist);
            float puddle = noise(vUv * 8.0 + uTime * 0.01);
            puddle = smoothstep(0.3, 0.7, puddle) * uWetness;
            float refl = puddle * distFade * uReflectionIntensity;
            gl_FragColor = vec4(uReflectionColor * refl, refl * 0.3);
          }
        `}
      />
    </mesh>
  );
});

function StageGround({ satelliteTexture }: { satelliteTexture: string | null }) {
  const sc = useSceneStore(st => st.settings);

  const renderGround = () => {
    switch (sc.groundStyle) {
      case 'flat-black':
        return (
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[20000, 20000]} />
            <meshStandardMaterial color="#050505" roughness={0.95} metalness={0} />
          </mesh>
        );
      case 'concrete':
        return <ConcreteGround brightness={sc.groundBrightness} />;
      case 'finale-dark':
        return <FinaleDarkGround brightness={sc.groundBrightness} />;
      case 'google-earth':
      default:
        return <GrassGround />;
    }
  };

  return (
    <group>
      {renderGround()}
      {satelliteTexture && <SatelliteOverlay textureUrl={satelliteTexture} />}
      {sc.groundFogIntensity > 0 && <GroundFog />}

      {/* Operational grid */}
      {sc.showGrid && (
        <>
          <Grid
            position={[0, 0.01, 0]}
            args={[1000, 1000]}
            cellSize={2}
            cellThickness={0.15}
            cellColor="#15152a"
            sectionSize={10}
            sectionThickness={0.4}
            sectionColor="#1a1a2e"
            fadeDistance={800}
            infiniteGrid
          />
          <Grid
            position={[0, 0.015, 0]}
            args={[2000, 2000]}
            cellSize={50}
            cellThickness={0.6}
            cellColor="#1a1a2e"
            sectionSize={100}
            sectionThickness={0.8}
            sectionColor="#22223a"
            fadeDistance={1500}
            infiniteGrid
          />
        </>
      )}

      {/* MINAS FX floor logo */}
      <FloorLogo />

      {/* Origin marker */}
      {sc.showOriginMarker && (
        <>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.15, 6]} />
            <meshBasicMaterial color="#4a5a8a" transparent opacity={0.25} />
          </mesh>
          <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[6, 0.15]} />
            <meshBasicMaterial color="#8a4a5a" transparent opacity={0.25} />
          </mesh>
        </>
      )}

      {/* Scale reference poles — real height markers matching firework break heights */}
      {sc.showScalePoles && [-80, -40, 0, 40, 80].map((x) => (
        <group key={`pole-${x}`} position={[x, 0, -60]}>
          {/* Tall reference pole (100m) */}
          <mesh position={[0, 50, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 100, 8]} />
            <meshStandardMaterial color="#555555" metalness={0.7} roughness={0.25} />
          </mesh>
          {/* Height markers every 25m */}
          {[25, 50, 75, 100].map((h) => (
            <group key={h}>
              <mesh position={[0, h, 0]}>
                <boxGeometry args={[0.5, 0.05, 0.5]} />
                <meshBasicMaterial color={h === 50 ? '#ffaa00' : h === 100 ? '#ff4444' : '#888888'} transparent opacity={0.5} />
              </mesh>
              {/* Height label billboard */}
              <mesh position={[1.2, h, 0]}>
                <planeGeometry args={[2, 0.6]} />
                <meshBasicMaterial color={h === 100 ? '#ff4444' : '#666666'} transparent opacity={0.25} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 100.3, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshBasicMaterial color="#ff4444" />
          </mesh>
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.35, 0.45, 0.2, 8]} />
            <meshStandardMaterial color="#444444" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Horizon treeline */}
      {sc.showTreeline && <TreelineSilhouette />}
    </group>
  );
}

// --- Layered tree silhouettes with depth ---
function TreelineSilhouette() {
  const trees = useMemo(() => {
    const result: { x: number; z: number; h: number; w: number; layer: number }[] = [];
    // 6 depth layers — expanded world
    for (let layer = 0; layer < 6; layer++) {
      const count = 120 - layer * 15;
      const baseDist = 800 + layer * 300;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + layer * 0.05;
        const dist = baseDist + Math.random() * 60;
        result.push({
          x: Math.cos(angle) * dist,
          z: Math.sin(angle) * dist,
          h: 6 + Math.random() * 22 + layer * 5,
          w: 5 + Math.random() * 10,
          layer,
        });
      }
    }
    return result;
  }, []);

  return (
    <group>
      {trees.map((t, i) => {
        // Darker and more transparent for distant layers
        const brightness = 0.03 + t.layer * 0.015;
        const opacity = 0.9 - t.layer * 0.15;
        return (
          <mesh key={i} position={[t.x, t.h * 0.5, t.z]}
            rotation={[0, Math.atan2(t.x, t.z), 0]}>
            <planeGeometry args={[t.w, t.h]} />
            <meshBasicMaterial
              color={new THREE.Color(brightness, brightness + 0.02, brightness)}
              transparent
              opacity={opacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// LaunchSites removed — positions are now user-created via toolbar

// ─── Scene-Settings-Driven Components ────────────────────────────────

const SHADOW_MAP_SIZES: Record<string, number> = { low: 1024, medium: 2048, high: 4096, ultra: 8192 };

function SceneLighting() {
  const { scene } = useThree();
  const s = useSceneStore(st => st.settings);
  const shadowSize = SHADOW_MAP_SIZES[s.shadowQuality] || 4096;
  const rigRef = useRef<ReturnType<typeof createHDRLightingRig> | null>(null);

  useEffect(() => {
    const rig = createHDRLightingRig({
      moonIntensity: s.moonIntensity,
      moonColor: new THREE.Color(s.moonColor),
      ambientIntensity: s.ambientIntensity,
      ambientColor: new THREE.Color(0.29, 0.38, 0.5),
      fillIntensity: 0.35,
      rimIntensity: 0.55,
    });
    rigRef.current = rig;

    // Configure shadow map from store settings
    rig.moon.shadow.mapSize.set(shadowSize, shadowSize);
    rig.moon.castShadow = s.shadowsEnabled;
    rig.moon.shadow.bias = -0.00003;
    rig.moon.shadow.normalBias = 0.02;
    rig.moon.shadow.camera.far = 2000;

    scene.add(rig.group);
    return () => { scene.remove(rig.group); };
  }, [scene]);

  // Reactively sync store settings to rig
  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.updateMoonIntensity(s.moonIntensity);
    rig.updateAmbient(s.ambientIntensity);
    rig.moon.color.set(s.moonColor);
    rig.moon.castShadow = s.shadowsEnabled;
    rig.moon.shadow.mapSize.set(shadowSize, shadowSize);
  }, [s.moonIntensity, s.ambientIntensity, s.moonColor, s.shadowsEnabled, shadowSize]);

  return (
    <>
      {/* Subtle backfill for depth separation — complements HDR rig */}
      <directionalLight position={[-60, 25, 70]} intensity={s.rimLightIntensity * 0.15} color="#3355aa" />
      <directionalLight position={[0, -8, 40]} intensity={s.fillLightIntensity * 0.08} color="#182218" />
    </>
  );
}

function SceneFog() {
  const s = useSceneStore(st => st.settings);
  if (s.fogDensity <= 0) return null;
  return <fog attach="fog" args={[s.fogColor, s.fogNear, s.fogFar / Math.max(s.fogDensity, 0.1)]} />;
}

function SceneStars() {
  const density = useSceneStore(st => st.settings.starDensity);
  if (density <= 0.05) return null;
  return <Stars radius={2000} depth={800} count={Math.round(15000 * density)} factor={6} saturation={0.2} fade speed={0.03} />;
}

function WeatherEffects() {
  const weather = useSceneStore(st => st.settings.weather);
  const rainIntensity = useSceneStore(st => st.settings.rainIntensity);
  const pointsRef = useRef<THREE.Points>(null);

  const rainData = useMemo(() => {
    if (weather !== 'light-rain' && weather !== 'heavy-rain' && weather !== 'snow') return null;
    const count = weather === 'heavy-rain' ? 3000 : weather === 'snow' ? 1500 : 1000;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 800;
      positions[i * 3 + 1] = Math.random() * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 800;
      velocities[i] = weather === 'snow' ? 1 + Math.random() * 2 : 15 + Math.random() * 25;
    }
    return { count, positions, velocities };
  }, [weather]);

  useFrame(() => {
    if (!pointsRef.current || !rainData) return;
    const posAttr = pointsRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    for (let i = 0; i < rainData.count; i++) {
      arr[i * 3 + 1] -= rainData.velocities[i] * 0.016 * rainIntensity;
      if (arr[i * 3 + 1] < 0) {
        arr[i * 3 + 1] = 160 + Math.random() * 40;
        arr[i * 3] = (Math.random() - 0.5) * 800;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 800;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (!rainData) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[rainData.positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={weather === 'snow' ? 0.15 : 0.04}
        color={weather === 'snow' ? '#e8e8ff' : '#aabbcc'}
        transparent
        opacity={rainIntensity * 0.6}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

// --- Camera controller with persistent state + cinematic intro ---
// Apple-smooth easing: cubic bezier for uniform camera movement
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function CameraController({ targetPosition, targetLookAt, freeLook }: { targetPosition: [number, number, number]; targetLookAt: [number, number, number]; freeLook: boolean }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPos = useRef(new THREE.Vector3(...targetPosition));
  const targetLook = useRef(new THREE.Vector3(...targetLookAt));
  const animating = useRef(false);
  const initialized = useRef(false);
  const lastPresetKey = useRef('');
  const introPhase = useRef<'hold' | 'sweep' | 'done'>('hold');
  const introTimer = useRef(0);

  // Intro: cinematic positions
  const introStartPos = useRef(new THREE.Vector3(0, 500, 0.01));
  const introStartLook = useRef(new THREE.Vector3(0, 0, 0));
  const introDuration = useRef({ hold: 2.5, sweep: 4.0 }); // generous timing for smooth feel

  useEffect(() => {
    camera.position.copy(introStartPos.current);
    camera.lookAt(introStartLook.current);
    introPhase.current = 'hold';
    introTimer.current = 0;
  }, []);

  const presetKey = `${targetPosition.join(',')}_${targetLookAt.join(',')}`;
  
  useEffect(() => {
    if (freeLook) { animating.current = false; return; }
    if (!initialized.current) {
      initialized.current = true;
      lastPresetKey.current = presetKey;
      return;
    }
    if (presetKey === lastPresetKey.current) return;
    lastPresetKey.current = presetKey;
    targetPos.current.set(...targetPosition);
    targetLook.current.set(...targetLookAt);
    animating.current = true;
  }, [presetKey, freeLook]);

  useFrame((_, delta) => {
    if (introPhase.current !== 'done') {
      introTimer.current += delta;
      
      if (introPhase.current === 'hold') {
        // Gentle top-down hold with very subtle orbital drift
        const holdT = Math.min(1, introTimer.current / introDuration.current.hold);
        const eased = easeInOutCubic(holdT);
        const orbitRadius = 3;
        const orbitSpeed = 0.15;
        camera.position.set(
          Math.sin(introTimer.current * orbitSpeed) * orbitRadius,
          500 - eased * 40, // very gentle descent during hold
          Math.cos(introTimer.current * orbitSpeed) * orbitRadius + 0.01
        );
        camera.lookAt(0, 0, 0);
        if (controlsRef.current) {
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.update();
        }
        if (introTimer.current >= introDuration.current.hold) {
          introPhase.current = 'sweep';
          introTimer.current = 0; // reset timer for sweep phase
        }
      } else if (introPhase.current === 'sweep') {
        // Smooth cinematic sweep to default position — uniform eased motion
        const sweepT = Math.min(1, introTimer.current / introDuration.current.sweep);
        const eased = easeInOutCubic(sweepT);
        
        const defaultPos = new THREE.Vector3(...targetPosition);
        const defaultLook = new THREE.Vector3(...targetLookAt);
        
        // Interpolate position with easing — uniform speed curve
        const sweepStartPos = new THREE.Vector3(0, 460, 3);
        camera.position.lerpVectors(sweepStartPos, defaultPos, eased);
        
        // Interpolate look target
        if (controlsRef.current) {
          const currentTarget = new THREE.Vector3().lerpVectors(introStartLook.current, defaultLook, eased);
          controlsRef.current.target.copy(currentTarget);
          controlsRef.current.update();
        }
        
        if (sweepT >= 1) {
          introPhase.current = 'done';
          camera.position.copy(defaultPos);
          if (controlsRef.current) {
            controlsRef.current.target.copy(defaultLook);
            controlsRef.current.update();
          }
          animating.current = false;
        }
      }
      return;
    }

    // Normal preset animation — smooth Apple-style easing
    if (!animating.current || !controlsRef.current || freeLook) return;
    camera.position.lerp(targetPos.current, 0.06);
    controlsRef.current.target.lerp(targetLook.current, 0.06);
    controlsRef.current.update();
    if (camera.position.distanceTo(targetPos.current) < 0.1) {
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.6}
      panSpeed={0.8}
      zoomSpeed={1.2}
      maxPolarAngle={Math.PI * 0.495}
      minDistance={1}
      maxDistance={8000}
      enablePan
    />
  );
}

/** Viewport playback controls — always visible at bottom center of 3D viewport */
function ViewportPlaybackControls() {
  const { isPlaying, setPlaying, currentTime, setCurrentTime, duration, playbackSpeed } = useProjectStore();

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const f = Math.floor((t % 1) * 30);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5">
      {/* Rewind */}
      <button
        onClick={() => { setCurrentTime(0); setPlaying(false); }}
        className="bg-card/85 backdrop-blur-xl border border-border/25 text-muted-foreground hover:text-foreground hover:bg-card/95 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg"
        title="Rewind (Home)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M1 1h2v10H1V1zm3 5l6 5V1L4 6z"/></svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={() => setPlaying(!isPlaying)}
        className={cn(
          "backdrop-blur-xl border w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg",
          isPlaying
            ? "bg-primary/20 text-primary border-primary/30 shadow-primary/15"
            : "bg-card/85 text-foreground border-border/25 hover:bg-card/95"
        )}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="0.5"/><rect x="8.5" y="1" width="3.5" height="12" rx="0.5"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9.5-5.5L3 1.5z"/></svg>
        )}
      </button>

      {/* Stop */}
      <button
        onClick={() => { setCurrentTime(0); setPlaying(false); }}
        className="bg-card/85 backdrop-blur-xl border border-border/25 text-muted-foreground hover:text-destructive hover:bg-card/95 w-8 h-8 rounded-lg flex items-center justify-center transition-all shadow-lg"
        title="Stop"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="1.5" y="1.5" width="9" height="9" rx="1"/></svg>
      </button>

      {/* Time display */}
      <div className="bg-card/85 backdrop-blur-xl border border-border/25 px-3 h-8 rounded-lg flex items-center gap-2 shadow-lg">
        <span className="text-[10px] font-mono-code text-foreground tracking-wider">{formatTime(currentTime)}</span>
        <span className="text-[9px] text-muted-foreground/60">/</span>
        <span className="text-[10px] font-mono-code text-muted-foreground">{formatTime(duration)}</span>
        {playbackSpeed !== 1 && (
          <span className="text-[8px] font-mono-code text-primary ml-1">{playbackSpeed}×</span>
        )}
      </div>

      {/* Progress mini-bar */}
      <div className="bg-card/85 backdrop-blur-xl border border-border/25 w-24 h-8 rounded-lg flex items-center px-2 shadow-lg cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = Math.max(0, Math.min(1, (e.clientX - rect.left - 8) / (rect.width - 16)));
          setCurrentTime(pct * duration);
        }}
      >
        <div className="relative w-full h-1 bg-border/30 rounded-full overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Floating menu for fullscreen mode — gives access to key actions */
function FullscreenEditMenu() {
  const { isPlaying, setPlaying, currentTime, setCurrentTime, duration } = useProjectStore();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute top-3 right-3 z-50 flex flex-col items-end gap-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="bg-surface-1/90 backdrop-blur-md text-foreground border border-border/60 px-3 py-1.5 rounded text-[10px] font-mono-code flex items-center gap-1.5 hover:bg-surface-2/90 transition-all shadow-lg"
      >
        <Cog className="w-3.5 h-3.5" />
        Menu
      </button>
      {expanded && (
        <div className="bg-surface-1/95 backdrop-blur-md border border-border/60 rounded-lg shadow-xl p-2 min-w-[160px] space-y-0.5">
          <button
            onClick={() => setPlaying(!isPlaying)}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => { setCurrentTime(0); setPlaying(false); }}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            ⏮ Rewind
          </button>
          <div className="border-t border-border/30 my-1" />
          <div className="px-3 py-1 text-[9px] font-mono-code text-muted-foreground">
            Time: {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
          </div>
          <div className="border-t border-border/30 my-1" />
          <button
            onClick={() => document.exitFullscreen()}
            className="w-full text-left px-3 py-1.5 text-[10px] font-mono-code text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded flex items-center gap-2"
          >
            <Minimize className="w-3 h-3" /> Sair Fullscreen
          </button>
        </div>
      )}
    </div>
  );
}

export default function SkyCanvas() {
  const editorMode = useProjectStore((s) => s.editorMode);
  const droneFormations = useProjectStore((s) => s.droneFormations);
  const gpsOrigin = useProjectStore((s) => s.gpsOrigin);
  // cursorStyle moved below geoTool declaration
  const [activePreset, setActivePreset] = useState('free');
  const [freeLook, setFreeLook] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];
  const perfStatsRef = useRef<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;
  const [satelliteTexture, setSatelliteTexture] = useState<string | null>(null);
  const [downloadingScenery, setDownloadingScenery] = useState(false);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);
  const recoveringContextRef = useRef(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ═══ Google Earth-style Geo Tools state ═══
  const [geoTool, setGeoTool] = useState<GeoToolMode>('none');
  const [geoMarkers, setGeoMarkers] = useState<GeoMarker[]>([]);
  const [geoRulers, setGeoRulers] = useState<GeoRulerPoint[]>([]);
  const [geoPaths, setGeoPaths] = useState<GeoPath[]>([]);
  const [activeRulerPoints, setActiveRulerPoints] = useState<[number, number, number][]>([]);
  const [activePathPoints, setActivePathPoints] = useState<[number, number, number][]>([]);
  const geoMarkerColorIdx = useRef(0);
  const geoPathColorIdx = useRef(0);
  const MARKER_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const cursorStyle = geoTool !== 'none' ? 'crosshair' : editorMode !== 'select' ? 'crosshair' : 'default';

  const handlePlaceMarker = useCallback((pos: [number, number, number]) => {
    const color = MARKER_COLORS[geoMarkerColorIdx.current % MARKER_COLORS.length];
    geoMarkerColorIdx.current++;
    const marker: GeoMarker = {
      id: `gm-${Date.now()}`,
      name: `Marcador ${geoMarkers.length + 1}`,
      position: pos,
      color,
      visible: true,
    };
    setGeoMarkers(prev => [...prev, marker]);
    setGeoTool('none');
    toast.success(`Marcador adicionado`);
  }, [geoMarkers.length]);

  const handlePlaceRulerPoint = useCallback((pos: [number, number, number]) => {
    setActiveRulerPoints(prev => [...prev, pos]);
  }, []);

  const handleFinishRuler = useCallback(() => {
    if (activeRulerPoints.length < 2) return;
    let total = 0;
    for (let i = 0; i < activeRulerPoints.length - 1; i++) {
      const [x1, y1, z1] = activeRulerPoints[i];
      const [x2, y2, z2] = activeRulerPoints[i + 1];
      total += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
    }
    const ruler: GeoRulerPoint = {
      id: `gr-${Date.now()}`,
      points: [...activeRulerPoints],
      totalDistance: total,
      visible: true,
      label: `Medição ${geoRulers.length + 1}`,
    };
    setGeoRulers(prev => [...prev, ruler]);
    setActiveRulerPoints([]);
    setGeoTool('none');
    toast.success(`Medição: ${total.toFixed(1)}m`);
  }, [activeRulerPoints, geoRulers.length]);

  const handlePlacePathPoint = useCallback((pos: [number, number, number]) => {
    setActivePathPoints(prev => [...prev, pos]);
  }, []);

  const handleFinishPath = useCallback(() => {
    if (activePathPoints.length < 2) return;
    const colors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ec4899', '#06b6d4'];
    const color = colors[geoPathColorIdx.current % colors.length];
    geoPathColorIdx.current++;
    const path: GeoPath = {
      id: `gp-${Date.now()}`,
      name: geoTool === 'polygon' ? `Polígono ${geoPaths.length + 1}` : `Caminho ${geoPaths.length + 1}`,
      points: [...activePathPoints],
      color,
      visible: true,
      closed: geoTool === 'polygon',
    };
    setGeoPaths(prev => [...prev, path]);
    setActivePathPoints([]);
    setGeoTool('none');
    toast.success(`${path.closed ? 'Polígono' : 'Caminho'} criado com ${path.points.length} pontos`);
  }, [activePathPoints, geoPaths.length, geoTool]);

  // Build active (in-progress) ruler/path for live preview
  const activeRuler: GeoRulerPoint | null = activeRulerPoints.length >= 2 ? {
    id: 'active-ruler',
    points: activeRulerPoints,
    totalDistance: activeRulerPoints.reduce((sum, p, i, arr) => {
      if (i === 0) return 0;
      const [x1, y1, z1] = arr[i - 1];
      const [x2, y2, z2] = p;
      return sum + Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
    }, 0),
    visible: true,
    label: 'Medindo...',
  } : null;

  const activePath: GeoPath | null = activePathPoints.length >= 2 ? {
    id: 'active-path',
    name: 'Traçando...',
    points: activePathPoints,
    color: '#ffffff',
    visible: true,
    closed: false,
  } : null;

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ESC cancels geo tool
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && geoTool !== 'none') {
        setGeoTool('none');
        setActiveRulerPoints([]);
        setActivePathPoints([]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [geoTool]);

  const handleDownloadScenery = useCallback(async () => {
    setDownloadingScenery(true);
    pushLog('Downloading satellite imagery...', 'info');
    try {
      // Get the API key from the edge function
      const { data: keyData, error: keyError } = await supabase.functions.invoke('get-maps-key');
      const apiKey = keyData?.key;
      if (keyError || !apiKey) {
        pushLog('Failed to get Google Maps API key', 'error');
        toast.error('Falha ao obter chave do Google Maps');
        return;
      }

      // Fetch satellite tile directly from client (avoids server-side 403 restrictions)
      const url = `https://maps.googleapis.com/maps/api/staticmap?center=${gpsOrigin.lat},${gpsOrigin.lng}&zoom=18&size=640x640&maptype=satellite&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        pushLog(`Google Static Maps error: ${res.status}`, 'error');
        toast.error(`Erro Google Maps: ${res.status}. Verifique se a Maps Static API está habilitada.`);
        return;
      }

      const blob = await res.blob();
      const imageUrl = URL.createObjectURL(blob);
      setSatelliteTexture(imageUrl);
      pushLog(`Satellite scenery loaded: ${gpsOrigin.lat.toFixed(4)}°, ${gpsOrigin.lng.toFixed(4)}°`, 'success');
      toast.success('Cenário satélite carregado!');
    } catch (err) {
      pushLog('Satellite download error', 'error');
      toast.error('Erro ao baixar cenário');
    } finally {
      setDownloadingScenery(false);
    }
  }, [gpsOrigin.lat, gpsOrigin.lng]);

  return (
    <div className="w-full h-full relative bg-[#030308]" data-sky-canvas style={{ cursor: cursorStyle }}>
      <WebGLErrorBoundary>
      <Canvas
        key={canvasInstanceKey}
        shadows
        gl={{
          antialias: false,
          toneMapping: THREE.NoToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: isMobile ? 'default' : 'high-performance',
          alpha: false,
          stencil: false,
          logarithmicDepthBuffer: !isMobile,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={isMobile ? [1, 1] : [1, 1.5]}
        performance={{ min: 0.5 }}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;

          const handleContextLost = (e: Event) => {
            e.preventDefault();
            if (recoveringContextRef.current) return;
            recoveringContextRef.current = true;
            console.warn('[FXK] WebGL context lost — remounting renderer');
            _starMaterialInstance?.dispose();
            _starMaterialInstance = null;
            setCanvasInstanceKey((prev) => prev + 1);
          };

          const handleContextRestored = () => {
            console.log('[FXK] WebGL context restored');
            recoveringContextRef.current = false;
            _starMaterialInstance?.dispose();
            _starMaterialInstance = null;
          };

          canvas.addEventListener('webglcontextlost', handleContextLost as EventListener);
          canvas.addEventListener('webglcontextrestored', handleContextRestored as EventListener);
        }}>
        <PerspectiveCamera makeDefault position={preset.position} fov={50} near={0.3} far={20000} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} freeLook={freeLook} />

        <SceneLighting />
        <AdaptiveExposureController />
        <GlobalIlluminationController />
        <GroundReflections />
        <SmokeController />
        <LensFlareController />
        <SparkTrailController />

        <SkyGradient />
        <Moon />
        <SceneStars />
        {!isMobile && <AtmosphericParticles />}
        <SceneFog />
        {!isMobile && <WeatherEffects />}

        <StageGround satelliteTexture={satelliteTexture} />
        <PositionPins />
        <PyroLaunchAngles />
        {!isMobile && <Rack3DView />}
        <TrajectoryPaths />
        <DroneChoreography />
        {!isMobile && <BoidsVisualizer />}
        {!isMobile && <CollisionAvoidanceOverlay config={DEFAULT_AVOIDANCE} />}
        <TimelineEffects />
        <LiveSFXEffects />
        {!isMobile && <AudioSpectrumVisualizer />}
        <PlaybackClock />
        {!isMobile && <CameraAnimator />}
        {!isMobile && <CameraPathPreview />}
        <PostProcessing />
        <BoxSelectR3F />
        <PerfCollector statsRef={perfStatsRef} />

        {/* ═══ Google Earth Geo Tools ═══ */}
        <GeoToolsScene
          markers={geoMarkers}
          rulers={[...geoRulers, ...(activeRuler ? [activeRuler] : [])]}
          paths={[...geoPaths, ...(activePath ? [activePath] : [])]}
        />
        <GeoToolClickHandler
          activeTool={geoTool}
          onPlaceMarker={handlePlaceMarker}
          onPlaceRulerPoint={handlePlaceRulerPoint}
          onPlacePathPoint={handlePlacePathPoint}
          onFinishRuler={handleFinishRuler}
          onFinishPath={handleFinishPath}
        />
      </Canvas>
      </WebGLErrorBoundary>

      {/* ═══ Google Earth Geo Tools UI ═══ */}
      {!isMobile && (
        <ViewportGeoTools
          activeTool={geoTool}
          onToolChange={(tool) => {
            setGeoTool(tool);
            if (tool === 'none') {
              // finalize any in-progress drawing
              if (activeRulerPoints.length >= 2) handleFinishRuler();
              if (activePathPoints.length >= 2) handleFinishPath();
              setActiveRulerPoints([]);
              setActivePathPoints([]);
            }
          }}
          markers={geoMarkers}
          rulers={geoRulers}
          paths={geoPaths}
          onClearMarkers={() => setGeoMarkers([])}
          onClearRulers={() => setGeoRulers([])}
          onClearPaths={() => setGeoPaths([])}
          onToggleMarkerVisibility={(id) => setGeoMarkers(prev => prev.map(m => m.id === id ? { ...m, visible: !m.visible } : m))}
          onToggleRulerVisibility={(id) => setGeoRulers(prev => prev.map(r => r.id === id ? { ...r, visible: !r.visible } : r))}
          onTogglePathVisibility={(id) => setGeoPaths(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p))}
          onDeleteMarker={(id) => setGeoMarkers(prev => prev.filter(m => m.id !== id))}
          onDeleteRuler={(id) => setGeoRulers(prev => prev.filter(r => r.id !== id))}
          onDeletePath={(id) => setGeoPaths(prev => prev.filter(p => p.id !== id))}
          onUpdateMarker={(id, updates) => setGeoMarkers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))}
          onUpdateRuler={(id, updates) => setGeoRulers(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))}
          onUpdatePath={(id, updates) => setGeoPaths(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))}
        />
      )}

      {/* Camera presets & controls */}
      <div className="absolute top-3 left-3 flex items-center gap-1 flex-wrap max-w-[calc(100%-24px)]">
        {/* Free look toggle */}
        <button
          onClick={() => setFreeLook(!freeLook)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md",
            freeLook
              ? "bg-warning/20 text-warning border-warning/30 shadow-lg shadow-warning/10"
              : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
          )}
          title="Free Look"
        >
          <ScanEye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Look</span>
        </button>

        {/* Mobile: camera dropdown; Desktop: inline buttons */}
        {isMobile ? (
          <div className="relative">
            <button
              onClick={() => setCameraMenuOpen(!cameraMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md bg-card/80 text-muted-foreground border-border/20"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{preset.label}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", cameraMenuOpen && "rotate-180")} />
            </button>
            {cameraMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCameraMenuOpen(false)} />
                <div className="absolute top-full left-0 mt-1 z-40 bg-card/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-2xl shadow-black/60 py-1 min-w-[140px]">
                  {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => { setActivePreset(id); setFreeLook(false); setCameraMenuOpen(false); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-[11px] font-medium flex items-center gap-2 rounded-lg mx-0.5 transition-all",
                        activePreset === id && !freeLook
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-1/60"
                      )}
                      style={{ width: 'calc(100% - 4px)' }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setActivePreset(id); setFreeLook(false); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md",
                activePreset === id && !freeLook
                  ? "bg-primary/15 text-primary border-primary/25 shadow-lg shadow-primary/10"
                  : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))
        )}

        {/* Download satellite scenery */}
        {!isMobile && (
          <button
            onClick={handleDownloadScenery}
            disabled={downloadingScenery}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md",
              satelliteTexture
                ? "bg-success/15 text-success border-success/25"
                : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
            )}
            title="Download real satellite scenery from Google Maps"
          >
            {downloadingScenery ? (
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Globe className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{satelliteTexture ? 'Satélite ✓' : 'Cenário Real'}</span>
          </button>
        )}

        {/* Fullscreen toggle */}
        {!isMobile && (
          <button
            onClick={() => {
              const el = document.querySelector('[data-sky-canvas]') as HTMLElement;
              if (!el) return;
              document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
            }}
            className="bg-card/80 text-muted-foreground border border-border/20 hover:text-foreground hover:bg-card/90 px-2.5 py-1.5 rounded-xl transition-all backdrop-blur-md"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Fullscreen floating edit menu */}
      {isFullscreen && <FullscreenEditMenu />}

      {!isMobile && <PerformanceHUD statsRef={perfStatsRef} droneCount={droneCount} />}
      {!isMobile && <ViewportTerminal />}
      <SelectionStatusBar />
      {!isMobile && <AlignmentTools />}

      {/* ═══ Viewport Playback Controls ═══ */}
      <ViewportPlaybackControls />

      {/* Bottom info — hidden on mobile to avoid tab bar overlap */}
      {!isMobile && (
        <div className="absolute bottom-3 right-3 text-[9px] font-mono-code text-muted-foreground/60 bg-card/70 backdrop-blur-md px-3 py-2 rounded-xl border border-border/15 space-y-0.5">
          <div className="text-[8px] text-muted-foreground/40 tracking-wider font-display">FX KONTROL v2.0 · Minas FX</div>
          <div>Orbit: LMB · Pan: MMB · Zoom: Scroll</div>
          <div>Box: Alt+Drag · Multi: Shift+Click · Edit: Dbl-Click</div>
          <div>{freeLook ? '🔓 Free Look ON' : '🔒 Preset Lock'}</div>
        </div>
      )}
    </div>
  );
}
