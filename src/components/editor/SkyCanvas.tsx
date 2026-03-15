import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Grid, PerspectiveCamera } from '@react-three/drei';
import { useProjectStore, EFFECT_LIBRARY } from '@/store/useProjectStore';
import { useSceneStore } from '@/store/useSceneStore';
import { useRef, useMemo, useEffect, useState, useCallback, Component, ErrorInfo, ReactNode } from 'react';
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
import { Camera, Eye, Video, Plane, Users, Maximize, Minimize, AlertTriangle, Globe, Download, ScanEye, Cog, Paintbrush, MapPinned, Film } from 'lucide-react';
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
  { id: 'free', label: 'Free', icon: Eye, position: [0, 15, 200] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'satellite', label: 'Top', icon: Plane, position: [0, 500, 0.1] as [number, number, number], target: [0, 0, 0] as [number, number, number] },
  { id: 'audience', label: 'Plateia', icon: Users, position: [0, 2, 250] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'front', label: 'Front', icon: Users, position: [0, 5, 300] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'side', label: 'Side', icon: Video, position: [300, 30, 0] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'back', label: 'Back', icon: Video, position: [0, 30, -200] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'aerial', label: 'Aerial 45°', icon: Plane, position: [0, 300, 300] as [number, number, number], target: [0, 50, 0] as [number, number, number] },
  { id: 'closeup', label: 'Close-up', icon: Camera, position: [20, 30, 80] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
  { id: 'cinematic', label: 'Cinema', icon: Video, position: [-80, 8, 220] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'drone-follow', label: 'Drone POV', icon: Eye, position: [15, 120, 40] as [number, number, number], target: [0, 100, 0] as [number, number, number] },
  { id: 'vip', label: 'VIP Box', icon: Users, position: [60, 5, 200] as [number, number, number], target: [0, 80, 0] as [number, number, number] },
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
  attribute float aSeed;
  varying vec3 vColor;
  varying float vLife;
  varying float vSize;
  varying float vSeed;
  void main() {
    vColor = color;
    vLife = aLife;
    vSize = aSize;
    vSeed = aSeed;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    // Blender-calibrated: tighter point size for realistic star scale
    gl_PointSize = aSize * (1600.0 / -mvPos.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 140.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const STAR_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vLife;
  varying float vSize;
  varying float vSeed;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);
    
    // Niagara-style layered glow: tight bright core + soft halo
    float core = exp(-dist * dist * 80.0);  // Very tight bright center
    float inner = exp(-dist * dist * 25.0); // Inner glow
    float outer = exp(-dist * dist * 8.0);  // Soft outer bloom
    
    // Combined alpha with natural falloff
    float alpha = core * 1.0 + inner * 0.6 + outer * 0.15;
    
    // Thermal color model: white-hot center fading to star color
    vec3 whiteHot = vec3(1.3, 1.15, 0.95);
    vec3 col = mix(vColor, whiteHot, core * 0.7);
    col += vColor * outer * 0.3;
    
    // Youth flash: brief bright moment at spawn
    float youth = max(0.0, 1.0 - vLife * 5.0);
    col += whiteHot * youth * 0.6;
    
    // Circular cutoff
    float edge = 1.0 - smoothstep(0.42, 0.5, dist);
    
    gl_FragColor = vec4(col, alpha * edge);
  }
`;

// ═══════════════════════════════════════════════════════════════════════
// Niagara-inspired FireworkBurst:
// - Custom star sprite shader (gaussian glow discs)
// - Analytical exponential drag integration
// - Thermal color pipeline: white-hot → saturated → ember
// - No smoke — clean particle rendering like Niagara
// - Caliber-proportional star count, size, and lifetime
// ═══════════════════════════════════════════════════════════════════════
function FireworkBurst({ 
  position, color, progress, caliber = 4, pattern = 'peony' 
}: { 
  position: [number, number, number]; color: string; progress: number; 
  caliber?: number; pattern?: string;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.LineSegments>(null);
  
  // Niagara-style: particle count scales with shell volume (4/3 π r³)
  const STAR_COUNT = useMemo(() => Math.min(3000, Math.round(150 + caliber * caliber * 32)), [caliber]);
  const TRAIL_LENGTH = useMemo(() => Math.min(24, 10 + Math.floor(caliber * 1.5)), [caliber]);
  
  // Real break speed from pyroPhysics — caliber proportional (m/s)
  const breakSpeed = useMemo(() => getBreakSpeed(caliber), [caliber]);
  
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

  // Pre-allocate typed arrays for per-frame updates
  const positionsRef = useRef(new Float32Array(STAR_COUNT * 3));
  const colorsRef = useRef(new Float32Array(STAR_COUNT * 3));
  const sizesRef = useRef(new Float32Array(STAR_COUNT));
  const livesRef = useRef(new Float32Array(STAR_COUNT));
  const trailVertCount = STAR_COUNT * TRAIL_LENGTH * 2;
  const trailPosRef = useRef(new Float32Array(trailVertCount * 3));
  const trailColRef = useRef(new Float32Array(trailVertCount * 3));

  // Custom shader material for star sprites
  const starMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: STAR_VERTEX_SHADER,
      fragmentShader: STAR_FRAGMENT_SHADER,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current || !trailRef.current) return;
    const pos = positionsRef.current;
    const cols = colorsRef.current;
    const sizes = sizesRef.current;
    const lives = livesRef.current;
    const tPos = trailPosRef.current;
    const tCol = trailColRef.current;
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
      const py = dragPos(vy, t, dragCoeff) + 0.5 * GRAVITY * t * t;
      const pz = dragPos(vz, t, dragCoeff) + w[2] * t * t * 0.3;
      pos[i * 3] = px; pos[i * 3 + 1] = py; pos[i * 3 + 2] = pz;

      // === Niagara Thermal Color Pipeline ===
      // Phase 1: White-hot flash (0-5% life)
      const flashIntensity = Math.max(0, 1 - starAge * 20);
      // Phase 2: Full saturated color (5-50% life)
      // Phase 3: Thermal decay to ember (50-100% life)
      const emberPhase = Math.max(0, (starAge - 0.45) / 0.55);
      
      // ═══ PyroChem Thermal Color Pipeline ═══
      // Uses real chemical compound emission spectra + thermal transitions
      const lifeRatio = 1 - starAge; // thermalColor expects 1=birth, 0=dead
      const chemColor = thermalColor(compound, lifeRatio, 1.0);
      
      // Per-star twinkle — organic shimmer
      let twinkle: number;
      if (isTrailingPattern) {
        twinkle = 0.8 + Math.sin(twinklePhases[i] + starAge * 15) * 0.2;
      } else {
        twinkle = temporalFlicker(sparkleSeeds[i], time, 0.65, 0.30, 0.35);
      }
      
      // Blend chemical color with original for artistic control (70% chem, 30% user)
      const r = THREE.MathUtils.lerp(baseColor.r * (1 - starAge), chemColor.r, 0.7);
      const g = THREE.MathUtils.lerp(baseColor.g * (1 - starAge), chemColor.g, 0.7);
      const b = THREE.MathUtils.lerp(baseColor.b * (1 - starAge), chemColor.b, 0.7);
      
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
        tPos[base2 + 1] = dragPos(vy, t0, dragCoeff) + 0.5 * GRAVITY * t0 * t0;
        tPos[base2 + 2] = dragPos(vz, t0, dragCoeff) + w[2] * t0 * t0 * 0.3;
        tPos[base2 + 3] = dragPos(vx, t1, dragCoeff) + w[0] * t1 * t1 * 0.3;
        tPos[base2 + 4] = dragPos(vy, t1, dragCoeff) + 0.5 * GRAVITY * t1 * t1;
        tPos[base2 + 5] = dragPos(vz, t1, dragCoeff) + w[2] * t1 * t1 * 0.3;
        
        const segFrac = s / TRAIL_LENGTH;
        const segFade = fadeCubed * Math.pow(1 - segFrac, 2.5) * 0.7;
        const endFade = fadeCubed * Math.pow(1 - (s + 1) / TRAIL_LENGTH, 2.5) * 0.7;
        
        // Finale trail thermal: white center → warm gold → colored → faint
        const trailWarmth = Math.pow(segFrac, 0.4);
        tCol[base2] = THREE.MathUtils.lerp(1.2, r * 0.7, trailWarmth) * segFade;
        tCol[base2 + 1] = THREE.MathUtils.lerp(0.8, g * 0.4, trailWarmth) * segFade;
        tCol[base2 + 2] = THREE.MathUtils.lerp(0.35, b * 0.15, trailWarmth) * segFade;
        tCol[base2 + 3] = THREE.MathUtils.lerp(1.2, r * 0.7, trailWarmth) * endFade;
        tCol[base2 + 4] = THREE.MathUtils.lerp(0.8, g * 0.4, trailWarmth) * endFade;
        tCol[base2 + 5] = THREE.MathUtils.lerp(0.35, b * 0.15, trailWarmth) * endFade;
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
      <points ref={pointsRef} material={starMaterial}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(STAR_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(STAR_COUNT * 3), 3]} />
          <bufferAttribute attach="attributes-aSize" args={[new Float32Array(STAR_COUNT), 1]} />
          <bufferAttribute attach="attributes-aLife" args={[new Float32Array(STAR_COUNT), 1]} />
        </bufferGeometry>
      </points>
      
      {/* ═══ Star trails — dense thermal gradient lines ═══ */}
      <lineSegments ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array(trailVertCount * 3), 3]} />
          <bufferAttribute attach="attributes-color" args={[new Float32Array(trailVertCount * 3), 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.6} depthWrite={false} blending={THREE.AdditiveBlending} linewidth={3} />
      </lineSegments>
      
      
      {/* ═══ BREAK FLASH — 3-layer system ═══ */}
      {/* Layer 1: Inner white-hot core — ultra HDR for maximum bloom */}
      {progress < 0.04 && (
        <mesh>
          <sphereGeometry args={[flashSize * 0.3 * (1 + progress * 8), 12, 12]} />
          <meshBasicMaterial color="#FFFFF0" transparent opacity={0.8 * (1 - progress / 0.04)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* Layer 2: Hot colored flash — primary bloom source */}
      {progress < 0.1 && (
        <mesh>
          <sphereGeometry args={[flashSize * (1 + progress * 8), 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.4 * Math.pow(1 - progress / 0.1, 2)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* Layer 3: Expanding shockwave ring */}
      {progress > 0.003 && progress < 0.1 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[
            progress * flashSize * 8,
            progress * flashSize * 8 + 0.4 + caliber * 0.1,
            48
          ]} />
          <meshBasicMaterial color={color} transparent opacity={0.04 * Math.pow(1 - progress / 0.1, 1.5)} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* Layer 4: Subtle sky illumination */}
      {progress < 0.3 && progress > 0.003 && (
        <mesh>
          <sphereGeometry args={[caliber * 4 + progress * caliber * 10, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.008 * (1 - progress / 0.3)} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function LightPoint({ position, color }: { position: [number, number, number]; color: string }) {
  return <QuadcopterModel position={position} color={color} />;
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

  return (
    <>
      {activeEffects.map(({ item, effect, progress, inPrefire, prefireProgress, caliber, resolvedPos, effectScale, effectBrightness, launchHeading, launchPitch }) => {
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
        // Angled burst position: shell travels along launch angle
        const burstPos: [number, number, number] = isShell
          ? [
              pos[0] + Math.sin(headingRad) * Math.cos(pitchRad) * realBreakHeight,
              pos[1] + Math.sin(pitchRad) * realBreakHeight,
              pos[2] - Math.cos(headingRad) * Math.cos(pitchRad) * realBreakHeight,
            ]
          : pos;

        // Heights from effect library, scaled by scene
        const scaledHeight = (effect.heightMeters || 4) * effectScale;

        if (pt === 'mine') return (
          <MineEffect key={item.id} position={pos} color={effect.color} progress={progress} />
        );
        if (pt === 'candle') return <RomanCandleEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 8} />;
        if (pt === 'waterfall') return <WaterfallEffect key={item.id} position={pos} color={effect.color} progress={progress} width={scaledHeight} />;
        if (pt === 'gerb') return <GerbEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'flame') return <FlameEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight} />;
        if (pt === 'cake') return <CakeEffect key={item.id} position={pos} color={effect.color} progress={progress} shotCount={effect.shotCount || 25} />;
        if (pt === 'laser') return <LaserEffect key={item.id} position={pos} color={effect.color} progress={progress} pattern={effect.laserPattern || 'fan'} beamCount={effect.beamCount || 8} />;
        if (pt === 'light' && effect.beamType) return <MovingHeadEffect key={item.id} position={pos} color={effect.color} progress={progress} beamType={effect.beamType} />;

        // ── SFX special routing ──
        if (eid === 'sfx-01') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 6} />;
        if (eid === 'sfx-02') return <CryoJetEffect key={item.id} position={pos} color={effect.color} progress={progress} height={scaledHeight || 8} horizontal />;
        if (eid === 'sfx-06' || eid === 'sfx-07') return <ConfettiEffect key={item.id} position={pos} color={effect.color} progress={progress} />;
        if (eid === 'sfx-08') return <FogMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={8 + (scaledHeight || 4)} />;
        if (eid === 'sfx-09') return <HazeMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} radius={16 + (scaledHeight || 4)} />;
        if (eid === 'sfx-10') return <SnowMachineEffect key={item.id} position={pos} progress={progress} width={6 + (scaledHeight || 4)} height={Math.max(6, (scaledHeight || 8) * 1.2)} />;
        if (eid === 'sfx-11') return <BubbleMachineEffect key={item.id} position={pos} color={effect.color} progress={progress} spread={6 + (scaledHeight || 3)} />;

        // ── Legacy effect ID routing ──
        if (eid.startsWith('comet-')) return <CometEffect key={item.id} position={pos} color={effect.color} progress={progress} direction={eid === 'comet-02' ? 'down' : 'up'} />;
        if (eid.startsWith('mburst-')) return <MultiBurstEffect key={item.id} position={burstPos} color={effect.color} progress={progress} burstCount={eid === 'mburst-02' ? 5 : 3} />;
        if (eid.startsWith('fan-')) return <FanEffect key={item.id} position={pos} color={effect.color} progress={progress} spreadAngle={eid === 'fan-02' ? 180 : 90} />;

        // ── Default: clean firework burst at break height (no smoke, Niagara-style) ──
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
  }), []);

  useEffect(() => {
    uniforms.uSkyBrightness.value = skyBrightness;
    uniforms.uHorizonGlow.value = horizonGlow;
    uniforms.uStarDensity.value = starDensity;
  }, [skyBrightness, horizonGlow, starDensity]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh>
      <sphereGeometry args={[500, 64, 64]} />
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
    <group position={[200, 350, -300]}>
      {/* Moon body with procedural surface — radius 12 for proper angular size */}
      <mesh>
        <sphereGeometry args={[12, 64, 64]} />
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
        <sphereGeometry args={[12.5, 32, 32]} />
        <meshBasicMaterial color="#d0c8a8" transparent opacity={0.12} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer volumetric halo */}
      <mesh>
        <sphereGeometry args={[20, 32, 32]} />
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
        <sphereGeometry args={[40, 16, 16]} />
        <meshBasicMaterial color="#506080" transparent opacity={0.012} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color="#8899bb" intensity={0.15} distance={800} decay={1} />
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

  return (
    <>
      {/* Far terrain — Google Earth satellite style */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000, 4, 4]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={terrainVertexShader}
          fragmentShader={terrainFragmentShader}
        />
      </mesh>
      {/* Near-stage grass with mowing pattern */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[120, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={terrainVertexShader}
          fragmentShader={nearFieldFragment}
          transparent={false}
        />
      </mesh>
    </>
  );
}

// --- Atmospheric dust particles floating in the air ---
function AtmosphericParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 500;
  
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
        opacity={0.18}
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
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}


function GroundFog() {
  const fogRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    time: { value: 0 },
  }), []);

  useFrame(({ clock }) => {
    uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={fogRef} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[500, 500, 1, 1]} />
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vWorldPos;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float time;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                       mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
          }
          
          void main() {
            vec2 uv = vWorldPos.xz * 0.01;
            float n1 = noise(uv * 3.0 + time * 0.02);
            float n2 = noise(uv * 6.0 - time * 0.015);
            float fog = n1 * 0.6 + n2 * 0.4;
            
            // Fade at edges
            float dist = length(vWorldPos.xz) * 0.01;
            float edgeFade = 1.0 - smoothstep(0.5, 1.0, dist);
            
            float alpha = fog * 0.04 * edgeFade;
            gl_FragColor = vec4(0.15, 0.18, 0.25, alpha);
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
    <>
      {/* Main ground with procedural PBR detail */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000, 8, 8]} />
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
            
            void main() {
              vec2 wuv = vWorldPos.xz;
              // Multi-scale surface detail
              float n1 = noise(wuv * 0.02) * 0.5 + noise(wuv * 0.08) * 0.3 + noise(wuv * 0.4) * 0.2;
              float micro = noise(wuv * 2.0) * 0.1;
              
              // Dark earth base with subtle variation
              float b = ${b.toFixed(3)};
              vec3 darkBase = vec3(0.015 * b, 0.025 * b, 0.015 * b);
              vec3 lighter = vec3(0.035 * b, 0.055 * b, 0.03 * b);
              vec3 color = mix(darkBase, lighter, n1);
              color += micro * vec3(0.01, 0.015, 0.008);
              
              // Wet specular reflection from moonlight
              float fresnel = pow(1.0 - max(vViewDir.y, 0.0), 4.0);
              color += vec3(0.008, 0.012, 0.02) * fresnel * 0.5;
              
              // Distance fade to darker
              float dist = length(wuv) * 0.001;
              color *= 1.0 - smoothstep(0.3, 1.0, dist) * 0.6;
              
              gl_FragColor = vec4(color, 1.0);
            }
          `}
        />
      </mesh>
      {/* Near-field circle with better detail */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[120, 64]} />
        <meshStandardMaterial
          color={new THREE.Color(0.04 * b, 0.065 * b, 0.035 * b)}
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>
      {/* Contact shadow circle under launch area */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[40, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.15} />
      </mesh>
    </>
  );
}

// --- Concrete / urban ground ---
function ConcreteGround({ brightness }: { brightness: number }) {
  const b = brightness * 0.5;
  return (
    <>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4000, 4000]} />
        <meshStandardMaterial
          color={new THREE.Color(0.06 * b, 0.06 * b, 0.065 * b)}
          roughness={0.95}
          metalness={0.1}
        />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[150, 64]} />
        <meshStandardMaterial
          color={new THREE.Color(0.08 * b, 0.08 * b, 0.085 * b)}
          roughness={0.9}
          metalness={0.15}
        />
      </mesh>
    </>
  );
}

// ═══ ADAPTIVE EXPOSURE CONTROLLER — Blender Cycles auto-exposure ═══
// Adjusts gl.toneMappingExposure in real-time based on active explosions
function AdaptiveExposureController() {
  const exposureRef = useRef(createExposureController());
  const { gl } = useThree();

  useFrame((_, delta) => {
    const state = exposureRef.current;
    // Count active bright effects as luminance proxy
    const { timelineItems, currentTime } = useProjectStore.getState();
    let luminance = 0;
    for (const item of timelineItems) {
      const elapsed = currentTime - item.startTime;
      if (elapsed >= 0 && elapsed < 0.5) {
        luminance += 3.0; // Each fresh burst adds luminance
      } else if (elapsed >= 0.5 && elapsed < 2.0) {
        luminance += 0.5;
      }
    }

    if (luminance > 2 && delta < 0.1) {
      flashEvent(state, Math.min(luminance * 0.15, 0.8));
    }

    const exposure = updateExposure(state, luminance, delta);
    gl.toneMappingExposure = exposure;
  });

  return null;
}

// ═══ GLOBAL ILLUMINATION — Hemisphere light probes from explosions ═══
// Fake GI: each explosion registers a color probe that bounces light onto the scene
function GlobalIlluminationController() {
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
}


// Renders reactive reflection plane that flashes with explosions
function GroundReflections() {
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
      <planeGeometry args={[400, 400]} />
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
            float dist = length(vWorldPos.xz) / 200.0;
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
}

function StageGround({ satelliteTexture }: { satelliteTexture: string | null }) {
  const sc = useSceneStore(st => st.settings);

  const renderGround = () => {
    switch (sc.groundStyle) {
      case 'flat-black':
        return (
          <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[4000, 4000]} />
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
            fadeDistance={350}
            infiniteGrid
          />
          <Grid
            position={[0, 0.015, 0]}
            args={[1000, 1000]}
            cellSize={50}
            cellThickness={0.6}
            cellColor="#1a1a2e"
            sectionSize={100}
            sectionThickness={0.8}
            sectionColor="#22223a"
            fadeDistance={600}
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
      const baseDist = 300 + layer * 120;
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
  const s = useSceneStore(st => st.settings);
  const shadowSize = SHADOW_MAP_SIZES[s.shadowQuality] || 4096;

  return (
    <>
      <ambientLight intensity={s.ambientIntensity} color="#4a6080" />
      <directionalLight
        position={[200, 350, -300]}
        intensity={s.moonIntensity}
        color={s.moonColor}
        castShadow={s.shadowsEnabled}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-far={600}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-bias={-0.00003}
        shadow-normalBias={0.02}
      />
      <hemisphereLight args={['#1a2850', '#0a1208', 0.15]} />
      {/* Subtle backfill for depth separation */}
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
  return <Stars radius={450} depth={200} count={Math.round(10000 * density)} factor={5} saturation={0.2} fade speed={0.03} />;
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
      positions[i * 3] = (Math.random() - 0.5) * 300;
      positions[i * 3 + 1] = Math.random() * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 300;
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
        arr[i * 3 + 1] = 80 + Math.random() * 20;
        arr[i * 3] = (Math.random() - 0.5) * 300;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 300;
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
  const introStartPos = useRef(new THREE.Vector3(0, 250, 0.01));
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
          250 - eased * 20, // very gentle descent during hold
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
        const sweepStartPos = new THREE.Vector3(0, 230, 3);
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
      maxDistance={2000}
      enablePan
    />
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
  const cursorStyle = editorMode !== 'select' ? 'crosshair' : 'default';
  const [activePreset, setActivePreset] = useState('free');
  const [freeLook, setFreeLook] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const preset = CAMERA_PRESETS.find((p) => p.id === activePreset) || CAMERA_PRESETS[0];
  const perfStatsRef = useRef<PerfStats>({ fps: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0 });
  const droneCount = droneFormations.length > 0 ? droneFormations[0].droneCount : 0;
  const [satelliteTexture, setSatelliteTexture] = useState<string | null>(null);
  const [downloadingScenery, setDownloadingScenery] = useState(false);

  // Track fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

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
        shadows
        gl={{
          antialias: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: 'high-performance',
          alpha: false,
          stencil: false,
          logarithmicDepthBuffer: true,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault position={preset.position} fov={50} near={0.3} far={6000} />
        <CameraController targetPosition={[...preset.position]} targetLookAt={[...preset.target]} freeLook={freeLook} />

        <SceneLighting />
        <AdaptiveExposureController />
        <GlobalIlluminationController />
        <GroundReflections />

        <SkyGradient />
        <Moon />
        <SceneStars />
        <AtmosphericParticles />
        <SceneFog />
        <WeatherEffects />

        <StageGround satelliteTexture={satelliteTexture} />
        {/* LaunchSites removed — user creates positions via toolbar */}
        <PositionPins />
        <PyroLaunchAngles />
        <Rack3DView />
        <TrajectoryPaths />
        <DroneChoreography />
        <BoidsVisualizer />
        <CollisionAvoidanceOverlay config={DEFAULT_AVOIDANCE} />
        <TimelineEffects />
        <LiveSFXEffects />
        <AudioSpectrumVisualizer />
        {/* GeofenceVisual removed — only shown when geofence explicitly configured */}
        <PlaybackClock />
        <CameraAnimator />
        <CameraPathPreview />
        <PostProcessing />
        <BoxSelectR3F />
        <PerfCollector statsRef={perfStatsRef} />
      </Canvas>
      </WebGLErrorBoundary>

      {/* Camera presets & controls */}
      <div className="absolute top-3 left-3 flex items-center gap-1 flex-wrap">
        {/* Free look toggle */}
        <button
          onClick={() => setFreeLook(!freeLook)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold transition-all border backdrop-blur-md",
            freeLook
              ? "bg-warning/20 text-warning border-warning/30 shadow-lg shadow-warning/10"
              : "bg-card/80 text-muted-foreground border-border/20 hover:text-foreground hover:bg-card/90"
          )}
          title="Free Look — camera stays where you leave it"
        >
          <ScanEye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Look</span>
        </button>

        {CAMERA_PRESETS.map(({ id, label, icon: Icon }) => (
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
        ))}

        {/* Download satellite scenery */}
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

        {/* Fullscreen toggle */}
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
      </div>

      {/* Fullscreen floating edit menu */}
      {isFullscreen && <FullscreenEditMenu />}

      <PerformanceHUD statsRef={perfStatsRef} droneCount={droneCount} />
      <ViewportTerminal />
      <SelectionStatusBar />
      <AlignmentTools />

      <div className="absolute bottom-3 right-3 text-[9px] font-mono-code text-muted-foreground/60 bg-card/70 backdrop-blur-md px-3 py-2 rounded-xl border border-border/15 space-y-0.5">
        <div className="text-[8px] text-muted-foreground/40 tracking-wider font-display">FX KONTROL v2.0 · Minas FX</div>
        <div>Orbit: LMB · Pan: MMB · Zoom: Scroll</div>
        <div>Box: Alt+Drag · Multi: Shift+Click · Edit: Dbl-Click</div>
        <div>{freeLook ? '🔓 Free Look ON' : '🔒 Preset Lock'}</div>
      </div>
    </div>
  );
}
